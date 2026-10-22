//! The models of a coding agent: runs the command line that prints them, and gives what it printed.
//!
//! The web frontend knows which command line prints the models of each coding agent, for example `codex debug models`,
//! and how to read the output. This file does only what the web frontend cannot do: it runs the command line on this
//! computer, with the function `run_tool` of the package `coding_agent_cli`. The call goes through the login shell, so
//! the commands that the developer installed are found.

use coding_agent_cli::{run_tool, AgentShell};

/// How long the call waits for the command line, in seconds.
const MODELS_TIMEOUT: u64 = 15;

/// Runs `executable` with `arguments` and gives its standard output: the list of the models of a coding agent.
#[tauri::command]
pub async fn coding_agent_models_run(executable: String, arguments: Vec<String>) -> Result<String, String> {
    run_tool(&AgentShell::login(), &executable, &arguments, MODELS_TIMEOUT).await
}
