//! Runs a coding agent tool with arguments, and gives what it printed.

use crate::agent_shell::AgentShell;
use std::process::Stdio;
use std::time::Duration;

/// Runs `executable` with `arguments` in `shell`, and gives what it printed on its standard output. It is how a caller
/// asks a coding agent tool for a fact, for example the list of its models, and not for an answer to a prompt.
///
/// The error is the first line that the command printed on its standard error output, or the reason why it did not run.
/// `timeout` is how long the call waits for the command, in seconds.
pub async fn run_tool(shell: &AgentShell, executable: &str, arguments: &[String], timeout: u64) -> Result<String, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake_commands::FakeCommands;

    #[tokio::test]
    async fn gives_the_standard_output_of_the_command_with_its_arguments() {
        let fake = FakeCommands::new("tool_output", &[("codex", "printf '%s|' \"$@\"")]);
        let arguments = vec!["debug".to_string(), "models".to_string()];
        assert_eq!(run_tool(&fake.shell, "codex", &arguments, 20).await, Ok("debug|models|".to_string()));
    }

    #[tokio::test]
    async fn gives_the_standard_error_output_when_the_command_fails() {
        let fake = FakeCommands::new("tool_failure", &[("codex", "echo 'not signed in' >&2\nexit 3")]);
        assert_eq!(run_tool(&fake.shell, "codex", &[], 20).await, Err("codex : not signed in".to_string()));
    }

    #[tokio::test]
    async fn gives_an_error_when_the_command_does_not_exist() {
        let fake = FakeCommands::new("tool_missing", &[]);
        let answer = run_tool(&fake.shell, "codex", &[], 20).await;
        assert!(matches!(&answer, Err(text) if text.starts_with("codex :")), "{answer:?}");
    }

    #[tokio::test]
    async fn gives_an_error_when_the_command_does_not_answer_in_time() {
        let fake = FakeCommands::new("tool_slow", &[("codex", "sleep 5")]);
        assert_eq!(run_tool(&fake.shell, "codex", &[], 1).await, Err("codex : no answer in 1 s".to_string()));
    }
}
