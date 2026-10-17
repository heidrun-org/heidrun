//! Runs a recorded request again through the interfaces of the data layer packages, to compare its duration with the
//! duration that the log holds.
//!
//! The rules that keep a replay away from the real data:
//! - A query (the SQL statements of the five packages, `read_usage`, and `find_usage`) opens the SQLite file read only, so a
//!   replay can never change it. The file should be a snapshot, which the command `requests snapshot` makes.
//! - A synchronization writes, so it needs `--isolated-database`: a file that does not exist yet, and that is not the default
//!   file of Heidrun. The folder of the file holds the lock of the replay, so the replay never waits for the desktop
//!   application. With `--start-from`, the isolated file starts as a copy of a snapshot, so a replay of the mode update
//!   measures an incremental synchronization.
//! - A request that ran inside another request is refused, and the request that holds it is replayed instead.
//! - A synchronization uses the network only with `--allow-network`. Without the option, the source `code_hosting` is skipped
//!   and the price list is a file that does not exist, which gives a warning and no network access.
//! - Every request of a replay carries the origin `replay` and the identifier of the original request, so a summary of the real
//!   usage leaves it out.

use crate::database::HeidrunDatabase;
use crate::sources::Source;
use crate::synchronization::{synchronize, SynchronizationMode, SynchronizationOptions};
use crate::usage::{read_usage, UsageRequest};
use request_log::{replaying, PairedRequest, RequestKind, REDACTED};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Instant;

/// What a replay may touch.
#[derive(Debug, Clone)]
pub struct ReplayOptions {
    /// The SQLite file that the queries read, open read only. It should be a snapshot.
    pub database_path: PathBuf,
    /// The SQLite file that a synchronization writes, or `None` when no synchronization may run.
    pub isolated_database: Option<PathBuf>,
    /// A SQLite file that is copied to the isolated file before the synchronization, or `None` for an empty file.
    pub start_from: Option<PathBuf>,
    /// The SQLite file that the desktop application writes. A synchronization never writes it.
    pub default_database_path: PathBuf,
    /// The folder that source control, code hosting, and coding agents read, when the original request has no folder.
    pub folder: PathBuf,
    /// True to let a synchronization use the network.
    pub is_network_allowed: bool,
    /// True to let a synchronization read the folders of the original request. False reads only the folder of the option
    /// `--folder` and the default folders of the coding agents.
    pub is_recorded_path_used: bool,
}

/// The result of one run of a replay.
#[derive(Debug, Clone, PartialEq)]
pub struct ReplayRun {
    /// The number of the run, from 1.
    pub run: usize,
    /// The time between the start and the end of the replayed request, in microseconds, from the monotonic clock.
    pub microseconds: u64,
    /// The number of rows or items that the replay gave, when it counts them.
    pub result_count: Option<u64>,
    /// The error of the replay, or `None` when it succeeded.
    pub error: Option<String>,
}

/// The reason why a request cannot be replayed alone, or `None` when it can. The check reads the parameters only.
pub fn replay_refusal(request: &PairedRequest) -> Option<String> {
    let start = &request.start;
    if let Some(parent) = &start.parent_request_id {
        return Some(format!(
            "The request ran inside the request {parent}, and has no parameters of its own to run alone. Replay the request that holds it."
        ));
    }
    let kind = start.kind;
    let is_query_with_statement = start.operation == "query" && kind == RequestKind::Query;
    if is_query_with_statement {
        return statement_refusal(&start.parameters);
    }
    let is_usage = start.operation == "read_usage" || start.operation == "find_usage";
    let is_synchronization = start.operation == "synchronize" && kind == RequestKind::Synchronization;
    if is_usage || is_synchronization {
        return None;
    }
    Some(format!(
        "The operation {}.{} cannot be replayed: only a query, a usage query, and a synchronization run again.",
        start.package, start.operation
    ))
}

/// Runs the request again `repeat` times, and gives the time of each run.
///
/// # Errors
/// An error when the request cannot be replayed, or when a rule of the isolation is broken. An error of the replayed
/// operation is not an error here: it is in the run.
pub fn replay_request(request: &PairedRequest, options: &ReplayOptions, repeat: usize) -> Result<Vec<ReplayRun>, String> {
    if let Some(refusal) = replay_refusal(request) {
        return Err(refusal);
    }
    let is_synchronization = request.start.kind == RequestKind::Synchronization;
    if is_synchronization && repeat > 1 {
        return Err("A synchronization runs once for each request: a second run would find the data already written.".to_string());
    }
    let prepared = if is_synchronization { Some(prepare_synchronization(request, options)?) } else { None };
    let mut runs = Vec::new();
    for run in 1..=repeat.max(1) {
        let started = Instant::now();
        let result = replaying(&request.start.request_id, || run_once(request, options, prepared.as_ref()));
        let microseconds = u64::try_from(started.elapsed().as_micros()).unwrap_or(u64::MAX);
        let (result_count, error) = match result {
            Ok(count) => (count, None),
            Err(message) => (None, Some(message)),
        };
        runs.push(ReplayRun { run, microseconds, result_count, error });
    }
    Ok(runs)
}

/// One replay run as a row, with the original request next to it.
pub fn replay_row(original: &PairedRequest, run: &ReplayRun) -> crate::output::QueryRow {
    let original_milliseconds = original.duration_milliseconds();
    let replay_milliseconds = run.microseconds as f64 / 1000.0;
    let ratio = original_milliseconds.filter(|original| *original > 0.0).map(|original| replay_milliseconds / original);
    let row = json!({
        "originalRequestId": original.start.request_id,
        "package": original.start.package,
        "operation": original.start.operation,
        "pattern": original.start.pattern,
        "run": run.run,
        "originalStartedAt": original.start.started_at,
        "originalMilliseconds": original_milliseconds,
        "originalResultCount": original.complete.as_ref().and_then(|complete| complete.result_count),
        "replayMilliseconds": replay_milliseconds,
        "replayResultCount": run.result_count,
        "replayToOriginalRatio": ratio.map(|ratio| (ratio * 100.0).round() / 100.0),
        "outcome": if run.error.is_some() { "failure" } else { "success" },
        "error": run.error,
    });
    match row {
        Value::Object(row) => row,
        _ => unreachable!("The row is an object"),
    }
}

/// The isolated file and the options of a synchronization, checked.
struct PreparedSynchronization {
    /// The sources to read, in the fixed order.
    sources: Vec<Source>,
    /// The mode of the original request.
    mode: SynchronizationMode,
    /// What the sources read, and the isolated file they write.
    options: SynchronizationOptions,
}

/// Checks the rules of the isolation, makes the isolated file, and builds the options of the synchronization.
fn prepare_synchronization(request: &PairedRequest, options: &ReplayOptions) -> Result<PreparedSynchronization, String> {
    let Some(isolated) = &options.isolated_database else {
        return Err("A synchronization writes, so its replay needs the option --isolated-database with a file that does not exist yet.".to_string());
    };
    let isolated = std::path::absolute(isolated).map_err(|error| format!("The path {} cannot be made absolute: {error}", isolated.display()))?;
    if isolated == options.default_database_path || isolated == options.database_path {
        return Err(format!("The isolated file {} is a file that a replay reads or the file of Heidrun. Give another path.", isolated.display()));
    }
    if isolated.exists() {
        return Err(format!("The isolated file {} exists already. A replay never writes a file that exists: remove it or give another path.", isolated.display()));
    }
    if let Some(folder) = isolated.parent() {
        std::fs::create_dir_all(folder).map_err(|error| format!("The folder {} cannot be made: {error}", folder.display()))?;
    }
    if let Some(snapshot) = &options.start_from {
        std::fs::copy(snapshot, &isolated)
            .map_err(|error| format!("The snapshot {} cannot be copied to {}: {error}", snapshot.display(), isolated.display()))?;
    }
    let start = &request.start;
    let parameters = &start.parameters;
    let text = |name: &str| parameters.get(name).and_then(Value::as_str).map(str::to_string);
    let mode = match text("mode").as_deref() {
        Some("initialize") => SynchronizationMode::Initialize,
        Some("update") => SynchronizationMode::Update,
        _ => return Err("The request has no mode, so it cannot be replayed.".to_string()),
    };
    let recorded_or = |name: &str, default: PathBuf| match (options.is_recorded_path_used, text(name)) {
        (true, Some(recorded)) => PathBuf::from(recorded),
        _ => default,
    };
    let sources: Vec<Source> = match start.package.as_str() {
        "heidrun_data" => parameters
            .get("sources")
            .and_then(Value::as_array)
            .map(|names| names.iter().filter_map(|name| name.as_str().and_then(Source::from_name)).collect())
            .unwrap_or_default(),
        other => Source::from_name(other).into_iter().collect(),
    };
    let sources: Vec<Source> = if options.is_network_allowed {
        sources
    } else {
        sources.into_iter().filter(|source| *source != Source::CodeHosting).collect()
    };
    if sources.is_empty() {
        return Err("No source is left to read: the source code_hosting needs the option --allow-network.".to_string());
    }
    let no_price_list = isolated.with_extension("no_price_list.json").display().to_string();
    let claude_dir = match text("claudeProjects") {
        Some(projects) if options.is_recorded_path_used => {
            Path::new(&projects).parent().map(PathBuf::from).unwrap_or_else(data_layer_coding_agents::claude_dir)
        }
        _ => recorded_or("claudeDir", data_layer_coding_agents::claude_dir()),
    };
    let synchronization_options = SynchronizationOptions {
        database_path: isolated,
        folder: recorded_or("folder", options.folder.clone()),
        repository: text("repository"),
        user_activity_file: recorded_or(
            if start.package == "heidrun_data" { "userActivityFile" } else { "file" },
            data_layer_user_activity::default_user_activity_file_path(),
        ),
        claude_dir,
        codex_home: recorded_or("codexHome", data_layer_coding_agents::codex_home()),
        agents_home: recorded_or("agentsHome", data_layer_coding_agents::agents_home()),
        price_list: if options.is_network_allowed { text("priceList") } else { Some(no_price_list) },
        is_price_refresh_forced: false,
    };
    Ok(PreparedSynchronization { sources, mode, options: synchronization_options })
}

/// One run of the replayed operation, through the interface of the package that received the original request. Gives the
/// number of rows or items, when the operation counts them.
fn run_once(request: &PairedRequest, options: &ReplayOptions, prepared: Option<&PreparedSynchronization>) -> Result<Option<u64>, String> {
    let start = &request.start;
    let parameters = &start.parameters;
    match (start.package.as_str(), start.operation.as_str()) {
        (_, "query") => {
            let sql = parameters.get("sql").and_then(Value::as_str).ok_or("The request has no statement.")?;
            let rows = query_rows(&start.package, sql, &options.database_path)?;
            Ok(Some(rows as u64))
        }
        ("heidrun_data", "read_usage") => {
            let text = |name: &str| parameters.get(name).and_then(Value::as_str).map(str::to_string);
            let usage_request = UsageRequest {
                database_path: options.database_path.clone(),
                repository: text("repository").ok_or("The parameter repository is missing.")?,
                folder: text("folder").ok_or("The parameter folder is missing.")?,
                since: text("since"),
                until: text("until"),
                grouping: text("grouping").ok_or("The parameter grouping is missing.")?,
                time_zone: text("timeZone"),
                is_by_chat: parameters.get("isByChat").and_then(Value::as_bool).unwrap_or(false),
                now: parameters.get("now").and_then(Value::as_i64).ok_or("The parameter now is missing.")?,
            };
            read_usage(&usage_request).map(|answer| Some(answer.periods.len() as u64))
        }
        ("coding_agents", "find_usage") => {
            let query = data_layer_coding_agents::usage_query_from_parameters(parameters)?;
            let database = data_layer_coding_agents::TokenUsageDatabase::open_read_only(&options.database_path)?;
            database.find_usage(&query).map(|rows| Some(rows.len() as u64))
        }
        (_, "synchronize") => {
            let prepared = prepared.ok_or("The synchronization was not prepared.")?;
            let results = synchronize(prepared.mode, &prepared.sources, &prepared.options, &|_: &str| {});
            let first_error = results.iter().find_map(|(_, result)| result.as_ref().err().cloned());
            match first_error {
                Some(message) => Err(message),
                None => Ok(Some(results.len() as u64)),
            }
        }
        (package, operation) => Err(format!("The operation {package}.{operation} cannot be replayed.")),
    }
}

/// Runs a statement through the read only interface of the package that received it, and counts the rows.
fn query_rows(package: &str, sql: &str, database_path: &Path) -> Result<usize, String> {
    match package {
        "source_control" => data_layer_source_control::SourceControlDatabase::open_read_only(database_path)?.query(sql).map(|rows| rows.len()),
        "code_hosting" => data_layer_code_hosting::CodeHostingDatabase::open_read_only(database_path)?.query(sql).map(|rows| rows.len()),
        "coding_agents" => data_layer_coding_agents::ChatSessionsDatabase::open_read_only(database_path)?.query(sql).map(|rows| rows.len()),
        "user_activity" => data_layer_user_activity::UserActivityDatabase::open_read_only(database_path)?.query(sql).map(|rows| rows.len()),
        _ => HeidrunDatabase::open_read_only(database_path)?.query(sql).map(|rows| rows.len()),
    }
}

/// The reason why a recorded statement cannot run again: it was cut, or a secret was removed from it.
fn statement_refusal(parameters: &Value) -> Option<String> {
    let sql = parameters.get("sql").and_then(Value::as_str);
    match sql {
        None => Some("The request has no statement, so it cannot be replayed.".to_string()),
        Some(_) if parameters.get("sqlTruncated").and_then(Value::as_bool) == Some(true) => {
            Some("The log holds only the start of the statement, so it cannot run again.".to_string())
        }
        Some(sql) if sql.contains(REDACTED) => {
            Some("The log removed a secret from the statement, so it cannot run again.".to_string())
        }
        Some(_) => None,
    }
}

/// Makes a snapshot of the SQLite file: a copy that is consistent, even while another program writes the file.
///
/// # Errors
/// An error when the file does not exist, when the snapshot exists already, or when SQLite cannot write the snapshot.
pub fn make_snapshot(database_path: &Path, snapshot_path: &Path) -> Result<u64, String> {
    if database_path.exists() == false {
        return Err(format!("The database file does not exist: {}.", database_path.display()));
    }
    if snapshot_path.exists() {
        return Err(format!("The snapshot {} exists already. Give another path.", snapshot_path.display()));
    }
    let connection = rusqlite::Connection::open_with_flags(database_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("The database file {} cannot be opened: {error}", database_path.display()))?;
    connection
        .execute("VACUUM INTO ?1", [snapshot_path.display().to_string()])
        .map_err(|error| format!("The snapshot {} cannot be written: {error}", snapshot_path.display()))?;
    std::fs::metadata(snapshot_path).map(|metadata| metadata.len()).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use request_log::{read_log, record, with_logger, LogSettings, Logger, RequestSpec, Summary};
    use std::sync::Arc;

    /// A folder with a SQLite file that the package `source_control` made, and the log file of the original requests.
    fn folder_with_database(name: &str) -> (PathBuf, PathBuf) {
        let folder = request_log::testing::new_temporary_folder(name);
        std::fs::create_dir_all(&folder).unwrap();
        let database_path = folder.join("data_layer.sqlite");
        let connection = rusqlite::Connection::open(&database_path).unwrap();
        connection
            .execute_batch("create table commits (hash text primary key, data text); insert into commits values ('a', '{}'), ('b', '{}');")
            .unwrap();
        (folder, database_path)
    }

    /// Records one request of the package `source_control` in a log, and reads it back as a paired request.
    fn recorded_query(folder: &Path, sql: &str) -> PairedRequest {
        let log_file = folder.join("data_layer_requests.jsonl");
        let logger = Arc::new(Logger::new(LogSettings::for_file(&log_file)));
        with_logger(logger, || {
            let spec = RequestSpec::new("source_control", "query", RequestKind::Query).sql(sql);
            let _ = record(spec, || Ok::<_, String>(vec![1, 2]), |rows| Summary::count(rows.len()));
        });
        read_log(&log_file, request_log::now_milliseconds()).unwrap().requests.remove(0)
    }

    fn options(database_path: &Path) -> ReplayOptions {
        ReplayOptions {
            database_path: database_path.to_path_buf(),
            isolated_database: None,
            start_from: None,
            default_database_path: PathBuf::from("/nowhere/data_layer.sqlite"),
            folder: PathBuf::from("."),
            is_network_allowed: false,
            is_recorded_path_used: false,
        }
    }

    #[test]
    fn a_replayed_query_runs_the_statement_and_marks_its_requests_as_a_replay() {
        let (folder, database_path) = folder_with_database("replay-query");
        let original = recorded_query(&folder, "select count(*) as n from commits");
        let (runs, events) =
            request_log::testing::capture(|| replay_request(&original, &options(&database_path), 3).unwrap());
        assert_eq!(runs.len(), 3);
        assert_eq!(runs[0].result_count, Some(1));
        assert!(runs.iter().all(|run| run.error.is_none()));
        let starts = request_log::testing::starts(&events);
        assert_eq!(starts.len(), 3);
        assert!(starts.iter().all(|start| start.origin == request_log::ORIGIN_REPLAY));
        assert!(starts.iter().all(|start| start.replay_of.as_deref() == Some(original.start.request_id.as_str())));
        assert_eq!(starts[0].package, "source_control");
    }

    #[test]
    fn a_replayed_query_is_read_only_so_a_statement_that_writes_fails_and_changes_nothing() {
        let (folder, database_path) = folder_with_database("replay-write");
        let original = recorded_query(&folder, "delete from commits");
        let runs = replay_request(&original, &options(&database_path), 1).unwrap();
        assert!(runs[0].error.is_some());
        let connection = rusqlite::Connection::open(&database_path).unwrap();
        let count: i64 = connection.query_row("select count(*) from commits", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn a_statement_that_was_cut_or_redacted_is_refused() {
        let (folder, _) = folder_with_database("replay-refused");
        let cut = recorded_query(&folder, &format!("select '{}'", "x".repeat(5000)));
        assert!(replay_refusal(&cut).unwrap().contains("only the start"));
        let secret = recorded_query(&folder, "select 1 where token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'");
        assert!(replay_refusal(&secret).is_some());
    }

    #[test]
    fn a_nested_request_and_an_operation_that_only_runs_inside_a_query_or_a_synchronization_are_refused() {
        let (folder, _) = folder_with_database("replay-nested");
        let mut original = recorded_query(&folder, "select 1");
        assert_eq!(replay_refusal(&original), None);
        original.start.parent_request_id = Some("r-1".to_string());
        assert!(replay_refusal(&original).unwrap().contains("Replay the request that holds it"));
        original.start.parent_request_id = None;
        original.start.operation = "upsert_commits".to_string();
        original.start.kind = RequestKind::Write;
        assert!(replay_refusal(&original).unwrap().contains("only a query"));
    }

    #[test]
    fn a_synchronization_needs_a_new_isolated_file_that_is_not_a_file_of_heidrun() {
        let (folder, database_path) = folder_with_database("replay-isolation");
        let mut original = recorded_query(&folder, "select 1");
        original.start.operation = "synchronize".to_string();
        original.start.kind = RequestKind::Synchronization;
        original.start.parameters = json!({ "mode": "update", "repository": "a/b" });
        let without_file = replay_request(&original, &options(&database_path), 1).unwrap_err();
        assert!(without_file.contains("--isolated-database"));
        let mut same_file = options(&database_path);
        same_file.isolated_database = Some(database_path.clone());
        assert!(replay_request(&original, &same_file, 1).unwrap_err().contains("Give another path"));
        let mut default_file = options(&database_path);
        default_file.isolated_database = Some(default_file.default_database_path.clone());
        assert!(replay_request(&original, &default_file, 1).unwrap_err().contains("Give another path"));
        let mut existing_file = options(&database_path);
        let existing = folder.join("existing.sqlite");
        std::fs::write(&existing, "x").unwrap();
        existing_file.isolated_database = Some(existing);
        assert!(replay_request(&original, &existing_file, 1).unwrap_err().contains("exists already"));
        let mut twice = options(&database_path);
        twice.isolated_database = Some(folder.join("new.sqlite"));
        assert!(replay_request(&original, &twice, 2).unwrap_err().contains("runs once"));
    }

    #[test]
    fn the_source_code_hosting_needs_the_network_option() {
        let (folder, database_path) = folder_with_database("replay-network");
        let mut original = recorded_query(&folder, "select 1");
        original.start.package = "code_hosting".to_string();
        original.start.operation = "synchronize".to_string();
        original.start.kind = RequestKind::Synchronization;
        original.start.parameters = json!({ "mode": "update", "repository": "a/b" });
        let mut replay_options = options(&database_path);
        replay_options.isolated_database = Some(folder.join("isolated.sqlite"));
        let error = replay_request(&original, &replay_options, 1).unwrap_err();
        assert!(error.contains("--allow-network"));
        assert_eq!(replay_options.isolated_database.as_ref().unwrap().exists(), false);
    }

    #[test]
    fn a_snapshot_is_a_consistent_copy_that_is_never_written_over() {
        let (folder, database_path) = folder_with_database("replay-snapshot");
        let snapshot = folder.join("snapshot.sqlite");
        assert!(make_snapshot(&database_path, &snapshot).unwrap() > 0);
        let connection = rusqlite::Connection::open(&snapshot).unwrap();
        let count: i64 = connection.query_row("select count(*) from commits", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 2);
        assert!(make_snapshot(&database_path, &snapshot).unwrap_err().contains("exists already"));
        assert!(make_snapshot(&folder.join("missing.sqlite"), &folder.join("other.sqlite")).is_err());
    }

    #[test]
    fn a_row_has_the_original_and_the_replay_side_by_side() {
        let (folder, database_path) = folder_with_database("replay-row");
        let original = recorded_query(&folder, "select count(*) as n from commits");
        let runs = replay_request(&original, &options(&database_path), 1).unwrap();
        let row = replay_row(&original, &runs[0]);
        assert_eq!(row["originalRequestId"], original.start.request_id.as_str());
        assert_eq!(row["originalResultCount"], 2);
        assert_eq!(row["replayResultCount"], 1);
        assert_eq!(row["outcome"], "success");
        assert!(row["replayMilliseconds"].as_f64().unwrap() >= 0.0);
    }
}
