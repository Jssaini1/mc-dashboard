// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod server;
mod setup;

use std::sync::Mutex;

use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

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
            server::commands::list_players,
            server::commands::get_server_info,
        ])
        .setup(|app| {
            let show = MenuItemBuilder::with_id("show", "Show Dashboard").build(app)?;
            let start = MenuItemBuilder::with_id("start", "Start Server").build(app)?;
            let stop = MenuItemBuilder::with_id("stop", "Stop Server").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show, &start, &stop, &quit])
                .build()?;
            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("MC Dashboard")
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .build(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "start" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("tray-action", "start");
                    }
                }
                "stop" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("tray-action", "stop");
                    }
                }
                "quit" => {
                    let state = app.state::<Mutex<server::manager::ServerManager>>();
                    if let Ok(mut mgr) = state.lock() {
                        let _ = mgr.stop();
                    };
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().ok();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<Mutex<server::manager::ServerManager>>();
                if let Ok(mut mgr) = state.lock() {
                    let _ = mgr.stop();
                };
            }
        });
}
