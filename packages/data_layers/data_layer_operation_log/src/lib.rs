//! `data_layer_operation_log`: the log of the operations that the data layer packages receive.
//!
//! A data layer package calls `record` in each public function. The call writes two events in one log file, a start event
//! before the operation and a completion event after it, with the same operation identifier. The events tell the caller, the
//! package, the operation name, the parameters that decide the workload, the duration, and the outcome. The files of the log are
//! then read to find the usage patterns and to run an operation again.
//!
//! The library has six parts:
//! - `record`, `record_value`, `OperationSpec`, and `Summary` write the two events of an operation. `replaying` marks the operations
//!   of a replay.
//! - `Event`, `StartEvent`, and `CompleteEvent` are the record format, and `FORMAT_VERSION` is its version.
//! - `Logger`, `LogSettings`, and `set_default_caller` hold the file, its size limit, and the name of the caller.
//! - `redact_text` and `normalize_sql` keep the secrets out of the file and group the statements.
//! - `read_log`, `filter_operations`, and `summarize` pair the events and give the usage patterns and the durations.
//! - `measure_overhead` measures the cost of the log.
//!
//! The calls are blocking. The log never changes the result of an operation and never hides its error.

mod clock;
mod event;
mod logger;
mod overhead;
mod reading;
mod redaction;
mod operation;
mod settings;
mod summary;
pub mod testing;

pub use clock::{now_milliseconds, parse_utc_text, utc_text};
pub use event::{
    empty_object, CompleteEvent, ErrorCategory, Event, Outcome, OperationKind, StartEvent, FORMAT_VERSION, ORIGIN_APPLICATION,
    ORIGIN_REPLAY,
};
pub use logger::{current_logger, set_default_caller, with_logger, Logger};
pub use overhead::{measure_overhead, OverheadReport};
pub use reading::{
    process_is_alive, read_log, read_log_with, LogReading, PairedOperation, OperationState, STALE_AFTER_MILLISECONDS,
};
pub use redaction::{is_secret_name, normalize_sql, redact_text, redact_value, truncate_text, MAX_TEXT_CHARACTERS, REDACTED};
pub use operation::{record, record_value, replaying, Operation, OperationSpec, Summary};
pub use settings::{
    default_log_file, rotated_file, LogSettings, CALLER_VARIABLE, DEFAULT_MAX_BYTES, LOG_FILE_NAME, LOG_FILE_VARIABLE, OFF_VALUE,
};
pub use summary::{filter_operations, repeated, summarize, workload_of, DurationStatistics, Filter, Group, GroupBy};
