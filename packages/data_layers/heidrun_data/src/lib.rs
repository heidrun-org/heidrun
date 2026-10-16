//! `heidrun_data`: one command line that gives a coding agent the data of the four data layers of Heidrun. It calls the
//! libraries of the four data layer packages, and never their executables.
//!
//! The library has eight parts:
//! - `Source` names the four sources, their tables, and the fixed order in which they are read.
//! - `synchronize` runs the mode initialize or update of each source that is asked for. A source that fails does not stop
//!   the others.
//! - `read_catalog` and `data_schema_text` give the shape of the tables: their columns, their keys, their joins, and the
//!   JSON schema of their column `data`.
//! - `read_chat_session`, `read_commit`, `read_code_hosting`, and `read_file_history` give the content that the tables do
//!   not store: the records of a chat session, the diff of a commit, the comments of an issue or of a pull request, and
//!   the tool calls that wrote one file.
//! - `lock_database` is the one lock of the SQLite file, for the threads of a program and for the programs of the
//!   computer. The desktop application and `synchronize` take it before each write.
//! - `HeidrunDatabase` is the SQLite file, open read only. It runs one query, and counts the rows of each source.
//! - `add_limit` adds a `LIMIT` to a statement that has none.
//! - `Format` and `write_rows` write rows as JSON lines, as a JSON list, or as a text table.
//!
//! The calls are blocking.

mod database;
mod database_lock;
mod output;
mod query_limit;
mod reading;
mod schema;
mod sources;
mod synchronization;

pub use database::{HeidrunDatabase, SourceSummary};
pub use database_lock::{lock_database, lock_file_path, DatabaseLock};
pub use output::{format_error, write_rows, Format, QueryRow};
pub use query_limit::{add_limit, DEFAULT_LIMIT};
pub use reading::chat_session_reader::{read_chat_session, ChatRecord, Role, SHORT_TOOL_LENGTH};
pub use reading::code_hosting_reader::{read_code_hosting, read_pull_request_diff, CodeHostingKind, Entry};
pub use reading::commit_reader::{read_commit, ChangedFile, CommitContent};
pub use reading::file_history_reader::{read_file_history, FileChange};
pub use schema::{data_schema_text, read_catalog, Column, TableShape};
pub use sources::{all_tables, find_table, DataSchema, Join, Source, Table};
pub use synchronization::{synchronize, SourceReport, SynchronizationMode, SynchronizationOptions};

use std::path::PathBuf;

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`. It is the file that the
/// four data layer packages write.
pub fn default_database_path() -> PathBuf {
    data_layer_source_control::default_database_path()
}
