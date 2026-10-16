//! The work of the people in a repository: the commits, the pull requests, and the issues, each one with its author and its
//! date. The tab "Work of one person" of the Statistics window groups them by person and by day.
//!
//! The module does not run `git` or `gh` itself. It copies the new commits into the SQLite file of the data layer with the
//! package `data_layer_source_control`, and the new pull requests and issues with the package `data_layer_code_hosting`. Then
//! it reads the three kinds of items back with read-only queries. A merge commit does not count: it brings in commits that
//! count already.

use chrono::{DateTime, FixedOffset};
use data_layer_code_hosting as code_hosting;
use data_layer_source_control as source_control;
use serde::Serialize;
use serde_json::Value;
use std::path::Path;

/// One commit of the work of a person.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommitWork {
    /// The name of the author, after the file `.mailmap` is applied.
    pub author_name: String,
    /// The email of the author, after the file `.mailmap` is applied.
    pub author_email: String,
    /// The date of the commit, in UTC, in the format ISO 8601.
    pub committed_at: String,
    /// The number of lines that the commit adds. A binary file counts 0.
    pub insertions: i64,
    /// The number of lines that the commit deletes. A binary file counts 0.
    pub deletions: i64,
}

/// One pull request or one issue that a person opened.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OpenedItemWork {
    /// The login of the author. It is `None` when the account of the author is deleted.
    pub author: Option<String>,
    /// The date when the author opened the item, in the format ISO 8601.
    pub created_at: String,
}

/// What the Statistics window needs to count the work of the people of one repository in a time range.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersonWorkItems {
    /// The repository, in the format `owner/name`.
    pub repository: String,
    /// The commits of the time range, the oldest first, with no merge.
    pub commits: Vec<CommitWork>,
    /// The pull requests that were opened in the time range, the oldest first.
    pub pull_requests: Vec<OpenedItemWork>,
    /// The issues that were opened in the time range, the oldest first.
    pub issues: Vec<OpenedItemWork>,
    /// The message of the error when GitHub could not be read, or `None`. The pull requests and the issues are then the ones
    /// that an earlier read wrote in the SQLite file, and they can be out of date.
    pub code_hosting_error: Option<String>,
}

/// The time of a text in ISO 8601, with an offset or the letter `Z`.
pub(crate) fn parse_time(text: &str) -> Result<DateTime<FixedOffset>, String> {
    DateTime::parse_from_rfc3339(text).map_err(|_| format!("`{text}` is not a time in ISO 8601"))
}

/// True when `time_text` is a time that is at or after `since` and before `until`. A text that is not a time is outside.
fn is_inside(time_text: &str, since: &DateTime<FixedOffset>, until: &DateTime<FixedOffset>) -> bool {
    match parse_time(time_text) {
        Ok(time) => time >= *since && time < *until,
        Err(_) => false,
    }
}

/// The text between single quotes of an SQL statement: a single quote is written twice.
fn sql_text(text: &str) -> String {
    text.replace('\'', "''")
}

/// The JSON of the column `data` of each row of a query, in the order of the rows.
fn data_of(rows: &[serde_json::Map<String, Value>]) -> Result<Vec<&str>, String> {
    rows.iter()
        .map(|row| row.get("data").and_then(Value::as_str).ok_or_else(|| "a row of the data layer has no column `data`".to_string()))
        .collect()
}

/// Copies the new commits of the Git repository of `folder` into the SQLite file.
fn synchronize_source_control(folder: &Path, database_path: &Path, repository: &str) -> Result<(), String> {
    let mut database = source_control::SourceControlDatabase::open(database_path)?;
    let runner = source_control::GitCommandRunner::new(folder);
    let reader = source_control::GitReader::new(&runner, &source_control::ignore_log);
    source_control::synchronize(
        source_control::SynchronizationMode::Update,
        repository,
        &mut database,
        &reader,
        &source_control::ignore_log,
    )?;
    Ok(())
}

/// Copies the new pull requests and the new issues of the repository from GitHub into the SQLite file.
fn synchronize_code_hosting(
    database_path: &Path,
    repository: &str,
    runner: &dyn code_hosting::GraphqlRunner,
) -> Result<(), String> {
    let mut database = code_hosting::CodeHostingDatabase::open(database_path)?;
    let reader = code_hosting::GithubReader::new(runner, &code_hosting::ignore_log);
    code_hosting::synchronize(
        code_hosting::SynchronizationMode::Update,
        repository,
        &mut database,
        &reader,
        &code_hosting::ignore_log,
    )?;
    Ok(())
}

/// The commits of `repository` made in the time range, the oldest first, with no merge.
fn read_commits(
    database_path: &Path,
    repository: &str,
    since: &DateTime<FixedOffset>,
    until: &DateTime<FixedOffset>,
) -> Result<Vec<CommitWork>, String> {
    let database = source_control::SourceControlDatabase::open_read_only(database_path)?;
    let rows = database.query(&format!("SELECT data FROM commits WHERE repository = '{}'", sql_text(repository)))?;
    let mut commits = Vec::new();
    for data in data_of(&rows)? {
        let commit = serde_json::from_str::<source_control::Commit>(data).map_err(|error| error.to_string())?;
        if commit.is_merge() == false && is_inside(&commit.committed_at, since, until) {
            commits.push(CommitWork {
                author_name: commit.author_name,
                author_email: commit.author_email,
                committed_at: commit.committed_at,
                insertions: commit.insertions,
                deletions: commit.deletions,
            });
        }
    }
    commits.sort_by(|first, second| first.committed_at.cmp(&second.committed_at));
    Ok(commits)
}

/// The pull requests of `repository` opened in the time range, the oldest first.
fn read_pull_requests(
    database_path: &Path,
    repository: &str,
    since: &DateTime<FixedOffset>,
    until: &DateTime<FixedOffset>,
) -> Result<Vec<OpenedItemWork>, String> {
    let database = code_hosting::CodeHostingDatabase::open_read_only(database_path)?;
    let rows =
        database.query(&format!("SELECT data FROM pull_requests WHERE repository = '{}'", sql_text(repository)))?;
    let mut pull_requests = Vec::new();
    for data in data_of(&rows)? {
        let pull_request = serde_json::from_str::<code_hosting::PullRequest>(data).map_err(|error| error.to_string())?;
        if is_inside(&pull_request.created_at, since, until) {
            pull_requests.push(OpenedItemWork { author: pull_request.author, created_at: pull_request.created_at });
        }
    }
    pull_requests.sort_by(|first, second| first.created_at.cmp(&second.created_at));
    Ok(pull_requests)
}

/// The issues of `repository` opened in the time range, the oldest first.
fn read_issues(
    database_path: &Path,
    repository: &str,
    since: &DateTime<FixedOffset>,
    until: &DateTime<FixedOffset>,
) -> Result<Vec<OpenedItemWork>, String> {
    let database = code_hosting::CodeHostingDatabase::open_read_only(database_path)?;
    let rows = database.query(&format!("SELECT data FROM issues WHERE repository = '{}'", sql_text(repository)))?;
    let mut issues = Vec::new();
    for data in data_of(&rows)? {
        let issue = serde_json::from_str::<code_hosting::Issue>(data).map_err(|error| error.to_string())?;
        if is_inside(&issue.created_at, since, until) {
            issues.push(OpenedItemWork { author: issue.author, created_at: issue.created_at });
        }
    }
    issues.sort_by(|first, second| first.created_at.cmp(&second.created_at));
    Ok(issues)
}

/// The work of the people in the Git repository of `folder`, in the time range from `since` to `until`, two texts in ISO 8601.
///
/// The new commits are copied into the SQLite file at `database_path` first, then the new pull requests and issues with
/// `runner`. A failure of GitHub, for example without a network, does not stop the read: the pull requests and the issues
/// that the SQLite file already holds are used, and the message of the failure is in `code_hosting_error`.
///
/// # Errors
/// An error when a time is not a time, when `folder` is not in a Git repository with a remote `origin`, or when the SQLite
/// file or `git` fails.
fn read_person_work(
    folder: &Path,
    database_path: &Path,
    runner: &dyn code_hosting::GraphqlRunner,
    since: &str,
    until: &str,
) -> Result<PersonWorkItems, String> {
    let since = parse_time(since)?;
    let until = parse_time(until)?;
    let repository = source_control::find_repository(folder)?;
    // Two commands that write the SQLite file at the same time would fail with "database is locked". The command line
    // heidrun_data takes the same lock.
    let _guard = heidrun_data::lock_database(database_path)?;
    synchronize_source_control(folder, database_path, &repository)?;
    let code_hosting_error = synchronize_code_hosting(database_path, &repository, runner).err();
    Ok(PersonWorkItems {
        commits: read_commits(database_path, &repository, &since, &until)?,
        pull_requests: read_pull_requests(database_path, &repository, &since, &until)?,
        issues: read_issues(database_path, &repository, &since, &until)?,
        repository,
        code_hosting_error,
    })
}

/// Called by the Statistics window to read the work of the people in the Git repository of `folder`, in the time range from
/// `since` to `until`, two texts in ISO 8601.
#[tauri::command]
pub async fn person_work_in_range(folder: String, since: String, until: String) -> Result<PersonWorkItems, String> {
    tauri::async_runtime::spawn_blocking(move || {
        read_person_work(
            Path::new(&folder),
            &source_control::default_database_path(),
            &code_hosting::GhGraphqlRunner,
            &since,
            &until,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;

    /// A folder in a new folder of the system temporary folder. The folder is removed when the value is dropped.
    struct TemporaryFolder(PathBuf);

    impl TemporaryFolder {
        fn new(name: &str) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun-person-work-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(&folder).unwrap();
            TemporaryFolder(folder)
        }

        fn repository(&self) -> PathBuf {
            self.0.join("repository")
        }

        fn database(&self) -> PathBuf {
            self.0.join("data_layer.sqlite")
        }
    }

    impl Drop for TemporaryFolder {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// A runner that answers every query with a list that holds no item and has no next page.
    struct EmptyRunner;

    impl code_hosting::GraphqlRunner for EmptyRunner {
        fn run(&self, query: &str, _variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
            let name = if query.contains("pullRequests") { "pullRequests" } else { "issues" };
            Ok(serde_json::json!({
                "data": { "repository": { name: { "nodes": [], "pageInfo": { "hasNextPage": false, "endCursor": null } } } }
            }))
        }
    }

    /// A runner that always fails, as GitHub does without a network.
    struct FailingRunner;

    impl code_hosting::GraphqlRunner for FailingRunner {
        fn run(&self, _query: &str, _variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
            Err("no network".to_string())
        }
    }

    /// Runs `git` in `folder`, with a fixed author and no configuration file of the developer. `date` is the date of the
    /// author and of the committer.
    fn git(folder: &Path, arguments: &[&str], author: (&str, &str), date: &str) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(folder)
            .args(arguments)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_AUTHOR_NAME", author.0)
            .env("GIT_AUTHOR_EMAIL", author.1)
            .env("GIT_AUTHOR_DATE", date)
            .env("GIT_COMMITTER_NAME", author.0)
            .env("GIT_COMMITTER_EMAIL", author.1)
            .env("GIT_COMMITTER_DATE", date)
            .output()
            .unwrap();
        assert!(output.status.success(), "git {} failed: {}", arguments.join(" "), String::from_utf8_lossy(&output.stderr));
        String::from_utf8_lossy(&output.stdout).trim_end().to_string()
    }

    /// A Git repository with the remote `origin` of GitHub, and one commit for each of the given authors and dates, in order.
    fn repository_with_commits(temporary: &TemporaryFolder, commits: &[((&str, &str), &str)]) -> PathBuf {
        let folder = temporary.repository();
        std::fs::create_dir_all(&folder).unwrap();
        let first_author = commits.first().map(|commit| commit.0).unwrap_or(("Nobody", "nobody@example.com"));
        git(&folder, &["init", "--quiet", "--initial-branch=main"], first_author, "2026-10-01T10:00:00+00:00");
        git(
            &folder,
            &["remote", "add", "origin", "git@github.com:heidrun-org/heidrun.git"],
            first_author,
            "2026-10-01T10:00:00+00:00",
        );
        for (index, (author, date)) in commits.iter().enumerate() {
            std::fs::write(folder.join("file.txt"), format!("version {index}")).unwrap();
            git(&folder, &["add", "file.txt"], *author, date);
            git(&folder, &["commit", "--quiet", "-m", &format!("Commit {index}")], *author, date);
        }
        folder
    }

    /// An issue or a pull request of the code hosting database, as the package writes it.
    fn pull_request(number: i64, author: Option<&str>, created_at: &str) -> code_hosting::PullRequest {
        code_hosting::PullRequest {
            number,
            title: "A pull request".into(),
            body: String::new(),
            state: code_hosting::PullRequestState::Merged,
            is_draft: false,
            author: author.map(String::from),
            merged_by: None,
            labels: vec![],
            base_ref_name: "dev_jerome".into(),
            head_ref_name: "a-branch".into(),
            merge_commit: None,
            created_at: created_at.into(),
            updated_at: created_at.into(),
            closed_at: None,
            merged_at: None,
            additions: 1,
            deletions: 0,
            changed_files: 1,
            commit_count: 1,
        }
    }

    fn issue(number: i64, author: Option<&str>, created_at: &str) -> code_hosting::Issue {
        code_hosting::Issue {
            number,
            title: "An issue".into(),
            body: String::new(),
            state: code_hosting::IssueState::Open,
            state_reason: None,
            author: author.map(String::from),
            assignees: vec![],
            labels: vec![],
            created_at: created_at.into(),
            updated_at: created_at.into(),
            closed_at: None,
            comment_count: 0,
        }
    }

    const ADA: (&str, &str) = ("Ada Author", "ada@example.com");
    const BOB: (&str, &str) = ("Bob Builder", "bob@example.com");

    #[test]
    fn the_commits_of_the_time_range_are_read_with_their_author_and_their_date_in_utc() {
        let temporary = TemporaryFolder::new("commits");
        let folder = repository_with_commits(
            &temporary,
            &[(ADA, "2026-10-10T10:00:00+00:00"), (BOB, "2026-10-12T12:00:00+02:00"), (ADA, "2026-10-14T10:00:00+00:00")],
        );
        let work = read_person_work(
            &folder,
            &temporary.database(),
            &EmptyRunner,
            "2026-10-11T00:00:00.000Z",
            "2026-10-13T00:00:00.000Z",
        )
        .unwrap();
        assert_eq!(work.repository, "heidrun-org/heidrun");
        assert_eq!(
            work.commits,
            vec![CommitWork {
                author_name: "Bob Builder".into(),
                author_email: "bob@example.com".into(),
                committed_at: work.commits[0].committed_at.clone(),
                insertions: 1,
                deletions: 1,
            }]
        );
        assert!(work.commits[0].committed_at.starts_with("2026-10-12T10:00:00"));
        assert_eq!(work.code_hosting_error, None);
    }

    #[test]
    fn the_lines_added_and_the_lines_deleted_of_each_commit_are_read() {
        let temporary = TemporaryFolder::new("lines");
        let folder = repository_with_commits(&temporary, &[(ADA, "2026-10-10T10:00:00+00:00")]);
        let date = "2026-10-11T10:00:00+00:00";
        std::fs::write(folder.join("file.txt"), "one\ntwo\nthree\nfour\n").unwrap();
        git(&folder, &["add", "file.txt"], BOB, date);
        git(&folder, &["commit", "--quiet", "-m", "Four lines"], BOB, date);
        std::fs::write(folder.join("file.txt"), "one\nthree\nfour\nfive\nsix\n").unwrap();
        git(&folder, &["add", "file.txt"], BOB, "2026-10-12T10:00:00+00:00");
        git(&folder, &["commit", "--quiet", "-m", "Two lines added, one line deleted"], BOB, "2026-10-12T10:00:00+00:00");
        let work = read_person_work(
            &folder,
            &temporary.database(),
            &EmptyRunner,
            "2026-10-01T00:00:00.000Z",
            "2026-10-20T00:00:00.000Z",
        )
        .unwrap();
        let lines: Vec<(i64, i64)> = work.commits.iter().map(|commit| (commit.insertions, commit.deletions)).collect();
        assert_eq!(lines, vec![(1, 0), (4, 1), (2, 1)]);
    }

    #[test]
    fn a_merge_commit_does_not_count() {
        let temporary = TemporaryFolder::new("merge");
        let folder = repository_with_commits(&temporary, &[(ADA, "2026-10-10T10:00:00+00:00")]);
        let date = "2026-10-11T10:00:00+00:00";
        git(&folder, &["checkout", "--quiet", "-b", "side"], BOB, date);
        std::fs::write(folder.join("side.txt"), "side").unwrap();
        git(&folder, &["add", "side.txt"], BOB, date);
        git(&folder, &["commit", "--quiet", "-m", "On the side"], BOB, date);
        git(&folder, &["checkout", "--quiet", "main"], ADA, date);
        std::fs::write(folder.join("main.txt"), "main").unwrap();
        git(&folder, &["add", "main.txt"], ADA, date);
        git(&folder, &["commit", "--quiet", "-m", "On main"], ADA, date);
        git(&folder, &["merge", "--quiet", "--no-ff", "-m", "Merge side", "side"], ADA, "2026-10-12T10:00:00+00:00");
        let work = read_person_work(
            &folder,
            &temporary.database(),
            &EmptyRunner,
            "2026-10-01T00:00:00.000Z",
            "2026-10-20T00:00:00.000Z",
        )
        .unwrap();
        assert_eq!(work.commits.len(), 3);
        assert!(work.commits.iter().all(|commit| commit.committed_at.as_str() < "2026-10-12"));
    }

    #[test]
    fn the_pull_requests_and_the_issues_of_the_time_range_are_read_with_their_author() {
        let temporary = TemporaryFolder::new("items");
        let folder = repository_with_commits(&temporary, &[(ADA, "2026-10-10T10:00:00+00:00")]);
        let mut database = code_hosting::CodeHostingDatabase::open(&temporary.database()).unwrap();
        database
            .upsert_pull_requests(
                "heidrun-org/heidrun",
                &[
                    pull_request(1, Some("ada"), "2026-10-09T10:00:00Z"),
                    pull_request(2, Some("bob"), "2026-10-12T10:00:00Z"),
                    pull_request(3, None, "2026-10-13T10:00:00Z"),
                ],
            )
            .unwrap();
        database
            .upsert_issues(
                "heidrun-org/heidrun",
                &[issue(4, Some("ada"), "2026-10-12T09:00:00Z"), issue(5, Some("ada"), "2026-10-20T09:00:00Z")],
            )
            .unwrap();
        drop(database);
        let work = read_person_work(
            &folder,
            &temporary.database(),
            &EmptyRunner,
            "2026-10-11T00:00:00.000Z",
            "2026-10-14T00:00:00.000Z",
        )
        .unwrap();
        assert_eq!(
            work.pull_requests,
            vec![
                OpenedItemWork { author: Some("bob".into()), created_at: "2026-10-12T10:00:00Z".into() },
                OpenedItemWork { author: None, created_at: "2026-10-13T10:00:00Z".into() },
            ]
        );
        assert_eq!(
            work.issues,
            vec![OpenedItemWork { author: Some("ada".into()), created_at: "2026-10-12T09:00:00Z".into() }]
        );
    }

    #[test]
    fn a_failure_of_github_keeps_the_items_that_are_already_read_and_gives_its_message() {
        let temporary = TemporaryFolder::new("failure");
        let folder = repository_with_commits(&temporary, &[(ADA, "2026-10-12T10:00:00+00:00")]);
        let mut database = code_hosting::CodeHostingDatabase::open(&temporary.database()).unwrap();
        database
            .upsert_pull_requests("heidrun-org/heidrun", &[pull_request(1, Some("ada"), "2026-10-12T10:00:00Z")])
            .unwrap();
        drop(database);
        let work = read_person_work(
            &folder,
            &temporary.database(),
            &FailingRunner,
            "2026-10-11T00:00:00.000Z",
            "2026-10-14T00:00:00.000Z",
        )
        .unwrap();
        assert_eq!(work.commits.len(), 1);
        assert_eq!(work.pull_requests.len(), 1);
        assert_eq!(work.code_hosting_error, Some("no network".to_string()));
    }

    #[test]
    fn a_folder_that_is_not_in_a_git_repository_is_an_error() {
        let temporary = TemporaryFolder::new("no-repository");
        let error = read_person_work(
            &temporary.0,
            &temporary.database(),
            &EmptyRunner,
            "2026-10-11T00:00:00.000Z",
            "2026-10-14T00:00:00.000Z",
        )
        .unwrap_err();
        assert!(error.contains("cannot be found"));
        assert!(temporary.database().exists() == false);
    }

    #[test]
    fn a_text_that_is_not_a_time_is_refused_before_anything_is_written() {
        let temporary = TemporaryFolder::new("bad-time");
        let folder = repository_with_commits(&temporary, &[(ADA, "2026-10-12T10:00:00+00:00")]);
        let error =
            read_person_work(&folder, &temporary.database(), &EmptyRunner, "' OR 1=1 --", "2026-10-14T00:00:00.000Z")
                .unwrap_err();
        assert!(error.contains("is not a time in ISO 8601"));
        assert!(temporary.database().exists() == false);
    }

    #[test]
    fn a_single_quote_in_the_name_of_the_repository_stays_inside_the_text() {
        assert_eq!(sql_text("o'brien/repository"), "o''brien/repository");
    }
}
