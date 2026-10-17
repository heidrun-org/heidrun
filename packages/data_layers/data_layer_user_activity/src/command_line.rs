//! The arguments of the command line `data_layer_user_activity`.

use data_layer_user_activity::SynchronizationMode;

/// The text of the option `--help`.
pub const HELP: &str = r#"Usage: data_layer_user_activity <command> [options]

Reads the user activity records of the developer from the file "user_activity.jsonl",
and writes them in the table "user_activity_records" of a SQLite file. A user activity
record is one active period of the developer in front of Heidrun, in one workspace.
Each row holds the record as JSON in the column "data". The times are in UTC.
The command never writes the file of the records.

Commands:
  initialize                 Read every line of the file, and write all the rows.
  update                     Read only the records that ended after the latest end
                             that the database holds. When the table is empty, read
                             everything.
  query <sql>                Run one SQL statement on the database, and print the
                             rows. The database is open read only, so a statement
                             that writes fails. The column "data" holds JSON: use
                             json_extract(data, '$.field').

Options:
  --database <path>          The SQLite file.
                             (default: "data_layer.sqlite" in HEIDRUN_DIR, or
                             "~/.config/heidrun/data_layer.sqlite")
  --file <path>              The file of the user activity records. For initialize
                             and update.
                             (default: "user_activity.jsonl" in the folder of the
                             variable HEIDRUN_DIR, or else in "~/.config/heidrun")
  --verbose                  Print the progress on the standard error output: each
                             line that is skipped, the number of records, and each
                             write. For initialize and update.
  --json                     Print the rows as a JSON list, and not as a text table.
                             For query.
  -h, --help                 Print this help.

Exit codes:
  0   The command worked. A file that does not exist, and a line that is not a valid
      record, are not errors: the report says it.
  1   An error happened. The message is on the standard error output.

Examples:
  $ data_layer_user_activity initialize
  $ data_layer_user_activity update --verbose
  $ data_layer_user_activity query "SELECT workspaceFolder, startedAt, endedAt FROM user_activity_records ORDER BY endedAt DESC LIMIT 5"
  $ data_layer_user_activity query --json "SELECT count(*) AS count FROM user_activity_records WHERE endedAt > '2026-10-14T00:00:00.000Z' AND startedAt < '2026-10-15T00:00:00.000Z'"
"#;

/// What the arguments ask for.
#[derive(Debug, PartialEq)]
pub enum Parsed {
    /// Print the help text.
    Help,
    /// Run the mode initialize or the mode update.
    Synchronize(SynchronizationRequest),
    /// Run one read-only SQL statement.
    Query(QueryRequest),
}

/// The request to run the mode initialize or the mode update.
#[derive(Debug, PartialEq)]
pub struct SynchronizationRequest {
    /// The mode to run.
    pub mode: SynchronizationMode,
    /// The path of the SQLite file, or `None` for the default path.
    pub database: Option<String>,
    /// The path of the file of the user activity records, or `None` for the default path.
    pub file: Option<String>,
    /// True when the command prints its progress on the standard error output.
    pub verbose: bool,
}

/// The request to run one read-only SQL statement.
#[derive(Debug, PartialEq)]
pub struct QueryRequest {
    /// The path of the SQLite file, or `None` for the default path.
    pub database: Option<String>,
    /// True when the command prints the rows as a JSON list.
    pub json: bool,
    /// The text of the SQL statement.
    pub sql: String,
}

/// The value of the option `name`: the text after the sign `=`, or else the next argument.
fn value_of<'a>(name: &str, inline: Option<String>, rest: &mut impl Iterator<Item = &'a String>) -> Result<String, String> {
    match inline {
        Some(value) => Ok(value),
        None => rest.next().cloned().ok_or_else(|| format!("The option {name} needs a value.")),
    }
}

/// Reads the arguments of the command line, without the name of the program.
///
/// # Errors
/// An unknown command or option, an option without a value, an option that the command does not accept, a missing command,
/// or a wrong number of arguments.
pub fn parse(arguments: &[String]) -> Result<Parsed, String> {
    let mut database = None;
    let mut file = None;
    let mut verbose = false;
    let mut json = false;
    let mut positionals: Vec<String> = Vec::new();
    let mut options_ended = false;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if options_ended || !argument.starts_with('-') || argument == "-" {
            positionals.push(argument.clone());
            continue;
        }
        let (name, inline) = match argument.split_once('=') {
            Some((name, value)) => (name.to_string(), Some(value.to_string())),
            None => (argument.clone(), None),
        };
        match name.as_str() {
            "--" => options_ended = true,
            "-h" | "--help" => return Ok(Parsed::Help),
            "--database" => database = Some(value_of("--database", inline, &mut rest)?),
            "--file" => file = Some(value_of("--file", inline, &mut rest)?),
            "--verbose" => verbose = true,
            "--json" => json = true,
            _ => return Err(format!("The option {name} is not known. Run with --help.")),
        }
    }
    let mut positionals = positionals.into_iter();
    let command = positionals.next().ok_or("A command is needed: initialize, update, or query. Run with --help.")?;
    let mode = match command.as_str() {
        "initialize" => Some(SynchronizationMode::Initialize),
        "update" => Some(SynchronizationMode::Update),
        "query" => None,
        _ => return Err(format!("The command {command} is not known: use initialize, update, or query.")),
    };
    match mode {
        Some(mode) => {
            if json {
                return Err(format!("The option --json is for the command query only, and not for {command}."));
            }
            if let Some(extra) = positionals.next() {
                return Err(format!("The command {command} takes no argument, and got {extra}."));
            }
            Ok(Parsed::Synchronize(SynchronizationRequest { mode, database, file, verbose }))
        }
        None => {
            if file.is_some() || verbose {
                return Err("The options --file and --verbose are for initialize and update, and not for query.".to_string());
            }
            let sql = positionals.next().ok_or("The command query needs one SQL statement, written in quotes.")?;
            if let Some(extra) = positionals.next() {
                return Err(format!("The command query takes one SQL statement, and got more: {extra}. Put the statement in quotes."));
            }
            Ok(Parsed::Query(QueryRequest { database, json, sql }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The arguments as owned texts.
    fn arguments(texts: &[&str]) -> Vec<String> {
        texts.iter().map(|text| text.to_string()).collect()
    }

    #[test]
    fn reads_initialize_and_update_with_their_options() {
        assert_eq!(
            parse(&arguments(&["initialize", "--database", "a.sqlite", "--file=records.jsonl", "--verbose"])),
            Ok(Parsed::Synchronize(SynchronizationRequest {
                mode: SynchronizationMode::Initialize,
                database: Some("a.sqlite".into()),
                file: Some("records.jsonl".into()),
                verbose: true,
            }))
        );
        assert_eq!(
            parse(&arguments(&["update"])),
            Ok(Parsed::Synchronize(SynchronizationRequest {
                mode: SynchronizationMode::Update,
                database: None,
                file: None,
                verbose: false,
            }))
        );
    }

    #[test]
    fn reads_query_with_its_statement_and_its_options_before_or_after_the_statement() {
        let expected = Parsed::Query(QueryRequest { database: Some("a.sqlite".into()), json: true, sql: "SELECT 1".into() });
        assert_eq!(parse(&arguments(&["query", "--json", "--database", "a.sqlite", "SELECT 1"])), Ok(expected));
        assert_eq!(
            parse(&arguments(&["query", "SELECT 1", "--json", "--database=a.sqlite"])),
            Ok(Parsed::Query(QueryRequest { database: Some("a.sqlite".into()), json: true, sql: "SELECT 1".into() }))
        );
    }

    #[test]
    fn reads_a_statement_that_starts_with_a_dash_after_the_two_dashes() {
        assert_eq!(
            parse(&arguments(&["query", "--", "-- a comment\nSELECT 1"])),
            Ok(Parsed::Query(QueryRequest { database: None, json: false, sql: "-- a comment\nSELECT 1".into() }))
        );
    }

    #[test]
    fn reads_the_help_option_in_any_place() {
        assert_eq!(parse(&arguments(&["--help"])), Ok(Parsed::Help));
        assert_eq!(parse(&arguments(&["update", "-h"])), Ok(Parsed::Help));
    }

    #[test]
    fn refuses_a_missing_or_an_unknown_command() {
        assert!(parse(&arguments(&[])).unwrap_err().contains("A command is needed"));
        assert!(parse(&arguments(&["fetch"])).unwrap_err().contains("fetch"));
    }

    #[test]
    fn refuses_an_unknown_option_and_an_option_without_a_value() {
        assert!(parse(&arguments(&["update", "--fast"])).unwrap_err().contains("--fast"));
        assert!(parse(&arguments(&["update", "--database"])).unwrap_err().contains("needs a value"));
        assert!(parse(&arguments(&["update", "--file"])).unwrap_err().contains("needs a value"));
    }

    #[test]
    fn refuses_an_option_that_the_command_does_not_accept() {
        assert!(parse(&arguments(&["update", "--json"])).unwrap_err().contains("--json"));
        assert!(parse(&arguments(&["query", "--verbose", "SELECT 1"])).unwrap_err().contains("--verbose"));
        assert!(parse(&arguments(&["query", "--file", "a.jsonl", "SELECT 1"])).unwrap_err().contains("--file"));
    }

    #[test]
    fn refuses_a_wrong_number_of_arguments() {
        assert!(parse(&arguments(&["update", "now"])).unwrap_err().contains("takes no argument"));
        assert!(parse(&arguments(&["query"])).unwrap_err().contains("needs one SQL statement"));
        assert!(parse(&arguments(&["query", "SELECT", "1"])).unwrap_err().contains("in quotes"));
    }
}
