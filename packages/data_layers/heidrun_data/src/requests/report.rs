//! The log of the requests of the data layer as rows: the file, the usage patterns, the list of the requests, and the cost
//! of the log. The records come from the package `request_log`, which every data layer package writes through.

use crate::output::QueryRow;
use request_log::{
    filter_requests, measure_overhead, repeated, summarize, workload_of, Filter, GroupBy, LogReading, PairedRequest, FORMAT_VERSION,
};
use serde_json::{json, Value};
use std::path::Path;

/// The most requests that the command `requests list` prints when the option `--limit` is not given.
pub const DEFAULT_LIST_LIMIT: usize = 100;

/// Reads the log file and its old file, and pairs the events. A log that does not exist is an empty log.
///
/// # Errors
/// An error when a file exists and cannot be read.
pub fn read_requests(log_file: &Path) -> Result<LogReading, String> {
    request_log::read_log(log_file, request_log::now_milliseconds())
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
    request_log::parse_utc_text(&full)
        .ok_or_else(|| format!("The time {text} is not a date YYYY-MM-DD or a time like 2026-10-17T12:30:00Z in UTC."))
}

/// What the log file is: where it is, how large, how many requests, and what is wrong with it.
///
/// # Errors
/// An error when a file exists and cannot be read.
pub fn info_row(log_file: &Path) -> Result<QueryRow, String> {
    let reading = read_requests(log_file)?;
    let size_of = |path: &Path| std::fs::metadata(path).map(|metadata| metadata.len()).unwrap_or(0);
    let old_file = request_log::rotated_file(log_file);
    let count = |is_counted: &dyn Fn(&PairedRequest) -> bool| reading.requests.iter().filter(|request| is_counted(request)).count();
    let settings = request_log::LogSettings::from_environment();
    let row = json!({
        "logFile": log_file.display().to_string(),
        "isLogOn": settings.file.is_some(),
        "formatVersion": FORMAT_VERSION,
        "bytes": size_of(log_file),
        "oldFileBytes": size_of(&old_file),
        "maximumBytes": settings.max_bytes,
        "requestCount": reading.requests.len(),
        "topLevelRequestCount": count(&|request| request.start.parent_request_id.is_none()),
        "nestedRequestCount": count(&|request| request.start.parent_request_id.is_some()),
        "replayCount": count(&|request| request.start.origin == request_log::ORIGIN_REPLAY),
        "unfinishedCount": count(&|request| request.state.is_unfinished()),
        "failedCount": count(&|request| request.state == request_log::RequestState::Failed),
        "orphanCompletions": reading.orphan_completions,
        "malformedLines": reading.malformed_lines,
        "unsupportedVersionLines": reading.unsupported_version_lines,
        "droppedEvents": reading.dropped_events,
        "firstStartedAt": reading.requests.first().map(|request| request.start.started_at.clone()),
        "lastStartedAt": reading.requests.last().map(|request| request.start.started_at.clone()),
    });
    match row {
        Value::Object(row) => Ok(row),
        _ => unreachable!("The row is an object"),
    }
}

/// The usage patterns: one row for each group of requests, with the largest total time first. `is_repeated_only` keeps the
/// groups of two requests or more.
pub fn summary_rows(reading: &LogReading, filter: &Filter, by: GroupBy, is_repeated_only: bool) -> Vec<QueryRow> {
    let requests = filter_requests(&reading.requests, filter);
    let groups = summarize(&requests, by);
    let groups = if is_repeated_only { repeated(groups) } else { groups };
    groups.iter().map(|group| group.to_row()).collect()
}

/// The requests that pass the filter, with their parameters and their durations, in the order of their start. With
/// `is_slowest_first`, the longest requests come first. A request that did not end comes last.
pub fn list_rows(reading: &LogReading, filter: &Filter, limit: Option<usize>, is_slowest_first: bool) -> Vec<QueryRow> {
    let mut requests = filter_requests(&reading.requests, filter);
    if is_slowest_first {
        requests.sort_by_key(|request| std::cmp::Reverse(request.duration_microseconds().unwrap_or(0)));
    }
    let requests: Vec<&PairedRequest> = match limit {
        Some(limit) => requests.into_iter().take(limit).collect(),
        None => requests,
    };
    requests.into_iter().map(request_row).collect()
}

/// One request as a row.
pub fn request_row(request: &PairedRequest) -> QueryRow {
    let start = &request.start;
    let complete = request.complete.as_ref();
    let row = json!({
        "requestId": start.request_id,
        "parentRequestId": start.parent_request_id,
        "caller": start.caller,
        "origin": start.origin,
        "replayOf": start.replay_of,
        "package": start.package,
        "operation": start.operation,
        "kind": start.kind.name(),
        "workload": workload_of(request),
        "state": request.state.name(),
        "startedAt": start.started_at,
        "durationMilliseconds": request.duration_milliseconds(),
        "outcome": complete.map(|complete| format!("{:?}", complete.outcome).to_lowercase()),
        "errorCategory": complete.and_then(|complete| complete.error_category.clone()),
        "resultCount": complete.and_then(|complete| complete.result_count),
        "pattern": start.pattern,
        "parameters": start.parameters,
        "concurrentRequests": start.concurrent_requests,
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

/// The cost of the log: the time that a request adds with the log on, and the bytes that it writes.
///
/// # Errors
/// An error when the temporary folder of the measure cannot be written.
pub fn overhead_rows(iterations: usize) -> Result<Vec<QueryRow>, String> {
    let report = measure_overhead(iterations)?;
    let row = |log: &str, statistics: &request_log::DurationStatistics| {
        json!({
            "log": log,
            "requestCount": statistics.count,
            "meanMicroseconds": (statistics.mean_microseconds * 10.0).round() / 10.0,
            "medianMicroseconds": statistics.median_microseconds,
            "p99Microseconds": statistics.p99_microseconds,
            "maximumMicroseconds": statistics.maximum_microseconds,
        })
    };
    let mut rows = vec![row("off", &report.off), row("on", &report.on)];
    rows.push(json!({
        "log": "added by the log",
        "requestCount": report.iterations,
        "meanMicroseconds": (report.added_mean_microseconds * 10.0).round() / 10.0,
        "bytesPerRequest": report.bytes_per_request.round(),
    }));
    Ok(rows.into_iter().filter_map(|row| if let Value::Object(row) = row { Some(row) } else { None }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use request_log::{record, RequestKind, RequestSpec, Summary};

    /// A log file with three requests: two queries and a failed one, written by the real recording code.
    fn log_with_requests(name: &str) -> std::path::PathBuf {
        let folder = request_log::testing::new_temporary_folder(name);
        let file = folder.join("data_layer_requests.jsonl");
        let logger = std::sync::Arc::new(request_log::Logger::new(request_log::LogSettings::for_file(&file)));
        request_log::with_logger(logger, || {
            for number in 0..2 {
                let spec = RequestSpec::new("coding_agents", "find_usage", RequestKind::Query)
                    .parameter("repository", "heidrun-org/heidrun")
                    .parameter("since", number)
                    .choice("grouping", "hour");
                let _ = record(spec, || Ok::<_, String>(vec![1, 2, 3]), |rows| Summary::count(rows.len()));
            }
            let spec = RequestSpec::new("source_control", "query", RequestKind::Query).sql("SELEC nothing");
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
    fn the_info_row_counts_the_requests_the_failures_and_the_damage_of_the_file() {
        let file = log_with_requests("info");
        std::fs::write(&file, std::fs::read_to_string(&file).unwrap() + "not json\n").unwrap();
        let row = info_row(&file).unwrap();
        assert_eq!(row["requestCount"], 3);
        assert_eq!(row["failedCount"], 1);
        assert_eq!(row["unfinishedCount"], 0);
        assert_eq!(row["malformedLines"], 1);
        assert_eq!(row["formatVersion"], 1);
        assert!(row["bytes"].as_u64().unwrap() > 0);
    }

    #[test]
    fn the_summary_groups_by_operation_and_the_repeated_requests_by_parameters() {
        let reading = read_requests(&log_with_requests("summary")).unwrap();
        let rows = summary_rows(&reading, &Filter::default(), GroupBy::Operation, false);
        assert_eq!(rows.len(), 2);
        let find_usage = rows.iter().find(|row| row["operation"] == "find_usage").unwrap();
        assert_eq!(find_usage["count"], 2);
        assert_eq!(find_usage["workload"], "stored_data_query");
        assert_eq!(find_usage["repositories"], "heidrun-org/heidrun");
        let repeated_rows = summary_rows(&reading, &Filter::default(), GroupBy::Pattern, true);
        assert_eq!(repeated_rows.len(), 1);
        assert_eq!(repeated_rows[0]["pattern"], "grouping=hour");
    }

    #[test]
    fn the_list_gives_the_parameters_and_the_slowest_first_when_asked() {
        let reading = read_requests(&log_with_requests("list")).unwrap();
        let rows = list_rows(&reading, &Filter::default(), None, false);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0]["parameters"]["repository"], "heidrun-org/heidrun");
        assert_eq!(rows[2]["outcome"], "failure");
        assert_eq!(rows[2]["errorCategory"], "database_error");
        let filter = Filter { operation: Some("find_usage".to_string()), ..Filter::default() };
        assert_eq!(list_rows(&reading, &filter, Some(1), true).len(), 1);
    }

    #[test]
    fn the_overhead_rows_have_the_log_off_the_log_on_and_the_difference() {
        let rows = overhead_rows(200).unwrap();
        let logs: Vec<&str> = rows.iter().map(|row| row["log"].as_str().unwrap()).collect();
        assert_eq!(logs, ["off", "on", "added by the log"]);
        assert!(rows[2]["bytesPerRequest"].as_f64().unwrap() > 100.0);
    }
}
