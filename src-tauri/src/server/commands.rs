use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, State};

use crate::server::error::ServerError;
use crate::server::manager::{ServerConfig, ServerManager};

fn on_line(app: &AppHandle) -> Arc<dyn Fn(String) + Send + Sync> {
    let app = app.clone();
    Arc::new(move |line| {
        let _ = app.emit("server-log", line);
    })
}

#[tauri::command]
pub fn start_server(
    app: AppHandle,
    state: State<Mutex<ServerManager>>,
    config: ServerConfig,
) -> Result<String, ServerError> {
    let mut mgr = state.lock().expect("server manager lock poisoned");
    mgr.start(&config, on_line(&app))?;
    Ok("started".into())
}

#[tauri::command]
pub fn stop_server(state: State<Mutex<ServerManager>>) -> Result<String, ServerError> {
    let mut mgr = state.lock().expect("server manager lock poisoned");
    mgr.stop()?;
    Ok("stopped".into())
}

#[tauri::command]
pub fn restart_server(
    app: AppHandle,
    state: State<Mutex<ServerManager>>,
    config: ServerConfig,
) -> Result<String, ServerError> {
    let mut mgr = state.lock().expect("server manager lock poisoned");
    mgr.restart(&config, on_line(&app))?;
    Ok("restarting".into())
}

#[tauri::command]
pub fn send_console_command(
    state: State<Mutex<ServerManager>>,
    command: String,
) -> Result<String, ServerError> {
    let mut mgr = state.lock().expect("server manager lock poisoned");
    mgr.send_command(&command)?;
    Ok(command)
}

#[tauri::command]
pub fn get_server_state(state: State<Mutex<ServerManager>>) -> String {
    let mgr = state.lock().expect("server manager lock poisoned");
    mgr.state().label().to_string()
}
