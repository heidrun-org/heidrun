//! Chats files: tells which of the files that a chat wrote still exist.
//!
//! A chat names the files that the coding agent wrote, and the coding agent often wrote them in a worktree that was
//! deleted after its merge. The caller maps each file to its path below the root of the repository, and asks here two
//! questions for each path:
//!
//! - `on_disk`: the file exists in the working folder of the root of the repository, so VS Code can open it.
//! - `on_remote`: the file exists on the default branch of the remote, as the last fetch knows it, so the web page of the
//!   file on the forge exists. The default branch is `refs/remotes/origin/HEAD`. A repository without it uses `HEAD`.
//!
//! The check of the remote is local and offline: it reads the objects of the repository with `git cat-file`.

use serde::Serialize;
use std::io::Write;
use std::path::{Component, Path};
use std::process::{Command, Stdio};

/// What is known about one file of a chat.
#[derive(Serialize, Debug, PartialEq)]
pub struct FileExistence {
    /// The path below the root of the repository, as the caller gave it.
    pub path: String,
    /// True when the file exists in the working folder of the root of the repository.
    pub on_disk: bool,
    /// True when the file exists on the default branch of the remote.
    pub on_remote: bool,
}

/// For each path below the root of the repository that holds `folder`, tells whether the file exists on the disk and on the
/// default branch of the remote. A path that is not below the root (absolute, with `..`, empty) does not exist.
#[tauri::command]
pub async fn chats_files_exist(folder: String, paths: Vec<String>) -> Result<Vec<FileExistence>, String> {
    // Off the main thread: it starts a Git process.
    tauri::async_runtime::spawn_blocking(move || check(&crate::project::find_root(Path::new(&folder)), &paths))
        .await
        .map_err(|e| e.to_string())
}

fn check(root: &Path, paths: &[String]) -> Vec<FileExistence> {
    let reference = default_branch_reference(root);
    let safe: Vec<&str> = paths.iter().map(String::as_str).filter(|path| is_safe(path)).collect();
    let on_remote = exist_in_reference(root, &reference, &safe);
    paths
        .iter()
        .map(|path| {
            let is_listed = is_safe(path);
            FileExistence {
                path: path.clone(),
                on_disk: is_listed && root.join(path).is_file(),
                on_remote: is_listed && on_remote.contains(path.as_str()),
            }
        })
        .collect()
}

/// True for a path that stays below the root: relative, made of normal parts, and without a line break.
fn is_safe(path: &str) -> bool {
    !path.is_empty()
        && !path.contains(['\n', '\r', '\0'])
        && Path::new(path).components().all(|component| matches!(component, Component::Normal(_)))
}

fn git(root: &Path) -> Command {
    let mut command = Command::new("git");
    command.arg("-C").arg(root).env("GIT_LITERAL_PATHSPECS", "1");
    command
}

/// `refs/remotes/origin/HEAD` when the repository has it, else `HEAD`.
fn default_branch_reference(root: &Path) -> String {
    let remote_head = "refs/remotes/origin/HEAD";
    let is_known = git(root)
        .args(["rev-parse", "--verify", "--quiet", &format!("{remote_head}^{{commit}}")])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    if is_known { remote_head.to_string() } else { "HEAD".to_string() }
}

/// The paths among `paths` that are files in the tree of `reference`.
fn exist_in_reference<'a>(root: &Path, reference: &str, paths: &[&'a str]) -> std::collections::HashSet<&'a str> {
    let mut found = std::collections::HashSet::new();
    if paths.is_empty() {
        return found;
    }
    let spawned = git(root)
        .args(["cat-file", "--batch-check"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    let Ok(mut child) = spawned else { return found };
    let input: String = paths.iter().map(|path| format!("{reference}:{path}\n")).collect();
    let Some(mut stdin) = child.stdin.take() else { return found };
    // A thread writes while this thread reads, so that a long list cannot fill the pipe and block both sides.
    let writer = std::thread::spawn(move || {
        let _ = stdin.write_all(input.as_bytes());
    });
    let output = child.wait_with_output();
    let _ = writer.join();
    let Ok(output) = output else { return found };
    let text = String::from_utf8_lossy(&output.stdout);
    for (path, line) in paths.iter().zip(text.lines()) {
        // A file answers "<id> blob <size>". A missing path answers "<name> missing". A folder answers "<id> tree <size>".
        if line.split(' ').nth(1) == Some("blob") {
            found.insert(*path);
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hd-chats-files-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn run_git(root: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"])
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .unwrap();
        assert!(status.success(), "git {args:?} failed");
    }

    /// A repository with one commit that holds `a.txt` and `src/b.txt`.
    fn repository(name: &str) -> PathBuf {
        let root = scratch(name);
        run_git(&root, &["init", "-q"]);
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::write(root.join("a.txt"), "a").unwrap();
        std::fs::write(root.join("src/b.txt"), "b").unwrap();
        run_git(&root, &["add", "."]);
        run_git(&root, &["commit", "-q", "-m", "first"]);
        root
    }

    fn answer(found: &[FileExistence], path: &str) -> (bool, bool) {
        let item = found.iter().find(|item| item.path == path).unwrap();
        (item.on_disk, item.on_remote)
    }

    fn paths(list: &[&str]) -> Vec<String> {
        list.iter().map(|path| path.to_string()).collect()
    }

    #[test]
    fn tells_that_a_committed_file_exists_on_the_disk_and_on_the_remote() {
        let root = repository("both");
        let found = check(&root, &paths(&["a.txt", "src/b.txt"]));
        assert_eq!(answer(&found, "a.txt"), (true, true));
        assert_eq!(answer(&found, "src/b.txt"), (true, true));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn tells_that_a_file_that_was_never_written_exists_nowhere() {
        let root = repository("nowhere");
        let found = check(&root, &paths(&["missing.txt", "src/missing.txt"]));
        assert_eq!(answer(&found, "missing.txt"), (false, false));
        assert_eq!(answer(&found, "src/missing.txt"), (false, false));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn tells_that_a_file_that_was_deleted_from_the_disk_still_exists_on_the_remote() {
        let root = repository("deleted");
        std::fs::remove_file(root.join("a.txt")).unwrap();
        let found = check(&root, &paths(&["a.txt"]));
        assert_eq!(answer(&found, "a.txt"), (false, true));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn tells_that_a_new_file_exists_on_the_disk_and_not_on_the_remote() {
        let root = repository("new");
        std::fs::write(root.join("new.txt"), "n").unwrap();
        let found = check(&root, &paths(&["new.txt"]));
        assert_eq!(answer(&found, "new.txt"), (true, false));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn reads_the_default_branch_of_the_remote_when_the_repository_knows_it() {
        let root = repository("origin");
        run_git(&root, &["update-ref", "refs/remotes/origin/main", "HEAD"]);
        run_git(&root, &["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
        std::fs::write(root.join("later.txt"), "l").unwrap();
        run_git(&root, &["add", "."]);
        run_git(&root, &["commit", "-q", "-m", "second"]);
        let found = check(&root, &paths(&["a.txt", "later.txt"]));
        assert_eq!(answer(&found, "a.txt"), (true, true));
        assert_eq!(answer(&found, "later.txt"), (true, false));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn does_not_count_a_folder_as_a_file() {
        let root = repository("folder");
        let found = check(&root, &paths(&["src"]));
        assert_eq!(answer(&found, "src"), (false, false));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn says_nothing_exists_for_a_path_that_leaves_the_root_and_for_a_folder_without_git() {
        let root = repository("unsafe");
        let found = check(&root, &paths(&["../a.txt", "/etc/hosts", "", "a.txt\nb"]));
        assert!(found.iter().all(|item| !item.on_disk && !item.on_remote));
        let plain = scratch("no-git");
        std::fs::write(plain.join("a.txt"), "a").unwrap();
        let found = check(&plain, &paths(&["a.txt"]));
        assert_eq!(answer(&found, "a.txt"), (true, false));
        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_dir_all(&plain);
    }

    #[test]
    fn keeps_the_order_and_the_paths_that_the_caller_gave() {
        let root = repository("order");
        let found = check(&root, &paths(&["src/b.txt", "../x", "a.txt"]));
        assert_eq!(found.iter().map(|item| item.path.as_str()).collect::<Vec<_>>(), vec!["src/b.txt", "../x", "a.txt"]);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn answers_for_an_empty_list() {
        let root = repository("empty");
        assert!(check(&root, &[]).is_empty());
        let _ = std::fs::remove_dir_all(&root);
    }
}
