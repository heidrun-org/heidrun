//! The arguments of the command `heidrun_code_data operations`, and the text of its help.
//!
//! The command has its own options, so its arguments are read here and not in `command_line.rs`. The word `operations` must be
//! the first argument.

use crate::command_line::{CommonOptions, Parsed};
use heidrun_code_data::Format;

/// The text of `heidrun_code_data operations --help`.
pub const OPERATIONS_HELP: &str = r#"Usage: heidrun_code_data operations <action> [options]

Reads the log of the operations that the data layer receives. Every call of a public function of the four data layer
packages and of heidrun_code_data is an operation, and writes two lines in the log: one when the operation starts, one when it
ends. The log tells who asked (caller), what (package and operation name), with which parameters, how long it took, and
how it ended. An operation that never ended stays visible as running or interrupted.

Actions:
  info                       Print where the log file is, its size, the version of its format, and how many operations,
                             failed operations, unfinished operations, and damaged lines it holds.
  summary                    Print the usage patterns: one row for each group of operations, with the count, the
                             failures, the unfinished operations, the total time, the mean, the median, the 90th, 95th,
                             and 99th percentile, and the longest time, in milliseconds. The largest total time comes
                             first. The column "workload" tells stored_data_query, collection, initial_import,
                             incremental_synchronization, synchronization, database_write, or lock_wait.
  list                       Print the operations one by one, with their parameters, so that they can be exported.
  replay                     Run recorded operations again through the data layer, and print the original time and the
                             replay time of each. See "Replay" below.
  snapshot                   Copy the SQLite file in a consistent file, for the replay of queries.
  overhead                   Measure what the log costs: the time that one operation adds, and the bytes that it writes.

The operations that run inside another operation (the SQL statement inside a synchronization, the lock) are nested operations.
A nested operation is not counted as an operation of its own, unless --nested is given. The operations of a replay are left out
unless --replays or --only-replays is given.

Options for info, summary, list, and replay:
  --log-file <path>          The log file. (default: the value of HEIDRUN_CODE_OPERATION_LOG_FILE, else
                             "~/.config/heidrun_code/data_layer_operations.jsonl"). The old file "<path>.1" is read too.

Options for summary, list, and replay (which operations):
  --caller <name>            Only the operations of this caller, for example heidrun or heidrun_code_data.
  --package <name>           Only the operations of this package: source_control, code_hosting, coding_agents,
                             user_activity, or heidrun_code_data.
  --operation-name <name>    Only the operations with this operation name, for example query, synchronize, or find_usage.
  --since <time>             Only the operations that started at this time or later. A date 2026-10-17 or a time
                             2026-10-17T12:30:00Z, in UTC.
  --until <time>             Only the operations that started before this time.
  --minimum-milliseconds <n> Only the operations that took at least n milliseconds.
  --state <name>             Only the operations that succeeded, failed, running, or interrupted.
  --unfinished               Only the operations that never ended: running or interrupted.
  --nested                   Count the nested operations too.
  --replays                  Count the operations of a replay too.
  --only-replays             Count only the operations of a replay.

Options for summary:
  --by <name>                How the operations are grouped: operation-name (the default), pattern (the SQL statement
                             without its values, with the choices of the operation), or parameters (the exact parameters).
  --repeated                 Keep the groups of two operations or more, to find the same call made again and again.

Options for list and replay:
  --id <operation id>        Only this operation.
  --limit <count>            The most operations that are printed. (default for list: 100, for replay: 10)

Options for list:
  --slowest                  The longest operations first.

Replay:
  A replay runs a recorded operation again through the interface of the package that received it, and prints the original
  time next to the replay time. The replayed operations are written in the log with the origin "replay" and the identifier
  of the original operation, so they never change the picture of the real usage. A replay times an operation on the data of
  today, so the numbers of rows can differ from the original. A replay cannot run an operation that runs inside another
  one: replay the operation that holds it. A statement that the log cut or cleaned of a secret is not replayed. A replay
  runs a query, a find call (find_commits, find_user_activity_records, find_issues_opened_between,
  find_pull_requests_opened_between, find_chat_list, find_ai_cost), a synchronization, and a refresh call
  (refresh_source_control, refresh_user_activity, refresh_code_hosting, refresh_chat_sessions) of the desktop application.
  The calls that fetch the price list are not replayed.
  - A query (a SQL statement, usage, find_usage) opens the SQLite file read only. Use a snapshot.
  - A synchronization writes, so it needs --isolated-database, a file that does not exist yet. It never writes the
    SQLite file of Heidrun Code. Without --allow-network, the source code_hosting is skipped, and no price list is fetched.

  --database <path>          The SQLite file that the queries read.
                             (default: "data_layer.sqlite" in HEIDRUN_CODE_DIR, or
                             "~/.config/heidrun_code/data_layer.sqlite")
  --repeat <count>           How many times each query runs. (default: 1) A synchronization runs once.
  --isolated-database <path> The new file that a synchronization writes.
  --start-from <path>        A snapshot that is copied to the isolated file first, so that the mode update of a
                             replay does an incremental synchronization.
  --folder <path>            The folder that source control, code hosting, and coding agents read.
                             (default: the current folder)
  --use-recorded-paths       Read the folders of the original operation instead of the folder of --folder and the
                             default folders of the coding agents.
  --allow-network            Let a synchronization use the network.

Options for snapshot:
  --to <path>                The new file. It must not exist.

Options for overhead:
  --iterations <count>       How many operations each of the two runs makes. (default: 2000)

Options of every action:
  --format <name>            jsonl, json, or table.
  --json                     The same as --format json.
  --verbose                  Print more on the standard error output.
  -h, --help                 Print this help.

Environment:
  HEIDRUN_CODE_OPERATION_LOG_FILE   The log file of every program. The value "off" turns the log off.
  HEIDRUN_CODE_OPERATION_LOG_CALLER The name of the caller that the log writes. (default: the name of the program)

Examples:
  $ heidrun_code_data operations info
  $ heidrun_code_data operations summary --format jsonl
  $ heidrun_code_data operations summary --by pattern --repeated --since 2026-10-01 --format jsonl
  $ heidrun_code_data operations summary --unfinished --nested --format jsonl
  $ heidrun_code_data operations list --slowest --limit 20 --format jsonl
  $ heidrun_code_data operations snapshot --to /tmp/snapshot.sqlite
  $ heidrun_code_data operations replay --id r-1792240496789-1 --database /tmp/snapshot.sqlite --repeat 5
  $ heidrun_code_data operations replay --operation-name synchronize --isolated-database /tmp/isolated.sqlite --format jsonl
  $ heidrun_code_data operations overhead --format jsonl
"#;

/// The size of the list that `operations replay` runs when the option `--limit` is not given.
pub const DEFAULT_REPLAY_LIMIT: usize = 10;

/// The number of operations of each run of `operations overhead` when the option `--iterations` is not given.
pub const DEFAULT_OVERHEAD_ITERATIONS: usize = 2000;

/// The action of the command `operations`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationsAction {
    /// Print the facts of the log file.
    Info,
    /// Print the usage patterns.
    Summary,
    /// Print the operations one by one.
    List,
    /// Run recorded operations again.
    Replay,
    /// Copy the SQLite file in a consistent file.
    Snapshot,
    /// Measure the cost of the log.
    Overhead,
}

/// The command `heidrun_code_data operations`.
#[derive(Debug, PartialEq)]
pub struct OperationsCommand {
    /// The options of every command.
    pub common: CommonOptions,
    /// The action.
    pub action: OperationsAction,
    /// The path of the log file, or `None` for the file of the environment.
    pub log_file: Option<String>,
    /// Only the operations of this caller.
    pub caller: Option<String>,
    /// Only the operations of this package.
    pub package: Option<String>,
    /// Only the operations of this operation.
    pub operation_name: Option<String>,
    /// The start of the time range, as written.
    pub since: Option<String>,
    /// The end of the time range, as written.
    pub until: Option<String>,
    /// Only the operations that took at least this long, in milliseconds.
    pub minimum_milliseconds: Option<u64>,
    /// The name of the state, as written.
    pub state: Option<String>,
    /// True to keep only the operations that never ended.
    pub is_unfinished: bool,
    /// True to count the nested operations.
    pub has_nested: bool,
    /// True to count the operations of a replay too.
    pub has_replays: bool,
    /// True to count only the operations of a replay.
    pub has_only_replays: bool,
    /// The name of the grouping of the summary, or `None` for `operation`.
    pub by: Option<String>,
    /// True to keep the groups of two operations or more.
    pub is_repeated: bool,
    /// The identifier of the one operation.
    pub id: Option<String>,
    /// The most operations that are printed.
    pub limit: Option<usize>,
    /// True to print the longest operations first.
    pub is_slowest_first: bool,
    /// How many times each query of a replay runs.
    pub repeat: usize,
    /// The new file that a synchronization of a replay writes.
    pub isolated_database: Option<String>,
    /// The snapshot that is copied to the isolated file first.
    pub start_from: Option<String>,
    /// The folder that the sources read.
    pub folder: Option<String>,
    /// True to read the folders of the original operation.
    pub is_recorded_path_used: bool,
    /// True to let a synchronization use the network.
    pub is_network_allowed: bool,
    /// The new file of a snapshot.
    pub to: Option<String>,
    /// The number of operations of each run of the measure of the cost of the log.
    pub iterations: usize,
}

/// The value of the option `name`: the text after the sign `=`, or else the next argument.
fn value_of<'a>(name: &str, inline: Option<String>, rest: &mut impl Iterator<Item = &'a String>) -> Result<String, String> {
    match inline {
        Some(value) => Ok(value),
        None => rest.next().cloned().ok_or_else(|| format!("The option {name} needs a value.")),
    }
}

/// The whole number of the option `name`.
fn number_of(name: &str, text: String) -> Result<u64, String> {
    text.parse::<u64>().map_err(|_| format!("The option {name} needs a whole number, and got {text}."))
}

/// Reads the arguments that follow the word `operations`.
///
/// # Errors
/// An unknown action or option, an option without a value, an option that the action does not accept, or a missing action.
pub fn parse(arguments: &[String]) -> Result<Parsed, String> {
    let mut command = OperationsCommand {
        common: CommonOptions::default(),
        action: OperationsAction::Info,
        log_file: None,
        caller: None,
        package: None,
        operation_name: None,
        since: None,
        until: None,
        minimum_milliseconds: None,
        state: None,
        is_unfinished: false,
        has_nested: false,
        has_replays: false,
        has_only_replays: false,
        by: None,
        is_repeated: false,
        id: None,
        limit: None,
        is_slowest_first: false,
        repeat: 1,
        isolated_database: None,
        start_from: None,
        folder: None,
        is_recorded_path_used: false,
        is_network_allowed: false,
        to: None,
        iterations: DEFAULT_OVERHEAD_ITERATIONS,
    };
    let mut given: Vec<&'static str> = Vec::new();
    let mut is_help = false;
    let mut positionals: Vec<String> = Vec::new();
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if argument.starts_with('-') == false || argument == "-" {
            positionals.push(argument.clone());
            continue;
        }
        let (name, inline) = match argument.split_once('=') {
            Some((name, value)) => (name.to_string(), Some(value.to_string())),
            None => (argument.clone(), None),
        };
        let mut note = |option: &'static str| given.push(option);
        match name.as_str() {
            "-h" | "--help" => is_help = true,
            "--database" => command.common.database = Some(value_of("--database", inline, &mut rest)?),
            "--format" => {
                let text = value_of("--format", inline, &mut rest)?;
                let format = Format::from_name(&text)
                    .ok_or_else(|| format!("The format {text} is not known: use jsonl, json, or table."))?;
                if command.common.format.is_some_and(|other| other != format) {
                    return Err("The options --format and --json ask for two different formats.".to_string());
                }
                command.common.format = Some(format);
            }
            "--json" => {
                if command.common.format.is_some_and(|other| other != Format::Json) {
                    return Err("The options --format and --json ask for two different formats.".to_string());
                }
                command.common.format = Some(Format::Json);
            }
            "--verbose" => command.common.verbose = true,
            "--log-file" => command.log_file = Some(value_of("--log-file", inline, &mut rest)?),
            "--caller" => {
                note("--caller");
                command.caller = Some(value_of("--caller", inline, &mut rest)?);
            }
            "--package" => {
                note("--package");
                command.package = Some(value_of("--package", inline, &mut rest)?);
            }
            "--operation-name" => {
                note("--operation-name");
                command.operation_name = Some(value_of("--operation-name", inline, &mut rest)?);
            }
            "--since" => {
                note("--since");
                command.since = Some(value_of("--since", inline, &mut rest)?);
            }
            "--until" => {
                note("--until");
                command.until = Some(value_of("--until", inline, &mut rest)?);
            }
            "--minimum-milliseconds" => {
                note("--minimum-milliseconds");
                command.minimum_milliseconds = Some(number_of(&name, value_of(&name, inline, &mut rest)?)?);
            }
            "--state" => {
                note("--state");
                command.state = Some(value_of("--state", inline, &mut rest)?);
            }
            "--unfinished" => {
                note("--unfinished");
                command.is_unfinished = true;
            }
            "--nested" => {
                note("--nested");
                command.has_nested = true;
            }
            "--replays" => {
                note("--replays");
                command.has_replays = true;
            }
            "--only-replays" => {
                note("--only-replays");
                command.has_only_replays = true;
            }
            "--by" => {
                note("--by");
                command.by = Some(value_of("--by", inline, &mut rest)?);
            }
            "--repeated" => {
                note("--repeated");
                command.is_repeated = true;
            }
            "--id" => {
                note("--id");
                command.id = Some(value_of("--id", inline, &mut rest)?);
            }
            "--limit" => {
                note("--limit");
                command.limit = Some(number_of(&name, value_of(&name, inline, &mut rest)?)? as usize);
            }
            "--slowest" => {
                note("--slowest");
                command.is_slowest_first = true;
            }
            "--repeat" => {
                note("--repeat");
                command.repeat = number_of(&name, value_of(&name, inline, &mut rest)?)? as usize;
                if command.repeat == 0 {
                    return Err("The option --repeat needs a number that is 1 or more.".to_string());
                }
            }
            "--isolated-database" => {
                note("--isolated-database");
                command.isolated_database = Some(value_of("--isolated-database", inline, &mut rest)?);
            }
            "--start-from" => {
                note("--start-from");
                command.start_from = Some(value_of("--start-from", inline, &mut rest)?);
            }
            "--folder" => {
                note("--folder");
                command.folder = Some(value_of("--folder", inline, &mut rest)?);
            }
            "--use-recorded-paths" => {
                note("--use-recorded-paths");
                command.is_recorded_path_used = true;
            }
            "--allow-network" => {
                note("--allow-network");
                command.is_network_allowed = true;
            }
            "--to" => {
                note("--to");
                command.to = Some(value_of("--to", inline, &mut rest)?);
            }
            "--iterations" => {
                note("--iterations");
                command.iterations = number_of(&name, value_of(&name, inline, &mut rest)?)? as usize;
                if command.iterations == 0 {
                    return Err("The option --iterations needs a number that is 1 or more.".to_string());
                }
            }
            _ => return Err(format!("The option {name} is not known. Run \"heidrun_code_data operations --help\".")),
        }
    }
    if is_help {
        return Ok(Parsed::Help(OPERATIONS_HELP));
    }
    let mut positionals = positionals.into_iter();
    let Some(action) = positionals.next() else {
        return Err("An action is needed: info, summary, list, replay, snapshot, or overhead. Run \"heidrun_code_data operations --help\".".to_string());
    };
    command.action = match action.as_str() {
        "info" => OperationsAction::Info,
        "summary" => OperationsAction::Summary,
        "list" => OperationsAction::List,
        "replay" => OperationsAction::Replay,
        "snapshot" => OperationsAction::Snapshot,
        "overhead" => OperationsAction::Overhead,
        _ => return Err(format!("The action {action} is not known: use info, summary, list, replay, snapshot, or overhead.")),
    };
    if let Some(extra) = positionals.next() {
        return Err(format!("The argument {extra} is not needed. The command operations takes one action."));
    }
    check_options(&command, &given)?;
    Ok(Parsed::Operations(command))
}

/// The options that each action accepts, besides the options of every action.
fn accepted_options(action: OperationsAction) -> &'static [&'static str] {
    const SUMMARY: &[&str] = &[
        "--caller", "--package", "--operation-name", "--since", "--until", "--minimum-milliseconds", "--state", "--unfinished",
        "--nested", "--replays", "--only-replays", "--by", "--repeated",
    ];
    const LIST: &[&str] = &[
        "--caller", "--package", "--operation-name", "--since", "--until", "--minimum-milliseconds", "--state", "--unfinished",
        "--nested", "--replays", "--only-replays", "--id", "--limit", "--slowest",
    ];
    const REPLAY: &[&str] = &[
        "--caller", "--package", "--operation-name", "--since", "--until", "--minimum-milliseconds", "--state", "--unfinished",
        "--nested", "--replays", "--only-replays", "--id", "--limit", "--repeat", "--isolated-database", "--start-from",
        "--folder", "--use-recorded-paths", "--allow-network", "--slowest",
    ];
    const SNAPSHOT: &[&str] = &["--to"];
    const OVERHEAD: &[&str] = &["--iterations"];
    match action {
        OperationsAction::Info => &[],
        OperationsAction::Summary => SUMMARY,
        OperationsAction::List => LIST,
        OperationsAction::Replay => REPLAY,
        OperationsAction::Snapshot => SNAPSHOT,
        OperationsAction::Overhead => OVERHEAD,
    }
}

/// Refuses an option that the action does not use, and the options that the action needs and that are missing.
fn check_options(command: &OperationsCommand, given: &[&'static str]) -> Result<(), String> {
    let accepted = accepted_options(command.action);
    for option in given {
        if accepted.contains(option) == false {
            return Err(format!("The option {option} is not for this action. Run \"heidrun_code_data operations --help\"."));
        }
    }
    if command.action == OperationsAction::Snapshot && command.to.is_none() {
        return Err("The action snapshot needs the option --to with the path of the new file.".to_string());
    }
    if command.has_replays && command.has_only_replays {
        return Err("The options --replays and --only-replays cannot be used together.".to_string());
    }
    if command.is_unfinished && command.state.is_some() {
        return Err("The options --unfinished and --state cannot be used together.".to_string());
    }
    if let Some(by) = &command.by {
        if data_layer_operation_log::GroupBy::from_name(by).is_none() {
            return Err(format!("The grouping {by} is not known: use operation-name, pattern, or parameters."));
        }
    }
    if let Some(state) = &command.state {
        if data_layer_operation_log::OperationState::from_name(state).is_none() {
            return Err(format!("The state {state} is not known: use succeeded, failed, running, or interrupted."));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(text: &str) -> Vec<String> {
        text.split_whitespace().map(str::to_string).collect()
    }

    fn parsed(text: &str) -> OperationsCommand {
        match parse(&arguments(text)).unwrap() {
            Parsed::Operations(command) => command,
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn each_action_is_read() {
        assert_eq!(parsed("info").action, OperationsAction::Info);
        assert_eq!(parsed("summary --by pattern --repeated").by.as_deref(), Some("pattern"));
        assert_eq!(parsed("list --slowest --limit 5").limit, Some(5));
        assert_eq!(parsed("replay --id r-1 --repeat 3").repeat, 3);
        assert_eq!(parsed("snapshot --to /tmp/a.sqlite").to.as_deref(), Some("/tmp/a.sqlite"));
        assert_eq!(parsed("overhead").iterations, DEFAULT_OVERHEAD_ITERATIONS);
        assert_eq!(parsed("overhead --iterations=50").iterations, 50);
    }

    #[test]
    fn the_help_is_given_for_the_flag_and_a_missing_action_is_an_error() {
        assert_eq!(parse(&arguments("--help")), Ok(Parsed::Help(OPERATIONS_HELP)));
        assert_eq!(parse(&arguments("summary -h")), Ok(Parsed::Help(OPERATIONS_HELP)));
        assert!(parse(&[]).unwrap_err().contains("An action is needed"));
        assert!(parse(&arguments("delete")).unwrap_err().contains("not known"));
        assert!(parse(&arguments("info summary")).unwrap_err().contains("takes one action"));
    }

    #[test]
    fn an_option_of_another_action_is_refused() {
        assert!(parse(&arguments("info --by pattern")).unwrap_err().contains("not for this action"));
        assert!(parse(&arguments("summary --isolated-database /tmp/a")).unwrap_err().contains("not for this action"));
        assert!(parse(&arguments("list --iterations 5")).unwrap_err().contains("not for this action"));
        assert!(parse(&arguments("snapshot")).unwrap_err().contains("--to"));
    }

    #[test]
    fn a_wrong_value_is_refused() {
        assert!(parse(&arguments("summary --by color")).unwrap_err().contains("operation-name, pattern, or parameters"));
        assert!(parse(&arguments("list --state sleeping")).unwrap_err().contains("not known"));
        assert!(parse(&arguments("list --limit many")).unwrap_err().contains("whole number"));
        assert!(parse(&arguments("replay --repeat 0")).unwrap_err().contains("1 or more"));
        assert!(parse(&arguments("list --replays --only-replays")).unwrap_err().contains("together"));
        assert!(parse(&arguments("list --unfinished --state failed")).unwrap_err().contains("together"));
        assert!(parse(&arguments("list --format yaml")).unwrap_err().contains("not known"));
        assert!(parse(&arguments("list --colour")).unwrap_err().contains("not known"));
    }
}
