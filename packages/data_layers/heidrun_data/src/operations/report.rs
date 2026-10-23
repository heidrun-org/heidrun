//! The log of the operations of the data layer as rows: the file, the usage patterns, the list of the operations, and the cost
//! of the log. The records come from the package `data_layer_operation_log`, which every data layer package writes through.

use crate::output::QueryRow;
use data_layer_operation_log::{
    filter_operations, measure_overhead, repeated, summarize, workload_of, Filter, GroupBy, LogReading, PairedOperation, FORMAT_VERSION,
};
use serde_json::{json, Value};
use std::path::Path;

/// The most operations that the command `operations list` prints when the option `--limit` is not given.
pub const DEFAULT_LIST_LIMIT: usize = 100;

/// Reads the log file and its old file, and pairs the events. A log that does not exist is an empty log.
///
/// # Errors
/// An error when a file exists and cannot be read.
pub fn read_operations(log_file: &Path) -> Result<LogReading, String> {
    data_layer_operation_log::read_log(log_file, data_layer_operation_log::now_milliseconds())
}

/// The time of a bound of the options `--since` and `--until`, in milliseconds since 1970 UTC. The forms are a date
/// `2026-10-17` (the start of the day), a time `2026-10-17T12:30:00Z`, and a time with milliseconds
/// `2026-10-17T12:30:00.000Z`. The times are in UTC.
///
/// # Errors
/// An error when the text has none of the three forms.
pub fn parse_time_bound(text: &str) -> Result<i64, String> {
    let full = match text.len() {
        10 => format!("{text}T00:00:00.000Z"),
        20 => format!("{}.000Z", &text[..19]),
        _ => text.to_string(),
    };
    data_layer_operation_log::parse_utc_text(&full)
        .ok_or_else(|| format!("The time {text} is not a date YYYY-MM-DD or a time like 2026-10-17T12:30:00Z in UTC."))
}

/// What the log file is: where it is, how large, how many operations, and what is wrong with it.
///
/// # Errors
/// An error when a file exists and cannot be read.
pub fn info_row(log_file: &Path) -> Result<QueryRow, String> {
    let reading = read_operations(log_file)?;
    let size_of = |path: &Path| std::fs::metadata(path).map(|metadata| metadata.len()).unwrap_or(0);
    let old_file = data_layer_operation_log::rotated_file(log_file);
    let count = |is_counted: &dyn Fn(&PairedOperation) -> bool| reading.operations.iter().filter(|operation| is_counted(operation)).count();
    let settings = data_layer_operation_log::LogSettings::from_environment();
    let row = json!({
        "logFile": log_file.display().to_string(),
        "isLogOn": settings.file.is_some(),
        "formatVersion": FORMAT_VERSION,
        "bytes": size_of(log_file),
        "oldFileBytes": size_of(&old_file),
        "maximumBytes": settings.max_bytes,
        "operationCount": reading.operations.len(),
        "topLevelOperationCount": count(&|operation| operation.start.parent_operation_id.is_none()),
        "nestedOperationCount": count(&|operation| operation.start.parent_operation_id.is_some()),
        "replayCount": count(&|operation| operation.start.origin == data_layer_operation_log::ORIGIN_REPLAY),
        "unfinishedCount": count(&|operation| operation.state.is_unfinished()),
        "failedCount": count(&|operation| operation.state == data_layer_operation_log::OperationState::Failed),
        "orphanCompletions": reading.orphan_completions,
        "malformedLines": reading.malformed_lines,
        "unsupportedVersionLines": reading.unsupported_version_lines,
        "droppedEvents": reading.dropped_events,
        "firstStartedAt": reading.operations.first().map(|operation| operation.start.started_at.clone()),
        "lastStartedAt": reading.operations.last().map(|operation| operation.start.started_at.clone()),
    });
    match row {
        Value::Object(row) => Ok(row),
        _ => unreachable!("The row is an object"),
    }
}

/// The usage patterns: one row for each group of operations, with the largest total time first. `is_repeated_only` keeps the
/// groups of two operations or more.
pub fn summary_rows(reading: &LogReading, filter: &Filter, by: GroupBy, is_repeated_only: bool) -> Vec<QueryRow> {
    let operations = filter_operations(&reading.operations, filter);
    let groups = summarize(&operations, by);
    let groups = if is_repeated_only { repeated(groups) } else { groups };
    groups.iter().map(|group| group.to_row()).collect()
}

/// The operations that pass the filter, with their parameters and their durations, in the order of their start. With
/// `is_slowest_first`, the longest operations come first. An operation that did not end comes last.
pub fn list_rows(reading: &LogReading, filter: &Filter, limit: Option<usize>, is_slowest_first: bool) -> Vec<QueryRow> {
    let mut operations = filter_operations(&reading.operations, filter);
    if is_slowest_first {
        operations.sort_by_key(|operation| std::cmp::Reverse(operation.duration_microseconds().unwrap_or(0)));
    }
    let operations: Vec<&PairedOperation> = match limit {
        Some(limit) => operations.into_iter().take(limit).collect(),
        None => operations,
    };
    operations.into_iter().map(operation_row).collect()
}

/// One operation as a row.
pub fn operation_row(operation: &PairedOperation) -> QueryRow {
    let start = &operation.start;
    let complete = operation.complete.as_ref();
    let row = json!({
        "operationId": start.operation_id,
        "parentOperationId": start.parent_operation_id,
        "caller": start.caller,
        "origin": start.origin,
        "replayOf": start.replay_of,
        "package": start.package,
        "operationName": start.operation_name,
        "kind": start.kind.name(),
        "workload": workload_of(operation),
        "state": operation.state.name(),
        "startedAt": start.started_at,
        "durationMilliseconds": operation.duration_milliseconds(),
        "outcome": complete.map(|complete| format!("{:?}", complete.outcome).to_lowercase()),
        "errorCategory": complete.and_then(|complete| complete.error_category.clone()),
        "resultCount": complete.and_then(|complete| complete.result_count),
        "pattern": start.pattern,
        "parameters": start.parameters,
        "concurrentOperations": start.concurrent_operations,
        "softwareVersion": start.software_version,
        "processId": start.process_id,
        "dataState": start.state,
        "details": complete.map(|complete| complete.details.clone()),
    });
    match row {
        Value::Object(row) => row,
        _ => unreachable!("The row is an object"),
    }
}

/// The cost of the log: the time that an operation adds with the log on, and the bytes that it writes.
///
/// # Errors
/// An error when the temporary folder of the measure cannot be written.
pub fn overhead_rows(iterations: usize) -> Result<Vec<QueryRow>, String> {
    let report = measure_overhead(iterations)?;
    let row = |log: &str, statistics: &data_layer_operation_log::DurationStatistics| {
        json!({
            "log": log,
            "operationCount": statistics.count,
            "meanMicroseconds": (statistics.mean_microseconds * 10.0).round() / 10.0,
            "medianMicroseconds": statistics.median_microseconds,
            "p99Microseconds": statistics.p99_microseconds,
            "maximumMicroseconds": statistics.maximum_microseconds,
        })
    };
    let mut rows = vec![row("off", &report.off), row("on", &report.on)];
    rows.push(json!({
        "log": "added by the log",
        "operationCount": report.iterations,
        "meanMicroseconds": (report.added_mean_microseconds * 10.0).round() / 10.0,
        "bytesPerOperation": report.bytes_per_operation.round(),
    }));
    Ok(rows.into_iter().filter_map(|row| if let Value::Object(row) = row { Some(row) } else { None }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

    /// A log file with three operations: two queries and a failed one, written by the real recording code.
    fn log_with_operations(name: &str) -> std::path::PathBuf {
        let folder = data_layer_operation_log::testing::new_temporary_folder(name);
        let file = folder.join("data_layer_operations.jsonl");
        let logger = std::sync::Arc::new(data_layer_operation_log::Logger::new(data_layer_operation_log::LogSettings::for_file(&file)));
        data_layer_operation_log::with_logger(logger, || {
            for number in 0..2 {
                let spec = OperationSpec::new("coding_agents", "find_usage", OperationKind::Query)
                    .parameter("repository", "heidrun-org/heidrun")
                    .parameter("since", number)
                    .choice("grouping", "hour");
                let _ = record(spec, || Ok::<_, String>(vec![1, 2, 3]), |rows| Summary::count(rows.len()));
            }
            let spec = OperationSpec::new("source_control", "query", OperationKind::Query).sql("SELEC nothing");
            let _ = record(spec, || Err::<(), String>("syntax error".to_string()), |_| Summary::none());
        });
        file
    }

    #[test]
    fn a_time_bound_is_a_date_or_a_time_in_utc() {
        assert_eq!(parse_time_bound("2026-10-17"), parse_time_bound("2026-10-17T00:00:00Z"));
        assert_eq!(parse_time_bound("2026-10-17T12:34:56Z"), parse_time_bound("2026-10-17T12:34:56.000Z"));
        assert_eq!(parse_time_bound("2026-10-17T12:34:56.000Z"), Ok(1_792_240_496_000));
        assert!(parse_time_bound("yesterday").is_err());
    }

    #[test]
    fn the_info_row_counts_the_operations_the_failures_and_the_damage_of_the_file() {
        let file = log_with_operations("info");
        std::fs::write(&file, std::fs::read_to_string(&file).unwrap() + "not json\n").unwrap();
        let row = info_row(&file).unwrap();
        assert_eq!(row["operationCount"], 3);
        assert_eq!(row["failedCount"], 1);
        assert_eq!(row["unfinishedCount"], 0);
        assert_eq!(row["malformedLines"], 1);
        assert_eq!(row["formatVersion"], 2);
        assert!(row["bytes"].as_u64().unwrap() > 0);
    }

    #[test]
    fn the_summary_groups_by_operation_and_the_repeated_operations_by_parameters() {
        let reading = read_operations(&log_with_operations("summary")).unwrap();
        let rows = summary_rows(&reading, &Filter::default(), GroupBy::OperationName, false);
        assert_eq!(rows.len(), 2);
        let find_usage = rows.iter().find(|row| row["operationName"] == "find_usage").unwrap();
        assert_eq!(find_usage["count"], 2);
        assert_eq!(find_usage["workload"], "stored_data_query");
        assert_eq!(find_usage["repositories"], "heidrun-org/heidrun");
        let repeated_rows = summary_rows(&reading, &Filter::default(), GroupBy::Pattern, true);
        assert_eq!(repeated_rows.len(), 1);
        assert_eq!(repeated_rows[0]["pattern"], "grouping=hour");
    }

    #[test]
    fn the_list_gives_the_parameters_and_the_slowest_first_when_asked() {
        let reading = read_operations(&log_with_operations("list")).unwrap();
        let rows = list_rows(&reading, &Filter::default(), None, false);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0]["parameters"]["repository"], "heidrun-org/heidrun");
        assert_eq!(rows[2]["outcome"], "failure");
        assert_eq!(rows[2]["errorCategory"], "database_error");
        let filter = Filter { operation_name: Some("find_usage".to_string()), ..Filter::default() };
        assert_eq!(list_rows(&reading, &filter, Some(1), true).len(), 1);
    }

    #[test]
    fn the_overhead_rows_have_the_log_off_the_log_on_and_the_difference() {
        let rows = overhead_rows(200).unwrap();
        let logs: Vec<&str> = rows.iter().map(|row| row["log"].as_str().unwrap()).collect();
        assert_eq!(logs, ["off", "on", "added by the log"]);
        assert!(rows[2]["bytesPerOperation"].as_f64().unwrap() > 100.0);
    }
}
