//! The program `ngrok` that an earlier Heidrun left running. A hard stop of Heidrun (Ctrl+C on `pnpm dev`, a restart of
//! `tauri dev`, a crash) does not kill `ngrok`, and the leftover program keeps the fixed address of the account, so the
//! next tunnel fails with `ERR_NGROK_334` (issue 583). Heidrun records the process id of each `ngrok` that it starts in a
//! file, and kills only a recorded process that is still an `ngrok`.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// The process id of the first process of the system. A process whose parent ended gets this parent.
const ORPHAN_PARENT: u32 = 1;

/// How long a killed `ngrok` may take to end.
const END_WAIT: Duration = Duration::from_secs(3);

/// The file that holds the process id of the last `ngrok` that Heidrun started.
pub struct TunnelRecord {
    /// The path of the file.
    path: PathBuf,
}

impl TunnelRecord {
    /// The record in the file `path`.
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Writes the process id of the `ngrok` that Heidrun just started.
    pub fn save(&self, process_id: u32) {
        if let Some(folder) = self.path.parent() {
            let _ = std::fs::create_dir_all(folder);
        }
        let _ = std::fs::write(&self.path, process_id.to_string());
    }

    /// Removes the file, after Heidrun killed its `ngrok`.
    pub fn clear(&self) {
        let _ = std::fs::remove_file(&self.path);
    }

    /// At the start of a tunnel: kills the recorded `ngrok` when its Heidrun ended, so its parent is now the first process
    /// of the system. An `ngrok` whose Heidrun still runs is not killed. True when a program was killed.
    pub fn kill_leftover(&self) -> bool {
        self.kill_if(|parent_id| parent_id == ORPHAN_PARENT)
    }

    /// For the button "Stop the old ngrok": kills the recorded `ngrok`, whatever its parent, unless it is `own_process_id`,
    /// the `ngrok` of this Heidrun. True when a program was killed. False when the other `ngrok` is not a recorded one.
    pub fn kill_recorded(&self, own_process_id: Option<u32>) -> bool {
        let Some(process_id) = self.read() else {
            return false;
        };
        if own_process_id == Some(process_id) {
            return false;
        }
        self.kill_if(|_| true)
    }

    fn read(&self) -> Option<u32> {
        std::fs::read_to_string(&self.path).ok()?.trim().parse().ok()
    }

    fn kill_if(&self, is_parent_accepted: impl Fn(u32) -> bool) -> bool {
        let Some(process_id) = self.read() else {
            return false;
        };
        let Some((parent_id, command)) = process_info(process_id) else {
            self.clear();
            return false;
        };
        if !is_ngrok(&command) || !is_parent_accepted(parent_id) {
            return false;
        }
        let is_killed = kill_and_wait(process_id);
        if is_killed {
            self.clear();
        }
        is_killed
    }
}

/// The parent process id and the command of the process `process_id`, or None when no such process runs.
fn process_info(process_id: u32) -> Option<(u32, String)> {
    let output = Command::new("ps")
        .args(["-o", "ppid=,comm=", "-p", &process_id.to_string()])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next()?.trim();
    let (parent_id, command) = line.split_once(char::is_whitespace)?;
    Some((parent_id.parse().ok()?, command.trim().to_string()))
}

/// True when the command is the program `ngrok`, with or without its folder.
fn is_ngrok(command: &str) -> bool {
    Path::new(command).file_name().is_some_and(|name| name == "ngrok")
}

/// Asks the process to end, and waits until it has ended. True when it has ended.
fn kill_and_wait(process_id: u32) -> bool {
    let is_sent = Command::new("kill")
        .arg(process_id.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success());
    if !is_sent {
        return false;
    }
    let start = Instant::now();
    while start.elapsed() < END_WAIT {
        if process_info(process_id).is_none() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_leftover_tunnel_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    /// A fake `ngrok`: a symbolic link named `ngrok` to the program `sleep`, so that `ps` shows the command `ngrok`. A copy
    /// of `sleep` does not work: macOS kills a copy of a program of the system.
    fn fake_ngrok(folder: &Path) -> PathBuf {
        let program = folder.join("ngrok");
        std::os::unix::fs::symlink("/bin/sleep", &program).unwrap();
        program
    }

    /// Starts `program` through a shell that ends at once, so the program loses its parent, like the `ngrok` of a Heidrun
    /// that was stopped hard. Returns its process id.
    fn start_orphan(program: &Path) -> u32 {
        let output = Command::new("/bin/sh")
            .arg("-c")
            .arg(format!("'{}' 600 >/dev/null 2>&1 & echo $!", program.display()))
            .output()
            .unwrap();
        let process_id = String::from_utf8_lossy(&output.stdout).trim().parse().unwrap();
        let start = Instant::now();
        while start.elapsed() < END_WAIT && process_info(process_id).map(|(parent_id, _)| parent_id) != Some(ORPHAN_PARENT) {
            std::thread::sleep(Duration::from_millis(20));
        }
        process_id
    }

    #[test]
    fn a_recorded_ngrok_with_no_parent_is_killed() {
        let folder = temporary_folder("orphan");
        let process_id = start_orphan(&fake_ngrok(&folder));
        let record = TunnelRecord::new(folder.join("ngrok.pid"));
        record.save(process_id);
        assert_eq!(record.kill_leftover(), true);
        assert_eq!(process_info(process_id), None);
        assert_eq!(folder.join("ngrok.pid").exists(), false);
    }

    #[test]
    fn a_recorded_ngrok_whose_heidrun_still_runs_is_not_killed_at_the_start() {
        let folder = temporary_folder("parent");
        let mut child = Command::new(fake_ngrok(&folder)).arg("600").spawn().unwrap();
        let record = TunnelRecord::new(folder.join("ngrok.pid"));
        record.save(child.id());
        assert_eq!(record.kill_leftover(), false);
        assert_eq!(process_info(child.id()).is_some(), true);
        child.kill().unwrap();
        child.wait().unwrap();
    }

    #[test]
    fn a_recorded_process_that_is_not_ngrok_is_never_killed() {
        let folder = temporary_folder("not_ngrok");
        let process_id = start_orphan(Path::new("/bin/sleep"));
        let record = TunnelRecord::new(folder.join("ngrok.pid"));
        record.save(process_id);
        assert_eq!(record.kill_leftover(), false);
        assert_eq!(record.kill_recorded(None), false);
        assert_eq!(process_info(process_id).is_some(), true);
        kill_and_wait(process_id);
    }

    #[test]
    fn the_button_kills_a_recorded_ngrok_whose_heidrun_still_runs() {
        let folder = temporary_folder("button");
        let mut child = Command::new(fake_ngrok(&folder)).arg("600").spawn().unwrap();
        let process_id = child.id();
        // The parent reaps the ended program, like the other Heidrun does.
        let parent = std::thread::spawn(move || child.wait());
        let record = TunnelRecord::new(folder.join("ngrok.pid"));
        record.save(process_id);
        assert_eq!(record.kill_recorded(None), true);
        parent.join().unwrap().unwrap();
    }

    #[test]
    fn the_button_never_kills_the_ngrok_of_this_heidrun() {
        let folder = temporary_folder("own");
        let mut child = Command::new(fake_ngrok(&folder)).arg("600").spawn().unwrap();
        let record = TunnelRecord::new(folder.join("ngrok.pid"));
        record.save(child.id());
        assert_eq!(record.kill_recorded(Some(child.id())), false);
        assert_eq!(process_info(child.id()).is_some(), true);
        child.kill().unwrap();
        child.wait().unwrap();
    }

    #[test]
    fn nothing_is_killed_with_no_record_or_with_an_ended_process() {
        let folder = temporary_folder("empty");
        let record = TunnelRecord::new(folder.join("ngrok.pid"));
        assert_eq!(record.kill_leftover(), false);
        assert_eq!(record.kill_recorded(None), false);
        let mut child = Command::new("/usr/bin/true").spawn().unwrap();
        child.wait().unwrap();
        record.save(child.id());
        assert_eq!(record.kill_leftover(), false);
        assert_eq!(folder.join("ngrok.pid").exists(), false);
    }

    #[test]
    fn the_command_ngrok_is_known_with_or_without_its_folder() {
        assert_eq!(is_ngrok("/opt/homebrew/bin/ngrok"), true);
        assert_eq!(is_ngrok("ngrok"), true);
        assert_eq!(is_ngrok("/bin/sleep"), false);
        assert_eq!(is_ngrok("/tmp/ngrok_hidden"), false);
    }
}
