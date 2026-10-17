//! The state of the working copy of a repository now: which files of a list exist, and which folders and branches the
//! worktrees have. The answer is a live check of the computer, bounded by the size of the list, and it reads no history.
//!
//! A chat names the files that the coding agent wrote, and the coding agent often wrote them in a worktree that was deleted
//! after its merge. The caller maps each file to its path below the root of the repository, and asks here two questions for
//! each path:
//! - `on_disk`: the file exists in the working folder of the root of the repository, so an editor can open it.
//! - `on_remote`: the file exists on the default branch of the remote, as the last fetch knows it, so the web page of the file
//!   on the code hosting service exists. The default branch is `refs/remotes/origin/HEAD`. A repository without it uses `HEAD`.
//!
//! The check of the remote is local and offline: it reads the objects of the repository with `git cat-file`.

use crate::git::git_runner::{GitCommandRunner, GitRunner};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Component, Path};

/// What is known about one file of a chat.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FileExistence {
    /// The path below the root of the repository, as the caller gave it.
    pub path: String,
    /// True when the file exists in the working folder of the root of the repository.
    pub on_disk: bool,
    /// True when the file exists on the default branch of the remote.
    pub on_remote: bool,
}

/// One worktree folder that exists, with the branch that it has checked out.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WorktreeBranch {
    /// The folder, as the caller gave it.
    pub folder: String,
    /// The current branch, or `None` when the head of the worktree is detached or cannot be read.
    pub branch: Option<String>,
}

/// For each path below `root`, tells whether the file exists on the disk and on the default branch of the remote. A path that
/// is not below the root (absolute, with `..`, empty) does not exist. The answer keeps the order and the paths of the caller.
pub fn find_file_existence(root: &Path, paths: &[String]) -> Vec<FileExistence> {
    let runner = GitCommandRunner::new(root).with_literal_pathspecs();
    let reference = find_default_branch_reference(&runner);
    let safe_paths: Vec<&str> = paths.iter().map(String::as_str).filter(|path| is_safe(path)).collect();
    let on_remote = find_paths_in_reference(&runner, &reference, &safe_paths);
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

/// The folders among `folders` that exist on the disk. A folder that is not an absolute path does not exist. The answer keeps
/// the order of the caller.
pub fn find_existing_folders(folders: &[String]) -> Vec<String> {
    folders
        .iter()
        .filter(|folder| Path::new(folder.as_str()).is_absolute() && Path::new(folder.as_str()).is_dir())
        .cloned()
        .collect()
}

/// For each folder among `folders` that exists, the current branch of the worktree. A folder that does not exist is left out,
/// so the caller knows that the worktree was removed. The answer keeps the order of the caller.
pub fn find_worktree_branches(folders: &[String]) -> Vec<WorktreeBranch> {
    find_existing_folders(folders)
        .into_iter()
        .map(|folder| {
            let branch = find_current_branch(Path::new(&folder));
            WorktreeBranch { folder, branch }
        })
        .collect()
}

/// The branch that the worktree in `folder` has checked out. The folder of a worktree holds a file `.git` with the line
/// `gitdir: <folder of the worktree inside the repository>`, and the main checkout holds a folder `.git`. The file `HEAD` of
/// that folder says `ref: refs/heads/<branch>`, or a commit when the head is detached.
fn find_current_branch(folder: &Path) -> Option<String> {
    let dot_git = folder.join(".git");
    let git_folder = if dot_git.is_dir() {
        dot_git
    } else {
        let text = std::fs::read_to_string(&dot_git).ok()?;
        let target = Path::new(text.trim().strip_prefix("gitdir:")?.trim());
        if target.is_absolute() {
            target.to_path_buf()
        } else {
            folder.join(target)
        }
    };
    let head = std::fs::read_to_string(git_folder.join("HEAD")).ok()?;
    head.trim().strip_prefix("ref: refs/heads/").map(str::to_string)
}

/// True for a path that stays below the root: relative, made of normal parts, and without a line break.
fn is_safe(path: &str) -> bool {
    !path.is_empty()
        && !path.contains(['\n', '\r', '\0'])
        && Path::new(path).components().all(|component| matches!(component, Component::Normal(_)))
}

/// `refs/remotes/origin/HEAD` when the repository has it, else `HEAD`.
fn find_default_branch_reference(runner: &dyn GitRunner) -> String {
    let remote_head = "refs/remotes/origin/HEAD";
    let is_known = runner.run(&["rev-parse", "--verify", "--quiet", &format!("{remote_head}^{{commit}}")], None).is_ok();
    if is_known {
        remote_head.to_string()
    } else {
        "HEAD".to_string()
    }
}

/// The paths among `paths` that are files in the tree of `reference`.
fn find_paths_in_reference<'a>(runner: &dyn GitRunner, reference: &str, paths: &[&'a str]) -> HashSet<&'a str> {
    let mut found = HashSet::new();
    if paths.is_empty() {
        return found;
    }
    let input: String = paths.iter().map(|path| format!("{reference}:{path}\n")).collect();
    let Ok(text) = runner.run(&["cat-file", "--batch-check"], Some(&input)) else {
        return found;
    };
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
    use crate::test_samples::{temp_folder, TestRepository};

    /// A repository with one commit that holds `a.txt` and `src/b.txt`.
    fn repository(name: &str) -> TestRepository {
        let repository = TestRepository::new(name);
        std::fs::create_dir_all(repository.folder.join("src")).unwrap();
        std::fs::write(repository.folder.join("a.txt"), "a").unwrap();
        std::fs::write(repository.folder.join("src/b.txt"), "b").unwrap();
        repository.git(&["add", "."], 1);
        repository.git(&["commit", "--quiet", "-m", "first"], 1);
        repository
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
        let repository = repository("working_copy_both");
        let found = find_file_existence(&repository.folder, &paths(&["a.txt", "src/b.txt"]));
        assert_eq!(answer(&found, "a.txt"), (true, true));
        assert_eq!(answer(&found, "src/b.txt"), (true, true));
    }

    #[test]
    fn tells_that_a_file_that_was_never_written_exists_nowhere() {
        let repository = repository("working_copy_nowhere");
        let found = find_file_existence(&repository.folder, &paths(&["missing.txt", "src/missing.txt"]));
        assert_eq!(answer(&found, "missing.txt"), (false, false));
        assert_eq!(answer(&found, "src/missing.txt"), (false, false));
    }

    #[test]
    fn tells_that_a_file_that_was_deleted_from_the_disk_still_exists_on_the_remote() {
        let repository = repository("working_copy_deleted");
        std::fs::remove_file(repository.folder.join("a.txt")).unwrap();
        let found = find_file_existence(&repository.folder, &paths(&["a.txt"]));
        assert_eq!(answer(&found, "a.txt"), (false, true));
    }

    #[test]
    fn tells_that_a_new_file_exists_on_the_disk_and_not_on_the_remote() {
        let repository = repository("working_copy_new");
        std::fs::write(repository.folder.join("new.txt"), "n").unwrap();
        let found = find_file_existence(&repository.folder, &paths(&["new.txt"]));
        assert_eq!(answer(&found, "new.txt"), (true, false));
    }

    #[test]
    fn reads_the_default_branch_of_the_remote_when_the_repository_knows_it() {
        let repository = repository("working_copy_origin");
        repository.git(&["update-ref", "refs/remotes/origin/main", "HEAD"], 1);
        repository.git(&["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], 1);
        repository.commit_file("later.txt", "l", "second", 2);
        let found = find_file_existence(&repository.folder, &paths(&["a.txt", "later.txt"]));
        assert_eq!(answer(&found, "a.txt"), (true, true));
        assert_eq!(answer(&found, "later.txt"), (true, false));
    }

    #[test]
    fn does_not_count_a_folder_as_a_file() {
        let repository = repository("working_copy_folder");
        let found = find_file_existence(&repository.folder, &paths(&["src"]));
        assert_eq!(answer(&found, "src"), (false, false));
    }

    #[test]
    fn says_nothing_exists_for_a_path_that_leaves_the_root_and_a_file_exists_in_a_folder_without_git() {
        let repository = repository("working_copy_unsafe");
        let found = find_file_existence(&repository.folder, &paths(&["../a.txt", "/etc/hosts", "", "a.txt\nb"]));
        assert!(found.iter().all(|item| !item.on_disk && !item.on_remote));
        let plain = temp_folder("working_copy_no_git");
        std::fs::write(plain.join("a.txt"), "a").unwrap();
        let found = find_file_existence(&plain, &paths(&["a.txt"]));
        assert_eq!(answer(&found, "a.txt"), (true, false));
    }

    #[test]
    fn keeps_the_order_and_the_paths_that_the_caller_gave_and_answers_for_an_empty_list() {
        let repository = repository("working_copy_order");
        let found = find_file_existence(&repository.folder, &paths(&["src/b.txt", "../x", "a.txt"]));
        assert_eq!(found.iter().map(|item| item.path.as_str()).collect::<Vec<_>>(), vec!["src/b.txt", "../x", "a.txt"]);
        assert!(find_file_existence(&repository.folder, &[]).is_empty());
    }

    #[test]
    fn keeps_the_folders_that_exist_in_the_order_of_the_caller() {
        let root = temp_folder("working_copy_folders");
        std::fs::create_dir_all(root.join("one")).unwrap();
        std::fs::create_dir_all(root.join("two")).unwrap();
        let wanted = vec![
            root.join("two").to_string_lossy().to_string(),
            root.join("gone").to_string_lossy().to_string(),
            root.join("one").to_string_lossy().to_string(),
        ];
        assert_eq!(find_existing_folders(&wanted), vec![wanted[0].clone(), wanted[2].clone()]);
    }

    #[test]
    fn does_not_count_a_file_or_a_relative_path_as_a_worktree_folder() {
        let root = temp_folder("working_copy_folder_file");
        std::fs::write(root.join("a.txt"), "a").unwrap();
        let file = root.join("a.txt").to_string_lossy().to_string();
        assert!(find_existing_folders(&[file, "relative/folder".to_string(), String::new()]).is_empty());
    }

    #[test]
    fn reads_the_branch_of_a_worktree_from_its_git_file() {
        let root = temp_folder("working_copy_branch_worktree");
        let git_folder = root.join("repository/.git/worktrees/fix-35");
        std::fs::create_dir_all(&git_folder).unwrap();
        std::fs::write(git_folder.join("HEAD"), "ref: refs/heads/fix-tab-35\n").unwrap();
        let worktree = root.join("repository/.claude/worktrees/fix-35");
        std::fs::create_dir_all(&worktree).unwrap();
        std::fs::write(worktree.join(".git"), format!("gitdir: {}\n", git_folder.display())).unwrap();
        assert_eq!(find_current_branch(&worktree), Some("fix-tab-35".to_string()));
    }

    #[test]
    fn reads_the_branch_of_a_checkout_that_has_a_git_folder_and_a_relative_git_file() {
        let root = temp_folder("working_copy_branch_checkout");
        std::fs::create_dir_all(root.join("main/.git")).unwrap();
        std::fs::write(root.join("main/.git/HEAD"), "ref: refs/heads/dev_jerome\n").unwrap();
        assert_eq!(find_current_branch(&root.join("main")), Some("dev_jerome".to_string()));
        std::fs::create_dir_all(root.join("linked")).unwrap();
        std::fs::write(root.join("linked/.git"), "gitdir: ../main/.git\n").unwrap();
        assert_eq!(find_current_branch(&root.join("linked")), Some("dev_jerome".to_string()));
    }

    #[test]
    fn has_no_branch_for_a_detached_head_or_a_folder_without_git() {
        let root = temp_folder("working_copy_branch_none");
        std::fs::create_dir_all(root.join("detached/.git")).unwrap();
        std::fs::write(root.join("detached/.git/HEAD"), "0123456789abcdef0123456789abcdef01234567\n").unwrap();
        assert_eq!(find_current_branch(&root.join("detached")), None);
        std::fs::create_dir_all(root.join("plain")).unwrap();
        assert_eq!(find_current_branch(&root.join("plain")), None);
    }

    #[test]
    fn gives_the_branch_only_for_the_folders_that_exist() {
        let root = temp_folder("working_copy_branches_list");
        std::fs::create_dir_all(root.join("one/.git")).unwrap();
        std::fs::write(root.join("one/.git/HEAD"), "ref: refs/heads/one-branch\n").unwrap();
        let one: String = root.join("one").to_string_lossy().to_string();
        let gone: String = root.join("gone").to_string_lossy().to_string();
        let found = find_worktree_branches(&[gone, one.clone()]);
        assert_eq!(found, vec![WorktreeBranch { folder: one, branch: Some("one-branch".to_string()) }]);
    }
}
