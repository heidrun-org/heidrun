//! The query interface of the package: the typed reads that a program uses to show the issues and the pull requests. A read
//! opens the SQLite file only. It never sends a request to GitHub and it never runs the command `gh`.

use crate::model::types::{Issue, PullRequest};
use crate::model::utc_time::to_whole_second_text;
use crate::storage::database::CodeHostingDatabase;
use crate::REQUEST_PACKAGE;
use request_log::{record, RequestKind, RequestSpec, Summary};
use std::path::Path;

/// The issues of `repository` opened in the time range from `since` (included) to `until` (excluded), read from the SQLite file
/// at `database_path`, the oldest first. Both times are texts in the format ISO 8601 with an offset or in UTC. A SQLite file
/// that does not exist holds no issue, so the answer is an empty list: the issues were never copied yet.
///
/// # Errors
/// An error when a time is not a time with an offset, or when the SQLite file cannot be read.
pub fn find_issues_opened_between(
    database_path: &Path,
    repository: &str,
    since: &str,
    until: &str,
) -> Result<Vec<Issue>, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "find_issues_opened_between", RequestKind::Query)
        .parameter("repository", repository)
        .parameter("since", since)
        .parameter("until", until)
        .database(database_path);
    record(spec, || match open_when_it_exists(database_path, since, until)? {
        None => Ok(Vec::new()),
        Some(database) => database.find_issues_opened_between(repository, since, until),
    }, |issues| Summary::count(issues.len()))
}

/// The pull requests of `repository` opened in the time range from `since` (included) to `until` (excluded), read from the SQLite
/// file at `database_path`, the oldest first. Both times are texts in the format ISO 8601 with an offset or in UTC. A SQLite file
/// that does not exist holds no pull request, so the answer is an empty list.
///
/// # Errors
/// An error when a time is not a time with an offset, or when the SQLite file cannot be read.
pub fn find_pull_requests_opened_between(
    database_path: &Path,
    repository: &str,
    since: &str,
    until: &str,
) -> Result<Vec<PullRequest>, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "find_pull_requests_opened_between", RequestKind::Query)
        .parameter("repository", repository)
        .parameter("since", since)
        .parameter("until", until)
        .database(database_path);
    record(spec, || match open_when_it_exists(database_path, since, until)? {
        None => Ok(Vec::new()),
        Some(database) => database.find_pull_requests_opened_between(repository, since, until),
    }, |found| Summary::count(found.len()))
}

/// The issues of `repository` whose numbers are in `numbers`, read from the SQLite file at `database_path`, in the order of
/// their numbers. A number that has no row, and a SQLite file that does not exist, give no issue.
///
/// # Errors
/// An error when the SQLite file cannot be read.
pub fn find_issues_by_numbers(database_path: &Path, repository: &str, numbers: &[i64]) -> Result<Vec<Issue>, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "find_issues_by_numbers", RequestKind::Query)
        .parameter("repository", repository)
        .parameter("numberCount", numbers.len())
        .database(database_path);
    record(spec, || {
        if !database_path.exists() {
            return Ok(Vec::new());
        }
        CodeHostingDatabase::open_read_only(database_path)?.find_issues_by_numbers(repository, numbers)
    }, |issues| Summary::count(issues.len()))
}

/// The pull requests of `repository` whose numbers are in `numbers`, read from the SQLite file at `database_path`, in the
/// order of their numbers. A number that has no row, and a SQLite file that does not exist, give no pull request.
///
/// # Errors
/// An error when the SQLite file cannot be read.
pub fn find_pull_requests_by_numbers(
    database_path: &Path,
    repository: &str,
    numbers: &[i64],
) -> Result<Vec<PullRequest>, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "find_pull_requests_by_numbers", RequestKind::Query)
        .parameter("repository", repository)
        .parameter("numberCount", numbers.len())
        .database(database_path);
    record(spec, || {
        if !database_path.exists() {
            return Ok(Vec::new());
        }
        CodeHostingDatabase::open_read_only(database_path)?.find_pull_requests_by_numbers(repository, numbers)
    }, |found| Summary::count(found.len()))
}

/// Checks the two times, then opens the SQLite file read only. `None` when the file does not exist.
fn open_when_it_exists(database_path: &Path, since: &str, until: &str) -> Result<Option<CodeHostingDatabase>, String> {
    to_whole_second_text(since)?;
    to_whole_second_text(until)?;
    if !database_path.exists() {
        return Ok(None);
    }
    CodeHostingDatabase::open_read_only(database_path).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::refresh::refresh_code_hosting_with_runner;
    use crate::test_samples::{date, issue_node, pull_request_node, temp_folder, FakeGithub};

    const REPOSITORY: &str = "heidrun-org/heidrun";

    #[test]
    fn gives_empty_lists_when_the_sqlite_file_exists_but_holds_no_table_of_issues_and_pull_requests() {
        let database_path = temp_folder("query_other_tables").join("data_layer.sqlite");
        rusqlite::Connection::open(&database_path).unwrap().execute_batch("CREATE TABLE other (data TEXT)").unwrap();
        let (since, until) = ("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");
        assert!(find_issues_opened_between(&database_path, "owner/name", since, until).unwrap().is_empty());
        assert!(find_pull_requests_opened_between(&database_path, "owner/name", since, until).unwrap().is_empty());
        assert!(find_issues_by_numbers(&database_path, "owner/name", &[1]).unwrap().is_empty());
        assert!(find_pull_requests_by_numbers(&database_path, "owner/name", &[1]).unwrap().is_empty());
    }

    #[test]
    fn reads_what_a_refresh_copied_with_no_request_to_github() {
        let database_path = temp_folder("query_after_refresh").join("data_layer.sqlite");
        let github = FakeGithub::new(
            vec![issue_node(1, &date(2)), issue_node(2, &date(3))],
            vec![pull_request_node(5, &date(4))],
            100,
        );
        refresh_code_hosting_with_runner(&github, &database_path, REPOSITORY).unwrap();
        let issues = find_issues_by_numbers(&database_path, REPOSITORY, &[2, 1]).unwrap();
        assert_eq!(issues.iter().map(|issue| issue.number).collect::<Vec<_>>(), vec![1, 2]);
        assert_eq!(issues[0].label_colors.get("enhancement").map(String::as_str), Some("a2eeef"));
        let pull_requests = find_pull_requests_opened_between(&database_path, REPOSITORY, &date(1), &date(9)).unwrap();
        assert_eq!(pull_requests.len(), 1);
        assert_eq!(find_issues_opened_between(&database_path, REPOSITORY, &date(1), &date(9)).unwrap().len(), 2);
    }

    #[test]
    fn a_find_is_one_request_with_the_range_and_the_count_and_a_failure_has_a_category_only() {
        let database_path = temp_folder("query_events").join("data_layer.sqlite");
        let github = FakeGithub::new(
            vec![issue_node(1, &date(2)), issue_node(2, &date(3))],
            vec![pull_request_node(5, &date(4))],
            100,
        );
        refresh_code_hosting_with_runner(&github, &database_path, REPOSITORY).unwrap();
        let (_, events) = request_log::testing::capture(|| {
            find_issues_opened_between(&database_path, REPOSITORY, &date(1), &date(9)).unwrap();
            find_pull_requests_by_numbers(&database_path, REPOSITORY, &[5, 6, 7]).unwrap();
        });
        let tree = request_log::testing::tree(&events);
        assert_eq!(tree[0], "code_hosting.find_issues_opened_between");
        assert!(tree.contains(&"code_hosting.find_pull_requests_by_numbers".to_string()), "{tree:?}");
        let starts = request_log::testing::starts(&events);
        assert_eq!(starts[0].parameters["repository"], REPOSITORY);
        let complete = request_log::testing::completion_of(&events, &starts[0].request_id).unwrap();
        assert_eq!(complete.result_count, Some(2));
        let by_numbers = starts.iter().find(|start| start.operation == "find_pull_requests_by_numbers").unwrap();
        assert_eq!(by_numbers.parameters["numberCount"], 3);
        let (_, events) = request_log::testing::capture(|| {
            find_pull_requests_opened_between(&database_path, REPOSITORY, "yesterday", &date(9)).unwrap_err()
        });
        let starts = request_log::testing::starts(&events);
        let complete = request_log::testing::completion_of(&events, &starts[0].request_id).unwrap();
        assert_eq!(complete.outcome, request_log::Outcome::Failure);
        assert!(complete.error_category.is_some());
    }

    #[test]
    fn gives_an_empty_list_when_the_sqlite_file_does_not_exist_and_still_refuses_a_wrong_time() {
        let database_path = temp_folder("query_no_database").join("data_layer.sqlite");
        assert_eq!(find_issues_opened_between(&database_path, "a/b", &date(1), &date(9)), Ok(Vec::new()));
        assert_eq!(find_pull_requests_by_numbers(&database_path, "a/b", &[1]), Ok(Vec::new()));
        assert!(find_pull_requests_opened_between(&database_path, "a/b", "yesterday", &date(9)).is_err());
        assert!(!database_path.exists());
    }
}
