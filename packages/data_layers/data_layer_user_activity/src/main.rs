//! The command line `data_layer_user_activity`: the commands initialize, update, and query.

mod command_line;

use command_line::{parse, Parsed, QueryRequest, SynchronizationRequest, HELP};
use data_layer_user_activity::{
    default_database_path, default_user_activity_file_path, synchronize, to_json, to_table, UserActivityDatabase,
    UserActivityFileReader,
};
use std::path::PathBuf;
use std::process::ExitCode;

/// The absolute path of the SQLite file: the path of the option `--database`, or else the default path.
fn database_path(option: &Option<String>) -> Result<PathBuf, String> {
    let path = option.as_ref().map(PathBuf::from).unwrap_or_else(default_database_path);
    std::path::absolute(&path).map_err(|error| format!("The path {} cannot be made absolute: {error}", path.display()))
}

/// The absolute path of the file of the user activity records: the path of the option `--file`, or else the default path.
fn user_activity_file_path(option: &Option<String>) -> Result<PathBuf, String> {
    let path = option.as_ref().map(PathBuf::from).unwrap_or_else(default_user_activity_file_path);
    std::path::absolute(&path).map_err(|error| format!("The path {} cannot be made absolute: {error}", path.display()))
}

/// Runs the mode initialize or the mode update, and prints a report on the standard output.
fn run_synchronization(request: &SynchronizationRequest) -> Result<(), String> {
    let file_path = user_activity_file_path(&request.file)?;
    let database_path = database_path(&request.database)?;
    let print_progress = |message: &str| eprintln!("{message}");
    let ignore_progress = |_: &str| {};
    let log: &dyn Fn(&str) = if request.verbose { &print_progress } else { &ignore_progress };
    log(&format!("file: {}", file_path.display()));
    log(&format!("database: {}", database_path.display()));
    let mut database = UserActivityDatabase::open(&database_path)?;
    let reader = UserActivityFileReader::new(&file_path);
    let report = synchronize(request.mode, &reader, &mut database, log)?;
    println!("{} -> {} ({})", file_path.display(), database_path.display(), report.mode.name());
    if !report.is_file_found {
        println!("The file does not exist, so nothing is read.");
    }
    println!("records: {} written, {} already read", report.record_count, report.already_read_record_count);
    println!("skipped lines: {}", report.skipped_line_count);
    Ok(())
}

/// Runs one read-only SQL statement, and prints the rows on the standard output.
fn run_query(request: &QueryRequest) -> Result<(), String> {
    let database = UserActivityDatabase::open_read_only(&database_path(&request.database)?)?;
    let rows = database.query(&request.sql)?;
    println!("{}", if request.json { to_json(&rows) } else { to_table(&rows) });
    Ok(())
}

/// Runs the command line.
fn run(arguments: &[String]) -> Result<(), String> {
    match parse(arguments)? {
        Parsed::Help => {
            print!("{HELP}");
            Ok(())
        }
        Parsed::Synchronize(request) => run_synchronization(&request),
        Parsed::Query(request) => run_query(&request),
    }
}

/// Exits with the code 1 and the message on the standard error output when an error happens.
fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match run(&arguments) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("Error: {message}");
            ExitCode::from(1)
        }
    }
}
