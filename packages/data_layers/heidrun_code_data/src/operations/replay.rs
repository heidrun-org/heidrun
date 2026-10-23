//! Runs a recorded operation again through the interfaces of the data layer packages, to compare its duration with the
//! duration that the log holds.
//!
//! The rules that keep a replay away from the real data:
//! - A query (the SQL statements of the five packages, `read_usage`, `find_usage`, and the `find_*` calls of the desktop
//!   application) opens the SQLite file read only, so a replay can never change it. The file should be a snapshot, which the
//!   command `operations snapshot` makes.
//! - A synchronization and a `refresh_*` call of the desktop application write, so they need `--isolated-database`: a file that does not exist yet, and that is not the default
//!   file of Heidrun Code. The folder of the file holds the lock of the replay, so the replay never waits for the desktop
//!   application. With `--start-from`, the isolated file starts as a copy of a snapshot, so a replay of the mode update
//!   measures an incremental synchronization.
//! - An operation that ran inside another operation is refused, and the operation that holds it is replayed instead.
//! - A synchronization uses the network only with `--allow-network`. Without the option, the source `code_hosting` is skipped
//!   and the price list is a file that does not exist, which gives a warning and no network access.
//! - Every operation of a replay carries the origin `replay` and the identifier of the original operation, so a summary of the real
//!   usage leaves it out.

use crate::database::HeidrunDatabase;
use crate::sources::Source;
use crate::synchronization::{synchronize, SynchronizationMode, SynchronizationOptions};
use crate::usage::{read_usage, UsageRequest};
use data_layer_operation_log::{replaying, PairedOperation, OperationKind, REDACTED};
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
    /// The folder that source control, code hosting, and coding agents read, when the original operation has no folder.
    pub folder: PathBuf,
    /// True to let a synchronization use the network.
    pub is_network_allowed: bool,
    /// True to let a synchronization read the folders of the original operation. False reads only the folder of the option
    /// `--folder` and the default folders of the coding agents.
    pub is_recorded_path_used: bool,
}

/// The result of one run of a replay.
#[derive(Debug, Clone, PartialEq)]
pub struct ReplayRun {
    /// The number of the run, from 1.
    pub run: usize,
    /// The time between the start and the end of the replayed operation, in microseconds, from the monotonic clock.
    pub microseconds: u64,
    /// The number of rows or items that the replay gave, when it counts them.
    pub result_count: Option<u64>,
    /// The error of the replay, or `None` when it succeeded.
    pub error: Option<String>,
}

/// The calls of the desktop application that read the SQLite file and give typed rows, with all their parameters in the log.
const FIND_OPERATIONS: [&str; 6] = [
    "find_commits",
    "find_user_activity_records",
    "find_issues_opened_between",
    "find_pull_requests_opened_between",
    "find_chat_list",
    "find_ai_cost",
];

/// The calls of the desktop application that copy one source into the SQLite file, with all their parameters in the log. The
/// calls `refresh_ai_cost`, `refresh_model_prices`, and `refresh_model_prices_when_due` are not here: they fetch a price list from
/// the network, and the check when due depends on the state of the process.
const REFRESH_OPERATIONS: [&str; 4] =
    ["refresh_source_control", "refresh_user_activity", "refresh_code_hosting", "refresh_chat_sessions"];

/// The reason why an operation cannot be replayed alone, or `None` when it can. The check reads the parameters only.
pub fn replay_refusal(operation: &PairedOperation) -> Option<String> {
    let start = &operation.start;
    if let Some(parent) = &start.parent_operation_id {
        return Some(format!(
            "The operation ran inside the operation {parent}, and has no parameters of its own to run alone. Replay the operation that holds it."
        ));
    }
    let kind = start.kind;
    let is_query_with_statement = start.operation_name == "query" && kind == OperationKind::Query;
    if is_query_with_statement {
        return statement_refusal(&start.parameters);
    }
    let is_usage = start.operation_name == "read_usage" || start.operation_name == "find_usage";
    let is_synchronization = start.operation_name == "synchronize" && kind == OperationKind::Synchronization;
    let is_find = kind == OperationKind::Query && FIND_OPERATIONS.contains(&start.operation_name.as_str());
    let is_refresh = kind == OperationKind::Synchronization && REFRESH_OPERATIONS.contains(&start.operation_name.as_str());
    if is_usage || is_synchronization || is_find || is_refresh {
        return None;
    }
    Some(format!(
        "The operation {}.{} cannot be replayed: only a query, a usage query, a find call, a refresh call of the sources, and a synchronization run again.",
        start.package, start.operation_name
    ))
}

/// Runs the operation again `repeat` times, and gives the time of each run.
///
/// # Errors
/// An error when the operation cannot be replayed, or when a rule of the isolation is broken. An error of the replayed
/// operation is not an error here: it is in the run.
pub fn replay_operation(operation: &PairedOperation, options: &ReplayOptions, repeat: usize) -> Result<Vec<ReplayRun>, String> {
    if let Some(refusal) = replay_refusal(operation) {
        return Err(refusal);
    }
    let is_synchronization = operation.start.kind == OperationKind::Synchronization;
    if is_synchronization && repeat > 1 {
        return Err("A synchronization runs once for each operation: a second run would find the data already written.".to_string());
    }
    let prepared = if REFRESH_OPERATIONS.contains(&operation.start.operation_name.as_str()) {
        Prepared::Refresh(prepare_refresh(operation, options)?)
    } else if is_synchronization {
        Prepared::Synchronization(prepare_synchronization(operation, options)?)
    } else {
        Prepared::Nothing
    };
    let mut runs = Vec::new();
    for run in 1..=repeat.max(1) {
        let started = Instant::now();
        let result = replaying(&operation.start.operation_id, || run_once(operation, options, &prepared));
        let microseconds = u64::try_from(started.elapsed().as_micros()).unwrap_or(u64::MAX);
        let (result_count, error) = match result {
            Ok(count) => (count, None),
            Err(message) => (None, Some(message)),
        };
        runs.push(ReplayRun { run, microseconds, result_count, error });
    }
    Ok(runs)
}

/// One replay run as a row, with the original operation next to it.
pub fn replay_row(original: &PairedOperation, run: &ReplayRun) -> crate::output::QueryRow {
    let original_milliseconds = original.duration_milliseconds();
    let replay_milliseconds = run.microseconds as f64 / 1000.0;
    let ratio = original_milliseconds.filter(|original| *original > 0.0).map(|original| replay_milliseconds / original);
    let row = json!({
        "originalOperationId": original.start.operation_id,
        "package": original.start.package,
        "operationName": original.start.operation_name,
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
    /// The mode of the original operation.
    mode: SynchronizationMode,
    /// What the sources read, and the isolated file they write.
    options: SynchronizationOptions,
}

/// What a replay of a synchronization or of a refresh call prepared before it runs.
enum Prepared {
    /// A query: nothing to prepare, because the file is open read only.
    Nothing,
    /// A synchronization of `heidrun_code_data` or of one package.
    Synchronization(PreparedSynchronization),
    /// A `refresh_*` call of the desktop application: the isolated file that it writes.
    Refresh(PathBuf),
}

/// Checks the rules of the isolation and makes the isolated file: it is not a file that a replay reads or the file of Heidrun Code,
/// it does not exist yet, and with `--start-from` it starts as a copy of a snapshot.
fn prepare_isolated_file(options: &ReplayOptions) -> Result<PathBuf, String> {
    let Some(isolated) = &options.isolated_database else {
        return Err("A synchronization writes, so its replay needs the option --isolated-database with a file that does not exist yet.".to_string());
    };
    let isolated = std::path::absolute(isolated).map_err(|error| format!("The path {} cannot be made absolute: {error}", isolated.display()))?;
    if isolated == options.default_database_path || isolated == options.database_path {
        return Err(format!("The isolated file {} is a file that a replay reads or the file of Heidrun Code. Give another path.", isolated.display()));
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
    Ok(isolated)
}

/// Checks the rules of the isolation, makes the isolated file, and builds the options of the synchronization.
fn prepare_synchronization(operation: &PairedOperation, options: &ReplayOptions) -> Result<PreparedSynchronization, String> {
    let isolated = prepare_isolated_file(options)?;
    let start = &operation.start;
    let parameters = &start.parameters;
    let text = |name: &str| parameters.get(name).and_then(Value::as_str).map(str::to_string);
    let mode = match text("mode").as_deref() {
        Some("initialize") => SynchronizationMode::Initialize,
        Some("update") => SynchronizationMode::Update,
        _ => return Err("The operation has no mode, so it cannot be replayed.".to_string()),
    };
    let recorded_or = |name: &str, default: PathBuf| match (options.is_recorded_path_used, text(name)) {
        (true, Some(recorded)) => PathBuf::from(recorded),
        _ => default,
    };
    let sources: Vec<Source> = match start.package.as_str() {
        "heidrun_code_data" => parameters
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
            if start.package == "heidrun_code_data" { "userActivityFile" } else { "file" },
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

/// A path parameter of the original operation, when `--use-recorded-paths` is on, else the default.
fn recorded_path(options: &ReplayOptions, parameters: &Value, name: &str, default: PathBuf) -> PathBuf {
    match (options.is_recorded_path_used, parameters.get(name).and_then(Value::as_str)) {
        (true, Some(recorded)) => PathBuf::from(recorded),
        _ => default,
    }
}

/// A text parameter of the original operation.
///
/// # Errors
/// An error when the parameter is missing or is not a text.
fn required_text(parameters: &Value, name: &str) -> Result<String, String> {
    parameters.get(name).and_then(Value::as_str).map(str::to_string).ok_or(format!("The parameter {name} is missing."))
}

/// Checks the rules of the isolation for a `refresh_*` call, and makes the isolated file. The source `code_hosting` needs the
/// option `--allow-network`.
fn prepare_refresh(operation: &PairedOperation, options: &ReplayOptions) -> Result<PathBuf, String> {
    if operation.start.operation_name == "refresh_code_hosting" && options.is_network_allowed == false {
        return Err("The source code_hosting needs the option --allow-network.".to_string());
    }
    prepare_isolated_file(options)
}

/// One run of the replayed operation, through the interface of the package that received the original operation. Gives the
/// number of rows or items, when the operation counts them.
fn run_once(operation: &PairedOperation, options: &ReplayOptions, prepared: &Prepared) -> Result<Option<u64>, String> {
    let start = &operation.start;
    let parameters = &start.parameters;
    match (start.package.as_str(), start.operation_name.as_str()) {
        (_, "query") => {
            let sql = parameters.get("sql").and_then(Value::as_str).ok_or("The operation has no statement.")?;
            let rows = query_rows(&start.package, sql, &options.database_path)?;
            Ok(Some(rows as u64))
        }
        ("heidrun_code_data", "read_usage") => {
            let text = |name: &str| parameters.get(name).and_then(Value::as_str).map(str::to_string);
            let usage_operation = UsageRequest {
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
            read_usage(&usage_operation).map(|answer| Some(answer.periods.len() as u64))
        }
        ("coding_agents", "find_usage") => {
            let query = data_layer_coding_agents::usage_query_from_parameters(parameters)?;
            let database = data_layer_coding_agents::TokenUsageDatabase::open_read_only(&options.database_path)?;
            database.find_usage(&query).map(|rows| Some(rows.len() as u64))
        }
        (_, operation_name) if FIND_OPERATIONS.contains(&operation_name) => run_find(operation_name, parameters, &options.database_path),
        (_, operation_name) if REFRESH_OPERATIONS.contains(&operation_name) => {
            let Prepared::Refresh(isolated) = prepared else {
                return Err("The refresh call was not prepared.".to_string());
            };
            run_refresh(operation_name, parameters, options, isolated)
        }
        (_, "synchronize") => {
            let Prepared::Synchronization(prepared) = prepared else {
                return Err("The synchronization was not prepared.".to_string());
            };
            let results = synchronize(prepared.mode, &prepared.sources, &prepared.options, &|_: &str| {});
            let first_error = results.iter().find_map(|(_, result)| result.as_ref().err().cloned());
            match first_error {
                Some(message) => Err(message),
                None => Ok(Some(results.len() as u64)),
            }
        }
        (package, operation_name) => Err(format!("The operation {package}.{operation_name} cannot be replayed.")),
    }
}

/// Runs a `find_*` call of the desktop application again on the SQLite file at `database_path`, and counts the rows. Every
/// `find_*` call opens the file read only.
fn run_find(operation_name: &str, parameters: &Value, database_path: &Path) -> Result<Option<u64>, String> {
    let text = |name: &str| required_text(parameters, name);
    let number = |name: &str| parameters.get(name).and_then(Value::as_i64).ok_or(format!("The parameter {name} is missing."));
    let count = match operation_name {
        "find_commits" => data_layer_source_control::find_commits(
            database_path,
            &text("repository")?,
            &text("since")?,
            &text("until")?,
            parameters.get("includeMerges").and_then(Value::as_bool).unwrap_or(false),
        )?
        .len(),
        "find_user_activity_records" => {
            data_layer_user_activity::find_user_activity_records(database_path, &text("since")?, &text("until")?)?.len()
        }
        "find_issues_opened_between" => {
            data_layer_code_hosting::find_issues_opened_between(database_path, &text("repository")?, &text("since")?, &text("until")?)?
                .len()
        }
        "find_pull_requests_opened_between" => data_layer_code_hosting::find_pull_requests_opened_between(
            database_path,
            &text("repository")?,
            &text("since")?,
            &text("until")?,
        )?
        .len(),
        "find_chat_list" => {
            let limit = usize::try_from(number("limit")?).map_err(|_| "The parameter limit is wrong.".to_string())?;
            let sorting = data_layer_coding_agents::sorting_from_parameters(parameters)?;
            let list = data_layer_coding_agents::find_chat_list(database_path, &text("root")?, limit, sorting)?;
            list.claude.chats.len() + list.codex.chats.len()
        }
        "find_ai_cost" => {
            let roots: Vec<String> = parameters
                .get("roots")
                .and_then(Value::as_array)
                .ok_or("The parameter roots is missing.")?
                .iter()
                .filter_map(|root| root.as_str().map(str::to_string))
                .collect();
            data_layer_coding_agents::find_ai_cost(database_path, &roots, number("since")?, number("until")?, &text("timeZone")?)?
                .hours
                .len()
        }
        other => return Err(format!("The operation {other} cannot be replayed.")),
    };
    Ok(Some(count as u64))
}

/// Runs a `refresh_*` call of the desktop application again, into the isolated file, and counts what it copied. The folders
/// of the original operation are read only with `--use-recorded-paths`.
fn run_refresh(operation_name: &str, parameters: &Value, options: &ReplayOptions, isolated: &Path) -> Result<Option<u64>, String> {
    let count = match operation_name {
        "refresh_source_control" => {
            let folder = recorded_path(options, parameters, "folder", options.folder.clone());
            data_layer_source_control::refresh_source_control(isolated, &folder, &required_text(parameters, "repository")?)?.commit_count
        }
        "refresh_user_activity" => {
            let file = recorded_path(options, parameters, "file", data_layer_user_activity::default_user_activity_file_path());
            data_layer_user_activity::refresh_user_activity(isolated, &file)?.record_count
        }
        "refresh_code_hosting" => {
            let report = data_layer_code_hosting::refresh_code_hosting(isolated, &required_text(parameters, "repository")?)?;
            report.issue_count + report.pull_request_count
        }
        "refresh_chat_sessions" => {
            let root = recorded_path(options, parameters, "root", options.folder.clone());
            data_layer_coding_agents::refresh_chat_sessions(isolated, &root.display().to_string())?.chat_session_count
        }
        other => return Err(format!("The operation {other} cannot be replayed.")),
    };
    Ok(Some(count as u64))
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
        None => Some("The operation has no statement, so it cannot be replayed.".to_string()),
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
    use data_layer_operation_log::{read_log, record, with_logger, LogSettings, Logger, OperationSpec, Summary};
    use std::sync::Arc;

    /// A folder with a SQLite file that the package `source_control` made, and the log file of the original operations.
    fn folder_with_database(name: &str) -> (PathBuf, PathBuf) {
        let folder = data_layer_operation_log::testing::new_temporary_folder(name);
        std::fs::create_dir_all(&folder).unwrap();
        let database_path = folder.join("data_layer.sqlite");
        let connection = rusqlite::Connection::open(&database_path).unwrap();
        connection
            .execute_batch("create table commits (hash text primary key, data text); insert into commits values ('a', '{}'), ('b', '{}');")
            .unwrap();
        (folder, database_path)
    }

    /// Records one operation of the package `source_control` in a log, and reads it back as a paired operation.
    fn recorded_query(folder: &Path, sql: &str) -> PairedOperation {
        let log_file = folder.join("data_layer_operations.jsonl");
        let logger = Arc::new(Logger::new(LogSettings::for_file(&log_file)));
        with_logger(logger, || {
            let spec = OperationSpec::new("source_control", "query", OperationKind::Query).sql(sql);
            let _ = record(spec, || Ok::<_, String>(vec![1, 2]), |rows| Summary::count(rows.len()));
        });
        read_log(&log_file, data_layer_operation_log::now_milliseconds()).unwrap().operations.remove(0)
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
    fn a_replayed_query_runs_the_statement_and_marks_its_operations_as_a_replay() {
        let (folder, database_path) = folder_with_database("replay-query");
        let original = recorded_query(&folder, "select count(*) as n from commits");
        let (runs, events) =
            data_layer_operation_log::testing::capture(|| replay_operation(&original, &options(&database_path), 3).unwrap());
        assert_eq!(runs.len(), 3);
        assert_eq!(runs[0].result_count, Some(1));
        assert!(runs.iter().all(|run| run.error.is_none()));
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts.len(), 3);
        assert!(starts.iter().all(|start| start.origin == data_layer_operation_log::ORIGIN_REPLAY));
        assert!(starts.iter().all(|start| start.replay_of.as_deref() == Some(original.start.operation_id.as_str())));
        assert_eq!(starts[0].package, "source_control");
    }

    #[test]
    fn a_replayed_query_is_read_only_so_a_statement_that_writes_fails_and_changes_nothing() {
        let (folder, database_path) = folder_with_database("replay-write");
        let original = recorded_query(&folder, "delete from commits");
        let runs = replay_operation(&original, &options(&database_path), 1).unwrap();
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
    fn a_nested_operation_and_an_operation_that_only_runs_inside_a_query_or_a_synchronization_are_refused() {
        let (folder, _) = folder_with_database("replay-nested");
        let mut original = recorded_query(&folder, "select 1");
        assert_eq!(replay_refusal(&original), None);
        original.start.parent_operation_id = Some("r-1".to_string());
        assert!(replay_refusal(&original).unwrap().contains("Replay the operation that holds it"));
        original.start.parent_operation_id = None;
        original.start.operation_name = "upsert_commits".to_string();
        original.start.kind = OperationKind::Write;
        assert!(replay_refusal(&original).unwrap().contains("only a query"));
    }

    #[test]
    fn a_synchronization_needs_a_new_isolated_file_that_is_not_a_file_of_heidrun() {
        let (folder, database_path) = folder_with_database("replay-isolation");
        let mut original = recorded_query(&folder, "select 1");
        original.start.operation_name = "synchronize".to_string();
        original.start.kind = OperationKind::Synchronization;
        original.start.parameters = json!({ "mode": "update", "repository": "a/b" });
        let without_file = replay_operation(&original, &options(&database_path), 1).unwrap_err();
        assert!(without_file.contains("--isolated-database"));
        let mut same_file = options(&database_path);
        same_file.isolated_database = Some(database_path.clone());
        assert!(replay_operation(&original, &same_file, 1).unwrap_err().contains("Give another path"));
        let mut default_file = options(&database_path);
        default_file.isolated_database = Some(default_file.default_database_path.clone());
        assert!(replay_operation(&original, &default_file, 1).unwrap_err().contains("Give another path"));
        let mut existing_file = options(&database_path);
        let existing = folder.join("existing.sqlite");
        std::fs::write(&existing, "x").unwrap();
        existing_file.isolated_database = Some(existing);
        assert!(replay_operation(&original, &existing_file, 1).unwrap_err().contains("exists already"));
        let mut twice = options(&database_path);
        twice.isolated_database = Some(folder.join("new.sqlite"));
        assert!(replay_operation(&original, &twice, 2).unwrap_err().contains("runs once"));
    }

    #[test]
    fn the_source_code_hosting_needs_the_network_option() {
        let (folder, database_path) = folder_with_database("replay-network");
        let mut original = recorded_query(&folder, "select 1");
        original.start.package = "code_hosting".to_string();
        original.start.operation_name = "synchronize".to_string();
        original.start.kind = OperationKind::Synchronization;
        original.start.parameters = json!({ "mode": "update", "repository": "a/b" });
        let mut replay_options = options(&database_path);
        replay_options.isolated_database = Some(folder.join("isolated.sqlite"));
        let error = replay_operation(&original, &replay_options, 1).unwrap_err();
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
        let runs = replay_operation(&original, &options(&database_path), 1).unwrap();
        let row = replay_row(&original, &runs[0]);
        assert_eq!(row["originalOperationId"], original.start.operation_id.as_str());
        assert_eq!(row["originalResultCount"], 2);
        assert_eq!(row["replayResultCount"], 1);
        assert_eq!(row["outcome"], "success");
        assert!(row["replayMilliseconds"].as_f64().unwrap() >= 0.0);
    }

    /// Runs `call` with a log in `folder`, and reads back the first operation that it wrote.
    fn recorded_call(folder: &Path, call: impl FnOnce()) -> PairedOperation {
        let log_file = folder.join("data_layer_operations_call.jsonl");
        let logger = Arc::new(Logger::new(LogSettings::for_file(&log_file)));
        with_logger(logger, call);
        read_log(&log_file, data_layer_operation_log::now_milliseconds()).unwrap().operations.remove(0)
    }

    /// A SQLite file that exists and holds no table of any package, so every `find_*` call gives an empty answer.
    fn empty_database(folder: &Path) -> PathBuf {
        let database_path = folder.join("empty.sqlite");
        rusqlite::Connection::open(&database_path).unwrap().execute_batch("CREATE TABLE other (data TEXT)").unwrap();
        database_path
    }

    #[test]
    fn a_find_call_of_the_desktop_application_runs_again_on_the_snapshot_and_is_marked_as_a_replay() {
        let (folder, _) = folder_with_database("replay-find");
        let database_path = empty_database(&folder);
        let (since, until) = ("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");
        let roots = vec!["/work/app".to_string()];
        let originals = vec![
            recorded_call(&folder, || {
                data_layer_source_control::find_commits(&database_path, "a/b", since, until, true).unwrap();
            }),
            recorded_call(&folder, || {
                data_layer_user_activity::find_user_activity_records(&database_path, since, until).unwrap();
            }),
            recorded_call(&folder, || {
                data_layer_code_hosting::find_issues_opened_between(&database_path, "a/b", since, until).unwrap();
            }),
            recorded_call(&folder, || {
                data_layer_code_hosting::find_pull_requests_opened_between(&database_path, "a/b", since, until).unwrap();
            }),
            recorded_call(&folder, || {
                let sorting = data_layer_coding_agents::Sorting::default();
                data_layer_coding_agents::find_chat_list(&database_path, "/work/app", 20, sorting).unwrap();
            }),
            recorded_call(&folder, || {
                data_layer_coding_agents::find_ai_cost(&database_path, &roots, 0, 1000, "UTC").unwrap();
            }),
        ];
        for original in &originals {
            assert_eq!(replay_refusal(original), None, "{}", original.start.operation_name);
            let (runs, events) =
                data_layer_operation_log::testing::capture(|| replay_operation(original, &options(&database_path), 2).unwrap());
            assert!(runs.iter().all(|run| run.error.is_none() && run.result_count == Some(0)), "{} {runs:?}", original.start.operation_name);
            let starts = data_layer_operation_log::testing::starts(&events);
            let top: Vec<_> = starts.iter().filter(|start| start.parent_operation_id.is_none()).collect();
            assert_eq!(top.len(), 2, "{}", original.start.operation_name);
            assert!(top.iter().all(|start| start.operation_name == original.start.operation_name));
            assert!(starts.iter().all(|start| start.origin == data_layer_operation_log::ORIGIN_REPLAY));
        }
    }

    #[test]
    fn a_refresh_call_of_the_desktop_application_runs_again_only_in_a_new_isolated_file() {
        let (folder, database_path) = folder_with_database("replay-refresh");
        let records_file = folder.join("user_activity.jsonl");
        let original = recorded_call(&folder, || {
            data_layer_user_activity::refresh_user_activity(&folder.join("original.sqlite"), &records_file).unwrap();
        });
        assert_eq!(original.start.operation_name, "refresh_user_activity");
        assert_eq!(replay_refusal(&original), None);
        let without_file = replay_operation(&original, &options(&database_path), 1).unwrap_err();
        assert!(without_file.contains("--isolated-database"));
        let mut replay_options = options(&database_path);
        replay_options.isolated_database = Some(folder.join("isolated.sqlite"));
        replay_options.is_recorded_path_used = true;
        assert!(replay_operation(&original, &replay_options, 2).unwrap_err().contains("runs once"));
        let (runs, events) = data_layer_operation_log::testing::capture(|| replay_operation(&original, &replay_options, 1).unwrap());
        assert!(runs[0].error.is_none(), "{runs:?}");
        assert!(folder.join("isolated.sqlite").exists());
        assert!(data_layer_operation_log::testing::starts(&events).iter().all(|start| start.origin == data_layer_operation_log::ORIGIN_REPLAY));
        assert!(replay_operation(&original, &replay_options, 1).unwrap_err().contains("exists already"));
        let mut code_hosting = original.clone();
        code_hosting.start.operation_name = "refresh_code_hosting".to_string();
        code_hosting.start.package = "code_hosting".to_string();
        let mut other_file = options(&database_path);
        other_file.isolated_database = Some(folder.join("other.sqlite"));
        assert!(replay_operation(&code_hosting, &other_file, 1).unwrap_err().contains("--allow-network"));
        assert!(!folder.join("other.sqlite").exists());
    }

    #[test]
    fn the_calls_that_use_the_network_for_prices_or_depend_on_the_state_of_the_process_are_refused() {
        let (folder, _) = folder_with_database("replay-refused-refresh");
        let mut original = recorded_query(&folder, "select 1");
        original.start.kind = OperationKind::Synchronization;
        for operation_name in ["refresh_ai_cost", "refresh_model_prices", "refresh_model_prices_when_due"] {
            original.start.operation_name = operation_name.to_string();
            assert!(replay_refusal(&original).unwrap().contains("cannot be replayed"), "{operation_name}");
        }
    }
}
