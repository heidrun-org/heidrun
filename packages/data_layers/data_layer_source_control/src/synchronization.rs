//! Fills the table `commits` from a Git repository, in the mode initialize or update.
//!
//! The package keeps no other state: the commits that are already read are the hashes in the table, for the repository. The
//! mode update reads only the commits whose hash is not in the table, so it does not depend on the dates of the commits. When
//! the table has no row for the repository, the mode update reads everything, as the mode initialize does. A commit that no
//! branch reaches any more, for example after a rebase, stays in the table.

use crate::git::git_reader::GitReader;
use crate::model::types::{SynchronizationMode, SynchronizationReport};
use crate::storage::database::SourceControlDatabase;
use std::collections::HashSet;

/// Reads the commits of a repository, and writes them in the database. `log` receives one line of progress for the number of
/// commits to read and for the write.
///
/// # Errors
/// An error when the database cannot be read or written, when `git` cannot be run, or when a commit does not follow its JSON
/// schema.
pub fn run(
    mode: SynchronizationMode,
    repository: &str,
    database: &mut SourceControlDatabase,
    reader: &GitReader,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let reachable_hashes = reader.list_hashes()?;
    let known_hashes = match mode {
        SynchronizationMode::Initialize => HashSet::new(),
        SynchronizationMode::Update => database.find_known_hashes(repository)?,
    };
    let reachable_count = reachable_hashes.len();
    let new_hashes: Vec<String> = reachable_hashes.into_iter().filter(|hash| !known_hashes.contains(hash)).collect();
    let known_commit_count = reachable_count - new_hashes.len();
    log(&format!(
        "mode {}: {} commits are read, {} are already in the database",
        mode.name(),
        new_hashes.len(),
        known_commit_count
    ));
    let commits = reader.read_commits(&new_hashes)?;
    database.upsert_commits(repository, &commits)?;
    log(&format!("commits: written row count {}, file {}", commits.len(), database.database_path().display()));
    Ok(SynchronizationReport {
        mode,
        repository: repository.to_string(),
        commit_count: commits.len(),
        known_commit_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::git_reader::ignore_log;
    use crate::git::git_runner::GitCommandRunner;
    use crate::test_samples::{temp_folder, TestRepository};
    use std::cell::RefCell;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// An empty database in a new folder.
    fn new_database(name: &str) -> SourceControlDatabase {
        SourceControlDatabase::open(&temp_folder(name).join("data_layer.sqlite")).unwrap()
    }

    #[test]
    fn initialize_reads_every_commit_and_writes_every_row() {
        let (repository, hashes) = TestRepository::with_four_commits("initialize");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("initialize_database");
        let report = run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                repository: REPOSITORY.to_string(),
                commit_count: 4,
                known_commit_count: 0,
            }
        );
        assert_eq!(database.count_commits(REPOSITORY), Ok(4));
        let merge = database.find_commit(REPOSITORY, &hashes[3]).unwrap().unwrap();
        assert!(merge.is_merge());
        assert_eq!(merge.subject, "Merge feature into main");
        assert!(!database.find_commit(REPOSITORY, &hashes[0]).unwrap().unwrap().is_merge());
    }

    #[test]
    fn initialize_two_times_in_a_row_gives_the_same_rows_with_no_row_written_two_times() {
        let (repository, _) = TestRepository::with_four_commits("initialize_twice");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("initialize_twice_database");
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let report = run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!((report.commit_count, report.known_commit_count), (4, 0));
        assert_eq!(database.count_commits(REPOSITORY), Ok(4));
    }

    #[test]
    fn update_on_an_empty_database_reads_everything_as_initialize_does() {
        let (repository, _) = TestRepository::with_four_commits("update_empty");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("update_empty_database");
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!((report.commit_count, report.known_commit_count), (4, 0));
        assert_eq!(database.count_commits(REPOSITORY), Ok(4));
    }

    #[test]
    fn update_reads_only_the_commits_that_are_not_in_the_database() {
        let (repository, _) = TestRepository::with_four_commits("update_new");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("update_new_database");
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let new_hash = repository.commit_file("c.txt", "three\n", "Add c.txt", 5);
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!((report.commit_count, report.known_commit_count), (1, 4));
        assert_eq!(database.count_commits(REPOSITORY), Ok(5));
        assert_eq!(database.find_commit(REPOSITORY, &new_hash).unwrap().unwrap().subject, "Add c.txt");
    }

    #[test]
    fn update_reads_a_new_commit_whose_date_is_older_than_the_commits_of_the_database() {
        let (repository, _) = TestRepository::with_four_commits("update_old_date");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("update_old_date_database");
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let old_hash = repository.commit_file("old.txt", "old\n", "A commit with an old date", 1);
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.commit_count, 1);
        assert!(database.find_commit(REPOSITORY, &old_hash).unwrap().is_some());
    }

    #[test]
    fn update_with_no_new_commit_writes_nothing() {
        let (repository, _) = TestRepository::with_four_commits("update_nothing");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("update_nothing_database");
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!((report.commit_count, report.known_commit_count), (0, 4));
        assert_eq!(database.count_commits(REPOSITORY), Ok(4));
    }

    #[test]
    fn update_of_one_repository_does_not_use_the_rows_of_another_repository() {
        let (repository, _) = TestRepository::with_four_commits("update_other_repository");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("update_other_repository_database");
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let report = run(SynchronizationMode::Update, "heidrun-org/another", &mut database, &reader, &ignore_log).unwrap();
        assert_eq!((report.commit_count, report.known_commit_count), (4, 0));
        assert_eq!(database.count_commits("heidrun-org/another"), Ok(4));
    }

    #[test]
    fn keeps_a_commit_that_no_branch_reaches_any_more() {
        let (repository, hashes) = TestRepository::with_four_commits("unreachable");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("unreachable_database");
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        repository.git(&["reset", "--quiet", "--hard", "HEAD~1"], 5);
        repository.git(&["branch", "--quiet", "--delete", "--force", "feature"], 5);
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!((report.commit_count, report.known_commit_count), (0, 2));
        assert_eq!(database.count_commits(REPOSITORY), Ok(4));
        assert!(database.find_commit(REPOSITORY, &hashes[3]).unwrap().is_some());
    }

    #[test]
    fn sends_the_lines_of_progress_of_the_commits_to_read_and_of_the_write() {
        let (repository, _) = TestRepository::with_four_commits("progress");
        let runner = GitCommandRunner::new(&repository.folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("progress_database");
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &log).unwrap();
        let path = database.database_path().display().to_string();
        let lines = lines.borrow();
        assert_eq!(
            *lines,
            [
                "mode initialize: 4 commits are read, 0 are already in the database".to_string(),
                format!("commits: written row count 4, file {path}"),
                "mode update: 0 commits are read, 4 are already in the database".to_string(),
                format!("commits: written row count 0, file {path}"),
            ]
        );
    }

    #[test]
    fn writes_nothing_and_says_so_when_the_folder_is_not_in_a_git_repository() {
        let folder = temp_folder("not_a_repository");
        let runner = GitCommandRunner::new(&folder);
        let reader = GitReader::new(&runner, &ignore_log);
        let mut database = new_database("not_a_repository_database");
        let error = run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap_err();
        assert!(error.contains("not a git repository"));
        assert_eq!(database.count_commits(REPOSITORY), Ok(0));
    }
}
