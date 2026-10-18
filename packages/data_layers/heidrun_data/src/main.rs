//! The command line `heidrun_data`: the commands sources, update, initialize, schema, query, usage, read, and operations.

mod command_line;
mod operations_command_line;

use command_line::{
    find_format, parse, CommonOptions, Parsed, QueryRequest, ReadKind, ReadRequest, SchemaRequest, SynchronizationRequest,
    UsageCommand,
};
use heidrun_data::{
    add_limit, data_schema_text, default_database_path, format_error, read_catalog, read_usage, synchronize, write_rows,
    Format, HeidrunDatabase, QueryRow, SynchronizationOptions, UsageRequest,
};
use heidrun_data::{
    read_chat_session, read_code_hosting, read_commit, read_file_history, read_pull_request_diff, CodeHostingKind,
};
use heidrun_data::{
    info_row, list_rows, make_snapshot, overhead_rows, parse_time_bound, read_operations, replay_refusal, replay_operation,
    replay_row, summary_rows, ReplayOptions, DEFAULT_LIST_LIMIT,
};
use operations_command_line::{OperationsAction, OperationsCommand, DEFAULT_REPLAY_LIMIT};
use std::io::{IsTerminal, Read};
use std::path::PathBuf;
use std::process::ExitCode;

/// The format of the output: the format of the options, or else the default of the standard output.
fn format_of(common: &CommonOptions) -> Format {
    common.format.unwrap_or_else(|| Format::default_for(std::io::stdout().is_terminal()))
}

/// The absolute path of a path, or of its default when it is not given.
fn absolute_path(option: &Option<String>, default: impl FnOnce() -> Result<PathBuf, String>) -> Result<PathBuf, String> {
    let path = match option {
        Some(path) => PathBuf::from(path),
        None => default()?,
    };
    std::path::absolute(&path).map_err(|error| format!("The path {} cannot be made absolute: {error}", path.display()))
}

/// The absolute path of the SQLite file: the path of the option `--database`, or else the default path.
fn database_path(common: &CommonOptions) -> Result<PathBuf, String> {
    absolute_path(&common.database, || Ok(default_database_path()))
}

/// Prints rows on the standard output, with a new line at the end when there is text.
fn print_rows(rows: &[QueryRow], format: Format) {
    let text = write_rows(rows, format);
    if !text.is_empty() {
        println!("{text}");
    }
}

/// Prints the four sources.
fn run_sources(common: &CommonOptions) -> Result<(), String> {
    let format = format_of(common);
    let database_path = database_path(common)?;
    if common.verbose {
        eprintln!("database: {}", database_path.display());
    }
    let summaries = HeidrunDatabase::summarize_file(&database_path)?;
    let rows: Vec<QueryRow> = match format {
        Format::Table => summaries.iter().flat_map(|summary| summary.to_table_rows()).collect(),
        _ => summaries.iter().map(|summary| summary.to_row()).collect(),
    };
    print_rows(&rows, format);
    Ok(())
}

/// Runs the mode initialize or the mode update on each source. Returns false when at least one source failed, after it
/// printed one error for each source that failed.
fn run_synchronization(request: &SynchronizationRequest) -> Result<bool, String> {
    let format = format_of(&request.common);
    let options = SynchronizationOptions {
        database_path: database_path(&request.common)?,
        folder: folder_of(&request.folder)?,
        repository: request.repository.clone(),
        user_activity_file: absolute_path(&request.file, || Ok(data_layer_user_activity::default_user_activity_file_path()))?,
        claude_dir: data_layer_coding_agents::claude_dir(),
        codex_home: data_layer_coding_agents::codex_home(),
        agents_home: data_layer_coding_agents::agents_home(),
        price_list: request.price_list.clone(),
        is_price_refresh_forced: request.is_price_refresh_forced,
    };
    let print_progress = |message: &str| eprintln!("{message}");
    let ignore_progress = |_: &str| {};
    let log: &dyn Fn(&str) = if request.common.verbose { &print_progress } else { &ignore_progress };
    log(&format!("database: {}", options.database_path.display()));
    log(&format!("folder: {}", options.folder.display()));
    let results = synchronize(request.mode, &request.sources, &options, log);
    let mut rows = Vec::new();
    let mut lines = Vec::new();
    let mut is_success = true;
    for (source, result) in results {
        match result {
            Ok(report) => {
                rows.push(report.to_row());
                lines.push(report.to_line());
            }
            Err(message) => {
                is_success = false;
                eprintln!("{}", format_error(&message, Some(source.name()), format));
            }
        }
    }
    match format {
        Format::Table => {
            for line in lines {
                println!("{line}");
            }
        }
        _ => print_rows(&rows, format),
    }
    Ok(is_success)
}

/// Prints the tokens and the estimated cost of a workspace in a time range.
fn run_usage(command: &UsageCommand) -> Result<(), String> {
    let format = format_of(&command.common);
    let folder = match &command.folder {
        Some(_) => folder_of(&command.folder)?,
        None => data_layer_coding_agents::find_root(&folder_of(&None)?),
    };
    let repository = match &command.repository {
        Some(repository) => repository.clone(),
        None => data_layer_coding_agents::find_repository(&folder)?,
    };
    let request = UsageRequest {
        database_path: database_path(&command.common)?,
        repository,
        folder: folder.display().to_string(),
        since: command.since.clone(),
        until: command.until.clone(),
        grouping: command.by.clone(),
        time_zone: command.time_zone.clone(),
        is_by_chat: command.is_by_chat,
        now: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or_default(),
    };
    if command.common.verbose {
        eprintln!("database: {}", request.database_path.display());
        eprintln!("workspace: {} of {}", request.folder, request.repository);
    }
    let answer = read_usage(&request)?;
    if command.common.verbose {
        eprintln!("token usage read at: {}", answer.synchronized_at);
    }
    print_rows(&answer.to_rows(), format);
    Ok(())
}

/// Prints the shape of every table, or the JSON schema of one table.
fn run_schema(request: &SchemaRequest) -> Result<(), String> {
    if let Some(table) = &request.table {
        print!("{}", data_schema_text(table)?);
        return Ok(());
    }
    let format = format_of(&request.common);
    let catalog = read_catalog()?;
    match format {
        Format::Sql => {
            let statements: Vec<&str> = catalog.iter().map(|shape| shape.create_statement.as_str()).collect();
            println!("{}", statements.join("\n\n"));
        }
        Format::Table => print_rows(&catalog.iter().map(|shape| shape.to_table_row()).collect::<Vec<_>>(), format),
        _ => print_rows(&catalog.iter().map(|shape| shape.to_row()).collect::<Vec<_>>(), format),
    }
    Ok(())
}

/// Runs one read-only SQL statement, and prints the rows.
fn run_query(request: &QueryRequest) -> Result<(), String> {
    let format = format_of(&request.common);
    let sql = if request.sql == "-" {
        let mut text = String::new();
        std::io::stdin()
            .read_to_string(&mut text)
            .map_err(|error| format!("The standard input cannot be read: {error}"))?;
        text
    } else {
        request.sql.clone()
    };
    let sql = add_limit(&sql, request.limit);
    let database_path = database_path(&request.common)?;
    if request.common.verbose {
        eprintln!("database: {}", database_path.display());
        eprintln!("statement: {sql}");
    }
    let database = HeidrunDatabase::open_read_only(&database_path)?;
    let rows = database.query(&sql)?;
    print_rows(&rows, format);
    Ok(())
}

/// The absolute path of the folder of the option `--folder`, or else of the current folder.
fn folder_of(option: &Option<String>) -> Result<PathBuf, String> {
    absolute_path(option, || std::env::current_dir().map_err(|error| error.to_string()))
}

/// The root of the main checkout of the repository that holds `folder`, so that the chat sessions of the main checkout and
/// of every worktree below it are found from any worktree. The root of the folder when `git` cannot tell.
fn main_root(folder: &std::path::Path) -> PathBuf {
    use data_layer_source_control::GitRunner;
    let runner = data_layer_source_control::GitCommandRunner::new(folder);
    let common_folder = runner.run(&["rev-parse", "--path-format=absolute", "--git-common-dir"], None);
    match common_folder.ok().map(|text| PathBuf::from(text.trim())) {
        Some(path) if path.file_name().is_some_and(|name| name == ".git") => {
            path.parent().map(PathBuf::from).unwrap_or_else(|| data_layer_coding_agents::find_root(folder))
        }
        _ => data_layer_coding_agents::find_root(folder),
    }
}

/// Prints the content of one thing from its source.
fn run_read(request: &ReadRequest) -> Result<(), String> {
    let format = format_of(&request.common);
    let folder = folder_of(&request.folder)?;
    match request.kind {
        ReadKind::ChatSession => {
            if !folder.is_dir() {
                return Err(format!("The folder {} does not exist.", folder.display()));
            }
            let root = main_root(&folder);
            let records = read_chat_session(
                &request.key,
                &root,
                &data_layer_coding_agents::claude_dir().join("projects"),
                &data_layer_coding_agents::codex_home(),
                request.is_full,
            )?;
            match format {
                Format::Table => {
                    for record in &records {
                        println!("[{}] {}: {}", record.at.as_deref().unwrap_or("no date"), record.role.name(), record.text);
                    }
                }
                _ => print_rows(&records.iter().map(|record| record.to_row()).collect::<Vec<_>>(), format),
            }
        }
        ReadKind::FileHistory => {
            if !folder.is_dir() {
                return Err(format!("The folder {} does not exist.", folder.display()));
            }
            let changes = read_file_history(
                &request.key,
                &main_root(&folder),
                &data_layer_coding_agents::claude_dir().join("projects"),
                &data_layer_coding_agents::codex_home(),
            );
            match format {
                Format::Table => {
                    for change in &changes {
                        print!("{}", change.to_text());
                    }
                }
                _ => print_rows(&changes.iter().map(|change| change.to_row()).collect::<Vec<_>>(), format),
            }
        }
        ReadKind::Commit => {
            let runner = data_layer_source_control::GitCommandRunner::new(&folder);
            let commit = read_commit(&runner, &request.key, request.has_diff)?;
            match format {
                Format::Table => print!("{}", commit.to_text()),
                _ => print_rows(&[commit.to_row()], format),
            }
        }
        ReadKind::Issue | ReadKind::PullRequest => {
            let repository = match &request.repository {
                Some(repository) => repository.clone(),
                None => data_layer_code_hosting::find_repository(&folder)?,
            };
            let number: u64 = request.key.parse().map_err(|_| format!("The key {} is not a number.", request.key))?;
            let kind = match request.kind {
                ReadKind::Issue => CodeHostingKind::Issue,
                _ => CodeHostingKind::PullRequest,
            };
            let mut entries = read_code_hosting(&data_layer_code_hosting::GhGraphqlRunner, kind, &repository, number)?;
            if kind == CodeHostingKind::PullRequest && request.has_diff {
                entries.push(read_pull_request_diff(&repository, number)?);
            }
            match format {
                Format::Table => {
                    for entry in &entries {
                        print!("{}", entry.to_text());
                    }
                }
                _ => print_rows(&entries.iter().map(|entry| entry.to_row()).collect::<Vec<_>>(), format),
            }
        }
    }
    Ok(())
}

/// The log file of the operations: the option `--log-file`, else the file of the variable `HEIDRUN_OPERATION_LOG_FILE`, else the
/// file in the folder of the data of Heidrun. The value `off` of the variable turns the writing off, and the reading still
/// uses the default file.
fn log_file_of(command: &OperationsCommand) -> Result<PathBuf, String> {
    let from_environment = data_layer_operation_log::LogSettings::from_environment().file;
    absolute_path(&command.log_file, || Ok(from_environment.unwrap_or_else(data_layer_operation_log::default_log_file)))
}

/// Which operations the options of the command select.
fn operation_filter_of(command: &OperationsCommand) -> Result<data_layer_operation_log::Filter, String> {
    let bound = |text: &Option<String>| text.as_deref().map(parse_time_bound).transpose();
    Ok(data_layer_operation_log::Filter {
        caller: command.caller.clone(),
        package: command.package.clone(),
        operation_name: command.operation_name.clone(),
        since_milliseconds: bound(&command.since)?,
        until_milliseconds: bound(&command.until)?,
        minimum_microseconds: command.minimum_milliseconds.map(|milliseconds| milliseconds.saturating_mul(1000)),
        state: command.state.as_deref().and_then(data_layer_operation_log::OperationState::from_name),
        only_unfinished: command.is_unfinished,
        include_nested: command.has_nested,
        include_replays: command.has_replays,
        only_replays: command.has_only_replays,
    })
}

/// Runs one action of the command `operations`.
fn run_operations(command: &OperationsCommand) -> Result<(), String> {
    let format = format_of(&command.common);
    match command.action {
        OperationsAction::Info => {
            let log_file = log_file_of(command)?;
            print_rows(&[info_row(&log_file)?], format);
        }
        OperationsAction::Summary => {
            let reading = read_operations(&log_file_of(command)?)?;
            let by = command.by.as_deref().and_then(data_layer_operation_log::GroupBy::from_name).unwrap_or(data_layer_operation_log::GroupBy::OperationName);
            print_rows(&summary_rows(&reading, &operation_filter_of(command)?, by, command.is_repeated), format);
        }
        OperationsAction::List => {
            let reading = read_operations(&log_file_of(command)?)?;
            let rows = match &command.id {
                Some(id) => {
                    let operation = reading.operations.iter().find(|operation| operation.start.operation_id == *id);
                    vec![heidrun_data::operation_row(operation.ok_or_else(|| format!("The operation {id} is not in the log."))?)]
                }
                None => {
                    let limit = command.limit.unwrap_or(DEFAULT_LIST_LIMIT);
                    list_rows(&reading, &operation_filter_of(command)?, Some(limit), command.is_slowest_first)
                }
            };
            print_rows(&rows, format);
        }
        OperationsAction::Replay => run_replay(command, format)?,
        OperationsAction::Snapshot => {
            let to = absolute_path(&command.to, || Err("The option --to is needed.".to_string()))?;
            let bytes = make_snapshot(&database_path(&command.common)?, &to)?;
            let mut row = QueryRow::new();
            row.insert("snapshot".to_string(), to.display().to_string().into());
            row.insert("bytes".to_string(), bytes.into());
            print_rows(&[row], format);
        }
        OperationsAction::Overhead => print_rows(&overhead_rows(command.iterations)?, format),
    }
    Ok(())
}

/// Runs recorded operations again, and prints the original time next to the time of each run. An operation that cannot be
/// replayed is named on the standard error output and skipped, unless it is the one operation that `--id` names.
fn run_replay(command: &OperationsCommand, format: Format) -> Result<(), String> {
    let reading = read_operations(&log_file_of(command)?)?;
    let selected: Vec<&data_layer_operation_log::PairedOperation> = match &command.id {
        Some(id) => {
            let operation = reading.operations.iter().find(|operation| operation.start.operation_id == *id);
            vec![operation.ok_or_else(|| format!("The operation {id} is not in the log."))?]
        }
        None => {
            let mut operations = data_layer_operation_log::filter_operations(&reading.operations, &operation_filter_of(command)?);
            operations.retain(|operation| replay_refusal(operation).is_none());
            if command.is_slowest_first {
                operations.sort_by_key(|operation| std::cmp::Reverse(operation.duration_microseconds().unwrap_or(0)));
            }
            operations.into_iter().take(command.limit.unwrap_or(DEFAULT_REPLAY_LIMIT)).collect()
        }
    };
    if selected.is_empty() {
        return Err("No recorded operation can be replayed with these options.".to_string());
    }
    let options = ReplayOptions {
        database_path: database_path(&command.common)?,
        isolated_database: command.isolated_database.as_ref().map(PathBuf::from),
        start_from: command.start_from.as_ref().map(PathBuf::from),
        default_database_path: default_database_path(),
        folder: folder_of(&command.folder)?,
        is_network_allowed: command.is_network_allowed,
        is_recorded_path_used: command.is_recorded_path_used,
    };
    let mut rows = Vec::new();
    let mut has_replayed_synchronization = false;
    for original in selected {
        let is_synchronization = original.start.kind == data_layer_operation_log::OperationKind::Synchronization;
        if is_synchronization && has_replayed_synchronization {
            eprintln!("{}: skipped. A replay runs one synchronization. Use --id for another.", original.start.operation_id);
            continue;
        }
        match replay_operation(original, &options, command.repeat) {
            Ok(runs) => {
                has_replayed_synchronization |= is_synchronization;
                rows.extend(runs.iter().map(|run| replay_row(original, run)));
            }
            Err(message) if command.id.is_some() => return Err(message),
            Err(message) => eprintln!("{}: skipped. {message}", original.start.operation_id),
        }
    }
    print_rows(&rows, format);
    Ok(())
}

/// Runs the command line. Returns false when at least one source failed, and its error is already printed.
fn run(parsed: Parsed) -> Result<bool, String> {
    match parsed {
        Parsed::Help(text) => {
            print!("{text}");
            Ok(true)
        }
        Parsed::Sources(common) => run_sources(&common).map(|()| true),
        Parsed::Synchronize(operation) => run_synchronization(&operation),
        Parsed::Schema(operation) => run_schema(&operation).map(|()| true),
        Parsed::Query(operation) => run_query(&operation).map(|()| true),
        Parsed::Usage(command) => run_usage(&command).map(|()| true),
        Parsed::Read(operation) => run_read(&operation).map(|()| true),
        Parsed::Operations(command) => run_operations(&command).map(|()| true),
    }
}

/// Exits with the code 1 and the error on the standard error output when an error happens.
fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let format = find_format(&arguments).unwrap_or_else(|| Format::default_for(std::io::stdout().is_terminal()));
    match parse(&arguments).and_then(run) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::from(1),
        Err(message) => {
            eprintln!("{}", format_error(&message, None, format));
            ExitCode::from(1)
        }
    }
}
