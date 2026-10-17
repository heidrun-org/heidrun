//! The refresh interface of the package: the one call that copies the new lines of the file of the user activity records into
//! the SQLite file.
//!
//! A program that shows the records calls this file to collect, and `query.rs` to read. The two never mix: a read of the
//! records never opens the file of the records.

use crate::model::types::{SynchronizationMode, SynchronizationReport};
use crate::storage::database::UserActivityDatabase;
use crate::synchronization::run;
use crate::user_activity_file::user_activity_file_reader::UserActivityFileReader;
use std::path::Path;

/// Copies the records of the file at `file_path` that are new into the SQLite file at `database_path`, with the mode update.
/// The SQLite file and its table are created when they do not exist. The caller holds the lock of the SQLite file.
///
/// # Errors
/// An error when the file of the records exists and cannot be read, or when the SQLite file cannot be opened or written.
pub fn refresh_user_activity(database_path: &Path, file_path: &Path) -> Result<SynchronizationReport, String> {
    let mut database = UserActivityDatabase::open(database_path)?;
    run(SynchronizationMode::Update, &UserActivityFileReader::new(file_path), &mut database, &|_| {})
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{line_with_offset, record, temp_folder, time, write_file};

    #[test]
    fn creates_the_sqlite_file_and_copies_the_records_of_the_file() {
        let file_path = write_file("refresh_copy", &[line_with_offset(&record(1), 2), line_with_offset(&record(2), 2)]);
        let database_path = temp_folder("refresh_copy_database").join("data_layer.sqlite");
        let report = refresh_user_activity(&database_path, &file_path).unwrap();
        assert_eq!((report.record_count, report.already_read_record_count), (2, 0));
        let database = UserActivityDatabase::open_read_only(&database_path).unwrap();
        assert_eq!(database.find_record("/work/heidrun", &time(2, 0)), Ok(Some(record(2))));
    }

    #[test]
    fn copies_only_the_new_records_the_second_time() {
        let file_path = write_file("refresh_twice", &[line_with_offset(&record(1), 0)]);
        let database_path = temp_folder("refresh_twice_database").join("data_layer.sqlite");
        refresh_user_activity(&database_path, &file_path).unwrap();
        let report = refresh_user_activity(&database_path, &file_path).unwrap();
        assert_eq!((report.record_count, report.already_read_record_count), (0, 1));
    }

    #[test]
    fn creates_an_empty_table_when_the_file_of_the_records_does_not_exist() {
        let folder = temp_folder("refresh_no_file");
        let report = refresh_user_activity(&folder.join("data_layer.sqlite"), &folder.join("user_activity.jsonl")).unwrap();
        assert_eq!((report.is_file_found, report.record_count), (false, 0));
    }
}
