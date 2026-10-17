//! The user activity source of the data layer of Heidrun: reads the user activity records of the developer from the file
//! `user_activity.jsonl`, and writes each one in the table `user_activity_records` of a SQLite file.
//!
//! The library has four parts:
//! - `UserActivityDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query.
//! - `UserActivityFileReader` reads the lines of the file, and turns each valid line into a record with its times in UTC.
//! - `synchronize` fills the table, in the mode initialize or update.
//! - `to_table` and `to_json` write the rows of a query as text.
//!
//! The package never writes the file of the user activity records: only the web frontend writes it. The calls are blocking.
//! A caller in an async program runs them in a blocking task.

mod model;
mod storage;
mod synchronization;
#[cfg(test)]
mod test_samples;
mod user_activity_file;

pub use model::schemas::{validate_user_activity_record_value, USER_ACTIVITY_RECORD_SCHEMA};
pub use model::types::{QueryRow, SynchronizationMode, SynchronizationReport, UserActivityRecord};
pub use model::utc_time::to_utc_text;
pub use storage::database::UserActivityDatabase;
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::run as synchronize;
pub use user_activity_file::user_activity_file_reader::{
    default_user_activity_file_path, user_activity_file_path, UserActivityFileReader, UserActivityFileReading,
    USER_ACTIVITY_FILE_NAME,
};

use std::path::PathBuf;

/// The name of this package in the log of the requests of the data layer, without the prefix `data_layer_`.
pub(crate) const REQUEST_PACKAGE: &str = "user_activity";

/// The path of the SQLite file when nobody gives another path: `~/.config/heidrun/data_layer.sqlite`. It is the same file as
/// the file of the other data layer packages, and each package writes its own tables in it.
pub fn default_database_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".config").join("heidrun").join("data_layer.sqlite")
}
