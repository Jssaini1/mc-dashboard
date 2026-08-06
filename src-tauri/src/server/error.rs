use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ServerError {
    AlreadyRunning,
    NotRunning,
    JavaNotFound(String),
    ServerDirMissing(String),
    JarMissing(String),
    InvalidMemory { min: u64, max: u64 },
    SpawnFailed(String),
    WriteFailed(String),
    Io(String),
}

impl fmt::Display for ServerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ServerError::AlreadyRunning => write!(f, "Server is already running"),
            ServerError::NotRunning => write!(f, "Server is not running"),
            ServerError::JavaNotFound(p) => write!(f, "Java executable not found at {p}"),
            ServerError::ServerDirMissing(p) => write!(f, "Server directory not found at {p}"),
            ServerError::JarMissing(p) => write!(f, "Server jar not found at {p}"),
            ServerError::InvalidMemory { min, max } => {
                write!(f, "Invalid memory settings (min {min} MB, max {max} MB)")
            }
            ServerError::SpawnFailed(e) => write!(f, "Failed to start server: {e}"),
            ServerError::WriteFailed(e) => write!(f, "Failed to write to server console: {e}"),
            ServerError::Io(e) => write!(f, "I/O error: {e}"),
        }
    }
}

impl std::error::Error for ServerError {}
