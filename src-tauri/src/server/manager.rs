use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::server::error::ServerError;
use crate::server::process::{OutputEvent, ServerProcess};

const STOP_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerState {
    Stopped,
    Starting,
    Online,
    Stopping,
}

impl ServerState {
    pub fn label(&self) -> &'static str {
        match self {
            ServerState::Stopped => "stopped",
            ServerState::Starting => "starting",
            ServerState::Online => "online",
            ServerState::Stopping => "stopping",
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ServerConfig {
    pub server_dir: String,
    pub server_jar: String,
    pub java_path: String,
    pub min_memory_mb: u64,
    pub max_memory_mb: u64,
}

impl ServerConfig {
    pub fn to_command(&self) -> Result<Command, ServerError> {
        if self.java_path.is_empty() || !Path::new(&self.java_path).is_file() {
            return Err(ServerError::JavaNotFound(self.java_path.clone()));
        }
        if self.server_dir.is_empty() || !Path::new(&self.server_dir).is_dir() {
            return Err(ServerError::ServerDirMissing(self.server_dir.clone()));
        }
        let jar_path = Path::new(&self.server_dir).join(&self.server_jar);
        if !jar_path.is_file() {
            return Err(ServerError::JarMissing(jar_path.display().to_string()));
        }
        if self.min_memory_mb < 512 || self.max_memory_mb < self.min_memory_mb {
            return Err(ServerError::InvalidMemory {
                min: self.min_memory_mb,
                max: self.max_memory_mb,
            });
        }

        let mut cmd = Command::new(&self.java_path);
        cmd.arg(format!("-Xms{}M", self.min_memory_mb))
            .arg(format!("-Xmx{}M", self.max_memory_mb))
            .arg("-jar")
            .arg(&self.server_jar)
            .arg("nogui")
            .current_dir(&self.server_dir);
        Ok(cmd)
    }
}

pub struct ServerManager {
    state: Arc<Mutex<ServerState>>,
    process: Option<ServerProcess>,
}

impl ServerManager {
    pub fn new() -> Self {
        ServerManager {
            state: Arc::new(Mutex::new(ServerState::Stopped)),
            process: None,
        }
    }

    pub fn state(&self) -> ServerState {
        *self.state.lock().expect("state lock poisoned")
    }

    pub fn start(
        &mut self,
        config: &ServerConfig,
        on_line: Arc<dyn Fn(String) + Send + Sync>,
    ) -> Result<(), ServerError> {
        let cmd = config.to_command()?;
        self.start_command(cmd, on_line)
    }

    fn start_command(
        &mut self,
        cmd: Command,
        on_line: Arc<dyn Fn(String) + Send + Sync>,
    ) -> Result<(), ServerError> {
        if let Some(proc) = &mut self.process {
            if proc.is_alive().map_err(|e| ServerError::Io(e.to_string()))? {
                return Err(ServerError::AlreadyRunning);
            }
        }

        let state_ref = Arc::clone(&self.state);
        let on_line_ref = Arc::clone(&on_line);
        let on_output = move |ev: OutputEvent| match ev {
            OutputEvent::Line(line) => {
                on_line_ref(line.clone());
                let mut st = state_ref.lock().expect("state lock poisoned");
                if *st == ServerState::Starting && is_done_line(&line) {
                    *st = ServerState::Online;
                }
            }
            OutputEvent::Eof => {
                let mut st = state_ref.lock().expect("state lock poisoned");
                if *st != ServerState::Stopped {
                    *st = ServerState::Stopped;
                }
            }
        };

        let proc = ServerProcess::spawn(cmd, on_output)
            .map_err(|e| ServerError::SpawnFailed(e.to_string()))?;
        *self.state.lock().expect("state lock poisoned") = ServerState::Starting;
        self.process = Some(proc);
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), ServerError> {
        {
            let Some(proc) = &mut self.process else {
                return Err(ServerError::NotRunning);
            };
            if !proc.is_alive().map_err(|e| ServerError::Io(e.to_string()))? {
                self.process = None;
                return Ok(());
            }

            *self.state.lock().expect("state lock poisoned") = ServerState::Stopping;
            proc.send_command("stop")
                .map_err(|e| ServerError::WriteFailed(e.to_string()))?;

            let deadline = Instant::now() + STOP_TIMEOUT;
            loop {
                match proc.is_alive() {
                    Ok(true) if Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(200));
                    }
                    Ok(true) => {
                        proc.kill().map_err(|e| ServerError::Io(e.to_string()))?;
                        break;
                    }
                    Ok(false) => break,
                    Err(e) => return Err(ServerError::Io(e.to_string())),
                }
            }
        }

        self.process = None;
        *self.state.lock().expect("state lock poisoned") = ServerState::Stopped;
        Ok(())
    }

    pub fn restart(
        &mut self,
        config: &ServerConfig,
        on_line: Arc<dyn Fn(String) + Send + Sync>,
    ) -> Result<(), ServerError> {
        let _ = self.stop();
        self.start(config, on_line)
    }

    pub fn send_command(&mut self, line: &str) -> Result<(), ServerError> {
        match &mut self.process {
            Some(proc) => proc
                .send_command(line)
                .map_err(|e| ServerError::WriteFailed(e.to_string())),
            None => Err(ServerError::NotRunning),
        }
    }
}

fn is_done_line(line: &str) -> bool {
    line.contains("Done (") && line.contains("! For help")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn fake_server_cmd() -> Command {
        let mut cmd = Command::new("powershell.exe");
        cmd.arg("-NoProfile")
            .arg("-Command")
            .arg("Write-Output 'Starting minecraft server version 1.21'; Write-Output 'Done (1.000s)! For help, type \"help\"'; while ($true) { $l = [Console]::In.ReadLine(); if ($null -eq $l) { break }; if ($l -eq 'stop') { Write-Output 'Stopping server'; break } }");
        cmd
    }

    fn collector() -> (mpsc::Receiver<String>, Arc<dyn Fn(String) + Send + Sync>) {
        let (tx, rx) = mpsc::channel();
        let cb: Arc<dyn Fn(String) + Send + Sync> = Arc::new(move |line| {
            let _ = tx.send(line);
        });
        (rx, cb)
    }

    fn wait_until_state(mgr: &ServerManager, expected: ServerState, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if mgr.state() == expected {
                return true;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        mgr.state() == expected
    }

    #[test]
    fn reaches_online_then_stops() {
        let mut mgr = ServerManager::new();
        assert_eq!(mgr.state(), ServerState::Stopped);
        let (_rx, cb) = collector();
        mgr.start_command(fake_server_cmd(), cb).expect("start");

        assert!(wait_until_state(&mgr, ServerState::Online, Duration::from_secs(10)));
        mgr.send_command("say hello").expect("send command");
        mgr.stop().expect("stop");
        assert_eq!(mgr.state(), ServerState::Stopped);
    }

    #[test]
    fn errors_when_not_running() {
        let mut mgr = ServerManager::new();
        assert!(matches!(mgr.send_command("list"), Err(ServerError::NotRunning)));
        assert!(matches!(mgr.stop(), Err(ServerError::NotRunning)));
    }

    #[test]
    fn rejects_double_start() {
        let mut mgr = ServerManager::new();
        let (_rx, cb) = collector();
        mgr.start_command(fake_server_cmd(), cb).expect("start");
        let (_rx2, cb2) = collector();
        let err = mgr.start_command(fake_server_cmd(), cb2).unwrap_err();
        assert!(matches!(err, ServerError::AlreadyRunning));
        mgr.stop().expect("stop");
    }

    #[test]
    fn done_line_detection() {
        assert!(is_done_line("Done (5.123s)! For help, type \"help\""));
        assert!(!is_done_line("Preparing spawn area: 10%"));
        assert!(!is_done_line("Done cleaning"));
    }
}
