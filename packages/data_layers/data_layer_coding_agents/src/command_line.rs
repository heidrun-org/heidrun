//! The arguments of the command line `data_layer_coding_agents`.

use data_layer_coding_agents::SynchronizationMode;

/// The text of the option `--help`.
pub const HELP: &str = r#"Usage: data_layer_coding_agents <command> [options]

Reads the chat sessions that Claude Code and Codex saved for a repository, and the
configuration of the coding agent, and writes them in a SQLite file. The table
"chat_sessions" has one row for each chat session, with its facts as JSON. Four link
tables hold what each chat session is linked to: "chat_session_folders",
"chat_session_issues", "chat_session_pull_requests", and "chat_session_files".

The configuration of the coding agent has three tables, with one row for each memory
file, subagent, or skill: "memory_files", "subagents", and "skills". The column "id"
is the absolute path, so it joins the column "path" of "chat_session_files". A row
whose file is gone stays, with the date of the removal in "removedAt".

Commands:
  initialize                 Read every chat session since the beginning.
  update                     Read only the chat sessions whose file changed since
                             the last read. When the table is empty, read
                             everything. Both commands read the whole
                             configuration of the coding agent.
  query <sql>                Run one SQL statement on the database, and print the
                             rows. The database is open read only, so a statement
                             that writes fails. The column "data" holds JSON: use
                             json_extract(data, '$.field').

Options:
  --database <path>          The SQLite file.
                             (default: "~/.config/heidrun/data_layer.sqlite")
  --folder <path>            A folder of the repository. The command finds the root
                             of the repository from it. For initialize and update.
                             (default: the current folder)
  --repository <owner/name>  The name of the repository, for the column "repository".
                             For initialize and update.
                             (default: the remote "origin" of the repository)
  --verbose                  Print the progress on the standard error output. For
                             initialize and update.
  --json                     Print the rows as a JSON list, and not as a text table.
                             For query.
  -h, --help                 Print this help.

The folders of the chat sessions are "~/.claude" (or the variable CLAUDE_CONFIG_DIR)
and "~/.codex" (or the variable CODEX_HOME). The skills are also read in "~/.agents",
and in the folders ".claude" and ".agents" of the repository.

Exit codes:
  0   The command worked.
  1   An error happened. The message is on the standard error output.

Examples:
  $ data_layer_coding_agents initialize
  $ data_layer_coding_agents update --verbose
  $ data_layer_coding_agents query "SELECT id, json_extract(data, '$.title') AS title FROM chat_sessions LIMIT 5"
  $ data_layer_coding_agents query --json "SELECT count(*) AS count FROM chat_session_issues"
  $ data_layer_coding_agents query "SELECT json_extract(data, '$.name') AS name FROM skills"
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
    /// A folder of the repository, or `None` for the current folder.
    pub folder: Option<String>,
    /// The repository in the format `owner/name`, or `None` for the remote `origin` of the repository.
    pub repository: Option<String>,
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
    let mut folder = None;
    let mut repository = None;
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
            "--folder" => folder = Some(value_of("--folder", inline, &mut rest)?),
            "--repository" => repository = Some(value_of("--repository", inline, &mut rest)?),
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
            Ok(Parsed::Synchronize(SynchronizationRequest { mode, database, folder, repository, verbose }))
        }
        None => {
            if folder.is_some() || repository.is_some() || verbose {
                return Err(
                    "The options --folder, --repository, and --verbose are for initialize and update, and not for query."
                        .to_string(),
                );
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
            parse(&arguments(&["initialize", "--database", "a.sqlite", "--repository=owner/name", "--folder", "/work", "--verbose"])),
            Ok(Parsed::Synchronize(SynchronizationRequest {
                mode: SynchronizationMode::Initialize,
                database: Some("a.sqlite".into()),
                folder: Some("/work".into()),
                repository: Some("owner/name".into()),
                verbose: true,
            }))
        );
        assert_eq!(
            parse(&arguments(&["update"])),
            Ok(Parsed::Synchronize(SynchronizationRequest {
                mode: SynchronizationMode::Update,
                database: None,
                folder: None,
                repository: None,
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
        assert!(parse(&arguments(&["update", "--folder"])).unwrap_err().contains("needs a value"));
    }

    #[test]
    fn refuses_an_option_that_the_command_does_not_accept() {
        assert!(parse(&arguments(&["update", "--json"])).unwrap_err().contains("--json"));
        assert!(parse(&arguments(&["query", "--verbose", "SELECT 1"])).unwrap_err().contains("--verbose"));
        assert!(parse(&arguments(&["query", "--repository", "a/b", "SELECT 1"])).unwrap_err().contains("--repository"));
        assert!(parse(&arguments(&["query", "--folder", "/a", "SELECT 1"])).unwrap_err().contains("--folder"));
    }

    #[test]
    fn refuses_a_wrong_number_of_arguments() {
        assert!(parse(&arguments(&["update", "now"])).unwrap_err().contains("takes no argument"));
        assert!(parse(&arguments(&["query"])).unwrap_err().contains("needs one SQL statement"));
        assert!(parse(&arguments(&["query", "SELECT", "1"])).unwrap_err().contains("in quotes"));
    }
}
