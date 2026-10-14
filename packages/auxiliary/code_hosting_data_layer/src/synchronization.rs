//! Fills the tables `issues` and `pull_requests` from GitHub, in the mode initialize or update.
//!
//! The date of the last read is not stored anywhere else: it is the largest value of the column `updatedAt` of each table, for
//! the repository. When a table has no row for the repository, the mode update reads everything, as the mode initialize does.

use crate::database::CodeHostingDatabase;
use crate::github_reader::GithubReader;
use crate::types::{CodeHostingTable, SynchronizationMode, SynchronizationReport};

/// Reads the issues and the pull requests of a repository, and writes them in the database. `log` receives one line of
/// progress for the date where each read starts and for each write.
///
/// # Errors
/// An error when the database cannot be read or written, when GitHub cannot be read, or when an item does not follow its
/// JSON schema.
pub fn run(
    mode: SynchronizationMode,
    repository: &str,
    database: &mut CodeHostingDatabase,
    reader: &GithubReader,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let (issues_since, pull_requests_since) = match mode {
        SynchronizationMode::Initialize => (None, None),
        SynchronizationMode::Update => (
            database.find_last_updated_at(CodeHostingTable::Issues, repository)?,
            database.find_last_updated_at(CodeHostingTable::PullRequests, repository)?,
        ),
    };
    log(&format!("mode {}: issues are read {}", mode.name(), describe_since(issues_since.as_deref())));
    let issues = reader.read_issues(repository, issues_since.as_deref())?;
    database.upsert_issues(repository, &issues)?;
    log(&format!("issues: written row count {}, file {}", issues.len(), database.database_path().display()));
    log(&format!("mode {}: pull requests are read {}", mode.name(), describe_since(pull_requests_since.as_deref())));
    let pull_requests = reader.read_pull_requests(repository, pull_requests_since.as_deref())?;
    database.upsert_pull_requests(repository, &pull_requests)?;
    log(&format!(
        "pull requests: written row count {}, file {}",
        pull_requests.len(),
        database.database_path().display()
    ));
    Ok(SynchronizationReport {
        mode,
        repository: repository.to_string(),
        issues_since,
        pull_requests_since,
        issue_count: issues.len(),
        pull_request_count: pull_requests.len(),
    })
}

/// Writes in words the date where a read starts: `since the beginning` for `None`, otherwise `since` and the date.
pub fn describe_since(since: Option<&str>) -> String {
    match since {
        None => "since the beginning".to_string(),
        Some(date) => format!("since {date}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github_reader::ignore_log;
    use crate::test_samples::{date, issue, issue_node, pull_request_node, temp_folder, FakeGithub, FakeRequest};
    use crate::types::IssueState;
    use serde_json::{json, Value};
    use std::cell::RefCell;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// A fake GitHub with three issues (days 1 to 3) and two pull requests (days 4 and 5), two items for each page.
    fn fake_github() -> FakeGithub {
        FakeGithub::new(
            (1..=3).map(|day| issue_node(day, &date(day as u32))).collect(),
            (4..=5).map(|day| pull_request_node(day, &date(day as u32))).collect(),
            2,
        )
    }

    /// An empty database in a new folder.
    fn new_database(name: &str) -> CodeHostingDatabase {
        CodeHostingDatabase::open(&temp_folder(name).join("data_layer.sqlite")).unwrap()
    }

    #[test]
    fn initialize_reads_everything_since_the_beginning_and_writes_every_row() {
        let fake_github = fake_github();
        let mut database = new_database("initialize");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let report = run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                repository: REPOSITORY.to_string(),
                issues_since: None,
                pull_requests_since: None,
                issue_count: 3,
                pull_request_count: 2,
            }
        );
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(2));
        let mut expected = issue(2);
        expected.updated_at = date(2);
        assert_eq!(database.find_issue(REPOSITORY, 2), Ok(Some(expected)));
    }

    #[test]
    fn initialize_two_times_in_a_row_gives_the_same_rows_with_no_row_written_two_times() {
        let fake_github = fake_github();
        let mut database = new_database("initialize_twice");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(2));
    }

    #[test]
    fn update_on_an_empty_database_reads_everything_as_initialize_does() {
        let fake_github = fake_github();
        let mut database = new_database("update_empty");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.issues_since, None);
        assert_eq!(report.pull_requests_since, None);
        assert_eq!((report.issue_count, report.pull_request_count), (3, 2));
    }

    #[test]
    fn update_reads_from_the_date_of_the_last_read_and_writes_the_new_and_the_changed_rows() {
        let fake_github = fake_github();
        let mut database = new_database("update_changes");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        {
            let mut nodes = fake_github.issue_nodes.borrow_mut();
            let mut reopened = issue_node(1, &date(8));
            reopened["state"] = json!("OPEN");
            reopened["stateReason"] = Value::Null;
            reopened["closedAt"] = Value::Null;
            nodes[0] = reopened;
            nodes.push(issue_node(6, &date(9)));
        }
        fake_github.requests.borrow_mut().clear();
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.issues_since, Some(date(3)));
        assert_eq!(report.pull_requests_since, Some(date(5)));
        assert_eq!(report.issue_count, 3);
        assert_eq!(report.pull_request_count, 1);
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(4));
        assert_eq!(database.find_issue(REPOSITORY, 1).unwrap().unwrap().state, IssueState::Open);
        assert_eq!(database.find_issue(REPOSITORY, 6).unwrap().unwrap().number, 6);
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(Some(date(9))));
    }

    #[test]
    fn update_does_not_ask_for_the_pages_that_hold_only_items_that_are_already_read() {
        let fake_github = fake_github();
        let mut database = new_database("update_pages");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        fake_github.requests.borrow_mut().clear();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let asked: Vec<(String, Option<String>)> = fake_github
            .requests
            .borrow()
            .iter()
            .map(|request: &FakeRequest| (request.connection_name.clone(), request.cursor.clone()))
            .collect();
        assert_eq!(asked, [("issues".to_string(), None), ("pullRequests".to_string(), None)]);
    }

    #[test]
    fn update_two_times_in_a_row_with_no_change_on_github_leaves_the_database_as_it_is() {
        let fake_github = fake_github();
        let mut database = new_database("update_twice");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(2));
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(Some(date(3))));
    }

    #[test]
    fn update_of_one_repository_does_not_use_the_date_of_the_last_read_of_another_repository() {
        let fake_github = fake_github();
        let mut database = new_database("update_other_repository");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let report =
            run(SynchronizationMode::Update, "heidrun-org/another", &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.issues_since, None);
        assert_eq!(database.count_rows(CodeHostingTable::Issues, "heidrun-org/another"), Ok(3));
    }

    #[test]
    fn sends_the_lines_of_progress_of_the_date_where_each_read_starts_and_of_each_write() {
        let fake_github = fake_github();
        let mut database = new_database("progress");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &log).unwrap();
        let path = database.database_path().display().to_string();
        let lines = lines.borrow();
        assert!(lines.contains(&"mode initialize: issues are read since the beginning".to_string()));
        assert!(lines.contains(&format!("issues: written row count 3, file {path}")));
        assert!(lines.contains(&format!("mode update: issues are read since {}", date(3))));
        assert!(lines.contains(&format!("mode update: pull requests are read since {}", date(5))));
        assert!(lines.contains(&format!("pull requests: written row count 1, file {path}")));
    }
}
