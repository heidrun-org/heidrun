//! The tab "Work of one person" of the Statistics window, source "Git history": the commits, the pull requests, and the issues of a
//! repository, each one with its author and its date.
//!
//! Two commands, never mixed:
//!
//! - `person_work_synchronize` copies the new commits into the SQLite file of the data layer with the package
//!   `data_layer_source_control`, and the new pull requests and issues with the package `data_layer_code_hosting`.
//! - `person_work_in_range` reads the SQLite file only. It runs no `git` command and no `gh` command, and it makes no network
//!   request. A merge commit does not count: it brings in commits that count already.

#[cfg(test)]
use data_layer_code_hosting::{refresh_code_hosting_with_runner, GraphqlRunner};
use data_layer_code_hosting::{find_issues_opened_between, find_pull_requests_opened_between, refresh_code_hosting};
use data_layer_source_control::{default_database_path, find_commits, find_repository, refresh_source_control};
use serde::Serialize;
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
}

/// What `person_work_synchronize` did.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersonWorkSynchronization {
    /// The repository, in the format `owner/name`. The tab gives it to `person_work_in_range`.
    pub repository: String,
    /// The message of the error when GitHub could not be read, or `None`. The pull requests and the issues are then the ones that
    /// an earlier read wrote in the SQLite file, and they can be out of date.
    pub code_hosting_error: Option<String>,
}

/// Called by the tab "Work of one person" to copy the new commits of the Git repository of `folder`, and the new pull requests
/// and issues of its GitHub repository, into the SQLite file.
#[tauri::command]
pub async fn person_work_synchronize(folder: String) -> Result<PersonWorkSynchronization, String> {
    // Off the main thread: it starts a Git process and a request to GitHub.
    tauri::async_runtime::spawn_blocking(move || {
        synchronize(Path::new(&folder), &default_database_path(), &|database_path, repository| {
            refresh_code_hosting(database_path, repository).map(|_| ())
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Called by the tab "Work of one person" to read the work of the people of `repository` (the format `owner/name`, as
/// `person_work_synchronize` gave it) in the time range from `since` to `until`, two texts in ISO 8601. It reads the SQLite file
/// only.
#[tauri::command]
pub async fn person_work_in_range(repository: String, since: String, until: String) -> Result<PersonWorkItems, String> {
    tauri::async_runtime::spawn_blocking(move || read(&default_database_path(), &repository, &since, &until))
        .await
        .map_err(|error| error.to_string())?
}

/// The refresh of the code hosting rows. A function with this shape is what `synchronize` calls, so a test gives another.
type RefreshFn = dyn Fn(&Path, &str) -> Result<(), String>;

/// Finds the repository of `folder`, copies its new commits, then refreshes its pull requests and issues with `refresh_hosting`.
/// A failure of GitHub does not fail the call: the stored rows are still read, and the message is in the answer.
fn synchronize(folder: &Path, database_path: &Path, refresh_hosting: &RefreshFn) -> Result<PersonWorkSynchronization, String> {
    let repository = find_repository(folder)?;
    // Two commands that write the SQLite file at the same time would fail with "database is locked". The command line
    // heidrun_code_data takes the same lock.
    let _guard = heidrun_code_data::lock_database(database_path)?;
    refresh_source_control(database_path, folder, &repository)?;
    let code_hosting_error = refresh_hosting(database_path, &repository).err();
    Ok(PersonWorkSynchronization { repository, code_hosting_error })
}

/// Reads the three kinds of items of `repository` from the SQLite file at `database_path`.
fn read(database_path: &Path, repository: &str, since: &str, until: &str) -> Result<PersonWorkItems, String> {
    let commits = find_commits(database_path, repository, since, until, false)?
        .into_iter()
        .map(|commit| CommitWork {
            author_name: commit.author_name,
            author_email: commit.author_email,
            committed_at: commit.committed_at,
            insertions: commit.insertions,
            deletions: commit.deletions,
        })
        .collect();
    let pull_requests = find_pull_requests_opened_between(database_path, repository, since, until)?
        .into_iter()
        .map(|pull_request| OpenedItemWork { author: pull_request.author, created_at: pull_request.created_at })
        .collect();
    let issues = find_issues_opened_between(database_path, repository, since, until)?
        .into_iter()
        .map(|issue| OpenedItemWork { author: issue.author, created_at: issue.created_at })
        .collect();
    Ok(PersonWorkItems { repository: repository.to_string(), commits, pull_requests, issues })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::path::PathBuf;
    use std::process::Command;

    const REPOSITORY: &str = "heidrun-org/heidrun";

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

    /// A fake GitHub that holds one issue and one pull request, both opened on 12 October 2026.
    struct FakeGithub;

    impl GraphqlRunner for FakeGithub {
        fn run(&self, query: &str, _variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
            let (name, node) = if query.contains("pullRequests") {
                ("pullRequests", json!({
                    "number": 6, "title": "A pull request", "body": "", "state": "MERGED", "isDraft": false,
                    "baseRefName": "dev_jerome", "headRefName": "a-branch", "createdAt": "2026-10-12T10:00:00Z",
                    "updatedAt": "2026-10-12T10:00:00Z", "closedAt": null, "mergedAt": null, "additions": 1, "deletions": 0,
                    "changedFiles": 1, "author": { "login": "ada" }, "mergedBy": null, "mergeCommit": null,
                    "labels": { "nodes": [] }, "commits": { "totalCount": 1 }
                }))
            } else {
                ("issues", json!({
                    "number": 5, "title": "An issue", "body": "", "state": "OPEN", "stateReason": null,
                    "createdAt": "2026-10-12T10:00:00Z", "updatedAt": "2026-10-12T10:00:00Z", "closedAt": null,
                    "author": { "login": "grace" }, "assignees": { "nodes": [] }, "labels": { "nodes": [] },
                    "comments": { "totalCount": 0 }
                }))
            };
            Ok(json!({
                "data": { "repository": { name: { "nodes": [node], "pageInfo": { "hasNextPage": false, "endCursor": null } } } }
            }))
        }
    }

    fn working_hosting(database_path: &Path, repository: &str) -> Result<(), String> {
        refresh_code_hosting_with_runner(&FakeGithub, database_path, repository).map(|_| ())
    }

    /// Runs `git` in `folder`, with a fixed author and no configuration file of the developer. `date` is the date of the
    /// author and of the committer.
    fn git(folder: &Path, arguments: &[&str], author: (&str, &str), date: &str) {
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
    }

    const ADA: (&str, &str) = ("Ada Author", "ada@example.com");
    const BOB: (&str, &str) = ("Bob Builder", "bob@example.com");

    /// A Git repository with the remote `origin` of GitHub, and one commit for each of the given authors and dates, in order.
    fn repository_with_commits(temporary: &TemporaryFolder, commits: &[((&str, &str), &str)]) -> PathBuf {
        let folder = temporary.repository();
        std::fs::create_dir_all(&folder).unwrap();
        git(&folder, &["init", "--quiet", "--initial-branch=main"], ADA, "2026-10-01T10:00:00+00:00");
        git(&folder, &["remote", "add", "origin", "git@github.com:heidrun-org/heidrun.git"], ADA, "2026-10-01T10:00:00+00:00");
        for (index, (author, date)) in commits.iter().enumerate() {
            std::fs::write(folder.join("file.txt"), format!("version {index}")).unwrap();
            git(&folder, &["add", "file.txt"], *author, date);
            git(&folder, &["commit", "--quiet", "-m", &format!("Commit {index}")], *author, date);
        }
        folder
    }

    fn two_commits(temporary: &TemporaryFolder) -> PathBuf {
        repository_with_commits(temporary, &[(ADA, "2026-10-10T10:00:00+00:00"), (BOB, "2026-10-12T12:00:00+02:00")])
    }

    #[test]
    fn a_synchronization_then_a_read_gives_the_work_even_when_git_and_github_are_unavailable() {
        let temporary = TemporaryFolder::new("sources_gone");
        let folder = two_commits(&temporary);
        let answer = synchronize(&folder, &temporary.database(), &working_hosting).unwrap();
        assert_eq!(answer.repository, REPOSITORY);
        assert_eq!(answer.code_hosting_error, None);
        std::fs::remove_dir_all(folder.join(".git")).unwrap();
        let work = read(&temporary.database(), REPOSITORY, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z").unwrap();
        assert_eq!(
            work.commits.iter().map(|commit| commit.author_name.as_str()).collect::<Vec<_>>(),
            vec!["Ada Author", "Bob Builder"]
        );
        assert_eq!(work.issues, vec![OpenedItemWork { author: Some("grace".into()), created_at: "2026-10-12T10:00:00Z".into() }]);
        assert_eq!(work.pull_requests, vec![OpenedItemWork { author: Some("ada".into()), created_at: "2026-10-12T10:00:00Z".into() }]);
        assert_eq!(work.repository, REPOSITORY);
    }

    #[test]
    fn the_commits_of_the_time_range_are_read_with_their_author_and_their_date_in_utc() {
        let temporary = TemporaryFolder::new("range");
        let folder = two_commits(&temporary);
        synchronize(&folder, &temporary.database(), &working_hosting).unwrap();
        let work = read(&temporary.database(), REPOSITORY, "2026-10-11T00:00:00.000Z", "2026-10-13T00:00:00.000Z").unwrap();
        assert_eq!(work.commits.len(), 1);
        assert_eq!(work.commits[0].author_name, "Bob Builder");
        assert_eq!(work.commits[0].author_email, "bob@example.com");
        assert_eq!((work.commits[0].insertions, work.commits[0].deletions), (1, 1));
        assert!(work.commits[0].committed_at.starts_with("2026-10-12T10:00:00"));
    }

    #[test]
    fn the_time_range_keeps_the_start_and_drops_the_end() {
        let temporary = TemporaryFolder::new("edges");
        let folder = two_commits(&temporary);
        synchronize(&folder, &temporary.database(), &working_hosting).unwrap();
        let work = read(&temporary.database(), REPOSITORY, "2026-10-10T10:00:00Z", "2026-10-12T10:00:00Z").unwrap();
        assert_eq!(work.commits.iter().map(|commit| commit.author_name.as_str()).collect::<Vec<_>>(), vec!["Ada Author"]);
    }

    #[test]
    fn a_merge_commit_does_not_count() {
        let temporary = TemporaryFolder::new("merge");
        let folder = repository_with_commits(&temporary, &[(ADA, "2026-10-10T10:00:00+00:00")]);
        git(&folder, &["checkout", "--quiet", "-b", "feature"], ADA, "2026-10-11T10:00:00+00:00");
        std::fs::write(folder.join("feature.txt"), "feature").unwrap();
        git(&folder, &["add", "feature.txt"], BOB, "2026-10-11T10:00:00+00:00");
        git(&folder, &["commit", "--quiet", "-m", "Feature"], BOB, "2026-10-11T10:00:00+00:00");
        git(&folder, &["checkout", "--quiet", "main"], ADA, "2026-10-12T10:00:00+00:00");
        std::fs::write(folder.join("main.txt"), "main").unwrap();
        git(&folder, &["add", "main.txt"], ADA, "2026-10-12T10:00:00+00:00");
        git(&folder, &["commit", "--quiet", "-m", "Main"], ADA, "2026-10-12T10:00:00+00:00");
        git(&folder, &["merge", "--quiet", "--no-ff", "feature", "-m", "Merge"], ADA, "2026-10-13T10:00:00+00:00");
        synchronize(&folder, &temporary.database(), &working_hosting).unwrap();
        let work = read(&temporary.database(), REPOSITORY, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z").unwrap();
        assert_eq!(work.commits.len(), 3);
    }

    #[test]
    fn a_failure_of_github_is_in_the_answer_and_the_commits_are_still_stored() {
        let temporary = TemporaryFolder::new("github_failure");
        let folder = two_commits(&temporary);
        let failing = |_: &Path, _: &str| Err("no network".to_string());
        let answer = synchronize(&folder, &temporary.database(), &failing).unwrap();
        assert_eq!(answer.code_hosting_error.as_deref(), Some("no network"));
        let work = read(&temporary.database(), REPOSITORY, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z").unwrap();
        assert_eq!(work.commits.len(), 2);
        assert!(work.issues.is_empty() && work.pull_requests.is_empty());
    }

    #[test]
    fn a_read_before_the_first_synchronization_is_empty_and_creates_nothing() {
        let temporary = TemporaryFolder::new("before");
        let work = read(&temporary.database(), REPOSITORY, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z").unwrap();
        assert!(work.commits.is_empty() && work.issues.is_empty() && work.pull_requests.is_empty());
        assert!(!temporary.database().exists());
    }

    #[test]
    fn a_read_refuses_a_time_that_is_not_a_time() {
        let temporary = TemporaryFolder::new("bad_time");
        assert!(read(&temporary.database(), REPOSITORY, "yesterday", "2026-11-01T00:00:00Z").is_err());
    }

    #[test]
    fn a_folder_that_is_not_in_a_repository_is_an_error() {
        let temporary = TemporaryFolder::new("no_repository");
        let none = |_: &Path, _: &str| Ok(());
        assert!(synchronize(&temporary.0, &temporary.database(), &none).is_err());
    }

    #[test]
    fn sends_the_work_to_the_web_page_with_the_names_of_the_fields_it_reads() {
        let temporary = TemporaryFolder::new("json");
        let folder = two_commits(&temporary);
        synchronize(&folder, &temporary.database(), &working_hosting).unwrap();
        let work = read(&temporary.database(), REPOSITORY, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z").unwrap();
        let json = serde_json::to_value(&work).unwrap();
        assert_eq!(json["commits"][0]["authorName"], "Ada Author");
        assert!(json["commits"][0]["committedAt"].is_string());
        assert!(json["pullRequests"][0]["createdAt"].is_string());
        assert_eq!(json["issues"][0]["author"], "grace");
        assert!(json.get("codeHostingError").is_none());
    }
}
