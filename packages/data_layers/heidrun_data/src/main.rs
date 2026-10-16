//! The command line `heidrun_data`: the commands sources, update, initialize, and query.

mod command_line;

use command_line::{find_format, parse, CommonOptions, Parsed, QueryRequest, SynchronizationRequest};
use heidrun_data::{
    add_limit, default_database_path, format_error, synchronize, write_rows, Format, HeidrunDatabase, QueryRow,
    SynchronizationOptions,
};
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
        folder: absolute_path(&request.folder, || std::env::current_dir().map_err(|error| error.to_string()))?,
        repository: request.repository.clone(),
        user_activity_file: absolute_path(&request.file, || Ok(data_layer_user_activity::default_user_activity_file_path()))?,
        claude_projects_folder: data_layer_chat_sessions::claude_dir().join("projects"),
        codex_home: data_layer_chat_sessions::codex_home(),
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

/// Runs the command line. Returns false when at least one source failed, and its error is already printed.
fn run(parsed: Parsed) -> Result<bool, String> {
    match parsed {
        Parsed::Help(text) => {
            print!("{text}");
            Ok(true)
        }
        Parsed::Sources(common) => run_sources(&common).map(|()| true),
        Parsed::Synchronize(request) => run_synchronization(&request),
        Parsed::Query(request) => run_query(&request).map(|()| true),
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
