//! The chat sessions source of the data layer of Heidrun: reads the chat sessions that Claude Code and Codex saved for a
//! repository, and writes the facts of each one in a SQLite file.
//!
//! The library has four parts:
//! - `scan`, `tokens`, and `ScanCache` read one chat session file without a model: the title, the dates, the messages, the
//!   folders, the issues, the pull requests, the files that the coding agent wrote, and the tokens of each model.
//! - `find_claude_session_files`, `find_codex_session_files`, and `read_codex_titles` find the chat session files of one
//!   folder, and of the folders below it when the `FolderScope` says so, including the compressed files of Codex, and the
//!   titles of the chat sessions of Codex. `find_claude_agent_files` finds the files of the subagents and of the workflows of a chat session of Claude Code.
//! - `ChatSessionsDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query. `synchronize`
//!   fills it, in the mode initialize or update.
//! - `to_table` and `to_json` write the rows of a query as text.
//!
//! The calls are blocking. A caller in an async program runs them in a blocking task.

mod coding_agents;
mod model;
mod repository_finder;
mod storage;
mod synchronization;
#[cfg(test)]
mod test_samples;

pub use coding_agents::agent_homes::{claude_dir, codex_home};
pub use coding_agents::scan::{feed_claude_line, feed_codex_line, read_lines_from, shorten, ChatMeta, Scan};
pub use coding_agents::scan_cache::{ScanCache, CACHE_FILE_NAME};
pub use coding_agents::session_files::{
    claude_folder_name, find_claude_agent_files, find_claude_session_files, find_codex_session_files, is_in_folder,
    read_codex_titles, title_of_scan, FolderScope, SessionFile,
};
pub use coding_agents::session_reader::{format_date, parse_date, read_chat_sessions};
pub use coding_agents::tokens::{TokenCounts, TokenScan, TokensByHour, TokensByModel, UNDATED_HOUR, UNKNOWN_MODEL};
pub use model::schemas::{validate_chat_session_value, CHAT_SESSION_SCHEMA};
pub use model::types::{
    ChatSession, ChatSessionRecord, ChatSessionRelations, ChatSessionTable, CodingAgent, ModelTokens, QueryRow,
    SynchronizationMode, SynchronizationReport,
};
pub use repository_finder::{find_repository, find_root, parse_repository};
pub use storage::database::ChatSessionsDatabase;
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::{describe_since, run as synchronize};

use std::path::PathBuf;

/// A function that ignores the lines of progress.
pub fn ignore_log(_message: &str) {}

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`. It is the same file as
/// the one of `data_layer_code_hosting`.
pub fn default_database_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".config").join("heidrun").join("data_layer.sqlite")
}
