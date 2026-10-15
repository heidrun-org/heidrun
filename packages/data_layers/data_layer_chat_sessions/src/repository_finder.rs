//! Finds the root and the repository of a folder: the first folder up that holds `.git`, and the name `owner/name` that the
//! remote `origin` gives. This file is the only place of the package that runs the command `git`.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Walks up from `folder` to the first folder that holds `.git` (a folder, or a file in a worktree). Returns `folder` when no
/// folder up holds `.git`.
pub fn find_root(folder: &Path) -> PathBuf {
    let mut current = Some(folder);
    while let Some(candidate) = current {
        if candidate.join(".git").exists() {
            return candidate.to_path_buf();
        }
        current = candidate.parent();
    }
    folder.to_path_buf()
}

/// The repository in the format `owner/name`, from the address of the remote `origin` of the repository at `root`.
///
/// # Errors
/// An error when the command `git` cannot run, when the repository has no remote `origin`, or when the address of the remote
/// has no owner and no name.
pub fn find_repository(root: &Path) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["config", "--get", "remote.origin.url"])
        .output()
        .map_err(|error| format!("The command git cannot run: {error}"))?;
    let address = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !output.status.success() || address.is_empty() {
        return Err(format!(
            "The folder {} has no remote origin. Give the repository with the option --repository.",
            root.display()
        ));
    }
    parse_repository(&address).ok_or_else(|| {
        format!("The address {address} of the remote origin has no owner and no name. Give the repository with the option --repository.")
    })
}

/// The owner and the name of a repository, from the address of a remote: `https://github.com/owner/name.git`,
/// `git@github.com:owner/name.git`, or `ssh://git@host/owner/name`. It is the last two parts of the address, without the
/// ending `.git`. `None` when the address has fewer than two parts.
pub fn parse_repository(address: &str) -> Option<String> {
    let address = address.trim().trim_end_matches('/');
    let address = address.strip_suffix(".git").unwrap_or(address);
    let parts: Vec<&str> = address.split(['/', ':']).filter(|part| !part.is_empty()).collect();
    if parts.len() < 2 {
        return None;
    }
    Some(format!("{}/{}", parts[parts.len() - 2], parts[parts.len() - 1]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::temp_folder;

    #[test]
    fn reads_the_owner_and_the_name_of_each_form_of_address() {
        for address in [
            "https://github.com/heidrun-org/heidrun.git",
            "https://github.com/heidrun-org/heidrun",
            "https://github.com/heidrun-org/heidrun/",
            "git@github.com:heidrun-org/heidrun.git",
            "ssh://git@github.com:22/heidrun-org/heidrun.git",
        ] {
            assert_eq!(parse_repository(address).as_deref(), Some("heidrun-org/heidrun"), "{address}");
        }
        assert_eq!(parse_repository("heidrun"), None);
        assert_eq!(parse_repository(""), None);
    }

    #[test]
    fn walks_up_to_the_folder_that_holds_git() {
        let root = temp_folder("find_root");
        std::fs::create_dir_all(root.join(".git")).unwrap();
        std::fs::create_dir_all(root.join("packages/a")).unwrap();
        assert_eq!(find_root(&root.join("packages/a")), root);
        let worktree = temp_folder("find_root_worktree");
        std::fs::write(worktree.join(".git"), "gitdir: /elsewhere\n").unwrap();
        assert_eq!(find_root(&worktree), worktree);
    }

    #[test]
    fn finds_the_repository_from_the_remote_origin_and_refuses_a_repository_without_it() {
        let root = temp_folder("find_repository");
        let git = |args: &[&str]| {
            let status = Command::new("git").arg("-C").arg(&root).args(args).status().unwrap();
            assert!(status.success());
        };
        git(&["init", "-q"]);
        assert!(find_repository(&root).unwrap_err().contains("--repository"));
        git(&["remote", "add", "origin", "git@github.com:fake-owner/fake-name.git"]);
        assert_eq!(find_repository(&root).as_deref(), Ok("fake-owner/fake-name"));
    }
}
