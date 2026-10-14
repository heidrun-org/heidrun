//! The source control source of the data layer of Heidrun: reads every commit and every merge of a Git repository, and writes
//! the facts of each one in the table `commits` of a SQLite file.
//!
//! The library has four parts:
//! - `SourceControlDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query.
//! - `GitReader` lists the commits of a repository and reads their facts, through a `GitRunner`. `GitCommandRunner` runs the
//!   command `git`.
//! - `synchronize` fills the table, in the mode initialize or update.
//! - `to_table` and `to_json` write the rows of a query as text.
//!
//! The calls are blocking. A caller in an async program runs them in a blocking task.

mod git;
mod model;
mod storage;
mod synchronization;
#[cfg(test)]
mod test_samples;

pub use git::git_reader::{ignore_log, GitReader};
pub use git::git_runner::{find_repository, parse_repository, GitCommandRunner, GitRunner};
pub use model::schemas::validate_commit_value;
pub use model::types::{Commit, QueryRow, SynchronizationMode, SynchronizationReport};
pub use storage::database::SourceControlDatabase;
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::run as synchronize;

use std::path::PathBuf;

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`. It is the same file as
/// the file of the other data layer packages, and each package writes its own tables in it.
pub fn default_database_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".config").join("heidrun").join("data_layer.sqlite")
}
