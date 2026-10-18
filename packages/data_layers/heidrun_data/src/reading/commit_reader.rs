//! Reads the message, the files, and the diff of one commit, with the `GitRunner` of `data_layer_source_control`. A merge is
//! compared with its first parent, as the line counts of the data layer are.

use crate::output::QueryRow;
use data_layer_source_control::GitRunner;
use serde_json::{json, Value};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// One file changed by a commit.
#[derive(Debug, Clone, PartialEq)]
pub struct ChangedFile {
    /// The path of the file, relative to the root of the repository.
    pub path: String,
    /// The number of lines added, or `None` for a binary file.
    pub insertions: Option<u64>,
    /// The number of lines deleted, or `None` for a binary file.
    pub deletions: Option<u64>,
}

/// The content of one commit.
#[derive(Debug, Clone, PartialEq)]
pub struct CommitContent {
    /// The full hash of the commit.
    pub hash: String,
    /// The name of the author.
    pub author_name: String,
    /// The email address of the author.
    pub author_email: String,
    /// The date of the commit, in UTC.
    pub committed_at: String,
    /// The message: the subject, then the body.
    pub message: String,
    /// The files changed, compared with the first parent.
    pub files: Vec<ChangedFile>,
    /// The diff, compared with the first parent, or `None` when it was not asked for.
    pub diff: Option<String>,
}

impl CommitContent {
    /// The commit as one row: `hash`, `authorName`, `authorEmail`, `committedAt`, `message`, `files`, and `diff` when it
    /// was asked for.
    pub fn to_row(&self) -> QueryRow {
        let files: Vec<Value> = self
            .files
            .iter()
            .map(|file| json!({ "path": file.path, "insertions": file.insertions, "deletions": file.deletions }))
            .collect();
        let mut row = match json!({
            "hash": self.hash,
            "authorName": self.author_name,
            "authorEmail": self.author_email,
            "committedAt": self.committed_at,
            "message": self.message,
            "files": files,
        }) {
            Value::Object(row) => row,
            _ => unreachable!("The commit is an object"),
        };
        if let Some(diff) = &self.diff {
            row.insert("diff".to_string(), Value::from(diff.clone()));
        }
        row
    }

    /// The commit as text for a person: the header, the message, the files, then the diff.
    pub fn to_text(&self) -> String {
        let mut text = format!(
            "commit {}\nAuthor: {} <{}>\nDate:   {}\n\n{}\n\nFiles:\n",
            self.hash,
            self.author_name,
            self.author_email,
            self.committed_at,
            self.message.trim_end()
        );
        for file in &self.files {
            let counts = match (file.insertions, file.deletions) {
                (Some(insertions), Some(deletions)) => format!("+{insertions} -{deletions}"),
                _ => "binary".to_string(),
            };
            text.push_str(&format!("  {} ({counts})\n", file.path));
        }
        if let Some(diff) = &self.diff {
            text.push('\n');
            text.push_str(diff.trim_end());
            text.push('\n');
        }
        text
    }
}

/// Reads one commit. `hash` can be a short hash, and the content gives the full one.
///
/// # Errors
/// An error when `git` fails, for example when the hash is not a commit of the repository.
pub fn read_commit(runner: &dyn GitRunner, hash: &str, has_diff: bool) -> Result<CommitContent, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "read_commit", OperationKind::Collection)
        .parameter("hash", hash)
        .choice("hasDiff", has_diff);
    record(spec, || read_commit_inside(runner, hash, has_diff), |commit| Summary::count(commit.files.len()))
}

/// The work of `read_commit`, between the start event and the completion event of its operation.
fn read_commit_inside(runner: &dyn GitRunner, hash: &str, has_diff: bool) -> Result<CommitContent, String> {
    if hash.starts_with('-') {
        return Err(format!("The hash {hash} is not a hash."));
    }
    let revision = format!("{hash}^{{commit}}");
    let header = runner.run(&["show", "--no-patch", "--format=%H%x00%an%x00%ae%x00%cd%x00%B", "--date=iso-strict-local", &revision], None)?;
    let mut fields = header.splitn(5, '\0');
    let mut next = || fields.next().unwrap_or_default().to_string();
    let (hash, author_name, author_email, committed_at, message) = (next(), next(), next(), next(), next());
    let numstat = runner.run(&["show", "--diff-merges=first-parent", "--numstat", "--format=", &hash], None)?;
    let files = numstat
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(3, '\t');
            let insertions = parts.next()?.parse().ok();
            let deletions = parts.next()?.parse().ok();
            Some(ChangedFile { path: parts.next()?.to_string(), insertions, deletions })
        })
        .collect();
    let diff = if has_diff {
        Some(runner.run(&["show", "--diff-merges=first-parent", "--patch", "--no-color", "--format=", &hash], None)?)
    } else {
        None
    };
    Ok(CommitContent { hash, author_name, author_email, committed_at, message: message.trim_end().to_string(), files, diff })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fake runner that answers each command of `git show` from a fixed text.
    struct FakeRunner;

    impl GitRunner for FakeRunner {
        fn run(&self, arguments: &[&str], _: Option<&str>) -> Result<String, String> {
            if arguments.contains(&"--no-patch") {
                return Ok("abc123\0Ada Author\0ada@example.com\02026-10-11T10:00:00+00:00\0Add a.txt\n\nThe body.\n\n".into());
            }
            if arguments.contains(&"--numstat") {
                return Ok("3\t1\ta.txt\n-\t-\timage.png\n".into());
            }
            Ok("diff --git a/a.txt b/a.txt\n+one\n".into())
        }
    }

    #[test]
    fn reads_the_message_the_files_and_the_diff() {
        let commit = read_commit(&FakeRunner, "abc", true).unwrap();
        assert_eq!(commit.hash, "abc123");
        assert_eq!(commit.message, "Add a.txt\n\nThe body.");
        assert_eq!(
            commit.files,
            vec![
                ChangedFile { path: "a.txt".into(), insertions: Some(3), deletions: Some(1) },
                ChangedFile { path: "image.png".into(), insertions: None, deletions: None },
            ]
        );
        assert_eq!(commit.diff.as_deref(), Some("diff --git a/a.txt b/a.txt\n+one\n"));
        assert!(commit.to_text().contains("  a.txt (+3 -1)\n  image.png (binary)\n"));
    }

    #[test]
    fn stops_after_the_files_without_the_diff() {
        let commit = read_commit(&FakeRunner, "abc", false).unwrap();
        assert_eq!(commit.diff, None);
        assert_eq!(Value::Object(commit.to_row()).get("diff"), None);
    }

    #[test]
    fn refuses_a_hash_that_is_an_option() {
        assert!(read_commit(&FakeRunner, "--all", false).is_err());
    }
}
