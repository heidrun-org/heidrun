//! Sends a GraphQL query to GitHub, and finds the repository of a folder. By default the runner sends the queries with the
//! command `gh`, which already knows the sign-in of the developer. This is the only file of the package that runs the
//! command `gh`.

use serde_json::Value;
use std::path::Path;
use std::process::Command;

/// Sends one GraphQL query to the code hosting service. The tests give a fake runner, so they need no network.
pub trait GraphqlRunner {
    /// Sends the query with its variables, and gives the parsed JSON answer. A variable with the value `None` is not sent.
    fn run(&self, query: &str, variables: &[(&str, Option<&str>)]) -> Result<Value, String>;
}

/// The runner that sends the query with the command `gh api graphql`.
pub struct GhGraphqlRunner;

impl GraphqlRunner for GhGraphqlRunner {
    fn run(&self, query: &str, variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
        let mut command = Command::new("gh");
        command.args(["api", "graphql", "-f"]).arg(format!("query={query}"));
        for (key, value) in variables {
            if let Some(value) = value {
                command.arg("-f").arg(format!("{key}={value}"));
            }
        }
        let output = command.output().map_err(|error| format!("The command gh api graphql did not start: {error}"))?;
        if !output.status.success() {
            return Err(format!("The command gh api graphql failed: {}", describe_failure(&output.stderr)));
        }
        serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("The answer of the command gh api graphql is not JSON: {error}"))
    }
}

/// Finds the repository of a folder, with the command `gh`.
///
/// # Errors
/// An error when the command `gh` fails, for example when the folder has no GitHub remote.
pub fn find_repository(working_directory: &Path) -> Result<String, String> {
    let output = Command::new("gh")
        .args(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
        .current_dir(working_directory)
        .output()
        .map_err(|error| format!("The command gh did not start: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "The command gh could not find the repository of {}: {}",
            working_directory.display(),
            describe_failure(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Writes the standard error output of a failed command in one text.
fn describe_failure(standard_error: &[u8]) -> String {
    let text = String::from_utf8_lossy(standard_error).trim().to_string();
    if text.is_empty() {
        "the command gave no message".to_string()
    } else {
        text
    }
}
