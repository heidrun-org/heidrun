//! Fills the table `user_activity_records` from the file `user_activity.jsonl`, in the mode initialize or update.
//!
//! The package keeps no other state: the records that are already read are the rows of the table. The mode update writes only
//! the records whose `endedAt` is later than the largest `endedAt` of the table. The web frontend appends a record when its
//! active period ends, so the lines of the file come in the order of their end. When the table has no row, the mode update
//! writes every record, as the mode initialize does. A row is never deleted: a record that the web frontend removes from the
//! file, because it is older than 400 days, stays in the table.

use crate::model::types::{SynchronizationMode, SynchronizationReport, UserActivityRecord};
use crate::storage::database::UserActivityDatabase;
use crate::user_activity_file::user_activity_file_reader::UserActivityFileReader;

/// Reads the records of the file, and writes them in the database. `log` receives the progress of the reading, one line for
/// the number of records to write, and one line for the write.
///
/// # Errors
/// An error when the file cannot be read, or when the database cannot be read or written.
pub fn run(
    mode: SynchronizationMode,
    reader: &UserActivityFileReader,
    database: &mut UserActivityDatabase,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let reading = reader.read(log)?;
    let latest_ended_at = match mode {
        SynchronizationMode::Initialize => None,
        SynchronizationMode::Update => database.find_latest_ended_at()?,
    };
    let read_count = reading.records.len();
    let new_records: Vec<UserActivityRecord> = reading
        .records
        .into_iter()
        .filter(|record| match &latest_ended_at {
            Some(latest_ended_at) => record.ended_at.as_str() > latest_ended_at.as_str(),
            None => true,
        })
        .collect();
    let already_read_record_count = read_count - new_records.len();
    log(&format!(
        "mode {}: {} records are written, {} are already read",
        mode.name(),
        new_records.len(),
        already_read_record_count
    ));
    database.upsert_records(&new_records)?;
    log(&format!("records: written row count {}, file {}", new_records.len(), database.database_path().display()));
    Ok(SynchronizationReport {
        mode,
        is_file_found: reading.is_file_found,
        record_count: new_records.len(),
        already_read_record_count,
        skipped_line_count: reading.skipped_line_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{line_with_offset, record, temp_folder, time, write_file};
    use std::cell::RefCell;
    use std::path::{Path, PathBuf};

    /// An empty database in a new folder.
    fn new_database(name: &str) -> UserActivityDatabase {
        UserActivityDatabase::open(&temp_folder(name).join("data_layer.sqlite")).unwrap()
    }

    /// Runs a mode on a file, with no log.
    fn synchronize(
        mode: SynchronizationMode,
        file_path: &Path,
        database: &mut UserActivityDatabase,
    ) -> SynchronizationReport {
        run(mode, &UserActivityFileReader::new(file_path), database, &|_| {}).unwrap()
    }

    /// A file with the records 1, 2, and 3, each one written with the offset +02:00.
    fn file_of_three_records(name: &str) -> PathBuf {
        write_file(name, &[1, 2, 3].map(|number| line_with_offset(&record(number), 2)))
    }

    /// Appends the lines to a file, each one ended by a new line.
    fn append_lines(file_path: &Path, lines: &[String]) {
        let mut text = std::fs::read_to_string(file_path).unwrap();
        for line in lines {
            text.push_str(line);
            text.push('\n');
        }
        std::fs::write(file_path, text).unwrap();
    }

    #[test]
    fn initialize_reads_every_line_and_writes_every_row() {
        let file_path = file_of_three_records("initialize");
        let mut database = new_database("initialize_database");
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                is_file_found: true,
                record_count: 3,
                already_read_record_count: 0,
                skipped_line_count: 0,
            }
        );
        assert_eq!(database.count_records(), Ok(3));
        assert_eq!(database.find_record("/work/heidrun", &time(2, 0)), Ok(Some(record(2))));
    }

    #[test]
    fn stores_the_times_in_utc_when_the_file_has_a_time_zone_offset() {
        let file_path = write_file("utc", &[line_with_offset(&record(10), 2)]);
        let mut database = new_database("utc_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        let stored = database.find_record("/work/heidrun", &time(10, 0)).unwrap().unwrap();
        assert_eq!(stored.ended_at, "2026-10-14T10:11:00.000Z");
        assert_eq!(database.find_latest_ended_at(), Ok(Some("2026-10-14T10:11:00.000Z".to_string())));
    }

    #[test]
    fn initialize_two_times_in_a_row_gives_the_same_rows_with_no_row_written_two_times() {
        let file_path = file_of_three_records("initialize_twice");
        let mut database = new_database("initialize_twice_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!((report.record_count, report.already_read_record_count), (3, 0));
        assert_eq!(database.count_records(), Ok(3));
    }

    #[test]
    fn update_on_an_empty_database_writes_everything_as_initialize_does() {
        let file_path = file_of_three_records("update_empty");
        let mut database = new_database("update_empty_database");
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.record_count, report.already_read_record_count), (3, 0));
        assert_eq!(database.count_records(), Ok(3));
    }

    #[test]
    fn update_writes_only_the_records_that_ended_after_the_latest_end_of_the_database() {
        let file_path = file_of_three_records("update_new");
        let mut database = new_database("update_new_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        append_lines(&file_path, &[line_with_offset(&record(4), 2), line_with_offset(&record(5), 2)]);
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.record_count, report.already_read_record_count), (2, 3));
        assert_eq!(database.count_records(), Ok(5));
        assert_eq!(database.find_record("/work/heidrun", &time(5, 0)), Ok(Some(record(5))));
    }

    #[test]
    fn update_two_times_in_a_row_writes_nothing_the_second_time() {
        let file_path = file_of_three_records("update_twice");
        let mut database = new_database("update_twice_database");
        synchronize(SynchronizationMode::Update, &file_path, &mut database);
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.record_count, report.already_read_record_count), (0, 3));
        assert_eq!(database.count_records(), Ok(3));
    }

    #[test]
    fn update_does_not_write_a_record_that_ended_at_the_same_time_as_the_latest_end() {
        let file_path = write_file("update_same_end", &[line_with_offset(&record(3), 0)]);
        let mut database = new_database("update_same_end_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        let mut same_end_in_another_folder = record(3);
        same_end_in_another_folder.workspace_folder = "/work/another".into();
        append_lines(&file_path, &[line_with_offset(&same_end_in_another_folder, 0)]);
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.record_count, report.already_read_record_count), (0, 2));
    }

    #[test]
    fn update_after_old_lines_were_removed_from_the_file_keeps_the_old_rows_and_writes_the_new_ones() {
        let file_path = file_of_three_records("update_removed");
        let mut database = new_database("update_removed_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        write_file_again(&file_path, &[line_with_offset(&record(3), 2), line_with_offset(&record(4), 2)]);
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.record_count, report.already_read_record_count), (1, 1));
        assert_eq!(database.count_records(), Ok(4));
        assert_eq!(database.find_record("/work/heidrun", &time(1, 0)), Ok(Some(record(1))));
    }

    #[test]
    fn initialize_after_old_lines_were_removed_from_the_file_keeps_the_old_rows() {
        let file_path = file_of_three_records("initialize_removed");
        let mut database = new_database("initialize_removed_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        write_file_again(&file_path, &[line_with_offset(&record(3), 2)]);
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!(report.record_count, 1);
        assert_eq!(database.count_records(), Ok(3));
    }

    #[test]
    fn keeps_every_row_when_the_file_is_empty_or_missing_after_a_first_run() {
        let file_path = file_of_three_records("file_gone");
        let mut database = new_database("file_gone_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        std::fs::write(&file_path, "").unwrap();
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.is_file_found, report.record_count), (true, 0));
        std::fs::remove_file(&file_path).unwrap();
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!((report.is_file_found, report.record_count), (false, 0));
        assert_eq!(database.count_records(), Ok(3));
    }

    #[test]
    fn counts_the_skipped_lines_and_writes_only_the_valid_records() {
        let file_path = write_file(
            "skipped",
            &[line_with_offset(&record(1), 0), "not json".to_string(), "[]".to_string(), line_with_offset(&record(2), 0)],
        );
        let mut database = new_database("skipped_database");
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!((report.record_count, report.skipped_line_count), (2, 2));
        assert_eq!(database.count_records(), Ok(2));
    }

    #[test]
    fn counts_the_skipped_lines_again_in_the_mode_update() {
        let file_path = write_file("skipped_update", &[line_with_offset(&record(1), 0), "not json".to_string()]);
        let mut database = new_database("skipped_update_database");
        synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        let report = synchronize(SynchronizationMode::Update, &file_path, &mut database);
        assert_eq!((report.record_count, report.skipped_line_count), (0, 1));
    }

    #[test]
    fn writes_nothing_and_says_so_when_the_file_does_not_exist() {
        let file_path = temp_folder("no_file").join("user_activity.jsonl");
        let mut database = new_database("no_file_database");
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                is_file_found: false,
                record_count: 0,
                already_read_record_count: 0,
                skipped_line_count: 0,
            }
        );
        assert_eq!(database.count_records(), Ok(0));
        assert!(!file_path.exists());
    }

    #[test]
    fn writes_nothing_for_an_empty_file() {
        let file_path = write_file("empty_file", &[]);
        let mut database = new_database("empty_file_database");
        let report = synchronize(SynchronizationMode::Initialize, &file_path, &mut database);
        assert_eq!((report.is_file_found, report.record_count, report.skipped_line_count), (true, 0, 0));
        assert_eq!(database.count_records(), Ok(0));
    }

    #[test]
    fn sends_the_lines_of_progress_of_the_records_to_write_and_of_the_write() {
        let file_path = file_of_three_records("progress");
        let mut database = new_database("progress_database");
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        let reader = UserActivityFileReader::new(&file_path);
        run(SynchronizationMode::Initialize, &reader, &mut database, &log).unwrap();
        run(SynchronizationMode::Update, &reader, &mut database, &log).unwrap();
        let path = database.database_path().display().to_string();
        let lines = lines.borrow();
        assert_eq!(
            *lines,
            [
                "file: 3 records are read, 0 lines are skipped".to_string(),
                "mode initialize: 3 records are written, 0 are already read".to_string(),
                format!("records: written row count 3, file {path}"),
                "file: 3 records are read, 0 lines are skipped".to_string(),
                "mode update: 0 records are written, 3 are already read".to_string(),
                format!("records: written row count 0, file {path}"),
            ]
        );
    }

    #[test]
    fn gives_an_error_and_writes_nothing_when_the_path_of_the_file_is_a_folder() {
        let folder = temp_folder("file_is_folder");
        let mut database = new_database("file_is_folder_database");
        let error = run(SynchronizationMode::Initialize, &UserActivityFileReader::new(&folder), &mut database, &|_| {})
            .unwrap_err();
        assert!(error.contains("cannot be read"));
        assert_eq!(database.count_records(), Ok(0));
    }

    /// Replaces the content of a file by lines, each one ended by a new line.
    fn write_file_again(file_path: &Path, lines: &[String]) {
        std::fs::write(file_path, lines.iter().map(|line| format!("{line}\n")).collect::<String>()).unwrap();
    }
}
