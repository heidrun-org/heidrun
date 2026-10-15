//! Sample data for the tests of the package: user activity records, the lines of the file that carry them, and temporary
//! folders. Only the tests compile this file.

use crate::model::types::UserActivityRecord;
use chrono::{DateTime, FixedOffset, SecondsFormat};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

/// The number of folders that `temp_folder` made. Two tests that give the same name never get the same folder.
static FOLDER_COUNT: AtomicUsize = AtomicUsize::new(0);

/// A new empty folder in the temporary folder. Each test gives its own name.
pub fn temp_folder(name: &str) -> PathBuf {
    let folder_number = FOLDER_COUNT.fetch_add(1, Ordering::SeqCst);
    let folder =
        std::env::temp_dir().join(format!("data_layer_user_activity_{name}_{}_{folder_number}", std::process::id()));
    let _ = std::fs::remove_dir_all(&folder);
    std::fs::create_dir_all(&folder).unwrap();
    folder
}

/// A time on the day 14 of October 2026, in UTC, with three digits of milliseconds. `hour` goes from 0 to 23.
pub fn time(hour: u32, minute: u32) -> String {
    format!("2026-10-14T{hour:02}:{minute:02}:00.000Z")
}

/// A user activity record in UTC that follows the JSON schema. The record `number` starts at the hour `number` of the day
/// 14, so a record with a higher number, from 1 to 23, ends later. Its workspace is `/work/heidrun`.
pub fn record(number: u32) -> UserActivityRecord {
    UserActivityRecord {
        workspace_folder: "/work/heidrun".into(),
        started_at: time(number, 0),
        last_action_at: time(number, 10),
        ended_at: time(number, 11),
        keyboard_action_count: 40,
        mouse_action_count: 12,
        end_reason: "cool_down".into(),
    }
}

/// The same moment as `time`, written with a time zone offset, as the web frontend writes it. `offset_hours` goes from -12
/// to 14.
pub fn time_with_offset(utc_time: &str, offset_hours: i32) -> String {
    let offset = FixedOffset::east_opt(offset_hours * 3600).unwrap();
    DateTime::parse_from_rfc3339(utc_time).unwrap().with_timezone(&offset).to_rfc3339_opts(SecondsFormat::Millis, false)
}

/// The line of the file for a record: its three times are written with the offset `offset_hours`, as the web frontend does.
pub fn line_with_offset(record: &UserActivityRecord, offset_hours: i32) -> String {
    let moved = UserActivityRecord {
        started_at: time_with_offset(&record.started_at, offset_hours),
        last_action_at: time_with_offset(&record.last_action_at, offset_hours),
        ended_at: time_with_offset(&record.ended_at, offset_hours),
        ..record.clone()
    };
    serde_json::to_string(&moved).unwrap()
}

/// Writes a file of lines, each one ended by a new line, and gives its path. The file sits in a new folder.
pub fn write_file(name: &str, lines: &[String]) -> PathBuf {
    let path = temp_folder(name).join("user_activity.jsonl");
    std::fs::write(&path, lines.iter().map(|line| format!("{line}\n")).collect::<String>()).unwrap();
    path
}
