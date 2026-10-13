//! Clustered dynamic topics: the translation table kept on the disk, and the call to a coding agent that fills it.
//!
//! The translation table maps each raw dynamic topic to the name of a cluster. It is kept in `topic_clusters.json`, in
//! the folder of the data of Heidrun. The web frontend decides which raw dynamic topics are new, writes the prompt, and
//! checks the answer. This file does only the two things that the web frontend cannot do: it reads and writes the file,
//! and it runs `codex` or `claude` on this computer.
//!
//! The call follows the rules of the package `raw_coding_agent_cli`: `claude` runs as `claude -p`, `codex` runs as
//! `codex exec --skip-git-repo-check -`, and the prompt always goes through the standard input. The call goes through the
//! login shell, so the commands that the developer installed are found, and Heidrun never reads or stores the login.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

/// The name of the file of the translation table, in the folder of the data of Heidrun.
const TABLE_FILE: &str = "topic_clusters.json";

/// The version of the content of the file. A file with another version is thrown away: the table starts empty.
const TABLE_VERSION: u32 = 1;

/// The coding agents that can answer, the one that is tried first coming first.
const CODING_AGENTS: [&str; 2] = ["codex", "claude"];

/// How long the call waits for the answer, in seconds.
const ANSWER_TIMEOUT: u64 = 180;

/// The error that the call gives when neither `codex` nor `claude` is installed.
const NO_CODING_AGENT: &str = "no_coding_agent";

/// What the file of the translation table holds.
#[derive(Serialize, Deserialize, Debug, Default)]
struct TableContent {
    version: u32,
    /// The cluster of each raw dynamic topic, written in lower case.
    rows: BTreeMap<String, String>,
}

/// The answer of a coding agent.
#[derive(Serialize, Debug, PartialEq)]
pub struct CodingAgentAnswer {
    /// The coding agent that answered: `codex` or `claude`.
    pub agent: String,
    /// What the coding agent printed, without the spaces and the line breaks at its start and at its end.
    pub text: String,
}

/// The shell that starts a coding agent, and the PATH that it sees.
pub(crate) struct AgentShell {
    /// The shell program.
    pub(crate) shell: String,
    /// The flag that gives the script to the shell: `-lc` for the login shell.
    pub(crate) flag: &'static str,
    /// The value of the PATH of the command, or `None` to keep the PATH that the shell makes.
    pub(crate) path: Option<String>,
}

impl AgentShell {
    /// The login shell of the developer: the commands that the developer installed are found, as in a terminal.
    pub(crate) fn login() -> Self {
        AgentShell { shell: crate::git::login_shell(), flag: "-lc", path: None }
    }

    /// A command that runs the script `script` with the arguments `args` in this shell.
    pub(crate) fn command(&self, script: &str, args: &[&str]) -> Command {
        let mut command = Command::new(&self.shell);
        command.arg(self.flag).arg(script).args(args).kill_on_drop(true).env("NO_COLOR", "1");
        if let Some(path) = &self.path {
            command.env("PATH", path);
        }
        command
    }

    /// True when the command `name` exists for this shell.
    async fn has(&self, name: &str) -> bool {
        let mut command = self.command("command -v \"$0\"", &[name]);
        command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        matches!(command.status().await, Ok(status) if status.success())
    }

    /// The first coding agent of `CODING_AGENTS` that exists, or `None`.
    async fn first_coding_agent(&self) -> Option<&'static str> {
        for name in CODING_AGENTS {
            if self.has(name).await {
                return Some(name);
            }
        }
        None
    }
}

/// The arguments that run one coding agent with the prompt on its standard input.
fn coding_agent_arguments(agent: &str) -> &'static [&'static str] {
    if agent == "claude" {
        &["-p"]
    } else {
        &["exec", "--skip-git-repo-check", "-"]
    }
}

/// Sends `prompt` to the first coding agent that exists and returns the answer.
///
/// The command runs in `folder`. It is not a workspace of the developer, so the chat that the coding agent saves for the
/// call never appears in the Chats sidebar section.
async fn ask(shell: &AgentShell, prompt: &str, folder: &Path, timeout: u64) -> Result<CodingAgentAnswer, String> {
    let Some(agent) = shell.first_coding_agent().await else {
        return Err(NO_CODING_AGENT.to_string());
    };
    let _ = std::fs::create_dir_all(folder);
    let mut command = shell.command("exec \"$0\" \"$@\"", &[]);
    command.arg(agent).args(coding_agent_arguments(agent));
    command.current_dir(folder).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| format!("{agent} : {error}"))?;
    let mut stdin = child.stdin.take().ok_or_else(|| format!("{agent} : no standard input"))?;
    let bytes = prompt.as_bytes().to_vec();
    // The coding agent can exit before it reads the whole prompt: the exit code tells what happened.
    let write = async move {
        let _ = stdin.write_all(&bytes).await;
        drop(stdin);
    };
    let (_, output) = tokio::time::timeout(Duration::from_secs(timeout), async { tokio::join!(write, child.wait_with_output()) })
        .await
        .map_err(|_| format!("{agent} : no answer in {timeout} s"))?;
    let output = output.map_err(|error| format!("{agent} : {error}"))?;
    if output.status.success() {
        return Ok(CodingAgentAnswer {
            agent: agent.to_string(),
            text: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        });
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if error.is_empty() { format!("{agent} failed ({})", output.status) } else { format!("{agent} : {error}") })
}

/// The file of the translation table.
fn table_path() -> PathBuf {
    crate::chats::data_dir().join(TABLE_FILE)
}

/// The folder where the coding agent runs.
fn agent_folder() -> PathBuf {
    crate::chats::data_dir().join("topic_clusters_agent")
}

/// Reads the rows of the file `path`. A missing file, a file that is not valid, and a file with another version give no
/// row.
fn read_rows(path: &Path) -> BTreeMap<String, String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<TableContent>(&text).ok())
        .filter(|content| content.version == TABLE_VERSION)
        .map(|content| content.rows)
        .unwrap_or_default()
}

/// Writes `rows` to the file `path`. The file is written aside then renamed: a crash never leaves half a file.
fn write_rows(path: &Path, rows: &BTreeMap<String, String>) -> Result<(), String> {
    let content = TableContent { version: TABLE_VERSION, rows: rows.clone() };
    let text = serde_json::to_string(&content).map_err(|error| error.to_string())?;
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    }
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, path).map_err(|error| error.to_string())
}

/// The translation table: the cluster of each raw dynamic topic.
#[tauri::command]
pub fn topic_clusters_read() -> BTreeMap<String, String> {
    read_rows(&table_path())
}

/// Replaces the translation table by `rows`.
#[tauri::command]
pub fn topic_clusters_write(rows: BTreeMap<String, String>) -> Result<(), String> {
    write_rows(&table_path(), &rows)
}

/// Sends `prompt` to `codex` when it is installed, and to `claude` otherwise. The error `no_coding_agent` says that
/// neither is installed.
#[tauri::command]
pub async fn coding_agent_ask(prompt: String) -> Result<CodingAgentAnswer, String> {
    ask(&AgentShell::login(), &prompt, &agent_folder(), ANSWER_TIMEOUT).await
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A folder with fake `codex` and `claude` commands, and a shell that sees only this folder and the system commands.
    struct FakeCommands {
        folder: PathBuf,
        shell: AgentShell,
    }

    impl FakeCommands {
        /// Makes a folder with one script for each pair `(command, script)`. A command without a script does not exist.
        fn new(name: &str, scripts: &[(&str, &str)]) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun_topic_clusters_{name}_{}", std::process::id()));
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

        /// The folder where the coding agent runs in the tests.
        fn working_folder(&self) -> PathBuf {
            self.folder.join("work")
        }
    }

    impl Drop for FakeCommands {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.folder);
        }
    }

    /// The fake command script that prints its arguments, then its standard input.
    const ECHO_SCRIPT: &str = "printf 'arguments:%s\\n' \"$*\"\nprintf 'standard input:'\ncat";

    #[tokio::test]
    async fn runs_codex_with_the_prompt_on_the_standard_input_when_both_exist() {
        let fake = FakeCommands::new("both", &[("codex", ECHO_SCRIPT), ("claude", "echo claude")]);
        let answer = ask(&fake.shell, "the prompt", &fake.working_folder(), 20).await.unwrap();
        assert_eq!(answer.agent, "codex");
        assert_eq!(answer.text, "arguments:exec --skip-git-repo-check -\nstandard input:the prompt");
    }

    #[tokio::test]
    async fn runs_claude_when_codex_does_not_exist() {
        let fake = FakeCommands::new("claude_only", &[("claude", ECHO_SCRIPT)]);
        let answer = ask(&fake.shell, "the prompt", &fake.working_folder(), 20).await.unwrap();
        assert_eq!(answer.agent, "claude");
        assert_eq!(answer.text, "arguments:-p\nstandard input:the prompt");
    }

    #[tokio::test]
    async fn gives_the_error_no_coding_agent_when_neither_exists() {
        let fake = FakeCommands::new("none", &[]);
        let answer = ask(&fake.shell, "the prompt", &fake.working_folder(), 20).await;
        assert_eq!(answer, Err("no_coding_agent".to_string()));
    }

    #[tokio::test]
    async fn gives_the_standard_error_output_when_the_coding_agent_fails() {
        let fake = FakeCommands::new("failure", &[("codex", "echo 'not signed in' >&2\nexit 3")]);
        let answer = ask(&fake.shell, "the prompt", &fake.working_folder(), 20).await;
        assert_eq!(answer, Err("codex : not signed in".to_string()));
    }

    #[tokio::test]
    async fn gives_an_error_when_the_coding_agent_does_not_answer_in_time() {
        let fake = FakeCommands::new("slow", &[("codex", "sleep 5")]);
        let answer = ask(&fake.shell, "the prompt", &fake.working_folder(), 1).await;
        assert_eq!(answer, Err("codex : no answer in 1 s".to_string()));
    }

    #[tokio::test]
    async fn runs_the_coding_agent_in_the_given_folder() {
        let fake = FakeCommands::new("folder", &[("codex", "pwd")]);
        let answer = ask(&fake.shell, "the prompt", &fake.working_folder(), 20).await.unwrap();
        assert!(answer.text.ends_with("work"), "{}", answer.text);
    }

    #[test]
    fn writes_the_table_and_reads_it_again() {
        let folder = std::env::temp_dir().join(format!("heidrun_topic_clusters_table_{}", std::process::id()));
        let path = folder.join(TABLE_FILE);
        let rows = BTreeMap::from([("side bar".to_string(), "sidebar".to_string()), ("tab".to_string(), "tab".to_string())]);
        write_rows(&path, &rows).unwrap();
        assert_eq!(read_rows(&path), rows);
        write_rows(&path, &BTreeMap::new()).unwrap();
        assert!(read_rows(&path).is_empty());
        let _ = std::fs::remove_dir_all(folder);
    }

    #[test]
    fn starts_with_no_row_when_the_file_is_missing_is_not_valid_or_has_another_version() {
        let folder = std::env::temp_dir().join(format!("heidrun_topic_clusters_bad_{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let path = folder.join(TABLE_FILE);
        assert!(read_rows(&path).is_empty());
        std::fs::write(&path, "not json").unwrap();
        assert!(read_rows(&path).is_empty());
        std::fs::write(&path, "{\"version\":99,\"rows\":{\"a\":\"b\"}}").unwrap();
        assert!(read_rows(&path).is_empty());
        let _ = std::fs::remove_dir_all(folder);
    }
}
