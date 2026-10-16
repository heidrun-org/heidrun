//! The reading of the chat session files that Claude Code and Codex save on the disk of the developer, and of the
//! configuration of the coding agent: the memory files, the subagents, and the skills.

pub mod agent_homes;
pub mod configuration_reader;
pub mod scan;
pub mod scan_cache;
pub mod session_files;
pub mod session_reader;
pub mod tokens;
