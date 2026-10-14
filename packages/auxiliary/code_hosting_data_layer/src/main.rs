//! The command line `code_hosting_data_layer`: the commands initialize, update, and query.

mod command_line;

use code_hosting_data_layer::{
    default_database_path, describe_since, find_repository, ignore_log, synchronize, to_json, to_table,
    CodeHostingDatabase, GhGraphqlRunner, GithubReader,
};
use command_line::{parse, Parsed, QueryRequest, SynchronizationRequest, HELP};
use std::path::PathBuf;
use std::process::ExitCode;

/// The absolute path of the SQLite file: the path of the option `--database`, or else the default path.
fn database_path(option: &Option<String>) -> Result<PathBuf, String> {
    let path = option.as_ref().map(PathBuf::from).unwrap_or_else(default_database_path);
    std::path::absolute(&path).map_err(|error| format!("The path {} cannot be made absolute: {error}", path.display()))
}

/// Runs the mode initialize or the mode update, and prints a report of three lines on the standard output.
fn run_synchronization(request: &SynchronizationRequest) -> Result<(), String> {
    let repository = match &request.repository {
        Some(repository) => repository.clone(),
        None => find_repository(&std::env::current_dir().map_err(|error| error.to_string())?)?,
    };
    let database_path = database_path(&request.database)?;
    let print_progress = |message: &str| eprintln!("{message}");
    let log: &dyn Fn(&str) = if request.verbose { &print_progress } else { &ignore_log };
    log(&format!("repository: {repository}"));
    log(&format!("database: {}", database_path.display()));
    let mut database = CodeHostingDatabase::open(&database_path)?;
    let runner = GhGraphqlRunner;
    let reader = GithubReader::new(&runner, log);
    let report = synchronize(request.mode, &repository, &mut database, &reader, log)?;
    println!("{} -> {} ({})", report.repository, database_path.display(), report.mode.name());
    println!("issues: {} written, read {}", report.issue_count, describe_since(report.issues_since.as_deref()));
    println!(
        "pull requests: {} written, read {}",
        report.pull_request_count,
        describe_since(report.pull_requests_since.as_deref())
    );
    Ok(())
}

/// Runs one read-only SQL statement, and prints the rows on the standard output.
fn run_query(request: &QueryRequest) -> Result<(), String> {
    let database = CodeHostingDatabase::open_read_only(&database_path(&request.database)?)?;
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
