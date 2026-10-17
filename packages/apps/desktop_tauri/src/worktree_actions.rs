//! The action of the Past chats sidebar section that opens the folder of a worktree in VS Code. It is an action, not a
//! retrieval: it shows no data of a chat, so it sits outside the folder `past_chats`.

use std::path::{Component, Path};
use std::process::Command;

/// Opens the folder of one worktree in VS Code, or in the default application when VS Code is not installed. Only a folder
/// that exists and sits in a worktree of Claude (`.claude/worktrees/`) or of Codex (`.codex/worktrees/`) opens.
#[tauri::command(async)]
pub fn chats_worktree_open_in_vscode(folder: String) -> Result<(), String> {
    if !is_worktree_folder(&folder) {
        return Err("This folder is not a worktree that exists.".to_string());
    }
    let vscode = Command::new("open").arg("-a").arg("Visual Studio Code").arg(&folder).status();
    if matches!(vscode, Ok(status) if status.success()) {
        return Ok(());
    }
    match Command::new("open").arg(&folder).status() {
        Ok(status) if status.success() => Ok(()),
        _ => Err("The folder cannot be opened.".to_string()),
    }
}

/// True for an absolute path of a folder that exists and has `.claude/worktrees/` or `.codex/worktrees/` in its path.
fn is_worktree_folder(folder: &str) -> bool {
    let path = Path::new(folder);
    let is_in_worktrees = folder.contains("/.claude/worktrees/") || folder.contains("/.codex/worktrees/");
    is_in_worktrees && path.is_absolute() && path.is_dir() && path.components().all(|part| part != Component::ParentDir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_a_folder_that_is_not_a_worktree_or_does_not_exist() {
        assert!(!is_worktree_folder("/tmp"));
        assert!(!is_worktree_folder("/work/app/.claude/worktrees/none-that-exists"));
        assert!(!is_worktree_folder("relative/.claude/worktrees/x"));
        assert!(chats_worktree_open_in_vscode("/tmp".to_string()).is_err());
    }

    #[test]
    fn accepts_an_existing_folder_below_a_worktree_folder_of_claude_or_of_codex() {
        for tool in [".claude", ".codex"] {
            let folder = std::env::temp_dir().join(format!("hd-worktree-action-{}", std::process::id())).join(tool).join("worktrees").join("fix");
            std::fs::create_dir_all(&folder).unwrap();
            assert!(is_worktree_folder(&folder.display().to_string()));
            let _ = std::fs::remove_dir_all(folder.ancestors().nth(3).unwrap());
        }
    }
}
