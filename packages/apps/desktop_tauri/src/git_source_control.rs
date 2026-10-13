//! The Git actions of the Source control sidebar section: stage, unstage, discard, commit, stash, pull, push,
//! fetch, and the diff that a coding agent reads to write the commit message.
//!
//! Each command accepts only a root that `git_status` gave before (`known_root`), and only paths inside it
//! (`safe_rel`). The paths are literal: no globs, no pathspec magic.

use crate::git::{known_root, safe_rel};
use std::time::Duration;
use tokio::process::Command;

/// The time a local Git action may take.
const LOCAL_TIMEOUT: u64 = 20;
/// The time a Git action that talks to the remote repository may take.
const REMOTE_TIMEOUT: u64 = 90;
/// The largest diff given to the coding agent that writes the commit message.
const MAX_DIFF: usize = 60_000;

/// Runs `git -C root args`, with literal paths and no prompt, and gives the standard output, or the standard error
/// output as the error.
async fn run(root: &str, args: &[&str], timeout: u64) -> Result<String, String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_LITERAL_PATHSPECS", "1")
        .env("GIT_TERMINAL_PROMPT", "0")
        .kill_on_drop(true);
    let output = tokio::time::timeout(Duration::from_secs(timeout), command.output())
        .await
        .map_err(|_| format!("git {}: no answer in {timeout} s", args.first().unwrap_or(&"")))?
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let error = if error.is_empty() { String::from_utf8_lossy(&output.stdout).trim().to_string() } else { error };
    Err(if error.is_empty() { format!("git {} failed ({})", args.first().unwrap_or(&""), output.status) } else { error })
}

/// Checks the root and each path, and gives the paths as `&str`.
fn checked_paths<'a>(root: &str, paths: &'a [String]) -> Result<Vec<&'a str>, String> {
    known_root(root)?;
    if paths.is_empty() {
        return Err("no file".into());
    }
    paths.iter().map(|path| safe_rel(path)).collect()
}

/// Runs `git <first> -- <paths>`.
async fn run_on_paths(root: &str, first: &[&str], paths: &[&str]) -> Result<(), String> {
    let mut args: Vec<&str> = first.to_vec();
    args.push("--");
    args.extend(paths);
    run(root, &args, LOCAL_TIMEOUT).await.map(|_| ())
}

/// True when the repository has at least one commit.
async fn has_head(root: &str) -> bool {
    run(root, &["rev-parse", "--verify", "--quiet", "HEAD"], LOCAL_TIMEOUT).await.is_ok()
}

/// Stages the files `paths`: new files, changed files, and deleted files.
#[tauri::command]
pub async fn git_stage(root: String, paths: Vec<String>) -> Result<(), String> {
    let paths = checked_paths(&root, &paths)?;
    run_on_paths(&root, &["add", "--all"], &paths).await
}

/// Unstages the files `paths`. The changes stay in the working folder.
#[tauri::command]
pub async fn git_unstage(root: String, paths: Vec<String>) -> Result<(), String> {
    let paths = checked_paths(&root, &paths)?;
    if has_head(&root).await {
        return run_on_paths(&root, &["restore", "--staged"], &paths).await;
    }
    run_on_paths(&root, &["rm", "--cached", "--quiet", "-r"], &paths).await
}

/// Discards the changes of the files `paths` that are not staged. A file that Git does not know is deleted.
#[tauri::command]
pub async fn git_discard(root: String, paths: Vec<String>) -> Result<(), String> {
    let paths = checked_paths(&root, &paths)?;
    let mut known_paths: Vec<&str> = Vec::new();
    let mut unknown_paths: Vec<&str> = Vec::new();
    for path in paths {
        let listed = run(&root, &["ls-files", "--", path], LOCAL_TIMEOUT).await?;
        if listed.trim().is_empty() {
            unknown_paths.push(path);
        } else {
            known_paths.push(path);
        }
    }
    if known_paths.is_empty() == false {
        run_on_paths(&root, &["restore", "--worktree"], &known_paths).await?;
    }
    if unknown_paths.is_empty() == false {
        run_on_paths(&root, &["clean", "--force"], &unknown_paths).await?;
    }
    Ok(())
}

/// Makes a commit of the staged files with `message`. With `amend`, the commit replaces the last commit.
#[tauri::command]
pub async fn git_commit(root: String, message: String, amend: bool) -> Result<String, String> {
    known_root(&root)?;
    if message.trim().is_empty() {
        return Err("empty commit message".into());
    }
    let mut args = vec!["commit", "--message", message.as_str()];
    if amend {
        args.push("--amend");
    }
    run(&root, &args, LOCAL_TIMEOUT).await
}

/// Puts the changes aside with `git stash push`: the staged files only when `staged_only`, else every change and
/// every new file.
#[tauri::command]
pub async fn git_stash(root: String, staged_only: bool) -> Result<String, String> {
    known_root(&root)?;
    if staged_only {
        return run(&root, &["stash", "push", "--staged", "--message", "Heidrun"], LOCAL_TIMEOUT).await;
    }
    run(&root, &["stash", "push", "--include-untracked", "--message", "Heidrun"], LOCAL_TIMEOUT).await
}

/// Runs `git pull`, `git push`, or `git fetch` (`action`). A push of a branch without an upstream branch sets
/// `origin` as its upstream.
#[tauri::command]
pub async fn git_sync(root: String, action: String) -> Result<String, String> {
    known_root(&root)?;
    match action.as_str() {
        "pull" => run(&root, &["pull", "--no-edit"], REMOTE_TIMEOUT).await,
        "fetch" => run(&root, &["fetch", "--prune"], REMOTE_TIMEOUT).await,
        "push" => {
            let upstream = run(&root, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], LOCAL_TIMEOUT).await;
            if upstream.is_ok() {
                return run(&root, &["push"], REMOTE_TIMEOUT).await;
            }
            let branch = run(&root, &["symbolic-ref", "--short", "HEAD"], LOCAL_TIMEOUT).await?;
            run(&root, &["push", "--set-upstream", "origin", branch.trim()], REMOTE_TIMEOUT).await
        }
        _ => Err(format!("unknown Git action: {action}")),
    }
}

/// The diff of the staged files, or of every change when nothing is staged, cut to `MAX_DIFF` bytes. A coding
/// agent reads it to write the commit message.
#[tauri::command]
pub async fn git_commit_diff(root: String) -> Result<String, String> {
    known_root(&root)?;
    let staged = run(&root, &["-c", "core.quotepath=off", "diff", "--cached", "--no-color", "--no-ext-diff"], LOCAL_TIMEOUT).await?;
    let diff = if staged.trim().is_empty() {
        let target = if has_head(&root).await { "HEAD" } else { "--cached" };
        run(&root, &["-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff", target], LOCAL_TIMEOUT).await?
    } else {
        staged
    };
    Ok(cut(diff, MAX_DIFF))
}

/// Cuts `text` to at most `max` bytes, on a character boundary.
fn cut(mut text: String, max: usize) -> String {
    if text.len() <= max {
        return text;
    }
    let mut end = max;
    while text.is_char_boundary(end) == false {
        end -= 1;
    }
    text.truncate(end);
    text
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::remember_root;
    use std::path::PathBuf;

    /// A temporary Git repository with one commit of the file `kept.txt`.
    struct Repository {
        folder: PathBuf,
    }

    impl Repository {
        fn new(name: &str) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun_source_control_{name}_{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(&folder).unwrap();
            let repository = Repository { folder };
            repository.git(&["init", "--quiet", "--initial-branch=main"]);
            repository.git(&["config", "user.email", "test@example.com"]);
            repository.git(&["config", "user.name", "Test"]);
            repository.write("kept.txt", "first\n");
            repository.git(&["add", "kept.txt"]);
            repository.git(&["commit", "--quiet", "--message", "first"]);
            remember_root(&repository.root());
            repository
        }

        fn root(&self) -> String {
            self.folder.to_string_lossy().into_owned()
        }

        fn write(&self, path: &str, text: &str) {
            std::fs::write(self.folder.join(path), text).unwrap();
        }

        fn read(&self, path: &str) -> Option<String> {
            std::fs::read_to_string(self.folder.join(path)).ok()
        }

        fn git(&self, args: &[&str]) -> String {
            let output = std::process::Command::new("git").arg("-C").arg(&self.folder).args(args).output().unwrap();
            String::from_utf8_lossy(&output.stdout).into_owned()
        }

        fn status(&self) -> String {
            self.git(&["status", "--porcelain"])
        }
    }

    impl Drop for Repository {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.folder);
        }
    }

    #[tokio::test]
    async fn stages_then_unstages_a_changed_file() {
        let repository = Repository::new("stage");
        repository.write("kept.txt", "second\n");
        git_stage(repository.root(), vec!["kept.txt".into()]).await.unwrap();
        assert_eq!(repository.status(), "M  kept.txt\n");
        git_unstage(repository.root(), vec!["kept.txt".into()]).await.unwrap();
        assert_eq!(repository.status(), " M kept.txt\n");
    }

    #[tokio::test]
    async fn discards_a_changed_file_and_deletes_a_new_file() {
        let repository = Repository::new("discard");
        repository.write("kept.txt", "second\n");
        repository.write("new.txt", "new\n");
        git_discard(repository.root(), vec!["kept.txt".into(), "new.txt".into()]).await.unwrap();
        assert_eq!(repository.read("kept.txt").as_deref(), Some("first\n"));
        assert_eq!(repository.read("new.txt"), None);
        assert_eq!(repository.status(), "");
    }

    #[tokio::test]
    async fn commits_the_staged_files_and_amends_the_last_commit() {
        let repository = Repository::new("commit");
        repository.write("kept.txt", "second\n");
        git_stage(repository.root(), vec!["kept.txt".into()]).await.unwrap();
        git_commit(repository.root(), "Change the kept file".into(), false).await.unwrap();
        assert_eq!(repository.git(&["log", "-1", "--format=%s"]), "Change the kept file\n");
        git_commit(repository.root(), "Change the kept file again".into(), true).await.unwrap();
        assert_eq!(repository.git(&["log", "--format=%s"]), "Change the kept file again\nfirst\n");
    }

    #[tokio::test]
    async fn refuses_an_empty_commit_message() {
        let repository = Repository::new("empty_message");
        assert!(git_commit(repository.root(), "  ".into(), false).await.is_err());
    }

    #[tokio::test]
    async fn gives_the_staged_diff_or_every_change_when_nothing_is_staged() {
        let repository = Repository::new("diff");
        repository.write("kept.txt", "second\n");
        let every_change = git_commit_diff(repository.root()).await.unwrap();
        assert!(every_change.contains("+second"));
        repository.write("other.txt", "other\n");
        git_stage(repository.root(), vec!["other.txt".into()]).await.unwrap();
        let staged = git_commit_diff(repository.root()).await.unwrap();
        assert!(staged.contains("+other"));
        assert!(staged.contains("+second") == false);
    }

    #[tokio::test]
    async fn refuses_a_root_that_git_status_did_not_give() {
        let answer = git_stage("/tmp/not_a_known_root".into(), vec!["file.txt".into()]).await;
        assert!(answer.is_err());
    }

    #[tokio::test]
    async fn refuses_a_path_outside_the_repository() {
        let repository = Repository::new("outside");
        assert!(git_stage(repository.root(), vec!["../outside.txt".into()]).await.is_err());
        assert!(git_discard(repository.root(), vec!["/etc/hosts".into()]).await.is_err());
    }

    #[test]
    fn cuts_a_text_on_a_character_boundary() {
        assert_eq!(cut("abcé".into(), 4), "abc");
        assert_eq!(cut("abc".into(), 10), "abc");
    }
}
