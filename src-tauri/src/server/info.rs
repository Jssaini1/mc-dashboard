use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize)]
pub struct OverviewInfo {
    pub difficulty: Option<String>,
    pub level_name: Option<String>,
    pub software: Option<String>,
    pub version: Option<String>,
    pub ip: Option<String>,
}

pub fn read_overview_info(server_dir: &str) -> OverviewInfo {
    let props = server_properties(server_dir);

    let difficulty = props.get("difficulty").cloned();
    let level_name = props.get("level-name").cloned();

    let bind_ip = props
        .get("server-ip")
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "0.0.0.0".to_string());
    let port = props
        .get("server-port")
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "25565".to_string());
    let ip = Some(format!("{bind_ip}:{port}"));

    let (version, software) = parse_latest_log(server_dir);

    OverviewInfo {
        difficulty,
        level_name,
        software,
        version,
        ip,
    }
}

fn server_properties(server_dir: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let path = Path::new(server_dir).join("server.properties");
    let Ok(contents) = std::fs::read_to_string(path) else {
        return map;
    };
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            map.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    map
}

fn parse_latest_log(server_dir: &str) -> (Option<String>, Option<String>) {
    let path = Path::new(server_dir).join("logs").join("latest.log");
    let Ok(contents) = std::fs::read_to_string(path) else {
        return (None, None);
    };
    let mut version = None;
    let mut software = None;
    for line in contents.lines() {
        if version.is_none() {
            if let Some(idx) = line.find("Starting minecraft server version ") {
                version = line[idx + "Starting minecraft server version ".len()..]
                    .split_whitespace()
                    .next()
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty());
            }
        }
        if software.is_none() {
            if let Some(idx) = line.find("This server is running ") {
                software = line[idx + "This server is running ".len()..]
                    .split(" version ")
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
            }
        }
        if version.is_some() && software.is_some() {
            break;
        }
    }
    (version, software)
}