//! An operation in the log: `record` runs a public function of a package between a start event and a completion event.
//!
//! This is the one place where a package records an operation. A package calls `record` in the public function itself, so the
//! desktop application, the command line `heidrun_code_data`, and the own command line of the package all write the same events,
//! and a new operation has no need of a timer in the caller.
//!
//! The duration is the time of the closure that `record` runs. It includes everything that the operation does inside: the
//! opening of the files that the operation opens itself, and the waits for the locks that the operation takes itself. It
//! leaves out the writing of the two events, the opening of the SQLite file by the caller before the call, and the lock of
//! the SQLite file that the caller takes before the call (the command `heidrun_code_data` records that wait as the operation
//! `lock_database`).

use crate::clock::{now_milliseconds, system_time_milliseconds, utc_text};
use crate::event::{
    empty_object, CompleteEvent, ErrorCategory, Event, Outcome, OperationKind, StartEvent, FORMAT_VERSION, ORIGIN_APPLICATION,
    ORIGIN_REPLAY,
};
use crate::logger::{current_logger, Logger};
use crate::redaction::{normalize_sql, redact_text, redact_value, truncate_text};
use serde_json::{Map, Value};
use std::cell::RefCell;
use std::fmt::Display;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

thread_local! {
    /// The identifiers of the operations that started on this thread and did not end, the newest last.
    static OPEN_OPERATIONS: RefCell<Vec<String>> = const { RefCell::new(Vec::new()) };
    /// The identifier of the operation that a replay runs again, while a replay runs on this thread.
    static REPLAYED_OPERATION: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// What a package says about an operation when it starts.
#[derive(Debug, Clone)]
pub struct OperationSpec {
    /// The name of the package, without the prefix `data_layer_`.
    package: &'static str,
    /// The stable name of the public function that the operation calls.
    operation_name: &'static str,
    /// What the operation does with the data.
    kind: OperationKind,
    /// The values that decide the workload, in the order in which the package gave them.
    parameters: Map<String, Value>,
    /// The choices that make the pattern of the operation.
    choices: Vec<String>,
    /// The SQL statement of the operation, when it has one.
    sql: Option<String>,
    /// The SQLite file that the operation works on, when it has one.
    database: Option<PathBuf>,
    /// What is known without cost about the data.
    state: Map<String, Value>,
}

impl OperationSpec {
    /// The start of the description of an operation.
    pub fn new(package: &'static str, operation_name: &'static str, kind: OperationKind) -> Self {
        OperationSpec {
            package,
            operation_name,
            kind,
            parameters: Map::new(),
            choices: Vec::new(),
            sql: None,
            database: None,
            state: Map::new(),
        }
    }

    /// A value that decides the workload, for example the repository or the end of a time range. A replay reads it.
    pub fn parameter(mut self, name: &str, value: impl Into<Value>) -> Self {
        self.parameters.insert(name.to_string(), value.into());
        self
    }

    /// A value that decides the workload and that has only a few possible values, for example the grouping interval, the
    /// sort order, or the mode. It is a parameter, and it is part of the pattern, so a summary counts together the operations
    /// that have the same choices and other repositories or other dates.
    pub fn choice(mut self, name: &str, value: impl Into<Value>) -> Self {
        let value = value.into();
        self.choices.push(format!("{name}={}", value.as_str().map(str::to_string).unwrap_or_else(|| value.to_string())));
        self.parameters.insert(name.to_string(), value);
        self
    }

    /// The SQL statement of the operation. The parameter `sql` holds it, without secrets and cut when it is too long, and the
    /// pattern holds it without its values.
    pub fn sql(mut self, sql: &str) -> Self {
        self.sql = Some(sql.to_string());
        self
    }

    /// The SQLite file that the operation works on. The parameter `databasePath` holds its path, and the state holds its size
    /// and the time of its last change.
    pub fn database(mut self, path: &Path) -> Self {
        self.database = Some(path.to_path_buf());
        self
    }

    /// A fact about the data at the start that costs nothing to know, for example the number of entries of a cache.
    pub fn state(mut self, name: &str, value: impl Into<Value>) -> Self {
        self.state.insert(name.to_string(), value.into());
        self
    }
}

/// What a package says about an operation when it ends.
#[derive(Debug, Clone, Default)]
pub struct Summary {
    /// The number of rows, items, or files that the operation returned or wrote.
    result_count: Option<u64>,
    /// Other numbers that explain the duration.
    details: Map<String, Value>,
}

impl Summary {
    /// A summary with nothing to say.
    pub fn none() -> Self {
        Summary::default()
    }

    /// A summary with the number of rows, items, or files of the result.
    pub fn count(count: usize) -> Self {
        Summary { result_count: Some(count as u64), details: Map::new() }
    }

    /// A number that explains the duration, for example the rows written or the files read.
    pub fn detail(mut self, name: &str, value: impl Into<Value>) -> Self {
        self.details.insert(name.to_string(), value.into());
        self
    }
}

/// An operation that started and did not end. Ending it, or dropping it, writes the completion event.
pub struct Operation {
    /// The log that holds the events, or `None` when the log is off.
    logger: Option<Arc<Logger>>,
    /// The identifier of the operation.
    operation_id: String,
    /// The package of the operation.
    package: &'static str,
    /// The operation name.
    operation_name: &'static str,
    /// The moment after the start event was written, from the monotonic clock.
    started: Instant,
    /// True once the completion event was written.
    is_done: bool,
}

impl Operation {
    /// Writes the start event, and starts the monotonic clock. Nothing is written when the log is off.
    pub fn start(spec: OperationSpec) -> Operation {
        let logger = current_logger();
        if logger.is_enabled() == false {
            return Operation {
                logger: None,
                operation_id: String::new(),
                package: spec.package,
                operation_name: spec.operation_name,
                started: Instant::now(),
                is_done: false,
            };
        }
        let started_at = now_milliseconds();
        let parent_operation_id = OPEN_OPERATIONS.with(|open| open.borrow().last().cloned());
        let replay_of = REPLAYED_OPERATION.with(|replayed| replayed.borrow().clone());
        let operation_id = logger.next_operation_id(started_at);
        let concurrent_operations = logger.enter();
        let mut event = Event::Start(StartEvent {
            v: FORMAT_VERSION,
            operation_id: operation_id.clone(),
            parent_operation_id,
            caller: logger.caller(),
            origin: if replay_of.is_some() { ORIGIN_REPLAY } else { ORIGIN_APPLICATION }.to_string(),
            replay_of,
            package: spec.package.to_string(),
            operation_name: spec.operation_name.to_string(),
            kind: spec.kind,
            parameters: parameters_of(&spec),
            pattern: pattern_of(&spec),
            started_at: utc_text(started_at),
            process_id: std::process::id(),
            software_version: env!("CARGO_PKG_VERSION").to_string(),
            concurrent_operations,
            state: state_of(&spec),
            dropped_events: None,
        });
        logger.write(&mut event);
        OPEN_OPERATIONS.with(|open| open.borrow_mut().push(operation_id.clone()));
        Operation {
            logger: Some(logger),
            operation_id,
            package: spec.package,
            operation_name: spec.operation_name,
            started: Instant::now(),
            is_done: false,
        }
    }

    /// The identifier of the operation, or an empty text when the log is off.
    pub fn operation_id(&self) -> &str {
        &self.operation_id
    }

    /// Ends the operation with a result.
    pub fn succeed(mut self, summary: Summary) {
        self.finish(Outcome::Success, None, summary);
    }

    /// Ends the operation with an error. Only the category of the error goes in the log, never its text.
    pub fn fail(self, message: &str) {
        self.fail_with(message, Summary::none());
    }

    /// Ends the operation with an error and a summary, for an operation that did part of its work before it failed, for example
    /// a synchronization of four sources where one source failed.
    pub fn fail_with(mut self, message: &str, summary: Summary) {
        self.finish(Outcome::Failure, Some(ErrorCategory::of_message(message)), summary);
    }

    /// Writes the completion event, once.
    fn finish(&mut self, outcome: Outcome, error_category: Option<&str>, summary: Summary) {
        if self.is_done {
            return;
        }
        self.is_done = true;
        let elapsed = self.started.elapsed();
        let Some(logger) = &self.logger else {
            return;
        };
        OPEN_OPERATIONS.with(|open| open.borrow_mut().retain(|id| *id != self.operation_id));
        logger.leave();
        let mut event = Event::Complete(CompleteEvent {
            v: FORMAT_VERSION,
            operation_id: self.operation_id.clone(),
            package: self.package.to_string(),
            operation_name: self.operation_name.to_string(),
            ended_at: utc_text(system_time_milliseconds(std::time::SystemTime::now())),
            duration_microseconds: elapsed.as_micros() as u64,
            outcome,
            error_category: error_category.map(str::to_string),
            result_count: summary.result_count,
            details: if summary.details.is_empty() { empty_object() } else { Value::Object(summary.details) },
            dropped_events: None,
        });
        logger.write(&mut event);
    }
}

impl Drop for Operation {
    /// An operation that is dropped before it ends is written as a failure: `panic` when the thread is unwinding, else `dropped`.
    fn drop(&mut self) {
        if self.is_done {
            return;
        }
        let category = if std::thread::panicking() { ErrorCategory::PANIC } else { ErrorCategory::DROPPED };
        self.finish(Outcome::Failure, Some(category), Summary::none());
    }
}

/// Runs an operation that returns a result or an error between a start event and a completion event, and gives back what
/// the operation gave, unchanged. `summarize` tells the number of rows and the other numbers of a result.
///
/// The log never changes the result and never hides the original error: a failure of the log is counted and ignored, and a
/// panic of the operation goes on after the completion event is written.
pub fn record<T, E: Display>(
    spec: OperationSpec,
    run: impl FnOnce() -> Result<T, E>,
    summarize: impl FnOnce(&T) -> Summary,
) -> Result<T, E> {
    let operation = Operation::start(spec);
    let result = run();
    match &result {
        Ok(value) => {
            let summary = catch_unwind(AssertUnwindSafe(|| summarize(value))).unwrap_or_default();
            operation.succeed(summary);
        }
        Err(error) => operation.fail(&error.to_string()),
    }
    result
}

/// Runs an operation that cannot fail between a start event and a completion event, and gives back what it gave.
pub fn record_value<T>(spec: OperationSpec, run: impl FnOnce() -> T, summarize: impl FnOnce(&T) -> Summary) -> T {
    let operation = Operation::start(spec);
    let value = run();
    let summary = catch_unwind(AssertUnwindSafe(|| summarize(&value))).unwrap_or_default();
    operation.succeed(summary);
    value
}

/// Runs a closure so that every operation that starts inside it, on this thread, has the origin `replay` and the field
/// `replayOf` with the identifier of the operation that is run again. A summary leaves these operations out by default.
pub fn replaying<T>(replayed_operation_id: &str, run: impl FnOnce() -> T) -> T {
    struct Restore(Option<String>);
    impl Drop for Restore {
        fn drop(&mut self) {
            let previous = self.0.take();
            REPLAYED_OPERATION.with(|replayed| *replayed.borrow_mut() = previous);
        }
    }
    let previous = REPLAYED_OPERATION.with(|replayed| replayed.borrow_mut().replace(replayed_operation_id.to_string()));
    let _restore = Restore(previous);
    run()
}

/// The parameters of the start event: the parameters of the package, the SQL statement, and the path of the database, with
/// every text without secrets.
fn parameters_of(spec: &OperationSpec) -> Value {
    let mut parameters = spec.parameters.clone();
    if let Some(sql) = &spec.sql {
        let (text, is_truncated) = truncate_text(&redact_text(sql));
        parameters.insert("sql".to_string(), Value::String(text));
        if is_truncated {
            parameters.insert("sqlTruncated".to_string(), Value::Bool(true));
        }
    }
    if let Some(database) = &spec.database {
        parameters.insert("databasePath".to_string(), Value::String(database.display().to_string()));
    }
    redact_value(&Value::Object(parameters))
}

/// The pattern of the start event: the SQL statement without its values, then the choices. The statement has no value left
/// to hide, so the pattern is not redacted.
fn pattern_of(spec: &OperationSpec) -> String {
    let mut parts = Vec::new();
    if let Some(sql) = &spec.sql {
        parts.push(truncate_text(&normalize_sql(sql)).0);
    }
    parts.extend(spec.choices.iter().cloned());
    parts.join(" | ")
}

/// The state of the start event: the facts of the package, the size of the SQLite file, and the time of its last change.
fn state_of(spec: &OperationSpec) -> Value {
    let mut state = spec.state.clone();
    if let Some(database) = &spec.database {
        match std::fs::metadata(database) {
            Ok(metadata) => {
                state.insert("databaseBytes".to_string(), Value::from(metadata.len()));
                if let Ok(modified) = metadata.modified() {
                    state.insert("databaseModifiedAt".to_string(), Value::String(utc_text(system_time_milliseconds(modified))));
                }
            }
            Err(_) => {
                state.insert("databaseExists".to_string(), Value::Bool(false));
            }
        }
    }
    Value::Object(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::capture;

    fn query_spec(sql: &str) -> OperationSpec {
        OperationSpec::new("source_control", "query", OperationKind::Query).sql(sql)
    }

    #[test]
    fn a_operation_writes_a_start_event_and_a_completion_event_with_the_same_identifier() {
        let (result, events) = capture(|| {
            record(query_spec("select 1"), || Ok::<_, String>(vec![1, 2, 3]), |rows| Summary::count(rows.len()))
        });
        assert_eq!(result, Ok(vec![1, 2, 3]));
        assert_eq!(events.len(), 2);
        let (Event::Start(start), Event::Complete(complete)) = (&events[0], &events[1]) else {
            panic!("the events are {events:?}");
        };
        assert_eq!(start.operation_id, complete.operation_id);
        assert_eq!((start.package.as_str(), start.operation_name.as_str()), ("source_control", "query"));
        assert_eq!(start.kind, OperationKind::Query);
        assert_eq!(start.origin, ORIGIN_APPLICATION);
        assert_eq!(start.parent_operation_id, None);
        assert_eq!(start.parameters["sql"], "select 1");
        assert_eq!(complete.outcome, Outcome::Success);
        assert_eq!(complete.result_count, Some(3));
        assert_eq!(complete.error_category, None);
    }

    #[test]
    fn an_error_is_given_back_unchanged_and_the_completion_event_holds_only_its_category() {
        let (result, events) = capture(|| {
            record(query_spec("select"), || Err::<(), String>("near \"select\": syntax error in /Users/someone/secret.sqlite".to_string()), |_| {
                Summary::none()
            })
        });
        assert_eq!(result, Err("near \"select\": syntax error in /Users/someone/secret.sqlite".to_string()));
        let Event::Complete(complete) = &events[1] else {
            panic!("the events are {events:?}");
        };
        assert_eq!(complete.outcome, Outcome::Failure);
        assert_eq!(complete.error_category.as_deref(), Some(ErrorCategory::DATABASE_ERROR));
        let line = serde_json::to_string(&events[1]).unwrap();
        assert!(line.contains("secret.sqlite") == false, "the text of the error is in the log: {line}");
    }

    #[test]
    fn a_nested_operation_names_its_parent_and_the_parent_has_none() {
        let (_, events) = capture(|| {
            record(OperationSpec::new("heidrun_code_data", "synchronize", OperationKind::Synchronization), || {
                record(OperationSpec::new("source_control", "synchronize", OperationKind::Synchronization), || Ok::<_, String>(()), |_| {
                    Summary::none()
                })
            }, |_| Summary::none())
        });
        let starts: Vec<&StartEvent> = events
            .iter()
            .filter_map(|event| match event {
                Event::Start(start) => Some(start),
                Event::Complete(_) => None,
            })
            .collect();
        assert_eq!(starts.len(), 2);
        assert_eq!(starts[0].parent_operation_id, None);
        assert_eq!(starts[1].parent_operation_id.as_deref(), Some(starts[0].operation_id.as_str()));
    }

    #[test]
    fn a_operation_after_a_nested_one_has_no_parent_again() {
        let (_, events) = capture(|| {
            let _ = record(query_spec("select 1"), || Ok::<_, String>(()), |_| Summary::none());
            let _ = record(query_spec("select 2"), || Ok::<_, String>(()), |_| Summary::none());
        });
        for event in &events {
            if let Event::Start(start) = event {
                assert_eq!(start.parent_operation_id, None);
            }
        }
    }

    #[test]
    fn two_operations_in_two_threads_have_different_identifiers_and_no_parent() {
        let (_, events) = capture(|| {
            let logger = current_logger();
            let handles: Vec<_> = (0..4)
                .map(|_| {
                    let logger = logger.clone();
                    std::thread::spawn(move || {
                        crate::logger::with_logger(logger, || {
                            record(query_spec("select 1"), || Ok::<_, String>(()), |_| Summary::none())
                        })
                    })
                })
                .collect();
            for handle in handles {
                handle.join().unwrap().unwrap();
            }
        });
        let identifiers: std::collections::HashSet<&str> = events.iter().map(Event::operation_id).collect();
        assert_eq!(identifiers.len(), 4);
        assert_eq!(events.len(), 8);
        for event in &events {
            if let Event::Start(start) = event {
                assert_eq!(start.parent_operation_id, None);
            }
        }
    }

    #[test]
    fn a_panic_ends_the_operation_as_a_failure_and_goes_on() {
        let (outcome, events) = capture(|| {
            catch_unwind(AssertUnwindSafe(|| {
                let _ = record(query_spec("select 1"), || -> Result<(), String> { panic!("the operation panics") }, |_| Summary::none());
            }))
        });
        assert!(outcome.is_err(), "the panic goes on");
        assert_eq!(events.len(), 2);
        let Event::Complete(complete) = &events[1] else {
            panic!("the events are {events:?}");
        };
        assert_eq!(complete.outcome, Outcome::Failure);
        assert_eq!(complete.error_category.as_deref(), Some(ErrorCategory::PANIC));
    }

    #[test]
    fn a_operation_that_is_dropped_is_a_failure_with_the_category_dropped() {
        let (_, events) = capture(|| {
            let operation = Operation::start(query_spec("select 1"));
            drop(operation);
        });
        let Event::Complete(complete) = &events[1] else {
            panic!("the events are {events:?}");
        };
        assert_eq!(complete.error_category.as_deref(), Some(ErrorCategory::DROPPED));
    }

    #[test]
    fn a_replay_marks_every_operation_inside_it() {
        let (_, events) = capture(|| {
            let _ = replaying("original-1", || record(query_spec("select 1"), || Ok::<_, String>(()), |_| Summary::none()));
            let _ = record(query_spec("select 2"), || Ok::<_, String>(()), |_| Summary::none());
        });
        let starts: Vec<&StartEvent> = events
            .iter()
            .filter_map(|event| match event {
                Event::Start(start) => Some(start),
                Event::Complete(_) => None,
            })
            .collect();
        assert_eq!((starts[0].origin.as_str(), starts[0].replay_of.as_deref()), (ORIGIN_REPLAY, Some("original-1")));
        assert_eq!((starts[1].origin.as_str(), starts[1].replay_of.as_deref()), (ORIGIN_APPLICATION, None));
    }

    #[test]
    fn the_secrets_of_a_statement_are_not_written_and_the_pattern_has_no_value() {
        let (_, events) = capture(|| {
            let _ = record(
                query_spec("select * from t where token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' and n = 42"),
                || Ok::<_, String>(()),
                |_| Summary::none(),
            );
        });
        let line = serde_json::to_string(&events[0]).unwrap();
        assert!(line.contains("ghp_") == false, "{line}");
        let Event::Start(start) = &events[0] else {
            panic!("the events are {events:?}");
        };
        assert_eq!(start.pattern, "select * from t where token = ? and n = ?");
    }

    #[test]
    fn a_choice_is_a_parameter_and_part_of_the_pattern() {
        let (_, events) = capture(|| {
            let spec = OperationSpec::new("coding_agents", "find_usage", OperationKind::Query)
                .parameter("repository", "heidrun-org/heidrun")
                .choice("grouping", "hour");
            let _ = record(spec, || Ok::<_, String>(()), |_| Summary::none());
        });
        let Event::Start(start) = &events[0] else {
            panic!("the events are {events:?}");
        };
        assert_eq!(start.parameters["grouping"], "hour");
        assert_eq!(start.parameters["repository"], "heidrun-org/heidrun");
        assert_eq!(start.pattern, "grouping=hour");
    }

    #[test]
    fn a_log_that_is_off_writes_nothing_and_gives_back_the_result() {
        let logger = Arc::new(Logger::new(crate::settings::LogSettings::off()));
        let result = crate::logger::with_logger(logger, || {
            record(query_spec("select 1"), || Ok::<_, String>(5), |_| Summary::none())
        });
        assert_eq!(result, Ok(5));
    }

    #[test]
    fn a_log_that_cannot_write_does_not_change_the_result() {
        let blocker = std::env::temp_dir().join(format!("operation-log-blocker-{}", std::process::id()));
        std::fs::write(&blocker, "x").unwrap();
        let logger = Arc::new(Logger::new(crate::settings::LogSettings::for_file(&blocker.join("inside").join("log.jsonl"))));
        let result = crate::logger::with_logger(logger.clone(), || {
            record(query_spec("select 1"), || Ok::<_, String>(5), |_| Summary::none())
        });
        assert_eq!(result, Ok(5));
        assert_eq!(logger.dropped_events(), 2);
    }
}
