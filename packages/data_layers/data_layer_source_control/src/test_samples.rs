//! Sample data and a real Git repository for the tests of the package. Only the tests compile this file.

use crate::model::types::Commit;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

/// A date in October 2026, in UTC, in the format ISO 8601. `day` goes from 1 to 28.
pub fn date(day: u32) -> String {
    format!("2026-10-{day:02}T10:00:00Z")
}

/// The number of folders that `temp_folder` made. Two tests that give the same name never get the same folder.
static FOLDER_COUNT: AtomicUsize = AtomicUsize::new(0);

/// A new empty folder in the temporary folder. Each test gives its own name.
pub fn temp_folder(name: &str) -> PathBuf {
    let folder_number = FOLDER_COUNT.fetch_add(1, Ordering::SeqCst);
    let folder =
        std::env::temp_dir().join(format!("data_layer_source_control_{name}_{}_{folder_number}", std::process::id()));
    let _ = std::fs::remove_dir_all(&folder);
    std::fs::create_dir_all(&folder).unwrap();
    folder
}

/// A hash of 40 characters. Each number gives another hash.
pub fn hash(number: u32) -> String {
    format!("{number:040x}")
}

/// A commit that follows the JSON schema. It has no parent, and its date is the day 2.
pub fn commit(number: u32) -> Commit {
    Commit {
        hash: hash(number),
        parents: vec![],
        author_name: "Ada Author".into(),
        author_email: "ada@example.com".into(),
        authored_at: date(1),
        committer_name: "Cora Committer".into(),
        committer_email: "cora@example.com".into(),
        committed_at: date(2),
        subject: "A subject".into(),
        body: "The body of the commit.".into(),
        files_changed: 2,
        insertions: 10,
        deletions: 3,
    }
}

/// A merge that follows the JSON schema. Its two parents are the commits `first_parent` and `second_parent`.
pub fn merge_commit(number: u32, first_parent: u32, second_parent: u32) -> Commit {
    Commit { parents: vec![hash(first_parent), hash(second_parent)], ..commit(number) }
}

/// A real Git repository in a new folder of the temporary folder. The commands that it runs use a fixed author, a fixed
/// committer, and no configuration file of the developer, so the result is the same on every computer.
pub struct TestRepository {
    /// The folder of the repository.
    pub folder: PathBuf,
}

impl TestRepository {
    /// Creates a repository with the branch `main` and no commit.
    pub fn new(name: &str) -> Self {
        let repository = TestRepository { folder: temp_folder(name) };
        repository.git(&["init", "--quiet", "--initial-branch=main"], 1);
        repository
    }

    /// Creates a repository with four commits, and gives it with their hashes, in this order:
    /// 1. The first commit, on the branch `main`, the day 1. It adds the file `a.txt` with one line.
    /// 2. A commit on the branch `feature`, the day 2. It adds the file `b.txt` with two lines.
    /// 3. A commit on the branch `main`, the day 3. It adds one line to the file `a.txt`.
    /// 4. The merge of the branch `feature` into the branch `main`, the day 4.
    pub fn with_four_commits(name: &str) -> (Self, Vec<String>) {
        let repository = TestRepository::new(name);
        let first_commit = repository.commit_file(
            "a.txt",
            "one\n",
            "First commit\n\nThe body of the first commit.\n\nIt has two paragraphs.",
            1,
        );
        repository.git(&["checkout", "--quiet", "-b", "feature"], 2);
        let feature_commit = repository.commit_file("b.txt", "line one\nline two\n", "Add b.txt on feature", 2);
        repository.git(&["checkout", "--quiet", "main"], 3);
        let main_commit = repository.commit_file("a.txt", "one\ntwo\n", "Change a.txt on main", 3);
        repository.git(&["merge", "--quiet", "--no-ff", "feature", "-m", "Merge feature into main"], 4);
        let merge = repository.git(&["rev-parse", "HEAD"], 4);
        (repository, vec![first_commit, feature_commit, main_commit, merge])
    }

    /// Writes a file, adds it, makes a commit, and gives the hash of the commit. The author and the committer date is the
    /// day `day` at 10:00 in the time zone +02:00, so the date in UTC is 08:00.
    pub fn commit_file(&self, file_name: &str, content: &str, message: &str, day: u32) -> String {
        std::fs::write(self.folder.join(file_name), content).unwrap();
        self.git(&["add", file_name], day);
        self.git(&["commit", "--quiet", "-m", message], day);
        self.git(&["rev-parse", "HEAD"], day)
    }

    /// Runs `git` in the folder with the fixed identity, and gives its standard output without the new line at the end.
    ///
    /// # Panics
    /// When the command fails.
    pub fn git(&self, arguments: &[&str], day: u32) -> String {
        let date_text = format!("2026-10-{day:02}T10:00:00+02:00");
        let output = Command::new("git")
            .arg("-C")
            .arg(&self.folder)
            .args(arguments)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_AUTHOR_NAME", "Ada Author")
            .env("GIT_AUTHOR_EMAIL", "ada@example.com")
            .env("GIT_AUTHOR_DATE", &date_text)
            .env("GIT_COMMITTER_NAME", "Cora Committer")
            .env("GIT_COMMITTER_EMAIL", "cora@example.com")
            .env("GIT_COMMITTER_DATE", &date_text)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {} failed: {}",
            arguments.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim_end().to_string()
    }
}
