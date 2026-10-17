//! The query interface of the package: the typed reads that a program uses to show the commits. A read opens the SQLite file
//! only. It never runs the command `git`.

use crate::model::types::Commit;
use crate::model::utc_time::to_whole_second_text;
use crate::storage::database::SourceControlDatabase;
use crate::REQUEST_PACKAGE;
use request_log::{record, RequestKind, RequestSpec, Summary};
use std::path::Path;

/// The commits of `repository` made in the time range from `since` (included) to `until` (excluded), read from the SQLite file
/// at `database_path`, the oldest first. Both times are texts in the format ISO 8601 with an offset or in UTC. A merge brings in
/// commits that count already, so it is left out unless `include_merges` is true. A SQLite file that does not exist holds no
/// commit, so the answer is an empty list: the commits were never copied yet.
///
/// # Errors
/// An error when a time is not a time with an offset, or when the SQLite file cannot be read.
pub fn find_commits(
    database_path: &Path,
    repository: &str,
    since: &str,
    until: &str,
    include_merges: bool,
) -> Result<Vec<Commit>, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "find_commits", RequestKind::Query)
        .parameter("repository", repository)
        .parameter("since", since)
        .parameter("until", until)
        .choice("includeMerges", include_merges)
        .database(database_path);
    record(spec, || find_commits_inside(database_path, repository, since, until, include_merges), |commits| {
        Summary::count(commits.len())
    })
}

/// The work of `find_commits`, between the start event and the completion event of its request.
fn find_commits_inside(
    database_path: &Path,
    repository: &str,
    since: &str,
    until: &str,
    include_merges: bool,
) -> Result<Vec<Commit>, String> {
    if !database_path.exists() {
        to_whole_second_text(since)?;
        to_whole_second_text(until)?;
        return Ok(Vec::new());
    }
    SourceControlDatabase::open_read_only(database_path)?.find_commits_between(repository, since, until, include_merges)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::refresh::refresh_source_control;
    use crate::test_samples::{temp_folder, TestRepository};

    #[test]
    fn gives_an_empty_list_when_the_sqlite_file_exists_but_holds_no_table_of_commits() {
        let database_path = temp_folder("query_other_tables").join("data_layer.sqlite");
        rusqlite::Connection::open(&database_path).unwrap().execute_batch("CREATE TABLE other (data TEXT)").unwrap();
        assert_eq!(find_commits(&database_path, "owner/name", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", false).unwrap(), vec![]);
    }

    #[test]
    fn reads_the_commits_that_a_refresh_copied_after_the_repository_is_gone() {
        let (repository, hashes) = TestRepository::with_four_commits("query_commits");
        let database_path = temp_folder("query_commits_database").join("data_layer.sqlite");
        refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        std::fs::remove_dir_all(&repository.folder).unwrap();
        let found =
            find_commits(&database_path, "heidrun-org/heidrun", "2026-10-01T00:00:00Z", "2026-10-30T00:00:00Z", false).unwrap();
        assert_eq!(found.len(), 3);
        assert!(found.iter().all(|commit| commit.hash != hashes[3]));
        let with_merges =
            find_commits(&database_path, "heidrun-org/heidrun", "2026-10-01T00:00:00Z", "2026-10-30T00:00:00Z", true).unwrap();
        assert_eq!(with_merges.len(), 4);
    }

    #[test]
    fn a_find_is_one_request_with_the_range_and_the_count_and_a_failure_has_a_category_only() {
        let (repository, _) = TestRepository::with_four_commits("query_events");
        let database_path = temp_folder("query_events_database").join("data_layer.sqlite");
        refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        let (found, events) = request_log::testing::capture(|| {
            find_commits(&database_path, "heidrun-org/heidrun", "2026-10-01T00:00:00Z", "2026-10-30T00:00:00Z", false).unwrap()
        });
        assert_eq!(found.len(), 3);
        let tree = request_log::testing::tree(&events);
        assert_eq!(tree[0], "source_control.find_commits");
        assert!(tree.contains(&"  source_control.find_commits_between".to_string()), "{tree:?}");
        let starts = request_log::testing::starts(&events);
        assert_eq!(starts[0].parameters["repository"], "heidrun-org/heidrun");
        assert_eq!(starts[0].parameters["includeMerges"], false);
        assert_eq!(request_log::testing::completion_of(&events, &starts[0].request_id).unwrap().result_count, Some(3));
        let (_, events) = request_log::testing::capture(|| {
            find_commits(&database_path, "a/b", "yesterday", "2026-10-30T00:00:00Z", false).unwrap_err()
        });
        let starts = request_log::testing::starts(&events);
        let complete = request_log::testing::completion_of(&events, &starts[0].request_id).unwrap();
        assert_eq!(complete.outcome, request_log::Outcome::Failure);
        assert!(complete.error_category.is_some());
    }

    #[test]
    fn gives_an_empty_list_when_the_sqlite_file_does_not_exist_and_still_refuses_a_wrong_time() {
        let database_path = temp_folder("query_no_database").join("data_layer.sqlite");
        assert_eq!(find_commits(&database_path, "a/b", "2026-10-01T00:00:00Z", "2026-10-30T00:00:00Z", false), Ok(Vec::new()));
        assert!(find_commits(&database_path, "a/b", "yesterday", "2026-10-30T00:00:00Z", false).is_err());
        assert!(!database_path.exists());
    }
}
