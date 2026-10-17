//! The query interface of the package: the typed reads that a program uses to show the user activity records. A read opens the
//! SQLite file only. It never opens the file of the records, and it never runs the command `git`.

use crate::model::types::UserActivityRecord;
use crate::storage::database::UserActivityDatabase;
use std::path::Path;

/// The records of the SQLite file at `database_path` whose active period overlaps the time range from `since` to `until`, the
/// oldest first. Both times are texts in the format ISO 8601 with an offset or in UTC. The times of the records are in UTC.
/// A SQLite file that does not exist holds no record, so the answer is an empty list: the records were never copied yet.
///
/// # Errors
/// An error when a time is not a time with an offset, or when the SQLite file cannot be read.
pub fn find_user_activity_records(database_path: &Path, since: &str, until: &str) -> Result<Vec<UserActivityRecord>, String> {
    if !database_path.exists() {
        crate::model::utc_time::to_utc_text(since)?;
        crate::model::utc_time::to_utc_text(until)?;
        return Ok(Vec::new());
    }
    UserActivityDatabase::open_read_only(database_path)?.find_records_overlapping(since, until)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::refresh::refresh_user_activity;
    use crate::test_samples::{line_with_offset, record, temp_folder, time, write_file};

    #[test]
    fn gives_an_empty_list_when_the_sqlite_file_exists_but_holds_no_table_of_records() {
        let database_path = temp_folder("query_other_tables").join("data_layer.sqlite");
        rusqlite::Connection::open(&database_path).unwrap().execute_batch("CREATE TABLE other (data TEXT)").unwrap();
        assert_eq!(find_user_activity_records(&database_path, &time(0, 0), &time(23, 0)).unwrap(), vec![]);
    }

    #[test]
    fn reads_the_records_that_a_refresh_copied_after_the_file_of_the_records_is_gone() {
        let file_path = write_file("query_after_refresh", &[line_with_offset(&record(1), 2), line_with_offset(&record(5), 2)]);
        let database_path = temp_folder("query_after_refresh_database").join("data_layer.sqlite");
        refresh_user_activity(&database_path, &file_path).unwrap();
        std::fs::remove_file(&file_path).unwrap();
        let found = find_user_activity_records(&database_path, &time(0, 0), &time(23, 0)).unwrap();
        assert_eq!(found, vec![record(1), record(5)]);
    }

    #[test]
    fn gives_an_empty_list_when_the_sqlite_file_does_not_exist_and_still_refuses_a_wrong_time() {
        let database_path = temp_folder("query_no_database").join("data_layer.sqlite");
        assert_eq!(find_user_activity_records(&database_path, &time(0, 0), &time(23, 0)), Ok(Vec::new()));
        assert!(find_user_activity_records(&database_path, "yesterday", &time(23, 0)).is_err());
        assert!(!database_path.exists());
    }
}
