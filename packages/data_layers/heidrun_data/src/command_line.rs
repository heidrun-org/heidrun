//! The arguments of the command line `heidrun_data`, and the texts of its help.

use heidrun_data::{Format, Source, SynchronizationMode, DEFAULT_LIMIT};

/// The text of `heidrun_data --help`.
pub const HELP: &str = r#"Usage: heidrun_data <command> [options]

Gives a coding agent the data of the four data layers of Heidrun, in one SQLite file:
  source_control   the commits of the Git repository         (table commits)
  code_hosting     the issues and the pull requests of GitHub (tables issues, pull_requests)
  chat_sessions    the chat sessions of Claude Code and Codex (table chat_sessions and
                   the link tables chat_session_folders, chat_session_issues,
                   chat_session_pull_requests, chat_session_files)
  user_activity    the active periods of the developer        (table user_activity_records)

Commands:
  sources                    Print the four sources, their tables, the number of rows
                             of each table, and when each source was last updated.
  update [<source>...]       Read what is new in every source, or in the sources given.
  initialize [<source>...]   Read every source since the beginning, or the sources
                             given.
  schema [<table>]           Print the tables, their columns, their primary keys, the
                             joins of the link tables, and the JSON schema of the
                             column "data". With a table, print that JSON schema.
  query <sql>                Run one read-only SQL statement on the SQLite file. The
                             column "data" holds JSON: use json_extract(data, '$.field').

Options of every command:
  --database <path>          The SQLite file.
                             (default: "~/.config/heidrun/data_layer.sqlite")
  --format <name>            The format of the output: jsonl, json, or table, and
                             sql for the command schema.
                             (default: jsonl when the standard output is not a
                             terminal, table when it is)
  --json                     The same as --format json.
  --verbose                  Print the progress on the standard error output.
  -h, --help                 Print the help. "heidrun_data <command> --help" prints the
                             options of that command.

Output:
  jsonl   One JSON object per line. An error is one JSON object on one line on the
          standard error output, with the fields "error" and, when one source failed,
          "source".
  json    One JSON list. The errors are the same as with jsonl.
  table   A text table for a person. An error is the text "Error: ...".

Exit codes:
  0   The command worked.
  1   An error happened, or at least one source failed. The message is on the
      standard error output.

Examples:
  $ heidrun_data sources --format jsonl
  $ heidrun_data update --format jsonl
  $ heidrun_data update chat_sessions code_hosting --format jsonl
  $ heidrun_data schema --format jsonl
  $ heidrun_data schema chat_sessions
  $ heidrun_data query --format jsonl "SELECT json_extract(data, '$.subject') AS subject FROM commits ORDER BY committedAt DESC LIMIT 5"
"#;

/// The text of `heidrun_data sources --help`.
pub const SOURCES_HELP: &str = r#"Usage: heidrun_data sources [options]

Prints one row per source: its tables with the number of rows of each one, and the date
of the last update of the source. The date is the largest "committedAt" of the commits,
"updatedAt" of the issues, the pull requests, and the chat sessions, and "endedAt" of
the user activity records. When the SQLite file does not exist, every table has 0 rows,
and the file is not created.

Options:
  --database <path>          The SQLite file.
                             (default: "~/.config/heidrun/data_layer.sqlite")
  --format <name>            jsonl, json, or table. With table, one row per table.
  --json                     The same as --format json.
  --verbose                  Print the path of the SQLite file on the standard error
                             output.
  -h, --help                 Print this help.

Examples:
  $ heidrun_data sources --format jsonl
  $ heidrun_data sources --format table
"#;

/// The text of `heidrun_data schema --help`.
pub const SCHEMA_HELP: &str = r#"Usage: heidrun_data schema [<table>] [options]

With no table, prints one row per table of the SQLite file: its source, its columns,
its primary key, the name of the JSON schema of its column "data", and, for a link
table, the tables that it joins and the columns that join them. Read it before you
write SQL, so that you never guess a column or a join.

With a table, prints the JSON schema of the column "data" of that table, as the data
layer package holds it: the fields, their types, and the description of each field.
The output is the text of the JSON schema file, whatever the format.

The tables and the columns come from the four data layer packages, so the command
needs no SQLite file.

Options:
  --format <name>            jsonl, json, table, or sql. With sql, prints the CREATE
                             TABLE statements.
  --json                     The same as --format json.
  --database <path>          Not used: the shape comes from the packages.
  --verbose                  Not used.
  -h, --help                 Print this help.

Examples:
  $ heidrun_data schema --format jsonl
  $ heidrun_data schema --format sql
  $ heidrun_data schema commits
  $ heidrun_data schema chat_sessions
"#;

/// The text of `heidrun_data update --help` and of `heidrun_data initialize --help`.
pub const SYNCHRONIZATION_HELP: &str = r#"Usage: heidrun_data update [<source>...] [options]
       heidrun_data initialize [<source>...] [options]

update reads only what is new in each source. initialize reads each source since the
beginning. With no source, both read the four sources. The sources always run in this
order, whatever the order of the arguments: source_control, code_hosting,
chat_sessions, user_activity.

A source that fails does not stop the others. The command prints one report row for
each source that worked, with the number of rows written in each table, and one error
on the standard error output for each source that failed. It exits with the code 1 when
at least one source failed.

The sources:
  source_control             Needs the command git.
  code_hosting               Needs the command gh, signed in.
  chat_sessions              Reads the folders of Claude Code and of Codex.
  user_activity              Reads the file of the user activity records.

Options:
  --database <path>          The SQLite file. It is created when it does not exist.
                             (default: "~/.config/heidrun/data_layer.sqlite")
  --repository <owner/name>  The name of the repository. For source_control,
                             code_hosting, and chat_sessions.
                             (default: the remote "origin" of the folder)
  --folder <path>            The folder of the Git repository, or a folder inside it.
                             For source_control, code_hosting, and chat_sessions.
                             (default: the current folder)
  --file <path>              The file of the user activity records. For user_activity.
                             (default: "user_activity.jsonl" in the folder of the
                             variable HEIDRUN_DIR, or else in "~/.config/heidrun")
  --format <name>            jsonl, json, or table.
  --json                     The same as --format json.
  --verbose                  Print the progress of each source on the standard error
                             output.
  -h, --help                 Print this help.

An option that a source does not use is not an error: the other sources use it.

Examples:
  $ heidrun_data update --format jsonl
  $ heidrun_data update chat_sessions --format jsonl
  $ heidrun_data initialize source_control --verbose --format jsonl
"#;

/// The text of `heidrun_data query --help`.
pub const QUERY_HELP: &str = r#"Usage: heidrun_data query <sql> [options]

Runs one SQL statement on the SQLite file, and prints the rows. The file is open read
only, so a statement that writes fails, and a query never creates the file. The column
"data" of every table holds JSON: use json_extract(data, '$.field'). When <sql> is "-",
the statement is read from the standard input.

A SELECT, WITH, or VALUES statement that has no LIMIT gets "LIMIT <count>" at its end.

Options:
  --limit <count>            The limit added to a statement that has none. 0 adds no
                             limit. (default: 1000)
  --database <path>          The SQLite file.
                             (default: "~/.config/heidrun/data_layer.sqlite")
  --format <name>            jsonl, json, or table.
  --json                     The same as --format json.
  --verbose                  Print the path of the SQLite file and the statement that
                             runs on the standard error output.
  -h, --help                 Print this help.

Examples:
  $ heidrun_data query --format jsonl "SELECT hash, json_extract(data, '$.subject') AS subject FROM commits ORDER BY committedAt DESC LIMIT 5"
  $ heidrun_data query --format jsonl "SELECT number, json_extract(data, '$.title') AS title FROM issues WHERE json_extract(data, '$.state') = 'OPEN'"
  $ echo "SELECT count(*) AS count FROM chat_sessions" | heidrun_data query - --format jsonl
"#;

/// The options of every command.
#[derive(Debug, PartialEq, Default)]
pub struct CommonOptions {
    /// The path of the SQLite file, or `None` for the default path.
    pub database: Option<String>,
    /// The format of the output, or `None` for the default of the standard output.
    pub format: Option<Format>,
    /// True when the command prints its progress on the standard error output.
    pub verbose: bool,
}

/// What the arguments ask for.
#[derive(Debug, PartialEq)]
pub enum Parsed {
    /// Print a help text.
    Help(&'static str),
    /// Print the four sources.
    Sources(CommonOptions),
    /// Run the mode initialize or the mode update.
    Synchronize(SynchronizationRequest),
    /// Print the shape of the tables, or the JSON schema of one table.
    Schema(SchemaRequest),
    /// Run one read-only SQL statement.
    Query(QueryRequest),
}

/// The request to print the shape of the tables.
#[derive(Debug, PartialEq)]
pub struct SchemaRequest {
    /// The options of every command.
    pub common: CommonOptions,
    /// The table whose JSON schema to print, or `None` to print every table.
    pub table: Option<String>,
}

/// The request to run the mode initialize or the mode update.
#[derive(Debug, PartialEq)]
pub struct SynchronizationRequest {
    /// The mode to run.
    pub mode: SynchronizationMode,
    /// The sources to read, in the fixed order. Every source when no source is given.
    pub sources: Vec<Source>,
    /// The options of every command.
    pub common: CommonOptions,
    /// The name of the repository in the format `owner/name`, or `None` for the remote `origin` of the folder.
    pub repository: Option<String>,
    /// The folder of the Git repository, or `None` for the current folder.
    pub folder: Option<String>,
    /// The file of the user activity records, or `None` for the default file.
    pub file: Option<String>,
}

/// The request to run one read-only SQL statement.
#[derive(Debug, PartialEq)]
pub struct QueryRequest {
    /// The options of every command.
    pub common: CommonOptions,
    /// The limit added to a statement that has none. 0 adds no limit.
    pub limit: u64,
    /// The text of the SQL statement, or `-` to read it from the standard input.
    pub sql: String,
}

/// The value of the option `name`: the text after the sign `=`, or else the next argument.
fn value_of<'a>(name: &str, inline: Option<String>, rest: &mut impl Iterator<Item = &'a String>) -> Result<String, String> {
    match inline {
        Some(value) => Ok(value),
        None => rest.next().cloned().ok_or_else(|| format!("The option {name} needs a value.")),
    }
}

/// The format of a name, or an error that lists the three names.
fn format_of(name: &str) -> Result<Format, String> {
    Format::from_name(name).ok_or_else(|| format!("The format {name} is not known: use jsonl, json, or table, or sql for the command schema."))
}

/// The format that the arguments ask for, read without the other checks, so that an error of the arguments is written in
/// that format too. `None` when no valid format is given.
pub fn find_format(arguments: &[String]) -> Option<Format> {
    let mut format = None;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if argument == "--" {
            break;
        }
        if argument == "--json" {
            format = Some(Format::Json);
        } else if argument == "--format" {
            format = rest.next().and_then(|name| Format::from_name(name)).or(format);
        } else if let Some(name) = argument.strip_prefix("--format=") {
            format = Format::from_name(name).or(format);
        }
    }
    format
}

/// Reads the arguments of the command line, without the name of the program.
///
/// # Errors
/// An unknown command, source, option, or format, an option without a value, an option that the command does not accept,
/// a missing command, or a wrong number of arguments.
pub fn parse(arguments: &[String]) -> Result<Parsed, String> {
    let mut common = CommonOptions::default();
    let mut repository = None;
    let mut folder = None;
    let mut file = None;
    let mut limit = None;
    let mut is_help = false;
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
            "-h" | "--help" => is_help = true,
            "--database" => common.database = Some(value_of("--database", inline, &mut rest)?),
            "--format" => {
                let format = format_of(&value_of("--format", inline, &mut rest)?)?;
                if common.format.is_some_and(|other| other != format) {
                    return Err("The options --format and --json ask for two different formats.".to_string());
                }
                common.format = Some(format);
            }
            "--json" => {
                if common.format.is_some_and(|other| other != Format::Json) {
                    return Err("The options --format and --json ask for two different formats.".to_string());
                }
                common.format = Some(Format::Json);
            }
            "--verbose" => common.verbose = true,
            "--repository" => repository = Some(value_of("--repository", inline, &mut rest)?),
            "--folder" => folder = Some(value_of("--folder", inline, &mut rest)?),
            "--file" => file = Some(value_of("--file", inline, &mut rest)?),
            "--limit" => {
                let text = value_of("--limit", inline, &mut rest)?;
                let count = text.parse::<u64>().map_err(|_| format!("The option --limit needs a whole number, and got {text}."))?;
                limit = Some(count);
            }
            _ => return Err(format!("The option {name} is not known. Run with --help.")),
        }
    }
    let mut positionals = positionals.into_iter();
    let Some(command) = positionals.next() else {
        if is_help {
            return Ok(Parsed::Help(HELP));
        }
        return Err("A command is needed: sources, update, initialize, schema, or query. Run with --help.".to_string());
    };
    let mode = match command.as_str() {
        "update" => Some(SynchronizationMode::Update),
        "initialize" => Some(SynchronizationMode::Initialize),
        "query" | "sources" | "schema" => None,
        _ if is_help => return Ok(Parsed::Help(HELP)),
        _ => {
            return Err(format!("The command {command} is not known: use sources, update, initialize, schema, or query."));
        }
    };
    if is_help {
        return Ok(Parsed::Help(match command.as_str() {
            "query" => QUERY_HELP,
            "sources" => SOURCES_HELP,
            "schema" => SCHEMA_HELP,
            _ => SYNCHRONIZATION_HELP,
        }));
    }
    if common.format == Some(Format::Sql) && command != "schema" {
        return Err(format!("The format sql is for the command schema only, and not for {command}."));
    }
    let synchronization_options = [("--repository", repository.is_some()), ("--folder", folder.is_some()), ("--file", file.is_some())];
    if let Some(mode) = mode {
        if limit.is_some() {
            return Err(format!("The option --limit is for the command query only, and not for {command}."));
        }
        let mut sources = Vec::new();
        for name in positionals {
            let source = Source::from_name(&name).ok_or_else(|| {
                format!("The source {name} is not known: use source_control, code_hosting, chat_sessions, or user_activity.")
            })?;
            sources.push(source);
        }
        let sources = if sources.is_empty() { Source::ALL.to_vec() } else { Source::in_fixed_order(&sources) };
        return Ok(Parsed::Synchronize(SynchronizationRequest { mode, sources, common, repository, folder, file }));
    }
    if let Some((option, _)) = synchronization_options.iter().find(|(_, is_given)| *is_given) {
        return Err(format!("The option {option} is for update and initialize, and not for {command}."));
    }
    if command == "schema" {
        if limit.is_some() {
            return Err("The option --limit is for the command query only, and not for schema.".to_string());
        }
        let table = positionals.next();
        if let Some(extra) = positionals.next() {
            return Err(format!("The command schema takes at most one table, and got more: {extra}."));
        }
        if table.is_some() && common.format == Some(Format::Sql) {
            return Err("The format sql prints every table: give no table with it.".to_string());
        }
        return Ok(Parsed::Schema(SchemaRequest { common, table }));
    }
    if command == "sources" {
        if limit.is_some() {
            return Err("The option --limit is for the command query only, and not for sources.".to_string());
        }
        if let Some(extra) = positionals.next() {
            return Err(format!("The command sources takes no argument, and got {extra}."));
        }
        return Ok(Parsed::Sources(common));
    }
    let sql = positionals.next().ok_or("The command query needs one SQL statement, written in quotes, or - for the standard input.")?;
    if let Some(extra) = positionals.next() {
        return Err(format!("The command query takes one SQL statement, and got more: {extra}. Put the statement in quotes."));
    }
    Ok(Parsed::Query(QueryRequest { common, limit: limit.unwrap_or(DEFAULT_LIMIT), sql }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The arguments as owned texts.
    fn arguments(texts: &[&str]) -> Vec<String> {
        texts.iter().map(|text| text.to_string()).collect()
    }

    #[test]
    fn reads_update_with_every_source_when_no_source_is_given() {
        assert_eq!(
            parse(&arguments(&["update"])),
            Ok(Parsed::Synchronize(SynchronizationRequest {
                mode: SynchronizationMode::Update,
                sources: Source::ALL.to_vec(),
                common: CommonOptions::default(),
                repository: None,
                folder: None,
                file: None,
            }))
        );
    }

    #[test]
    fn reads_initialize_with_its_sources_in_the_fixed_order_and_its_options() {
        assert_eq!(
            parse(&arguments(&[
                "initialize",
                "user_activity",
                "--database=a.sqlite",
                "chat_sessions",
                "--repository",
                "owner/name",
                "--folder",
                "/a/folder",
                "--file",
                "a.jsonl",
                "--format",
                "table",
                "--verbose",
            ])),
            Ok(Parsed::Synchronize(SynchronizationRequest {
                mode: SynchronizationMode::Initialize,
                sources: vec![Source::ChatSessions, Source::UserActivity],
                common: CommonOptions { database: Some("a.sqlite".into()), format: Some(Format::Table), verbose: true },
                repository: Some("owner/name".into()),
                folder: Some("/a/folder".into()),
                file: Some("a.jsonl".into()),
            }))
        );
    }

    #[test]
    fn reads_query_with_its_limit_and_the_default_limit() {
        assert_eq!(
            parse(&arguments(&["query", "SELECT 1", "--limit", "0", "--format=jsonl"])),
            Ok(Parsed::Query(QueryRequest {
                common: CommonOptions { database: None, format: Some(Format::Jsonl), verbose: false },
                limit: 0,
                sql: "SELECT 1".into(),
            }))
        );
        assert_eq!(
            parse(&arguments(&["query", "-", "--json"])),
            Ok(Parsed::Query(QueryRequest {
                common: CommonOptions { database: None, format: Some(Format::Json), verbose: false },
                limit: DEFAULT_LIMIT,
                sql: "-".into(),
            }))
        );
    }

    #[test]
    fn reads_sources() {
        assert_eq!(
            parse(&arguments(&["sources", "--database", "a.sqlite"])),
            Ok(Parsed::Sources(CommonOptions { database: Some("a.sqlite".into()), format: None, verbose: false }))
        );
    }

    #[test]
    fn reads_schema_with_or_without_a_table_and_the_format_sql_for_schema_only() {
        assert_eq!(
            parse(&arguments(&["schema", "--format", "sql"])),
            Ok(Parsed::Schema(SchemaRequest {
                common: CommonOptions { database: None, format: Some(Format::Sql), verbose: false },
                table: None,
            }))
        );
        assert_eq!(
            parse(&arguments(&["schema", "commits"])),
            Ok(Parsed::Schema(SchemaRequest { common: CommonOptions::default(), table: Some("commits".into()) }))
        );
        assert!(parse(&arguments(&["query", "SELECT 1", "--format", "sql"])).unwrap_err().contains("schema only"));
        assert!(parse(&arguments(&["schema", "commits", "--format", "sql"])).unwrap_err().contains("give no table"));
        assert!(parse(&arguments(&["schema", "commits", "issues"])).unwrap_err().contains("at most one table"));
        assert!(parse(&arguments(&["schema", "--limit", "3"])).unwrap_err().contains("--limit"));
    }

    #[test]
    fn reads_the_help_of_the_program_and_of_each_command() {
        assert_eq!(parse(&arguments(&["--help"])), Ok(Parsed::Help(HELP)));
        assert_eq!(parse(&arguments(&["-h", "unknown"])), Ok(Parsed::Help(HELP)));
        assert_eq!(parse(&arguments(&["update", "--help"])), Ok(Parsed::Help(SYNCHRONIZATION_HELP)));
        assert_eq!(parse(&arguments(&["initialize", "-h"])), Ok(Parsed::Help(SYNCHRONIZATION_HELP)));
        assert_eq!(parse(&arguments(&["query", "--help"])), Ok(Parsed::Help(QUERY_HELP)));
        assert_eq!(parse(&arguments(&["sources", "--help"])), Ok(Parsed::Help(SOURCES_HELP)));
        assert_eq!(parse(&arguments(&["schema", "--help"])), Ok(Parsed::Help(SCHEMA_HELP)));
    }

    #[test]
    fn refuses_a_missing_or_an_unknown_command_or_source() {
        assert!(parse(&arguments(&[])).unwrap_err().contains("A command is needed"));
        assert!(parse(&arguments(&["fetch"])).unwrap_err().contains("fetch"));
        assert!(parse(&arguments(&["update", "commits"])).unwrap_err().contains("The source commits is not known"));
    }

    #[test]
    fn refuses_an_unknown_option_format_or_limit() {
        assert!(parse(&arguments(&["update", "--fast"])).unwrap_err().contains("--fast"));
        assert!(parse(&arguments(&["update", "--format", "csv"])).unwrap_err().contains("csv"));
        assert!(parse(&arguments(&["update", "--format", "table", "--json"])).unwrap_err().contains("two different formats"));
        assert!(parse(&arguments(&["query", "SELECT 1", "--limit", "many"])).unwrap_err().contains("whole number"));
        assert!(parse(&arguments(&["update", "--database"])).unwrap_err().contains("needs a value"));
    }

    #[test]
    fn refuses_an_option_that_the_command_does_not_accept() {
        assert!(parse(&arguments(&["update", "--limit", "5"])).unwrap_err().contains("--limit"));
        assert!(parse(&arguments(&["sources", "--limit", "5"])).unwrap_err().contains("--limit"));
        assert!(parse(&arguments(&["query", "--folder", "a", "SELECT 1"])).unwrap_err().contains("--folder"));
        assert!(parse(&arguments(&["sources", "--repository", "a/b"])).unwrap_err().contains("--repository"));
        assert!(parse(&arguments(&["query", "--file", "a", "SELECT 1"])).unwrap_err().contains("--file"));
    }

    #[test]
    fn refuses_a_wrong_number_of_arguments() {
        assert!(parse(&arguments(&["sources", "now"])).unwrap_err().contains("takes no argument"));
        assert!(parse(&arguments(&["query"])).unwrap_err().contains("needs one SQL statement"));
        assert!(parse(&arguments(&["query", "SELECT", "1"])).unwrap_err().contains("in quotes"));
    }

    #[test]
    fn finds_the_format_before_the_other_checks() {
        assert_eq!(find_format(&arguments(&["fetch", "--format", "jsonl"])), Some(Format::Jsonl));
        assert_eq!(find_format(&arguments(&["--json", "--fast"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["--format=table"])), Some(Format::Table));
        assert_eq!(find_format(&arguments(&["update"])), None);
    }
}
