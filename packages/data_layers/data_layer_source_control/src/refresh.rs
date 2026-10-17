//! The refresh interface of the package: the one call that copies the new commits of a Git repository into the SQLite file.
//!
//! A program that shows the commits calls this file to collect, and `query.rs` to read. The two never mix: a read of the
//! commits never runs the command `git`.

use crate::git::git_reader::{ignore_log, GitReader};
use crate::git::git_runner::GitCommandRunner;
use crate::model::types::{SynchronizationMode, SynchronizationReport};
use crate::storage::database::SourceControlDatabase;
use crate::synchronization::run;
use crate::REQUEST_PACKAGE;
use request_log::{record, RequestKind, RequestSpec, Summary};
use std::path::Path;

/// Copies the commits of the Git repository of `folder` that the SQLite file at `database_path` does not hold yet, with the
/// mode update. `repository` is the name `owner/name` that the rows get. The SQLite file and its table are created when they do
/// not exist. The caller holds the lock of the SQLite file.
///
/// # Errors
/// An error when the command `git` cannot run in `folder`, or when the SQLite file cannot be opened or written.
pub fn refresh_source_control(
    database_path: &Path,
    folder: &Path,
    repository: &str,
) -> Result<SynchronizationReport, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "refresh_source_control", RequestKind::Synchronization)
        .choice("mode", SynchronizationMode::Update.name())
        .parameter("repository", repository)
        .parameter("folder", folder.display().to_string())
        .database(database_path);
    record(spec, || refresh_source_control_inside(database_path, folder, repository), |report| {
        Summary::count(report.commit_count).detail("knownCommitCount", report.known_commit_count)
    })
}

/// The work of `refresh_source_control`, between the start event and the completion event of its request.
fn refresh_source_control_inside(
    database_path: &Path,
    folder: &Path,
    repository: &str,
) -> Result<SynchronizationReport, String> {
    let mut database = SourceControlDatabase::open(database_path)?;
    let runner = GitCommandRunner::new(folder);
    let reader = GitReader::new(&runner, &ignore_log);
    run(SynchronizationMode::Update, repository, &mut database, &reader, &ignore_log)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{temp_folder, TestRepository};

    #[test]
    fn copies_the_commits_of_a_repository_and_only_the_new_ones_the_second_time() {
        let (repository, _) = TestRepository::with_four_commits("refresh_commits");
        let database_path = temp_folder("refresh_commits_database").join("data_layer.sqlite");
        let first = refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        assert_eq!(first.commit_count, 4);
        let second = refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        assert_eq!(second.commit_count, 0);
        repository.commit_file("c.txt", "c", "A fifth commit", 5);
        let third = refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        assert_eq!(third.commit_count, 1);
    }

    #[test]
    fn a_refresh_is_one_request_that_holds_the_synchronization_with_its_collection_and_writes() {
        let (repository, _) = TestRepository::with_four_commits("refresh_events");
        let database_path = temp_folder("refresh_events_database").join("data_layer.sqlite");
        let (_, events) = request_log::testing::capture(|| {
            refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap()
        });
        let tree = request_log::testing::tree(&events);
        assert_eq!(tree[0], "source_control.refresh_source_control");
        assert_eq!(tree[1], "  source_control.synchronize");
        assert!(tree.contains(&"    source_control.read_commits".to_string()), "{tree:?}");
        let starts = request_log::testing::starts(&events);
        assert_eq!(starts[0].parameters["mode"], "update");
        assert_eq!(starts[0].parameters["repository"], "heidrun-org/heidrun");
        let complete = request_log::testing::completion_of(&events, &starts[0].request_id).unwrap();
        assert_eq!(complete.result_count, Some(4));
    }

    #[test]
    fn fails_with_a_message_for_a_folder_that_is_not_in_a_repository() {
        let folder = temp_folder("refresh_no_repository");
        let error = refresh_source_control(&folder.join("data_layer.sqlite"), &folder, "a/b").unwrap_err();
        assert!(error.contains("git"));
    }
}
