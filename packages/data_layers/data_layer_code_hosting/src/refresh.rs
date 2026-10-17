//! The refresh interface of the package: the one call that copies the new issues and pull requests of a GitHub repository into
//! the SQLite file.
//!
//! A program that shows the issues and the pull requests calls this file to collect, and `query.rs` to read. The two never
//! mix: a read never sends a request to GitHub.

use crate::github::github_reader::{ignore_log, GithubReader};
use crate::github::graphql_runner::{GhGraphqlRunner, GraphqlRunner};
use crate::model::types::{CodeHostingTable, SynchronizationMode, SynchronizationReport};
use crate::storage::database::CodeHostingDatabase;
use crate::synchronization::run;
use std::path::Path;

/// Copies the issues and the pull requests of `repository` that changed since the last read into the SQLite file at
/// `database_path`, with the command `gh`. The SQLite file and its tables are created when they do not exist. The caller holds
/// the lock of the SQLite file.
///
/// The mode is update, which reads only the items that changed since the largest date of change of each table. The mode is
/// initialize, which reads every item, when an earlier version of the package wrote a row without the colors of its labels, so
/// the read gives that row its colors once.
///
/// # Errors
/// An error when the command `gh` fails, for example without a network, or when the SQLite file cannot be opened or written.
pub fn refresh_code_hosting(database_path: &Path, repository: &str) -> Result<SynchronizationReport, String> {
    refresh_code_hosting_with_runner(&GhGraphqlRunner, database_path, repository)
}

/// Like `refresh_code_hosting`, with the runner that sends the queries. The tests give a fake runner.
///
/// # Errors
/// The same as `refresh_code_hosting`.
pub fn refresh_code_hosting_with_runner(
    runner: &dyn GraphqlRunner,
    database_path: &Path,
    repository: &str,
) -> Result<SynchronizationReport, String> {
    let mut database = CodeHostingDatabase::open(database_path)?;
    let mut missing_color_count = 0;
    for table in CodeHostingTable::ALL {
        missing_color_count += database.count_rows_without_label_colors(table, repository)?;
    }
    let mode = if missing_color_count > 0 { SynchronizationMode::Initialize } else { SynchronizationMode::Update };
    let reader = GithubReader::new(runner, &ignore_log);
    run(mode, repository, &mut database, &reader, &ignore_log)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{date, issue_node, pull_request_node, temp_folder, FakeGithub};
    use rusqlite::Connection;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    fn fake_github() -> FakeGithub {
        FakeGithub::new(vec![issue_node(1, &date(2)), issue_node(2, &date(3))], vec![pull_request_node(5, &date(4))], 100)
    }

    #[test]
    fn creates_the_sqlite_file_and_copies_the_issues_and_the_pull_requests() {
        let database_path = temp_folder("refresh_copy").join("data_layer.sqlite");
        let report = refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        assert_eq!((report.mode, report.issue_count, report.pull_request_count), (SynchronizationMode::Update, 2, 1));
    }

    #[test]
    fn reads_everything_again_once_when_a_row_has_no_label_colors_and_then_only_the_changes() {
        let database_path = temp_folder("refresh_colors").join("data_layer.sqlite");
        refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        let connection = Connection::open(&database_path).unwrap();
        connection.execute("UPDATE issues SET data = json_remove(data, '$.labelColors') WHERE number = 1", []).unwrap();
        drop(connection);
        let second = refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        assert_eq!((second.mode, second.issue_count), (SynchronizationMode::Initialize, 2));
        let third = refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        assert_eq!(third.mode, SynchronizationMode::Update);
    }
}
