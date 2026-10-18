//! The cost of the log itself: the time that one operation adds when the log is on, and the bytes that it writes.
//!
//! The measure runs the same empty operation many times, with the log off and with the log on in a temporary file, so the
//! difference is the cost of the two events and nothing else. The result is the proof that the log does not become the
//! cause of the slowdown that it measures.

use crate::logger::{with_logger, Logger};
use crate::operation::{record_value, OperationSpec, Summary};
use crate::event::OperationKind;
use crate::settings::LogSettings;
use crate::summary::DurationStatistics;
use crate::testing::new_temporary_folder;
use std::sync::Arc;
use std::time::Instant;

/// The cost of the log on a number of operations.
#[derive(Debug, Clone, PartialEq)]
pub struct OverheadReport {
    /// The number of operations of each run.
    pub iterations: usize,
    /// The time of an operation with the log off, in microseconds.
    pub off: DurationStatistics,
    /// The time of an operation with the log on, in microseconds.
    pub on: DurationStatistics,
    /// The mean time that the log adds to an operation, in microseconds.
    pub added_mean_microseconds: f64,
    /// The mean number of bytes that an operation writes in the file, with its two events.
    pub bytes_per_operation: f64,
}

/// Measures the cost of the log on `iterations` operations with a statement of 200 characters and three parameters, which is
/// larger than most real operations.
///
/// # Errors
/// An error when the temporary folder cannot be written.
pub fn measure_overhead(iterations: usize) -> Result<OverheadReport, String> {
    let sql = format!("select json_extract(data, '$.title') from chat_sessions where repository = 'a/b' {}", "and 1 = 1 ".repeat(12));
    let off = run_operations(Arc::new(Logger::new(LogSettings::off())), iterations, &sql);
    let folder = new_temporary_folder("overhead");
    std::fs::create_dir_all(&folder).map_err(|error| format!("The folder {} cannot be made: {error}", folder.display()))?;
    let file = folder.join("data_layer_operations.jsonl");
    let on = run_operations(Arc::new(Logger::new(LogSettings::for_file(&file))), iterations, &sql);
    let bytes = std::fs::metadata(&file).map(|metadata| metadata.len()).unwrap_or(0);
    let _ = std::fs::remove_dir_all(&folder);
    let off = DurationStatistics::of(&off);
    let on = DurationStatistics::of(&on);
    Ok(OverheadReport {
        iterations,
        added_mean_microseconds: on.mean_microseconds - off.mean_microseconds,
        bytes_per_operation: bytes as f64 / iterations.max(1) as f64,
        off,
        on,
    })
}

/// The time of each of `iterations` operations on a log, in microseconds.
fn run_operations(logger: Arc<Logger>, iterations: usize, sql: &str) -> Vec<u64> {
    let mut durations = Vec::with_capacity(iterations);
    with_logger(logger, || {
        for number in 0..iterations {
            let spec = OperationSpec::new("coding_agents", "find_usage", OperationKind::Query)
                .sql(sql)
                .parameter("repository", "heidrun-org/heidrun")
                .choice("grouping", "hour")
                .parameter("since", number as u64);
            let started = Instant::now();
            record_value(spec, || std::hint::black_box(number), |_| Summary::count(1));
            durations.push(started.elapsed().as_micros() as u64);
        }
    });
    durations
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The most that one operation may add to the work of an operation with the log on, in microseconds. A real operation that
    /// the log measures takes at least a few hundred microseconds. This limit is large because the test runs in a
    /// development build on a computer that runs other programs, and it still catches a log that locks, waits, or syncs.
    const BUDGET_MICROSECONDS: f64 = 1000.0;

    /// The most bytes that one operation may write: two events with a statement of 200 characters.
    const BYTES_BUDGET: f64 = 2048.0;

    #[test]
    fn a_operation_adds_less_than_the_budget_and_writes_few_bytes() {
        // The tests run in parallel, so one slow measure is repeated: the quietest of three counts.
        let mut report = measure_overhead(2000).unwrap();
        for _ in 0..2 {
            if report.added_mean_microseconds < BUDGET_MICROSECONDS {
                break;
            }
            report = measure_overhead(2000).unwrap();
        }
        assert_eq!(report.on.count, 2000);
        assert!(
            report.added_mean_microseconds < BUDGET_MICROSECONDS,
            "one operation adds {:.1} microseconds, the budget is {BUDGET_MICROSECONDS}",
            report.added_mean_microseconds
        );
        assert!(report.bytes_per_operation < BYTES_BUDGET, "one operation writes {:.0} bytes", report.bytes_per_operation);
        assert!(report.bytes_per_operation > 100.0, "the events are written: {:.0} bytes", report.bytes_per_operation);
    }
}
