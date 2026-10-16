//! `heidrun_data`: one command line that gives a coding agent the data of the four data layers of Heidrun. It calls the
//! libraries of the four data layer packages, and never their executables.
//!
//! The library has five parts:
//! - `Source` names the four sources, their tables, and the fixed order in which they are read.
//! - `synchronize` runs the mode initialize or update of each source that is asked for. A source that fails does not stop
//!   the others.
//! - `HeidrunDatabase` is the SQLite file, open read only. It runs one query, and counts the rows of each source.
//! - `add_limit` adds a `LIMIT` to a statement that has none.
//! - `Format` and `write_rows` write rows as JSON lines, as a JSON list, or as a text table.
//!
//! The calls are blocking.

mod database;
mod output;
mod query_limit;
mod sources;
mod synchronization;

pub use database::{HeidrunDatabase, SourceSummary};
pub use output::{format_error, write_rows, Format, QueryRow};
pub use query_limit::{add_limit, DEFAULT_LIMIT};
pub use sources::Source;
pub use synchronization::{synchronize, SourceReport, SynchronizationMode, SynchronizationOptions};

use std::path::PathBuf;

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`. It is the file that the
/// four data layer packages write.
pub fn default_database_path() -> PathBuf {
    data_layer_source_control::default_database_path()
}
