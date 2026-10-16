//! The folders where Claude Code and Codex keep their files, and the folder `.agents` that several coding agents read.

use std::path::PathBuf;

/// The folder of the configuration of Claude Code: the variable `CLAUDE_CONFIG_DIR`, else `~/.claude`.
pub fn claude_dir() -> PathBuf {
    if let Ok(directory) = std::env::var("CLAUDE_CONFIG_DIR") {
        if !directory.is_empty() {
            return PathBuf::from(directory);
        }
    }
    dirs::home_dir().unwrap_or_default().join(".claude")
}

/// The folder of Codex: the variable `CODEX_HOME`, else `~/.codex`.
pub fn codex_home() -> PathBuf {
    if let Ok(directory) = std::env::var("CODEX_HOME") {
        if !directory.is_empty() {
            return PathBuf::from(directory);
        }
    }
    dirs::home_dir().unwrap_or_default().join(".codex")
}

/// The folder `.agents` of the home folder, which several coding agents read: `~/.agents`.
pub fn agents_home() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".agents")
}
