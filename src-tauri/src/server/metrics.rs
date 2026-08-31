use std::io;
use std::time::{Duration, Instant};

use crate::server::error::ServerError;

#[derive(Debug, Clone, serde::Serialize)]
pub struct MetricSample {
    pub memory_mb: f64,
    pub cpu_percent: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemInfo {
    pub java_version: String,
    pub os: String,
    pub os_arch: String,
    pub processors: u32,
}

pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        java_version: java_version(),
        os: std::env::consts::OS.to_string(),
        os_arch: std::env::consts::ARCH.to_string(),
        processors: num_cpus(),
    }
}

pub fn sample_process(pid: u32) -> Result<MetricSample, ServerError> {
    let cpu1 = process_cpu_time(pid).map_err(|e| ServerError::Io(e.to_string()))?;
    let start = Instant::now();
    std::thread::sleep(Duration::from_millis(200));
    let cpu2 = process_cpu_time(pid).map_err(|e| ServerError::Io(e.to_string()))?;
    let wall = start.elapsed().as_secs_f64();

    let mem_kb = process_memory_kb(pid).map_err(|e| ServerError::Io(e.to_string()))?;
    Ok(MetricSample {
        memory_mb: mem_kb as f64 / 1024.0,
        cpu_percent: if wall > 0.0 {
            ((cpu2.saturating_sub(cpu1)) as f64 / wall) * 100.0
        } else {
            0.0
        },
    })
}

#[cfg(target_os = "windows")]
fn process_cpu_time(pid: u32) -> io::Result<u64> {
    use std::process::Command;

    // Use PowerShell to get process CPU time in seconds (double), return as ms.
    let out = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!(
                "(Get-Process -Id {pid} -ErrorAction SilentlyContinue).CPU * 1000"
            ),
        ])
        .output()?;
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    text.parse::<f64>().map(|v| v as u64).map_err(|_| {
        io::Error::new(io::ErrorKind::Other, "failed to parse process CPU time")
    })
}

#[cfg(not(target_os = "windows"))]
fn process_cpu_time(pid: u32) -> io::Result<u64> {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat"))?;
    // utime (14) + stime (15) in clock ticks after comm (field 2 may contain spaces)
    let after_comm = stat[stat.find(')').ok_or(io::Error::new(
        io::ErrorKind::Other,
        "malformed stat",
    ))? + 1..]
        .split_whitespace()
        .collect::<Vec<_>>();
    let utime: u64 = after_comm
        .get(11)
        .ok_or(io::Error::new(io::ErrorKind::Other, "short stat"))?
        .parse()
        .unwrap_or(0);
    let stime: u64 = after_comm
        .get(12)
        .ok_or(io::Error::new(io::ErrorKind::Other, "short stat"))?
        .parse()
        .unwrap_or(0);
    let ticks = sysconf_ticks_per_sec();
    Ok((utime + stime) * 1000 / ticks.max(1))
}

#[cfg(not(target_os = "windows"))]
fn sysconf_ticks_per_sec() -> u64 {
    100
}

#[cfg(not(target_os = "windows"))]
fn process_memory_kb(pid: u32) -> io::Result<u64> {
    let status = std::fs::read_to_string(format!("/proc/{pid}/status"))?;
    for line in status.lines() {
        if let Some(rest) = line.strip_prefix("VmRSS:") {
            return rest
                .split_whitespace()
                .next()
                .and_then(|v| v.parse().ok())
                .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "parse VmRSS"));
        }
    }
    Err(io::Error::new(io::ErrorKind::Other, "no VmRSS found"))
}

#[cfg(target_os = "windows")]
fn process_memory_kb(pid: u32) -> io::Result<u64> {
    use std::process::Command;

    let out = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!(
                "(Get-Process -Id {pid} -ErrorAction SilentlyContinue).WorkingSet64 / 1024"
            ),
        ])
        .output()?;
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    text.parse::<f64>().map(|v| v as u64).map_err(|_| {
        io::Error::new(io::ErrorKind::Other, "failed to parse process memory")
    })
}

#[cfg(target_os = "linux")]
fn java_version() -> String {
    match std::process::Command::new("java").arg("-version").output() {
        Ok(out) => String::from_utf8_lossy(&out.stderr)
            .lines()
            .next()
            .unwrap_or("Unknown")
            .trim()
            .to_string(),
        Err(_) => "java not found".to_string(),
    }
}

#[cfg(not(target_os = "linux"))]
fn java_version() -> String {
    match std::process::Command::new("java").arg("-version").output() {
        Ok(out) => {
            let stderr = out.stderr;
            if stderr.is_empty() {
                String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .unwrap_or("Unknown")
                    .trim()
                    .to_string()
            } else {
                String::from_utf8_lossy(&stderr)
                    .lines()
                    .next()
                    .unwrap_or("Unknown")
                    .trim()
                    .to_string()
            }
        }
        Err(_) => "java not found".to_string(),
    }
}

fn num_cpus() -> u32 {
    std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(1)
}

