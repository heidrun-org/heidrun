//! The record format: the two events that an operation writes in the log file, one JSON object on each line.
//!
//! The field `v` of each event holds the version of the format. A reader that does not know a version skips its lines and
//! counts them. A change that renames or removes a field, or that changes the meaning of a field, adds one to the version.
//! A new optional field does not.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// The version of the record format that this package writes and reads.
pub const FORMAT_VERSION: u32 = 2;

/// The value of the field `origin` of an operation that a person or a program made for its own need.
pub const ORIGIN_APPLICATION: &str = "application";

/// The value of the field `origin` of an operation that the command `heidrun_data operations replay` made to measure. A summary
/// leaves these operations out, so a performance exercise does not change the picture of the real usage.
pub const ORIGIN_REPLAY: &str = "replay";

/// What an operation does with the data. The summaries tell these five apart.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    /// A read of the rows that the SQLite file already holds. It touches no source.
    Query,
    /// A read of a source: the chat session files, the Git repository, the command `gh`, the price list on the web.
    Collection,
    /// The mode initialize or the mode update of a source: a collection, then a write in the SQLite file.
    Synchronization,
    /// A write of rows in the SQLite file, the second half of a synchronization.
    Write,
    /// The wait for the lock of the SQLite file, which the caller takes before it writes.
    Lock,
}

impl OperationKind {
    /// The name of the kind, as the log file writes it.
    pub fn name(self) -> &'static str {
        match self {
            OperationKind::Query => "query",
            OperationKind::Collection => "collection",
            OperationKind::Synchronization => "synchronization",
            OperationKind::Write => "write",
            OperationKind::Lock => "lock",
        }
    }
}

/// How an operation ended.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    /// The operation returned a result.
    Success,
    /// The operation returned an error, or it stopped with a panic.
    Failure,
}

/// The first event of an operation: it is written before the operation starts, so an operation that never ends stays visible.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartEvent {
    /// The version of the record format.
    pub v: u32,
    /// The identifier of the operation. It is unique among the operations of all the programs of the computer, and the
    /// completion event of the operation holds the same one.
    pub operation_id: String,
    /// The identifier of the operation that was running on the same thread when this one started. An operation with a parent is a
    /// nested operation, and a summary does not count it as an operation of its own, unless a person asks for it.
    pub parent_operation_id: Option<String>,
    /// The program that made the operation: `heidrun` for the desktop application, `heidrun_data` for the command line.
    pub caller: String,
    /// Either `application` or `replay`.
    pub origin: String,
    /// The identifier of the operation that a replay runs again. The value is absent for an operation of the application.
    pub replay_of: Option<String>,
    /// The name of the package that received the operation, without the prefix `data_layer_`: `source_control`.
    pub package: String,
    /// The stable name of the public function that the operation calls: `query`. The pair of the package and the operation name is the
    /// key of every summary.
    pub operation_name: String,
    /// What the operation does with the data.
    pub kind: OperationKind,
    /// The values that decide the workload. A replay reads them to run the operation again.
    pub parameters: Value,
    /// The text that groups operations that ask for the same thing with other values: the SQL statement without its literal
    /// values, or the choices (the grouping interval, the sort order, the mode) of the operation.
    pub pattern: String,
    /// The wall-clock time at the start, in UTC.
    pub started_at: String,
    /// The identifier of the operating system process.
    pub process_id: u32,
    /// The version of the software that wrote the event.
    pub software_version: String,
    /// The number of operations that were running in the same process when this one started.
    pub concurrent_operations: u32,
    /// What is known without cost about the data at the start: the size of the SQLite file and its last change. The file is
    /// never copied in the log.
    pub state: Value,
    /// The number of events that this process could not write before this one. Absent when no event was lost.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub dropped_events: Option<u64>,
}

/// The second event of an operation: it is written when the operation ends, with a result or with an error.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompleteEvent {
    /// The version of the record format.
    pub v: u32,
    /// The identifier of the operation, the same as in the start event.
    pub operation_id: String,
    /// The package of the operation, repeated so that a line is readable when the start event is in a rotated file that is gone.
    pub package: String,
    /// The operation name, repeated for the same reason.
    pub operation_name: String,
    /// The wall-clock time at the end, in UTC.
    pub ended_at: String,
    /// The time between the start and the end, in microseconds, from the monotonic clock of the program.
    pub duration_microseconds: u64,
    /// Either `success` or `failure`.
    pub outcome: Outcome,
    /// A short word that says what kind of error ended the operation: see `ErrorCategory`. The value is absent on success.
    pub error_category: Option<String>,
    /// The number of rows, items, or files that the operation returned or wrote, when the operation knows it.
    pub result_count: Option<u64>,
    /// Other numbers that explain the duration: the rows written, the files read, the cache entries.
    pub details: Value,
    /// The number of events that this process could not write before this one. Absent when no event was lost.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub dropped_events: Option<u64>,
}

/// One line of the log file.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    /// The first event of an operation.
    Start(StartEvent),
    /// The second event of an operation.
    Complete(CompleteEvent),
}

impl Event {
    /// The identifier of the operation that the event belongs to.
    pub fn operation_id(&self) -> &str {
        match self {
            Event::Start(start) => &start.operation_id,
            Event::Complete(complete) => &complete.operation_id,
        }
    }
}

/// The words of the field `errorCategory`. The category tells what to look at, and never repeats the text of the error,
/// because that text can hold a path, a statement, or a piece of a source.
pub struct ErrorCategory;

impl ErrorCategory {
    /// Another program or another thread holds the SQLite file.
    pub const DATABASE_LOCKED: &'static str = "database_locked";
    /// SQLite refused the statement or the write: a wrong statement, a missing table, a read only file.
    pub const DATABASE_ERROR: &'static str = "database_error";
    /// A file, a folder, a repository, or a row does not exist.
    pub const NOT_FOUND: &'static str = "not_found";
    /// The operating system refused to read or write a file.
    pub const PERMISSION_DENIED: &'static str = "permission_denied";
    /// A source did not answer: the command `git` or `gh` failed, the network is down.
    pub const SOURCE_UNAVAILABLE: &'static str = "source_unavailable";
    /// The data does not follow its JSON schema, or cannot be parsed.
    pub const INVALID_DATA: &'static str = "invalid_data";
    /// The caller gave a wrong value: an unknown mode, a bad time range.
    pub const INVALID_INPUT: &'static str = "invalid_input";
    /// The operation stopped with a panic.
    pub const PANIC: &'static str = "panic";
    /// The operation was dropped before it ended, for example by an early return of a caller that did not finish it.
    pub const DROPPED: &'static str = "dropped";
    /// Any other error.
    pub const OTHER: &'static str = "other";

    /// The category of the text of an error. The packages give their errors as text, so the category comes from the words.
    pub fn of_message(message: &str) -> &'static str {
        let text = message.to_lowercase();
        let has = |words: &[&str]| words.iter().any(|word| text.contains(word));
        if has(&["database is locked", "database table is locked", "busy", "locked by"]) {
            ErrorCategory::DATABASE_LOCKED
        } else if has(&["no such table", "no such column", "syntax error"]) {
            ErrorCategory::DATABASE_ERROR
        } else if has(&["no such file", "not found", "does not exist", "cannot find", "not a git repository"]) {
            ErrorCategory::NOT_FOUND
        } else if has(&["permission denied", "operation not permitted", "access is denied"]) {
            ErrorCategory::PERMISSION_DENIED
        } else if has(&["sqlite", "sql ", "syntax error", "read only", "readonly", "constraint", "no such column", "database"]) {
            ErrorCategory::DATABASE_ERROR
        } else if has(&["schema", "not valid json", "is not a commit", "invalid json", "cannot be parsed", "parse"]) {
            ErrorCategory::INVALID_DATA
        } else if has(&["`git`", "`gh`", "network", "connection", "timed out", "could not resolve", "http"]) {
            ErrorCategory::SOURCE_UNAVAILABLE
        } else if has(&["invalid", "unknown", "not a number", "must be", "needs a"]) {
            ErrorCategory::INVALID_INPUT
        } else {
            ErrorCategory::OTHER
        }
    }
}

/// An empty JSON object, the value of `parameters`, `state`, and `details` when there is nothing to say.
pub fn empty_object() -> Value {
    Value::Object(Map::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_start() -> StartEvent {
        StartEvent {
            v: FORMAT_VERSION,
            operation_id: "r1".to_string(),
            parent_operation_id: None,
            caller: "heidrun".to_string(),
            origin: ORIGIN_APPLICATION.to_string(),
            replay_of: None,
            package: "source_control".to_string(),
            operation_name: "query".to_string(),
            kind: OperationKind::Query,
            parameters: serde_json::json!({ "sql": "select 1" }),
            pattern: "select ?".to_string(),
            started_at: "2026-10-17T12:34:56.789Z".to_string(),
            process_id: 7,
            software_version: "0.2.7".to_string(),
            concurrent_operations: 0,
            state: empty_object(),
            dropped_events: None,
        }
    }

    #[test]
    fn a_start_event_is_one_line_with_the_event_name_and_the_camel_case_fields() {
        let line = serde_json::to_string(&Event::Start(sample_start())).unwrap();
        assert!(line.starts_with("{\"event\":\"start\",\"v\":2,\"operationId\":\"r1\""), "{line}");
        assert!(line.contains("\"kind\":\"query\""));
        assert!(line.contains("\"startedAt\":\"2026-10-17T12:34:56.789Z\""));
        assert!(line.contains('\n') == false);
        assert!(line.contains("droppedEvents") == false);
    }

    #[test]
    fn a_line_is_read_back_to_the_same_event() {
        let event = Event::Start(sample_start());
        let line = serde_json::to_string(&event).unwrap();
        assert_eq!(serde_json::from_str::<Event>(&line).unwrap(), event);
    }

    #[test]
    fn a_completion_event_is_read_back_to_the_same_event() {
        let event = Event::Complete(CompleteEvent {
            v: FORMAT_VERSION,
            operation_id: "r1".to_string(),
            package: "source_control".to_string(),
            operation_name: "query".to_string(),
            ended_at: "2026-10-17T12:34:56.790Z".to_string(),
            duration_microseconds: 1234,
            outcome: Outcome::Failure,
            error_category: Some(ErrorCategory::DATABASE_LOCKED.to_string()),
            result_count: None,
            details: empty_object(),
            dropped_events: Some(2),
        });
        let line = serde_json::to_string(&event).unwrap();
        assert!(line.contains("\"event\":\"complete\""));
        assert!(line.contains("\"droppedEvents\":2"));
        assert_eq!(serde_json::from_str::<Event>(&line).unwrap(), event);
    }

    #[test]
    fn the_category_comes_from_the_words_of_the_error() {
        assert_eq!(ErrorCategory::of_message("database is locked"), ErrorCategory::DATABASE_LOCKED);
        assert_eq!(ErrorCategory::of_message("No such file or directory (os error 2)"), ErrorCategory::NOT_FOUND);
        assert_eq!(ErrorCategory::of_message("no such table: commits"), ErrorCategory::DATABASE_ERROR);
        assert_eq!(
            ErrorCategory::of_message("The database file does not exist: /a/data_layer.sqlite. Run the command update first."),
            ErrorCategory::NOT_FOUND
        );
        assert_eq!(ErrorCategory::of_message("Permission denied (os error 13)"), ErrorCategory::PERMISSION_DENIED);
        assert_eq!(ErrorCategory::of_message("near \"selec\": syntax error"), ErrorCategory::DATABASE_ERROR);
        assert_eq!(ErrorCategory::of_message("The command `git` failed"), ErrorCategory::SOURCE_UNAVAILABLE);
        assert_eq!(ErrorCategory::of_message("something odd"), ErrorCategory::OTHER);
    }
}
