// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod server;
mod setup;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(Mutex::new(server::manager::ServerManager::new()))
        .invoke_handler(tauri::generate_handler![
            setup::accept_eula,
            setup::ensure_server_properties,
            server::commands::start_server,
            server::commands::stop_server,
            server::commands::restart_server,
            server::commands::send_console_command,
            server::commands::get_server_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
