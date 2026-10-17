//! Reads the file `user_activity.jsonl`: one JSON line for each active period of the developer. The web frontend is the only
//! program that writes the file, and this code never writes it.
//!
//! A line becomes a record when it is a JSON object that follows the JSON schema. The three times of the line carry the
//! offset of the time zone of the computer, and the record holds them in UTC. Any other line is skipped and counted, and it
//! never stops the reading. An empty line holds no record, so it is neither read nor counted.

use crate::model::schemas::{record_to_checked_value, validate_user_activity_record_value};
use crate::model::types::UserActivityRecord;
use crate::model::utc_time::to_utc_text;
use serde_json::Value;
use std::path::{Path, PathBuf};
use crate::REQUEST_PACKAGE;
use request_log::{record, RequestKind, RequestSpec, Summary};

/// The name of the file of the user activity records.
pub const USER_ACTIVITY_FILE_NAME: &str = "user_activity.jsonl";

/// What the reading of the file found.
#[derive(Debug, Clone, PartialEq)]
pub struct UserActivityFileReading {
    /// False when the file does not exist. Then `records` is empty and no line is skipped.
    pub is_file_found: bool,
    /// The valid records, with their times in UTC, in the order of the lines of the file.
    pub records: Vec<UserActivityRecord>,
    /// The number of lines that are not a user activity record that follows the JSON schema. An empty line is not counted.
    pub skipped_line_count: usize,
}

/// The reader of the file of the user activity records.
pub struct UserActivityFileReader {
    /// The path of the file.
    file_path: PathBuf,
}

impl UserActivityFileReader {
    /// Makes a reader for the file at `file_path`. The file is not opened yet.
    pub fn new(file_path: &Path) -> Self {
        UserActivityFileReader { file_path: file_path.to_path_buf() }
    }

    /// The path of the file.
    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    /// Reads every line of the file. `log` receives one line of progress for each skipped line, with its number and its
    /// reason, and one line for the total.
    ///
    /// # Errors
    /// An error when the file exists and cannot be read, for example when the path is a folder. A file that does not exist
    /// is not an error: the web frontend writes the file only when the first active period ends.
    pub fn read(&self, log: &dyn Fn(&str)) -> Result<UserActivityFileReading, String> {
        let spec = RequestSpec::new(REQUEST_PACKAGE, "read_file", RequestKind::Collection)
            .parameter("file", self.file_path.display().to_string());
        record(spec, || self.read_inside(log), |reading| {
            Summary::count(reading.records.len()).detail("skippedLineCount", reading.skipped_line_count)
        })
    }

    /// The work of `read`, between the start event and the completion event of its request.
    fn read_inside(&self, log: &dyn Fn(&str)) -> Result<UserActivityFileReading, String> {
        let bytes = match std::fs::read(&self.file_path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                log("file: the file does not exist");
                return Ok(UserActivityFileReading { is_file_found: false, records: Vec::new(), skipped_line_count: 0 });
            }
            Err(error) => return Err(format!("The file {} cannot be read: {error}", self.file_path.display())),
        };
        let mut records = Vec::new();
        let mut skipped_line_count = 0;
        for (index, line) in bytes.split(|byte| *byte == b'\n').enumerate() {
            if line.iter().all(|byte| byte.is_ascii_whitespace()) {
                continue;
            }
            match read_line(line) {
                Ok(record) => records.push(record),
                Err(reason) => {
                    skipped_line_count += 1;
                    log(&format!("file: line {} is skipped: {reason}", index + 1));
                }
            }
        }
        log(&format!("file: {} records are read, {} lines are skipped", records.len(), skipped_line_count));
        Ok(UserActivityFileReading { is_file_found: true, records, skipped_line_count })
    }
}

/// The path of the file of the user activity records. The folder `heidrun_dir`, which is the value of the variable
/// `HEIDRUN_DIR`, replaces the folder `~/.config/heidrun` when it is given. The web frontend writes the same path.
pub fn user_activity_file_path(heidrun_dir: Option<&str>, home_folder: &Path) -> PathBuf {
    match heidrun_dir.filter(|value| value.is_empty() == false) {
        Some(folder) => PathBuf::from(folder),
        None => home_folder.join(".config").join("heidrun"),
    }
    .join(USER_ACTIVITY_FILE_NAME)
}

/// The path of the file when nobody gives another path: in the folder of the variable `HEIDRUN_DIR`, or else in
/// `~/.config/heidrun`.
pub fn default_user_activity_file_path() -> PathBuf {
    let heidrun_dir = std::env::var("HEIDRUN_DIR").ok();
    user_activity_file_path(heidrun_dir.as_deref(), &dirs::home_dir().unwrap_or_default())
}

/// Turns one line of the file into a record in UTC.
///
/// # Errors
/// The reason why the line is not a user activity record that follows the JSON schema.
fn read_line(line: &[u8]) -> Result<UserActivityRecord, String> {
    let text = std::str::from_utf8(line).map_err(|_| "the line is not valid UTF-8 text".to_string())?;
    let value: Value = serde_json::from_str(text).map_err(|error| format!("the line is not valid JSON: {error}"))?;
    if !value.is_object() {
        return Err("the line is not a JSON object".to_string());
    }
    validate_user_activity_record_value(&value)?;
    let record: UserActivityRecord =
        serde_json::from_value(value).map_err(|error| format!("the line is not a user activity record: {error}"))?;
    let record_in_utc = UserActivityRecord {
        started_at: to_utc_text(&record.started_at)?,
        last_action_at: to_utc_text(&record.last_action_at)?,
        ended_at: to_utc_text(&record.ended_at)?,
        ..record
    };
    record_to_checked_value(&record_in_utc)?;
    Ok(record_in_utc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{line_with_offset, record, temp_folder, time, write_file};
    use std::cell::RefCell;

    /// Reads a file of lines, and gives the reading.
    fn read_lines(name: &str, lines: &[String]) -> UserActivityFileReading {
        let path = write_file(name, lines);
        UserActivityFileReader::new(&path).read(&|_| {}).unwrap()
    }

    #[test]
    fn reads_the_records_of_the_lines_in_the_order_of_the_file() {
        let lines = [line_with_offset(&record(3), 0), line_with_offset(&record(1), 0)];
        let reading = read_lines("order", &lines);
        assert_eq!(
            reading,
            UserActivityFileReading {
                is_file_found: true,
                records: vec![record(3), record(1)],
                skipped_line_count: 0
            }
        );
    }

    #[test]
    fn gives_the_times_in_utc_when_the_line_carries_a_time_zone_offset() {
        let lines = [line_with_offset(&record(10), 2), line_with_offset(&record(11), -5)];
        let reading = read_lines("offset", &lines);
        assert!(lines[0].contains("+02:00"));
        assert!(lines[1].contains("-05:00"));
        assert_eq!(reading.records, vec![record(10), record(11)]);
        assert_eq!(reading.records[0].ended_at, time(10, 11));
    }

    #[test]
    fn gives_an_empty_reading_for_an_empty_file() {
        let reading = read_lines("empty", &[]);
        assert_eq!(reading, UserActivityFileReading { is_file_found: true, records: vec![], skipped_line_count: 0 });
    }

    #[test]
    fn says_that_the_file_is_not_found_when_it_does_not_exist_and_creates_nothing() {
        let path = temp_folder("missing").join("user_activity.jsonl");
        let reading = UserActivityFileReader::new(&path).read(&|_| {}).unwrap();
        assert_eq!(reading, UserActivityFileReading { is_file_found: false, records: vec![], skipped_line_count: 0 });
        assert!(!path.exists());
    }

    #[test]
    fn gives_an_error_when_the_path_is_a_folder() {
        let folder = temp_folder("a_folder");
        let error = UserActivityFileReader::new(&folder).read(&|_| {}).unwrap_err();
        assert!(error.contains("cannot be read"));
    }

    #[test]
    fn skips_and_counts_a_line_that_is_not_valid_json_and_reads_the_lines_around_it() {
        let lines = [line_with_offset(&record(1), 0), "not json".to_string(), line_with_offset(&record(2), 0)];
        let reading = read_lines("not_json", &lines);
        assert_eq!(reading.records, vec![record(1), record(2)]);
        assert_eq!(reading.skipped_line_count, 1);
    }

    #[test]
    fn skips_a_line_that_is_json_but_not_an_object() {
        let lines = ["[]".to_string(), "\"text\"".to_string(), "42".to_string(), "null".to_string()];
        let reading = read_lines("not_object", &lines);
        assert_eq!((reading.records.len(), reading.skipped_line_count), (0, 4));
    }

    #[test]
    fn skips_a_line_that_does_not_follow_the_json_schema() {
        let valid = serde_json::to_value(record(1)).unwrap();
        let mut missing_field = valid.clone();
        missing_field.as_object_mut().unwrap().remove("endReason");
        let mut unknown_field = valid.clone();
        unknown_field["typedText"] = "secret".into();
        let mut wrong_time = valid.clone();
        wrong_time["endedAt"] = "yesterday".into();
        let mut time_without_offset = valid.clone();
        time_without_offset["endedAt"] = "2026-10-14T11:11:00.000".into();
        let mut negative_count = valid.clone();
        negative_count["mouseActionCount"] = (-1).into();
        let mut unknown_reason = valid.clone();
        unknown_reason["endReason"] = "lunch".into();
        let lines: Vec<String> = [missing_field, unknown_field, wrong_time, time_without_offset, negative_count, unknown_reason]
            .iter()
            .map(|value| value.to_string())
            .collect();
        let reading = read_lines("not_schema", &lines);
        assert_eq!((reading.records.len(), reading.skipped_line_count), (0, 6));
    }

    #[test]
    fn skips_a_line_with_a_count_that_is_a_whole_number_written_as_a_fraction() {
        let line = line_with_offset(&record(1), 0).replace("\"keyboardActionCount\":40", "\"keyboardActionCount\":40.0");
        let reading = read_lines("fraction", &[line]);
        assert_eq!((reading.records.len(), reading.skipped_line_count), (0, 1));
    }

    #[test]
    fn skips_a_line_that_is_not_valid_text_and_reads_the_next_line() {
        let path = write_file("not_text", &[line_with_offset(&record(1), 0)]);
        let mut bytes = std::fs::read(&path).unwrap();
        bytes.extend_from_slice(b"{\"workspaceFolder\":\"\xff\xfe\"}\n");
        bytes.extend_from_slice(line_with_offset(&record(2), 0).as_bytes());
        std::fs::write(&path, bytes).unwrap();
        let reading = UserActivityFileReader::new(&path).read(&|_| {}).unwrap();
        assert_eq!(reading.records, vec![record(1), record(2)]);
        assert_eq!(reading.skipped_line_count, 1);
    }

    #[test]
    fn does_not_read_or_count_an_empty_line_and_reads_a_last_line_with_no_new_line_after_it() {
        let path = write_file("empty_lines", &[line_with_offset(&record(1), 0), String::new(), "   ".to_string()]);
        let mut bytes = std::fs::read(&path).unwrap();
        bytes.extend_from_slice(line_with_offset(&record(2), 0).as_bytes());
        std::fs::write(&path, bytes).unwrap();
        let reading = UserActivityFileReader::new(&path).read(&|_| {}).unwrap();
        assert_eq!(reading.records, vec![record(1), record(2)]);
        assert_eq!(reading.skipped_line_count, 0);
    }

    #[test]
    fn reads_a_line_that_ends_with_a_carriage_return() {
        let path = write_file("carriage_return", &[format!("{}\r", line_with_offset(&record(1), 0))]);
        let reading = UserActivityFileReader::new(&path).read(&|_| {}).unwrap();
        assert_eq!((reading.records, reading.skipped_line_count), (vec![record(1)], 0));
    }

    #[test]
    fn skips_the_last_line_when_the_application_stopped_in_the_middle_of_a_write() {
        let path = write_file("cut_line", &[line_with_offset(&record(1), 0)]);
        let mut bytes = std::fs::read(&path).unwrap();
        bytes.extend_from_slice(&line_with_offset(&record(2), 0).as_bytes()[..40]);
        std::fs::write(&path, bytes).unwrap();
        let reading = UserActivityFileReader::new(&path).read(&|_| {}).unwrap();
        assert_eq!((reading.records, reading.skipped_line_count), (vec![record(1)], 1));
    }

    #[test]
    fn sends_a_line_of_progress_for_each_skipped_line_with_its_number_and_one_line_for_the_total() {
        let path = write_file("progress", &[line_with_offset(&record(1), 0), "not json".to_string(), "[]".to_string()]);
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        UserActivityFileReader::new(&path).read(&log).unwrap();
        let lines = lines.borrow();
        assert_eq!(lines.len(), 3);
        assert!(lines[0].starts_with("file: line 2 is skipped: the line is not valid JSON"));
        assert_eq!(lines[1], "file: line 3 is skipped: the line is not a JSON object");
        assert_eq!(lines[2], "file: 1 records are read, 2 lines are skipped");
    }

    #[test]
    fn never_writes_the_file() {
        let path = write_file("never_writes", &[line_with_offset(&record(1), 2), "not json".to_string()]);
        let before = std::fs::read(&path).unwrap();
        UserActivityFileReader::new(&path).read(&|_| {}).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn puts_the_file_in_the_folder_of_the_variable_heidrun_dir_when_it_is_given() {
        let home = Path::new("/home/ada");
        assert_eq!(
            user_activity_file_path(Some("/tmp/heidrun_data"), home),
            Path::new("/tmp/heidrun_data/user_activity.jsonl")
        );
        assert_eq!(user_activity_file_path(None, home), Path::new("/home/ada/.config/heidrun/user_activity.jsonl"));
    }
}
