//! The shell that starts a coding agent tool, and the PATH that it sees.

use std::process::Stdio;
use tokio::process::Command;

/// The shell that starts a coding agent tool, and the PATH that the tool sees.
pub struct AgentShell {
    /// The shell program.
    pub shell: String,
    /// The flag that gives the script to the shell: `-lc` for the login shell, `-c` for a plain shell.
    pub flag: &'static str,
    /// The value of the PATH of the command, or `None` to keep the PATH that the shell makes.
    pub path: Option<String>,
}

/// The shell that runs a tool through the login: the shell of the user when it is a POSIX shell, `/bin/zsh` otherwise.
/// It needs a POSIX shell: fish and friends fall back to zsh (login PATH too).
pub fn login_shell() -> String {
    let user_shell = std::env::var("SHELL").unwrap_or_default();
    if user_shell.ends_with("/zsh") || user_shell.ends_with("/bash") || user_shell.ends_with("/sh") {
        user_shell
    } else {
        "/bin/zsh".into()
    }
}

impl AgentShell {
    /// The login shell of the developer: the commands that the developer installed are found, as in a terminal. The
    /// desktop application uses it, because an application that starts from the Finder does not have the PATH of a terminal.
    pub fn login() -> Self {
        AgentShell { shell: login_shell(), flag: "-lc", path: None }
    }

    /// A plain shell that keeps the PATH of the program that starts it. The command line uses it, because a terminal
    /// already gives the right PATH, and the files of the login shell must not print anything in the answer.
    pub fn plain() -> Self {
        AgentShell { shell: "/bin/sh".into(), flag: "-c", path: None }
    }

    /// A command that runs the script `script` with the arguments `args` in this shell.
    pub fn command(&self, script: &str, args: &[&str]) -> Command {
        let mut command = Command::new(&self.shell);
        command.arg(self.flag).arg(script).args(args).kill_on_drop(true).env("NO_COLOR", "1");
        if let Some(path) = &self.path {
            command.env("PATH", path);
        }
        command
    }

    /// True when the command `name` exists for this shell.
    pub(crate) async fn has(&self, name: &str) -> bool {
        let mut command = self.command("command -v \"$0\"", &[name]);
        command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        matches!(command.status().await, Ok(status) if status.success())
    }
}
