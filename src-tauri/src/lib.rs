use tauri::ipc::Response;
use tauri::Manager;

mod save_panel;

// Open (or re-focus) the About window.
//
// About is the one dialog that's a real OS window rather than an in-app panel:
// it's the macOS convention for an About box, and it's the only one where that's
// cheap, since it reads nothing from the editor's canvas state. Created here in
// Rust rather than from JS so the window is built on demand — declaring it in
// tauri.conf.json would spin up its webview at launch and pay the memory for a
// window most sessions never open.
#[tauri::command]
fn open_about_window(app: tauri::AppHandle) -> Result<(), String> {
    // Already open: bring it forward instead of stacking a second copy.
    if let Some(win) = app.get_webview_window("about") {
        let _ = win.unminimize();
        let _ = win.show();
        return win.set_focus().map_err(|e| e.to_string());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "about",
        tauri::WebviewUrl::App("about.html".into()),
    )
    .title("About Paintlet")
    .inner_size(340.0, 300.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    hide_minimize_and_zoom(&app, "about");

    Ok(())
}

// A macOS About box shows only a close button. Building the window
// non-minimizable / non-maximizable merely greys those two out, which reads as
// "temporarily unavailable" rather than "not applicable" — so remove them.
// AppKit may only be touched on the main thread.
#[cfg(target_os = "macos")]
fn hide_minimize_and_zoom(app: &tauri::AppHandle, label: &'static str) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        use objc2_app_kit::{NSWindow, NSWindowButton};

        let Some(win) = app.get_webview_window(label) else { return };
        let Ok(ptr) = win.ns_window() else { return };
        // SAFETY: ns_window() hands back the NSWindow backing this Tauri
        // window, and we're inside run_on_main_thread — the only place AppKit
        // views may be touched.
        let ns_window: &NSWindow = unsafe { &*ptr.cast::<NSWindow>() };
        for button in [
            NSWindowButton::MiniaturizeButton,
            NSWindowButton::ZoomButton,
        ] {
            if let Some(b) = ns_window.standardWindowButton(button) {
                b.setHidden(true);
            }
        }
    });
}

// Read a file off disk and hand the raw bytes back to the webview as an
// ArrayBuffer. We go through a Rust command (rather than the fs plugin) so the
// user can open/save anywhere they pick in the native dialog without wrestling
// with fs-scope globs — std::fs has no path allowlist.
#[tauri::command]
fn read_image_file(path: String) -> Result<Response, String> {
    std::fs::read(&path)
        .map(Response::new)
        .map_err(|e| e.to_string())
}

// Write raw bytes (a PNG/JPEG the frontend encoded from the canvas) to disk.
#[tauri::command]
fn write_image_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())
}

// Show the save panel that has a real format popup — see save_panel.rs for why
// this can't come from the dialog plugin.
//
// AppKit panels are main-thread-only and runModal spins its own event loop, so
// the work is hopped to the main thread and this command blocks on a channel
// until it closes. Blocking is safe precisely because this is a *synchronous*
// command: Tauri runs those on a worker thread, never on the main thread or the
// async runtime, so nothing the panel needs is held up waiting on us.
#[tauri::command]
fn save_image_dialog(
    app: tauri::AppHandle,
    request: save_panel::SaveRequest,
) -> Result<save_panel::SaveResponse, String> {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            // On the main thread by construction, so this marker is sound.
            let mtm = objc2::MainThreadMarker::new()
                .expect("run_on_main_thread ran off the main thread");
            let _ = tx.send(save_panel::run(mtm, &request));
        })
        .map_err(|e| e.to_string())?;

        rx.recv()
            .map_err(|_| "the save panel closed unexpectedly".to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        // No AppKit, so no native format popup; the frontend falls back to the
        // plugin dialog. Paintlet only ships for macOS, but the shell still has
        // to compile elsewhere.
        let _ = (app, request);
        Ok(save_panel::SaveResponse::unsupported())
    }
}

// macOS auto-appends items to any menu titled "Edit": "Start Dictation…",
// "Emoji & Symbols", and (macOS 15.1+) "Writing Tools" / "AutoFill". The first
// two honor AppKit's NSUserDefaults switches — set them before the menu is
// built. (These are user-defaults keys, NOT Info.plist keys: putting them in
// Info.plist does nothing, which is why the earlier Info.plist approach still
// showed Dictation.) Writing Tools / AutoFill have no such switch and are
// stripped from the installed menu instead — see strip_edit_menu_system_items.
#[cfg(target_os = "macos")]
fn disable_edit_menu_auto_items() {
    use objc2_foundation::{ns_string, NSUserDefaults};
    let defaults = NSUserDefaults::standardUserDefaults();
    defaults.setBool_forKey(true, ns_string!("NSDisabledDictationMenuItem"));
    defaults.setBool_forKey(true, ns_string!("NSDisabledCharacterPaletteMenuItem"));
}

// Remove the system-injected Edit-menu items that have no defaults switch
// (Writing Tools, AutoFill). The JS side invokes this right after it installs
// the menu bar; AppKit must only be touched from the main thread.
#[tauri::command]
fn strip_edit_menu_system_items(app: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(|| {
            use objc2::MainThreadMarker;
            use objc2_app_kit::NSApplication;

            let Some(mtm) = MainThreadMarker::new() else { return };
            let nsapp = NSApplication::sharedApplication(mtm);
            let Some(main_menu) = nsapp.mainMenu() else { return };
            for i in 0..main_menu.numberOfItems() {
                let Some(item) = main_menu.itemAtIndex(i) else { continue };
                let Some(submenu) = item.submenu() else { continue };
                if submenu.title().to_string() != "Edit" {
                    continue;
                }
                // Walk backwards so removals don't shift indices still to
                // be visited. Match by title: the injected items live on
                // private selectors, so the visible title is the stable
                // hook. (Dictation/Emoji are already suppressed via the
                // defaults keys; matching them here is just a backstop.)
                for j in (0..submenu.numberOfItems()).rev() {
                    let Some(sub) = submenu.itemAtIndex(j) else { continue };
                    let title = sub.title().to_string();
                    if title.contains("Writing Tools")
                        || title.contains("AutoFill")
                        || title.contains("Start Dictation")
                        || title.contains("Emoji")
                    {
                        submenu.removeItem(&sub);
                    }
                }
                // Drop any separator the removals left dangling at the end.
                while submenu.numberOfItems() > 0 {
                    let last = submenu.itemAtIndex(submenu.numberOfItems() - 1);
                    match last {
                        Some(l) if l.isSeparatorItem() => submenu.removeItem(&l),
                        _ => break,
                    }
                }
                break;
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "macos")]
    disable_edit_menu_auto_items();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            read_image_file,
            write_image_file,
            save_image_dialog,
            strip_edit_menu_system_items,
            open_about_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
