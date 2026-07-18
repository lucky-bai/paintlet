use tauri::ipc::Response;

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
            strip_edit_menu_system_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
