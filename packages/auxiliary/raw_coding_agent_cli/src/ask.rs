//! Sends one prompt to a coding agent command line tool, and gives the answer.

use crate::agent_shell::AgentShell;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

/// The coding agents that can answer, the one that is tried first coming first. The name of a coding agent is also the
/// name of its command.
pub const CODING_AGENTS: [&str; 2] = ["codex", "claude"];

/// The error that `ask` gives when no coding agent is named, and neither `codex` nor `claude` is installed.
pub const NO_CODING_AGENT: &str = "no_coding_agent";

/// The answer of a coding agent.
#[derive(Debug, PartialEq)]
pub struct Answer {
    /// The coding agent that answered: `codex` or `claude`.
    pub agent: String,
    /// What the coding agent printed, without the spaces and the line breaks at its start and at its end.
    pub text: String,
}

/// The arguments that run one coding agent with the prompt on its standard input. `codex exec` refuses to run outside a
/// trusted Git repository without `--skip-git-repo-check`, so the flag is always given.
fn arguments_of(agent: &str) -> &'static [&'static str] {
    if agent == "claude" {
        &["-p"]
    } else {
        &["exec", "--skip-git-repo-check", "-"]
    }
}

/// The coding agent to run: the one that `agent` names, or the first of `CODING_AGENTS` that exists when `agent` is
/// `None`.
async fn choose(shell: &AgentShell, agent: Option<&str>) -> Result<&'static str, String> {
    let Some(name) = agent else {
        for candidate in CODING_AGENTS {
            if shell.has(candidate).await {
                return Ok(candidate);
            }
        }
        return Err(NO_CODING_AGENT.to_string());
    };
    let Some(known) = CODING_AGENTS.into_iter().find(|candidate| *candidate == name) else {
        return Err(format!("Unknown coding agent \"{name}\". Use {}.", CODING_AGENTS.join(" or ")));
    };
    if shell.has(known).await {
        Ok(known)
    } else {
        Err(format!("The command \"{known}\" is not installed or is not in the PATH."))
    }
}

/// Sends `prompt` to a coding agent and returns the answer. The prompt always goes through the standard input, never
/// through an argument, so a long prompt does not reach the size limit of the command line.
///
/// - `agent` names the coding agent to run. `None` runs the first of `CODING_AGENTS` that exists, and gives the error
///   `NO_CODING_AGENT` when none exists.
/// - `folder` is the folder where the coding agent runs. The call makes it when it does not exist. `None` keeps the folder
///   of the program. A folder that is not a workspace of the developer keeps the chat of the coding agent out of the Chats
///   sidebar section.
/// - `timeout` is how long the call waits for the answer, in seconds. `None` waits without end.
///
/// The error is the first line that the command printed on its standard error output, or the reason why it did not run.
pub async fn ask(
    shell: &AgentShell,
    agent: Option<&str>,
    prompt: &str,
    folder: Option<&Path>,
    timeout: Option<u64>,
) -> Result<Answer, String> {
    let agent = choose(shell, agent).await?;
    let mut command = shell.command("exec \"$0\" \"$@\"", &[]);
    command.arg(agent).args(arguments_of(agent));
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(folder) = folder {
        let _ = std::fs::create_dir_all(folder);
        command.current_dir(folder);
    }
    let mut child = command.spawn().map_err(|error| format!("{agent} : {error}"))?;
    let mut stdin = child.stdin.take().ok_or_else(|| format!("{agent} : no standard input"))?;
    let bytes = prompt.as_bytes().to_vec();
    // The coding agent can exit before it reads the whole prompt: the exit code tells what happened.
    let write = async move {
        let _ = stdin.write_all(&bytes).await;
        drop(stdin);
    };
    let work = async { tokio::join!(write, child.wait_with_output()) };
    let (_, output) = match timeout {
        Some(seconds) => tokio::time::timeout(Duration::from_secs(seconds), work)
            .await
            .map_err(|_| format!("{agent} : no answer in {seconds} s"))?,
        None => work.await,
    };
    let output = output.map_err(|error| format!("{agent} : {error}"))?;
    if output.status.success() {
        return Ok(Answer { agent: agent.to_string(), text: String::from_utf8_lossy(&output.stdout).trim().to_string() });
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if error.is_empty() { format!("{agent} failed ({})", output.status) } else { format!("{agent} : {error}") })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake_commands::{FakeCommands, ECHO_SCRIPT};

    #[tokio::test]
    async fn runs_codex_with_the_prompt_on_the_standard_input_when_both_exist() {
        let fake = FakeCommands::new("both", &[("codex", ECHO_SCRIPT), ("claude", "echo claude")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert_eq!(answer.agent, "codex");
        assert_eq!(answer.text, "arguments:exec --skip-git-repo-check -\nstandard input:the prompt");
    }

    #[tokio::test]
    async fn runs_claude_when_codex_does_not_exist() {
        let fake = FakeCommands::new("claude_only", &[("claude", ECHO_SCRIPT)]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert_eq!(answer.agent, "claude");
        assert_eq!(answer.text, "arguments:-p\nstandard input:the prompt");
    }

    #[tokio::test]
    async fn runs_the_coding_agent_that_the_caller_names_even_when_the_other_one_comes_first() {
        let fake = FakeCommands::new("named", &[("codex", "echo codex"), ("claude", ECHO_SCRIPT)]);
        let answer = ask(&fake.shell, Some("claude"), "the prompt", None, Some(20)).await.unwrap();
        assert_eq!(answer, Answer { agent: "claude".into(), text: "arguments:-p\nstandard input:the prompt".into() });
    }

    #[tokio::test]
    async fn gives_the_error_no_coding_agent_when_neither_exists() {
        let fake = FakeCommands::new("none", &[]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await;
        assert_eq!(answer, Err("no_coding_agent".to_string()));
    }

    #[tokio::test]
    async fn gives_a_clear_error_when_the_named_command_is_not_installed() {
        let fake = FakeCommands::new("not_installed", &[("codex", "echo codex")]);
        let answer = ask(&fake.shell, Some("claude"), "the prompt", None, Some(20)).await;
        assert_eq!(answer, Err("The command \"claude\" is not installed or is not in the PATH.".to_string()));
    }

    #[tokio::test]
    async fn gives_a_clear_error_when_the_coding_agent_is_not_known() {
        let fake = FakeCommands::new("unknown", &[("gemini", "echo gemini")]);
        let answer = ask(&fake.shell, Some("gemini"), "the prompt", None, Some(20)).await;
        assert_eq!(answer, Err("Unknown coding agent \"gemini\". Use codex or claude.".to_string()));
    }

    #[tokio::test]
    async fn gives_the_standard_error_output_when_the_coding_agent_fails() {
        let fake = FakeCommands::new("failure", &[("codex", "echo 'not signed in' >&2\nexit 3")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await;
        assert_eq!(answer, Err("codex : not signed in".to_string()));
    }

    #[tokio::test]
    async fn gives_the_exit_status_when_the_coding_agent_fails_without_a_message() {
        let fake = FakeCommands::new("silent_failure", &[("codex", "exit 3")]);
        let answer = ask(&fake.shell, None, "the prompt", None, Some(20)).await;
        assert!(matches!(&answer, Err(text) if text.starts_with("codex failed (")), "{answer:?}");
    }

    #[tokio::test]
    async fn gives_an_error_when_the_coding_agent_does_not_answer_in_time() {
        let fake = FakeCommands::new("slow", &[("codex", "sleep 5")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(1)).await;
        assert_eq!(answer, Err("codex : no answer in 1 s".to_string()));
    }

    #[tokio::test]
    async fn waits_without_end_when_the_caller_gives_no_timeout() {
        let fake = FakeCommands::new("no_timeout", &[("codex", "sleep 1\necho late")]);
        let answer = ask(&fake.shell, None, "the prompt", None, None).await.unwrap();
        assert_eq!(answer.text, "late");
    }

    #[tokio::test]
    async fn runs_the_coding_agent_in_the_given_folder() {
        let fake = FakeCommands::new("folder", &[("codex", "pwd")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert!(answer.text.ends_with("work"), "{}", answer.text);
    }

    #[tokio::test]
    async fn sends_a_prompt_larger_than_the_limit_of_the_command_line() {
        let fake = FakeCommands::new("large", &[("claude", ECHO_SCRIPT)]);
        let prompt = "x".repeat(2_000_000);
        let answer = ask(&fake.shell, Some("claude"), &prompt, None, Some(60)).await.unwrap();
        assert_eq!(answer.text, format!("arguments:-p\nstandard input:{prompt}"));
    }
}
