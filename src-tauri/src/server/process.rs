use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Arc;
use std::thread;

#[derive(Debug)]
pub enum OutputEvent {
    Line(String),
    Eof,
}

pub struct ServerProcess {
    child: Child,
    stdin: ChildStdin,
}

impl ServerProcess {
    pub fn spawn(
        mut cmd: Command,
        on_output: impl Fn(OutputEvent) + Send + Sync + 'static,
    ) -> io::Result<Self> {
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().expect("stdin piped");
        let stdout = child.stdout.take().expect("stdout piped");
        let stderr = child.stderr.take().expect("stderr piped");

        let on_output: Arc<dyn Fn(OutputEvent) + Send + Sync> = Arc::new(on_output);
        spawn_reader(stdout, Arc::clone(&on_output), true);
        spawn_reader(stderr, on_output, false);

        Ok(ServerProcess { child, stdin })
    }

    pub fn send_command(&mut self, line: &str) -> io::Result<()> {
        writeln!(self.stdin, "{line}")?;
        self.stdin.flush()
    }

    pub fn kill(&mut self) -> io::Result<()> {
        self.child.kill()
    }

    pub fn is_alive(&mut self) -> io::Result<bool> {
        match self.child.try_wait()? {
            Some(_) => Ok(false),
            None => Ok(true),
        }
    }
}

impl Drop for ServerProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

fn spawn_reader<R>(reader: R, on_output: Arc<dyn Fn(OutputEvent) + Send + Sync>, emit_eof: bool)
where
    R: std::io::Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buf = BufReader::new(reader);
        let mut line = String::new();
        loop {
            line.clear();
            match buf.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim_end_matches(['\r', '\n']);
                    on_output(OutputEvent::Line(trimmed.to_string()));
                }
                Err(_) => break,
            }
        }
        if emit_eof {
            on_output(OutputEvent::Eof);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn echo_cmd() -> Command {
        #[cfg(windows)]
        {
            let mut cmd = Command::new("powershell.exe");
            cmd.arg("-NoProfile")
                .arg("-Command")
                .arg("Write-Output 'first'; Write-Output 'second'; Write-Output 'third'");
            cmd
        }
        #[cfg(not(windows))]
        {
            let mut cmd = Command::new("sh");
            cmd.arg("-c").arg("echo first; echo second; echo third");
            cmd
        }
    }

    #[test]
    fn streams_lines_and_eof() {
        let (tx, rx) = mpsc::channel();
        let on_output = move |ev: OutputEvent| {
            let _ = tx.send(ev);
        };
        let mut proc = ServerProcess::spawn(echo_cmd(), on_output).expect("spawn");

        let mut lines = Vec::new();
        let mut saw_eof = false;
        while let Ok(ev) = rx.recv_timeout(Duration::from_secs(10)) {
            match ev {
                OutputEvent::Line(l) => lines.push(l),
                OutputEvent::Eof => {
                    saw_eof = true;
                    break;
                }
            }
        }
        assert_eq!(lines, vec!["first", "second", "third"]);
        assert!(saw_eof);
        for _ in 0..50 {
            if !proc.is_alive().expect("try_wait") {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        assert!(!proc.is_alive().expect("try_wait"));
    }

    #[test]
    fn sends_command_to_stdin() {
        let (tx, rx) = mpsc::channel();
        let on_output = move |ev: OutputEvent| {
            let _ = tx.send(ev);
        };
        let mut cmd = {
            #[cfg(windows)]
            {
                let mut c = Command::new("powershell.exe");
                c.arg("-NoProfile")
                    .arg("-Command")
                    .arg("Write-Output 'START'; $line = [Console]::In.ReadLine(); Write-Output ('GOT: ' + $line)");
                c
            }
            #[cfg(not(windows))]
            {
                let mut c = Command::new("sh");
                c.arg("-c")
                    .arg("echo START; read line; echo \"GOT: $line\"");
                c
            }
        };
        let mut proc = ServerProcess::spawn(cmd, on_output).expect("spawn");

        let mut saw_start = false;
        while let Ok(ev) = rx.recv_timeout(Duration::from_secs(10)) {
            if let OutputEvent::Line(l) = ev {
                if l == "START" {
                    saw_start = true;
                    break;
                }
            }
        }
        assert!(saw_start, "expected START from child");

        proc.send_command("hello").expect("write stdin");

        let mut got = None;
        while let Ok(ev) = rx.recv_timeout(Duration::from_secs(10)) {
            if let OutputEvent::Line(l) = ev {
                if l.starts_with("GOT:") {
                    got = Some(l);
                    break;
                }
            }
        }
        assert_eq!(got.as_deref(), Some("GOT: hello"));
    }

    #[test]
    fn kill_stops_running_process() {
        let (tx, rx) = mpsc::channel();
        let on_output = move |ev: OutputEvent| {
            let _ = tx.send(ev);
        };
        let mut cmd = {
            #[cfg(windows)]
            {
                let mut c = Command::new("cmd.exe");
                c.arg("/C").arg("ping -n 1000 127.0.0.1");
                c
            }
            #[cfg(not(windows))]
            {
                let mut c = Command::new("sleep");
                c.arg("1000");
                c
            }
        };
        let mut proc = ServerProcess::spawn(cmd, on_output).expect("spawn");
        assert!(proc.is_alive().expect("try_wait"));

        proc.kill().expect("kill");
        let mut saw_eof = false;
        while let Ok(ev) = rx.recv_timeout(Duration::from_secs(10)) {
            if let OutputEvent::Eof = ev {
                saw_eof = true;
                break;
            }
        }
        assert!(saw_eof, "expected eof after kill");
    }
}
