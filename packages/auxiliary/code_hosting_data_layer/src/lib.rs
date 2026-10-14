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

mod database;
mod github_reader;
mod query_formatter;
mod schemas;
mod synchronization;
#[cfg(test)]
mod test_samples;
mod types;

pub use database::CodeHostingDatabase;
pub use github_reader::{
    find_repository, ignore_log, GhGraphqlRunner, GithubReader, GraphqlRunner, ISSUES_QUERY, PULL_REQUESTS_QUERY,
};
pub use query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use schemas::{validate_issue_value, validate_pull_request_value};
pub use synchronization::{describe_since, run as synchronize};
pub use types::{
    CodeHostingTable, Issue, IssueState, IssueStateReason, PullRequest, PullRequestState, QueryRow, SynchronizationMode,
    SynchronizationReport,
};

use std::path::PathBuf;

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`.
pub fn default_database_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".config").join("heidrun").join("data_layer.sqlite")
}
