use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, State};

use crate::server::error::ServerError;
use crate::server::manager::{PlayersResponse, ServerConfig, ServerManager};

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

#[tauri::command]
pub fn list_players(
    state: State<Mutex<ServerManager>>,
) -> Result<PlayersResponse, ServerError> {
    let mut mgr = state.lock().expect("server manager lock poisoned");
    let lines = mgr.send_and_capture("list", 10)?;
    Ok(parse_list_output(&lines))
}

#[tauri::command]
pub fn get_server_info(
    state: State<Mutex<ServerManager>>,
) -> Result<crate::server::manager::ServerInfo, ServerError> {
    let mgr = state.lock().expect("server manager lock poisoned");
    Ok(mgr.server_info(None))
}

#[tauri::command]
pub fn get_system_info() -> crate::server::metrics::SystemInfo {
    crate::server::metrics::get_system_info()
}

#[tauri::command]
pub fn get_server_metrics(
    state: State<Mutex<ServerManager>>,
) -> Result<crate::server::metrics::MetricSample, ServerError> {
    let mgr = state.lock().expect("server manager lock poisoned");
    let pid = mgr
        .server_pid()
        .ok_or(ServerError::NotRunning)?;
    crate::server::metrics::sample_process(pid)
}

pub(crate) fn parse_list_output(lines: &[String]) -> PlayersResponse {
    for line in lines {
        if let Some(idx) = line.find("players online") {
            let before = &line[..idx];
            let count: usize = before
                .split_once("are ")
                .and_then(|(_, rest)| rest.split_whitespace().next())
                .and_then(|n| n.parse().ok())
                .unwrap_or(0);
            let max: usize = line
                .find("max of ")
                .and_then(|i| {
                    let rest = &line[i + 7..];
                    rest.split_whitespace()
                        .next()
                        .and_then(|n| n.parse().ok())
                })
                .unwrap_or(0);
            let names_part = line.split(':').last().unwrap_or("");
            let names: Vec<String> = names_part
                .split(", ")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            return PlayersResponse { count, max, names };
        }
    }
    PlayersResponse {
        count: 0,
        max: 0,
        names: Vec::new(),
    }
}
