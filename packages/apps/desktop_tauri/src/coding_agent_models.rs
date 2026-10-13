//! The models of a coding agent: runs the command line that prints them, and gives what it printed.
//!
//! The web frontend knows which command line prints the models of each coding agent, for example `codex debug models`,
//! and how to read the output. This file does only what the web frontend cannot do: it runs the command line on this
//! computer. The call goes through the login shell, so the commands that the developer installed are found.

use crate::topic_clusters::AgentShell;
use std::process::Stdio;
use std::time::Duration;

/// How long the call waits for the command line, in seconds.
const MODELS_TIMEOUT: u64 = 15;

/// Runs `executable` with `arguments` in `shell`, and gives what it printed on its standard output.
///
/// The error is the first line that the command printed on its standard error output, or the reason why it did not run.
async fn run(shell: &AgentShell, executable: &str, arguments: &[String], timeout: u64) -> Result<String, String> {
    let mut command = shell.command("exec \"$0\" \"$@\"", &[]);
    command.arg(executable).args(arguments);
    command.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let child = command.spawn().map_err(|error| format!("{executable} : {error}"))?;
    let output = tokio::time::timeout(Duration::from_secs(timeout), child.wait_with_output())
        .await
        .map_err(|_| format!("{executable} : no answer in {timeout} s"))?
        .map_err(|error| format!("{executable} : {error}"))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if error.is_empty() { format!("{executable} failed ({})", output.status) } else { format!("{executable} : {error}") })
}

/// Runs `executable` with `arguments` and gives its standard output: the list of the models of a coding agent.
#[tauri::command]
pub async fn coding_agent_models_run(executable: String, arguments: Vec<String>) -> Result<String, String> {
    run(&AgentShell::login(), &executable, &arguments, MODELS_TIMEOUT).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// A folder with fake commands, and a shell that sees only this folder and the system commands.
    struct FakeCommands {
        folder: PathBuf,
        shell: AgentShell,
    }

    impl FakeCommands {
        /// Makes a folder with one script for each pair `(command, script)`. A command without a script does not exist.
        fn new(name: &str, scripts: &[(&str, &str)]) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun_coding_agent_models_{name}_{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(&folder).unwrap();
            for (command, script) in scripts {
                let path = folder.join(command);
                std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
                }
            }
            let path = format!("{}:/usr/bin:/bin", folder.display());
            FakeCommands { folder, shell: AgentShell { shell: "/bin/sh".into(), flag: "-c", path: Some(path) } }
        }
    }

    impl Drop for FakeCommands {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.folder);
        }
    }

    #[tokio::test]
    async fn gives_the_standard_output_of_the_command_with_its_arguments() {
        let fake = FakeCommands::new("output", &[("codex", "printf '%s|' \"$@\"")]);
        let arguments = vec!["debug".to_string(), "models".to_string()];
        assert_eq!(run(&fake.shell, "codex", &arguments, 20).await, Ok("debug|models|".to_string()));
    }

    #[tokio::test]
    async fn gives_the_standard_error_output_when_the_command_fails() {
        let fake = FakeCommands::new("failure", &[("codex", "echo 'not signed in' >&2\nexit 3")]);
        assert_eq!(run(&fake.shell, "codex", &[], 20).await, Err("codex : not signed in".to_string()));
    }

    #[tokio::test]
    async fn gives_an_error_when_the_command_does_not_exist() {
        let fake = FakeCommands::new("missing", &[]);
        let answer = run(&fake.shell, "codex", &[], 20).await;
        assert!(matches!(&answer, Err(text) if text.starts_with("codex :")), "{answer:?}");
    }

    #[tokio::test]
    async fn gives_an_error_when_the_command_does_not_answer_in_time() {
        let fake = FakeCommands::new("slow", &[("codex", "sleep 5")]);
        assert_eq!(run(&fake.shell, "codex", &[], 1).await, Err("codex : no answer in 1 s".to_string()));
    }
}
