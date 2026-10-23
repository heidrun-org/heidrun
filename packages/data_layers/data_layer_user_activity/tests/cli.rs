//! Tests of the executable `data_layer_user_activity`, with a fake file of user activity records in a temporary folder. The
//! file has three records that ended on the day 14 of October 2026, written with the time zone offset +02:00 as the web
//! frontend writes them.

use data_layer_user_activity::UserActivityDatabase;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;

/// The line of a record of the file: the folder `/work/heidrun`, the hour `hour` of the day 14 in the time zone +02:00, and
/// the end reason `cool_down`.
fn line(hour: u32) -> String {
    json!({
        "workspaceFolder": "/work/heidrun",
        "startedAt": format!("2026-10-14T{hour:02}:00:00.000+02:00"),
        "lastActionAt": format!("2026-10-14T{hour:02}:10:00.000+02:00"),
        "endedAt": format!("2026-10-14T{hour:02}:10:05.000+02:00"),
        "keyboardActionCount": 40,
        "mouseActionCount": 12,
        "endReason": "cool_down",
    })
    .to_string()
}

/// A folder with a fake file of user activity records, the path of a database file, and the path of a folder for the
/// variable `HEIDRUN_DIR`.
struct Fixture {
    folder: PathBuf,
    file_path: PathBuf,
    database_path: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

impl Fixture {
    /// Makes the folder and the file of three records, which end at the hours 10, 11, and 12 of the time zone +02:00.
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("data_layer_user_activity_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        let file_path = folder.join("user_activity.jsonl");
        std::fs::write(&file_path, format!("{}\n{}\n{}\n", line(10), line(11), line(12))).unwrap();
        let database_path = folder.join("data_layer.sqlite");
        Fixture { folder, file_path, database_path }
    }

    /// Runs the executable with `arguments`, in the folder of the fixture, with no variable `HEIDRUN_DIR`.
    fn run(&self, arguments: &[&str]) -> CliResult {
        self.run_with_environment(arguments, None)
    }

    /// Runs the executable with `arguments`, with the variable `HEIDRUN_DIR` set to `heidrun_dir` when it is given.
    fn run_with_environment(&self, arguments: &[&str], heidrun_dir: Option<&Path>) -> CliResult {
        let mut command = Command::new(env!("CARGO_BIN_EXE_data_layer_user_activity"));
        command.args(arguments).env_remove("HEIDRUN_DIR").env("HEIDRUN_OPERATION_LOG_FILE", "off").current_dir(&self.folder);
        if let Some(heidrun_dir) = heidrun_dir {
            command.env("HEIDRUN_DIR", heidrun_dir);
        }
        let output = command.output().unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code(),
        }
    }

    /// Runs `initialize` or `update` on the file and the database of the fixture.
    fn synchronize(&self, command: &str) -> CliResult {
        self.run(&[command, "--database", self.database(), "--file", self.file()])
    }

    /// Appends lines to the file of the fixture.
    fn append(&self, lines: &[String]) {
        let mut text = std::fs::read_to_string(&self.file_path).unwrap();
        for line in lines {
            text.push_str(line);
            text.push('\n');
        }
        std::fs::write(&self.file_path, text).unwrap();
    }

    /// The path of the file of the records, as text.
    fn file(&self) -> &str {
        self.file_path.to_str().unwrap()
    }

    /// The path of the database file, as text.
    fn database(&self) -> &str {
        self.database_path.to_str().unwrap()
    }

    /// The number of rows of the table, read with the library.
    fn row_count(&self) -> i64 {
        UserActivityDatabase::open(&self.database_path).unwrap().count_records().unwrap()
    }
}

#[test]
fn initialize_writes_the_rows_of_the_file_and_prints_the_report() {
    let fixture = Fixture::new("initialize");
    let result = fixture.synchronize("initialize");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains(&format!("{} -> {} (initialize)", fixture.file(), fixture.database())));
    assert!(result.stdout.contains("records: 3 written, 0 already read"));
    assert!(result.stdout.contains("skipped lines: 0"));
    assert_eq!(fixture.row_count(), 3);
}

#[test]
fn stores_the_times_in_utc_when_the_file_has_a_time_zone_offset() {
    let fixture = Fixture::new("utc");
    fixture.synchronize("initialize");
    let result = fixture.run(&[
        "query",
        "--database",
        fixture.database(),
        "--json",
        "SELECT startedAt, endedAt, json_extract(data, '$.lastActionAt') AS lastActionAt FROM user_activity_records \
         ORDER BY endedAt LIMIT 1",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(
        serde_json::from_str::<Value>(&result.stdout).unwrap(),
        json!([{
            "startedAt": "2026-10-14T08:00:00.000Z",
            "endedAt": "2026-10-14T08:10:05.000Z",
            "lastActionAt": "2026-10-14T08:10:00.000Z",
        }])
    );
}

#[test]
fn two_runs_in_a_row_never_write_a_row_two_times() {
    let fixture = Fixture::new("twice");
    fixture.synchronize("initialize");
    let initialize_again = fixture.synchronize("initialize");
    assert_eq!(initialize_again.exit_code, Some(0), "{}", initialize_again.stderr);
    assert_eq!(fixture.row_count(), 3);
    let update = fixture.synchronize("update");
    assert!(update.stdout.contains("(update)"));
    assert!(update.stdout.contains("records: 0 written, 3 already read"));
    assert_eq!(fixture.row_count(), 3);
}

#[test]
fn update_reads_only_the_records_that_were_added_to_the_file() {
    let fixture = Fixture::new("update");
    fixture.synchronize("initialize");
    fixture.append(&[line(13), line(14)]);
    let result = fixture.synchronize("update");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("records: 2 written, 3 already read"));
    assert_eq!(fixture.row_count(), 5);
}

#[test]
fn update_keeps_the_old_rows_after_old_lines_were_removed_from_the_file() {
    let fixture = Fixture::new("removed");
    fixture.synchronize("initialize");
    std::fs::write(&fixture.file_path, format!("{}\n{}\n", line(12), line(13))).unwrap();
    let result = fixture.synchronize("update");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("records: 1 written, 1 already read"));
    assert_eq!(fixture.row_count(), 4);
}

#[test]
fn update_on_an_empty_database_reads_everything() {
    let fixture = Fixture::new("update_first");
    let result = fixture.synchronize("update");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("records: 3 written, 0 already read"));
}

#[test]
fn an_empty_file_writes_no_row_and_creates_the_empty_table() {
    let fixture = Fixture::new("empty_file");
    std::fs::write(&fixture.file_path, "").unwrap();
    let result = fixture.synchronize("initialize");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("records: 0 written, 0 already read"));
    assert!(!result.stdout.contains("does not exist"));
    assert_eq!(fixture.row_count(), 0);
}

#[test]
fn a_missing_file_is_not_an_error_the_report_says_so_and_the_file_is_not_created() {
    let fixture = Fixture::new("missing_file");
    std::fs::remove_file(&fixture.file_path).unwrap();
    let result = fixture.synchronize("initialize");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("The file does not exist, so nothing is read."));
    assert!(result.stdout.contains("records: 0 written, 0 already read"));
    assert!(!fixture.file_path.exists());
    assert_eq!(fixture.row_count(), 0);
}

#[test]
fn a_line_that_is_not_valid_is_skipped_counted_and_printed_and_the_other_lines_are_written() {
    let fixture = Fixture::new("skipped");
    fixture.append(&["not json".to_string(), "[]".to_string(), json!({ "endedAt": "yesterday" }).to_string()]);
    let result = fixture.synchronize("initialize");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("records: 3 written, 0 already read"));
    assert!(result.stdout.contains("skipped lines: 3"));
    assert_eq!(fixture.row_count(), 3);
}

#[test]
fn the_command_never_writes_the_file() {
    let fixture = Fixture::new("never_writes");
    fixture.append(&["not json".to_string()]);
    let before = std::fs::read(&fixture.file_path).unwrap();
    fixture.synchronize("initialize");
    fixture.synchronize("update");
    assert_eq!(std::fs::read(&fixture.file_path).unwrap(), before);
}

#[test]
fn without_the_option_file_it_reads_the_file_in_the_folder_of_the_variable_heidrun_dir() {
    let fixture = Fixture::new("heidrun_dir");
    let heidrun_dir = fixture.folder.join("heidrun_dir");
    std::fs::create_dir_all(&heidrun_dir).unwrap();
    std::fs::write(heidrun_dir.join("user_activity.jsonl"), format!("{}\n", line(10))).unwrap();
    let result = fixture.run_with_environment(&["initialize", "--database", fixture.database()], Some(&heidrun_dir));
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains(heidrun_dir.join("user_activity.jsonl").to_str().unwrap()));
    assert!(result.stdout.contains("records: 1 written, 0 already read"));
}

#[test]
fn the_option_file_replaces_the_path_that_the_variable_heidrun_dir_gives() {
    let fixture = Fixture::new("file_replaces");
    let heidrun_dir = fixture.folder.join("heidrun_dir");
    std::fs::create_dir_all(&heidrun_dir).unwrap();
    std::fs::write(heidrun_dir.join("user_activity.jsonl"), format!("{}\n", line(10))).unwrap();
    let result = fixture.run_with_environment(
        &["initialize", "--database", fixture.database(), "--file", fixture.file()],
        Some(&heidrun_dir),
    );
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("records: 3 written, 0 already read"));
}

#[test]
fn prints_the_error_and_exits_with_the_code_1_when_the_path_of_the_file_is_a_folder() {
    let fixture = Fixture::new("file_is_folder");
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--file", fixture.folder.to_str().unwrap()]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("cannot be read"));
}

#[test]
fn verbose_prints_the_progress_on_the_standard_error_output() {
    let fixture = Fixture::new("verbose");
    fixture.append(&["not json".to_string()]);
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--file", fixture.file(), "--verbose"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains(&format!("file: {}", fixture.file())));
    assert!(result.stderr.contains(&format!("database: {}", fixture.database())));
    assert!(result.stderr.contains("file: line 4 is skipped"));
    assert!(result.stderr.contains("file: 3 records are read, 1 lines are skipped"));
    assert!(result.stderr.contains(&format!("records: written row count 3, file {}", fixture.database())));
    assert!(!result.stdout.contains("line 4"));
}

#[test]
fn without_verbose_nothing_is_printed_on_the_standard_error_output() {
    let fixture = Fixture::new("quiet");
    fixture.append(&["not json".to_string()]);
    let result = fixture.synchronize("initialize");
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.stderr, "");
}

#[test]
fn query_prints_the_rows_as_a_text_table() {
    let fixture = Fixture::new("query_table");
    fixture.synchronize("initialize");
    let result = fixture.run(&[
        "query",
        "--database",
        fixture.database(),
        "SELECT workspaceFolder, endedAt FROM user_activity_records ORDER BY endedAt",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("workspaceFolder"));
    assert!(result.stdout.contains("/work/heidrun"));
    assert!(result.stdout.contains("2026-10-14T08:10:05.000Z"));
    assert!(result.stdout.contains("row count: 3"));
}

#[test]
fn query_finds_the_records_that_overlap_a_time_range() {
    let fixture = Fixture::new("query_overlap");
    fixture.synchronize("initialize");
    let result = fixture.run(&[
        "query",
        "--database",
        fixture.database(),
        "--json",
        "SELECT count(*) AS count FROM user_activity_records \
         WHERE endedAt > '2026-10-14T09:05:00.000Z' AND startedAt < '2026-10-14T09:30:00.000Z'",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(serde_json::from_str::<Value>(&result.stdout).unwrap(), json!([{ "count": 1 }]));
}

#[test]
fn query_refuses_a_statement_that_writes_and_the_rows_stay() {
    let fixture = Fixture::new("query_write");
    fixture.synchronize("initialize");
    let result = fixture.run(&["query", "--database", fixture.database(), "DELETE FROM user_activity_records"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("readonly"));
    assert_eq!(fixture.row_count(), 3);
}

#[test]
fn query_exits_with_the_code_1_and_creates_no_file_when_the_database_does_not_exist() {
    let fixture = Fixture::new("query_missing");
    let result = fixture.run(&["query", "--database", fixture.database(), "SELECT 1"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("does not exist"));
    assert!(!fixture.database_path.exists());
}

#[test]
fn prints_the_error_and_exits_with_the_code_1_when_the_command_is_wrong() {
    let fixture = Fixture::new("wrong_command");
    let result = fixture.run(&["fetch"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error: The command fetch is not known"));
}

#[test]
fn shows_the_three_commands_in_the_help() {
    let fixture = Fixture::new("help");
    let result = fixture.run(&["--help"]);
    assert_eq!(result.exit_code, Some(0));
    for command in ["initialize", "update", "query", "--file", "HEIDRUN_DIR"] {
        assert!(result.stdout.contains(command), "{command}");
    }
}
