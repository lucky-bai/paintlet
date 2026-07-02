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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![read_image_file, write_image_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
