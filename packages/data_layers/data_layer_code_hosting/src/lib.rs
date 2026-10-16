//! The code hosting source of the data layer of Heidrun: reads every issue and every pull request of a GitHub repository, and
//! writes the facts of each one in two tables of a SQLite file.
//!
//! The library has four parts:
//! - `CodeHostingDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query.
//! - `GithubReader` reads the pages of issues and of pull requests, through a `GraphqlRunner`. `GhGraphqlRunner` sends the
//!   queries with the command `gh`.
//! - `synchronize` fills the two tables, in the mode initialize or update.
//! - `to_table` and `to_json` write the rows of a query as text.
//!
//! The calls are blocking. A caller in an async program runs them in a blocking task.

mod github;
mod model;
mod storage;
mod synchronization;
#[cfg(test)]
mod test_samples;

pub use github::github_reader::{ignore_log, GithubReader, ISSUES_QUERY, PULL_REQUESTS_QUERY};
pub use github::graphql_runner::{find_repository, GhGraphqlRunner, GraphqlRunner};
pub use model::schemas::{validate_issue_value, validate_pull_request_value, ISSUE_SCHEMA, PULL_REQUEST_SCHEMA};
pub use model::types::{
    CodeHostingTable, Issue, IssueState, IssueStateReason, PullRequest, PullRequestState, QueryRow, SynchronizationMode,
    SynchronizationReport,
};
pub use storage::database::CodeHostingDatabase;
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::{describe_since, run as synchronize};

use std::path::PathBuf;

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`.
pub fn default_database_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".config").join("heidrun").join("data_layer.sqlite")
}
