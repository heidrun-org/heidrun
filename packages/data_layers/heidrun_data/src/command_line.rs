//! The arguments of the command line `heidrun_data`, and the texts of its help.

use heidrun_data::{Format, Source, SynchronizationMode, DEFAULT_LIMIT};

/// The text of `heidrun_data --help`.
pub const HELP: &str = r#"Usage: heidrun_data <command> [options]

Gives a coding agent the data of the four data layers of Heidrun, in one SQLite file:
  source_control   the commits of the Git repository         (table commits)
  code_hosting     the issues and the pull requests of GitHub (tables issues, pull_requests)
  coding_agents    the chat sessions of Claude Code and Codex (table chat_sessions and
                   the link tables chat_session_folders, chat_session_issues,
                   chat_session_pull_requests, chat_session_files), the
                   configuration of the coding agent (tables memory_files,
                   subagents, skills), the tokens of each minute (table
                   token_usage_minutes, with the view token_usage_with_cost for
                   the estimated cost), and the model prices (tables
                   model_price_versions, model_prices)
  user_activity    the active periods of the developer        (table user_activity_records)

Commands:
  sources                    Print the four sources, their tables, the number of rows
                             of each table, and the newest date of each source.
  update [<source>...]       Read what is new in every source, or in the sources given.
  initialize [<source>...]   Read every source since the beginning, or the sources
                             given.
  schema [<table>]           Print the tables, their columns, their primary keys, the
                             joins of the link tables, and the JSON schema of the
                             column "data". With a table, print that JSON schema.
  query <sql>                Run one read-only SQL statement on the SQLite file. The
                             column "data" holds JSON: use json_extract(data, '$.field').
  usage                      Print the tokens and the estimated cost in US dollars of a
                             workspace in a time range, by minute, hour, or day. It
                             reads the SQLite file only.
  read <kind> <key>          Print the content of one thing from its source: a
                             chat_session, a commit, an issue, or a pull_request.
  requests <action>          Read the log of the requests that the data layer receives:
                             the usage patterns, the durations, the failures, and the
                             requests that never ended. Run recorded requests again
                             and measure what the log costs.

Options of every command:
  --database <path>          The SQLite file.
                             (default: "data_layer.sqlite" in HEIDRUN_DIR, or
                             "~/.config/heidrun/data_layer.sqlite")
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
  $ heidrun_data update coding_agents code_hosting --format jsonl
  $ heidrun_data schema --format jsonl
  $ heidrun_data schema chat_sessions
  $ heidrun_data query --format jsonl "SELECT json_extract(data, '$.subject') AS subject FROM commits ORDER BY committedAt DESC LIMIT 5"
  $ heidrun_data usage --by day --since 2026-09-14 --format jsonl
  $ heidrun_data read issue 500 --format jsonl
  $ heidrun_data requests summary --format jsonl
"#;

/// The text of `heidrun_data usage --help`.
pub const USAGE_HELP: &str = r#"Usage: heidrun_data usage [options]

Prints the tokens and the estimated cost of a workspace in a time range, one row per
period. It reads the SQLite file only and never a chat session file, so it is fast. The
tokens come from the table token_usage_minutes, which "update coding_agents" and
"initialize coding_agents" fill, and the cost comes from the view token_usage_with_cost.
When the token usage of the repository was never read, the command fails and says so.

A workspace is a folder: a chat session counts when it started in this folder or in a
folder below it, such as a worktree or a sub-folder, and it counts once.

A minute is the minute of the record that reports the tokens of a request. It is not a
measure of the generation of the tokens. The minutes and the hours are in UTC. A day is a
calendar day of the time zone, so it lasts 23 or 25 hours when the clock changes.

The cost is an estimate at the public price of each model (the price list of LiteLLM,
US dollars for one million tokens), at the latest version of the prices. It is not an
invoice, and not the payment of a subscription. A model without a known price has no
cost: "costUsd" is then null, or only the part of the models that have a price, and
"isCostComplete" is false. "unpricedTokens" counts the tokens without a known cost.

The rows: "periodStart" (UTC), "day" (by day only), "chatSessionId" (--by-chat only),
"freshInputTokens", "cachedInputTokens", "cacheWriteInputTokens", "outputTokens",
"totalTokens", "costUsd", "unpricedTokens", and "isCostComplete".

Options:
  --folder <path>            The folder of the workspace.
                             (default: the root of the Git repository of the current
                             folder)
  --repository <owner/name>  The repository.
                             (default: the remote "origin" of the folder)
  --since <date>             The start of the time range: a date YYYY-MM-DD, the start
                             of that day in the time zone, or a time in ISO 8601 with
                             its zone, such as 2026-10-14T08:30:00Z.
                             (default: 30 days before the end)
  --until <date>             The end of the time range, not included. The same forms.
                             (default: now)
  --by <name>                minute, hour, or day. (default: day)
  --time-zone <name>         The time zone that cuts the days and reads the dates, in
                             the IANA names such as Europe/Paris, or UTC.
                             (default: the time zone of the computer)
  --by-chat                  One row per chat session and per period.
  --database <path>          The SQLite file.
                             (default: "data_layer.sqlite" in HEIDRUN_DIR, or
                             "~/.config/heidrun/data_layer.sqlite")
  --format <name>            jsonl, json, or table.
  --json                     The same as --format json.
  --verbose                  Print when the token usage was read the last time.
  -h, --help                 Print this help.

Examples:
  $ heidrun_data usage --by day --since 2026-09-14 --until 2026-10-14 --format jsonl
  $ heidrun_data usage --by hour --since 2026-10-14 --time-zone UTC --format table
  $ heidrun_data usage --by-chat --by day --since 2026-10-01 --format jsonl
"#;

/// The text of `heidrun_data read --help`.
pub const READ_HELP: &str = r#"Usage: heidrun_data read <kind> <key> [options]

Prints the content of one thing, which the tables do not store, from its source. It
reads the source each time and writes nothing.

Kinds:
  chat_session <id>          The records of the chat session, one per line: "at",
                             "role" (developer, coding_agent, or tool), and "text". A
                             tool call is "<name>: <input>", and a tool result is
                             "result: <output>", each shortened to one line unless
                             --full is given. The id is the column "id" of the table
                             chat_sessions. Reads the files of Claude Code and of
                             Codex for the repository, its worktrees, and its
                             sub-folders.
  commit <hash>              The message, the files changed with their line counts,
                             then the diff. A merge is compared with its first parent.
                             Needs the command git.
  issue <number>             The body, then every comment with its author and its
                             date. Needs the command gh, signed in.
  pull_request <number>      The body, then every comment, review, and review comment
                             with its author, its date, and for a review comment its
                             file and its line, in the order of the dates, then the
                             diff. Needs the command gh, signed in.
  file_history <path>        Every tool call of a chat session that wrote the file, in
                             the order of the dates: "at", "chatSessionId", "tool"
                             (Write, Edit, Bash, apply_patch, ...), and "input". The
                             "old_string" and "new_string" of an Edit are the diff.
                             Reads the files of Claude Code and of Codex for the
                             repository, its worktrees, and its sub-folders.
                             Give the path as the coding agent wrote it, most often
                             absolute, for example the column "id" of the table
                             memory_files. A file name or a relative path matches
                             the end of the path, so it can also find another file
                             with the same name.
                             A shell command counts when it names the path and has
                             a sign of a write: ">", "sed -i", "tee", "mv", "cp",
                             "rm", 'w' or "w" (the mode of a Python open), or
                             "apply_patch". A change made by hand, outside a coding
                             agent, is not found.
                             The input is always printed in full, so --full is
                             refused. The format table prints each field of the
                             input on its own lines. It reads every chat session
                             file, so it can take some seconds.

Options:
  --repository <owner/name>  The repository of an issue or of a pull request.
                             (default: the remote "origin" of the folder)
  --folder <path>            The folder of the Git repository, or a folder inside it.
                             (default: the current folder)
  --full                     For chat_session: print the tool calls and the tool
                             results whole.
  --no-diff                  For commit and pull_request: print no diff.
  --format <name>            jsonl, json, or table.
  --json                     The same as --format json.
  --database <path>          Not used: read never opens the SQLite file.
  --verbose                  Not used.
  -h, --help                 Print this help.

Examples:
  $ heidrun_data read chat_session 0b7c2c5e-8f5d-4a59-9a43-0b6c1b1b2f10 --format jsonl
  $ heidrun_data read commit HEAD --no-diff --format jsonl
  $ heidrun_data read issue 500 --format jsonl
  $ heidrun_data read pull_request 565 --no-diff --format jsonl
  $ heidrun_data read file_history /Users/me/.claude/projects/-Users-me-app/memory/MEMORY.md --format table
"#;

/// The text of `heidrun_data sources --help`.
pub const SOURCES_HELP: &str = r#"Usage: heidrun_data sources [options]

Prints one row per source: its tables with the number of rows of each one, and the
newest date of the source ("lastUpdatedAt"). It is not the time of the last update
command. The date is the largest "committedAt" of the commits,
"updatedAt" of the issues, the pull requests, and the chat sessions, and "endedAt" of
the user activity records. When the SQLite file does not exist, every table has 0 rows,
and the file is not created.

Options:
  --database <path>          The SQLite file.
                             (default: "data_layer.sqlite" in HEIDRUN_DIR, or
                             "~/.config/heidrun/data_layer.sqlite")
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
coding_agents, user_activity.

A source that fails does not stop the others. The command prints one report row for
each source that worked, with the number of rows written in each table, and one error
on the standard error output for each source that failed. It exits with the code 1 when
at least one source failed.

The sources:
  source_control             Needs the command git.
  code_hosting               Needs the command gh, signed in.
  coding_agents              Reads the folders of Claude Code, of Codex, and
                             "~/.agents", and the folders ".claude" and ".agents"
                             of the repository. It writes the tokens of each minute
                             of the chat sessions that started in the repository or
                             below it, and then refreshes the model prices when the
                             latest version was checked a day ago or more. A price
                             list that cannot be fetched is a warning: the latest
                             known prices stay in use.
  user_activity              Reads the file of the user activity records.

Options:
  --database <path>          The SQLite file. It is created when it does not exist.
                             (default: "data_layer.sqlite" in HEIDRUN_DIR, or
                             "~/.config/heidrun/data_layer.sqlite")
  --repository <owner/name>  The name of the repository. For source_control,
                             code_hosting, and coding_agents.
                             (default: the remote "origin" of the folder)
  --folder <path>            The folder of the Git repository, or a folder inside it.
                             For source_control, code_hosting, and coding_agents.
                             (default: the current folder)
  --file <path>              The file of the user activity records. For user_activity.
                             (default: "user_activity.jsonl" in the folder of the
                             variable HEIDRUN_DIR, or else in "~/.config/heidrun")
  --price-list <address>     The web address, or the path of the file, of the price
                             list in the format of LiteLLM. For coding_agents.
                             (default: the public price list of LiteLLM)
  --refresh-prices           Fetch the price list even when the latest version was
                             checked less than a day ago. For coding_agents.
  --format <name>            jsonl, json, or table.
  --json                     The same as --format json.
  --verbose                  Print the progress of each source on the standard error
                             output, and a line when the command waits for the lock
                             of the SQLite file.
  -h, --help                 Print this help.

An option that a source does not use is not an error: the other sources use it.

Examples:
  $ heidrun_data update --format jsonl
  $ heidrun_data update coding_agents --format jsonl
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
                             (default: "data_layer.sqlite" in HEIDRUN_DIR, or
                             "~/.config/heidrun/data_layer.sqlite")
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
    /// Print the content of one thing from its source.
    Read(ReadRequest),
    /// Print the tokens and the estimated cost of a workspace in a time range.
    Usage(UsageCommand),
    /// Read the log of the requests of the data layer, run recorded requests again, or measure the cost of the log.
    Requests(crate::requests_command_line::RequestsCommand),
}

/// The request to print the tokens and the estimated cost of a workspace.
#[derive(Debug, PartialEq)]
pub struct UsageCommand {
    /// The options of every command.
    pub common: CommonOptions,
    /// The repository in the format `owner/name`, or `None` for the remote `origin` of the folder.
    pub repository: Option<String>,
    /// The folder of the workspace, or `None` for the root of the Git repository of the current folder.
    pub folder: Option<String>,
    /// The start of the time range, or `None` for 30 days before its end.
    pub since: Option<String>,
    /// The end of the time range, or `None` for now.
    pub until: Option<String>,
    /// The name of the grouping: `minute`, `hour`, or `day`.
    pub by: String,
    /// The name of the time zone, or `None` for the time zone of the computer.
    pub time_zone: Option<String>,
    /// True for one row per chat session and per period.
    pub is_by_chat: bool,
}

/// The kind of the thing that `read` prints.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadKind {
    /// A chat session of Claude Code or of Codex.
    ChatSession,
    /// A commit of the Git repository.
    Commit,
    /// An issue of the GitHub repository.
    Issue,
    /// A pull request of the GitHub repository.
    PullRequest,
    /// The tool calls of the chat sessions that wrote one file.
    FileHistory,
}

/// The request to print the content of one thing.
#[derive(Debug, PartialEq)]
pub struct ReadRequest {
    /// The options of every command.
    pub common: CommonOptions,
    /// The kind of the thing.
    pub kind: ReadKind,
    /// The key of the thing: the id of a chat session, the hash of a commit, the number of an issue or a pull request, or
    /// the path of a file.
    pub key: String,
    /// The repository of an issue or of a pull request, or `None` for the remote `origin` of the folder.
    pub repository: Option<String>,
    /// The folder of the Git repository, or `None` for the current folder.
    pub folder: Option<String>,
    /// True when the tool calls and the tool results of a chat session are printed whole.
    pub is_full: bool,
    /// True when the diff of a commit or of a pull request is printed.
    pub has_diff: bool,
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
    /// The web address, or the path of the file, of the price list, or `None` for the public price list.
    pub price_list: Option<String>,
    /// True to fetch the price list even when the latest version of the prices is fresh.
    pub is_price_refresh_forced: bool,
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
    if arguments.first().map(String::as_str) == Some("requests") {
        return crate::requests_command_line::parse(&arguments[1..]);
    }
    let mut common = CommonOptions::default();
    let mut repository = None;
    let mut folder = None;
    let mut file = None;
    let mut limit = None;
    let mut is_full = false;
    let mut has_diff = true;
    let mut since = None;
    let mut until = None;
    let mut by = None;
    let mut time_zone = None;
    let mut is_by_chat = false;
    let mut price_list = None;
    let mut is_price_refresh_forced = false;
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
            "--since" => since = Some(value_of("--since", inline, &mut rest)?),
            "--until" => until = Some(value_of("--until", inline, &mut rest)?),
            "--by" => by = Some(value_of("--by", inline, &mut rest)?),
            "--time-zone" => time_zone = Some(value_of("--time-zone", inline, &mut rest)?),
            "--by-chat" => is_by_chat = true,
            "--price-list" => price_list = Some(value_of("--price-list", inline, &mut rest)?),
            "--refresh-prices" => is_price_refresh_forced = true,
            "--full" => is_full = true,
            "--no-diff" => has_diff = false,
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
        return Err("A command is needed: sources, update, initialize, schema, query, usage, read, or requests. Run with --help.".to_string());
    };
    let mode = match command.as_str() {
        "update" => Some(SynchronizationMode::Update),
        "initialize" => Some(SynchronizationMode::Initialize),
        "query" | "sources" | "schema" | "read" | "usage" => None,
        _ if is_help => return Ok(Parsed::Help(HELP)),
        _ => {
            return Err(format!("The command {command} is not known: use sources, update, initialize, schema, query, usage, read, or requests."));
        }
    };
    if is_help {
        return Ok(Parsed::Help(match command.as_str() {
            "query" => QUERY_HELP,
            "sources" => SOURCES_HELP,
            "schema" => SCHEMA_HELP,
            "read" => READ_HELP,
            "usage" => USAGE_HELP,
            _ => SYNCHRONIZATION_HELP,
        }));
    }
    if command != "read" {
        if is_full {
            return Err(format!("The option --full is for the command read only, and not for {command}."));
        }
        if !has_diff {
            return Err(format!("The option --no-diff is for the command read only, and not for {command}."));
        }
    }
    let usage_options = [
        ("--since", since.is_some()),
        ("--until", until.is_some()),
        ("--by", by.is_some()),
        ("--time-zone", time_zone.is_some()),
        ("--by-chat", is_by_chat),
    ];
    if command != "usage" {
        if let Some((option, _)) = usage_options.iter().find(|(_, is_given)| *is_given) {
            return Err(format!("The option {option} is for the command usage only, and not for {command}."));
        }
    }
    let price_options = [("--price-list", price_list.is_some()), ("--refresh-prices", is_price_refresh_forced)];
    if !matches!(command.as_str(), "update" | "initialize") {
        if let Some((option, _)) = price_options.iter().find(|(_, is_given)| *is_given) {
            return Err(format!("The option {option} is for update and initialize, and not for {command}."));
        }
    }
    if command == "usage" {
        if limit.is_some() || file.is_some() || is_full || !has_diff {
            return Err("The command usage takes none of the options --limit, --file, --full, and --no-diff.".to_string());
        }
        if common.format == Some(Format::Sql) {
            return Err("The format sql is for the command schema only, and not for usage.".to_string());
        }
        if let Some(extra) = positionals.next() {
            return Err(format!("The command usage takes no argument, and got {extra}."));
        }
        let by = by.unwrap_or_else(|| "day".to_string());
        if !["minute", "hour", "day"].contains(&by.as_str()) {
            return Err(format!("The option --by needs minute, hour, or day, and got {by}."));
        }
        return Ok(Parsed::Usage(UsageCommand { common, repository, folder, since, until, by, time_zone, is_by_chat }));
    }
    if command == "read" {
        if limit.is_some() || file.is_some() {
            return Err("The options --limit and --file are not for the command read.".to_string());
        }
        let kind_name = positionals
            .next()
            .ok_or("The command read needs a kind (chat_session, commit, issue, pull_request, or file_history) and a key.")?;
        let kind = match kind_name.as_str() {
            "chat_session" => ReadKind::ChatSession,
            "commit" => ReadKind::Commit,
            "issue" => ReadKind::Issue,
            "pull_request" => ReadKind::PullRequest,
            "file_history" => ReadKind::FileHistory,
            _ => {
                return Err(format!(
                    "The kind {kind_name} is not known: use chat_session, commit, issue, pull_request, or file_history."
                ))
            }
        };
        let key = positionals.next().ok_or_else(|| format!("The command read {kind_name} needs a key."))?;
        if let Some(extra) = positionals.next() {
            return Err(format!("The command read takes one kind and one key, and got more: {extra}."));
        }
        if is_full && kind != ReadKind::ChatSession {
            return Err("The option --full is for read chat_session only.".to_string());
        }
        if !has_diff && !matches!(kind, ReadKind::Commit | ReadKind::PullRequest) {
            return Err("The option --no-diff is for read commit and read pull_request only.".to_string());
        }
        if repository.is_some() && !matches!(kind, ReadKind::Issue | ReadKind::PullRequest) {
            return Err("The option --repository is for read issue and read pull_request only.".to_string());
        }
        if matches!(kind, ReadKind::Issue | ReadKind::PullRequest) && key.parse::<u64>().is_err() {
            return Err(format!("The key of read {kind_name} is a number, and got {key}."));
        }
        return Ok(Parsed::Read(ReadRequest { common, kind, key, repository, folder, is_full, has_diff }));
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
                format!("The source {name} is not known: use source_control, code_hosting, coding_agents, or user_activity.")
            })?;
            sources.push(source);
        }
        let sources = if sources.is_empty() { Source::ALL.to_vec() } else { Source::in_fixed_order(&sources) };
        return Ok(Parsed::Synchronize(SynchronizationRequest {
            mode,
            sources,
            common,
            repository,
            folder,
            file,
            price_list,
            is_price_refresh_forced,
        }));
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
                price_list: None,
                is_price_refresh_forced: false,
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
                "coding_agents",
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
                sources: vec![Source::CodingAgents, Source::UserActivity],
                common: CommonOptions { database: Some("a.sqlite".into()), format: Some(Format::Table), verbose: true },
                repository: Some("owner/name".into()),
                folder: Some("/a/folder".into()),
                file: Some("a.jsonl".into()),
                price_list: None,
                is_price_refresh_forced: false,
            }))
        );
    }

    #[test]
    fn reads_the_options_of_the_prices_for_update_and_initialize_only() {
        let Ok(Parsed::Synchronize(request)) =
            parse(&arguments(&["update", "coding_agents", "--price-list=prices.json", "--refresh-prices"]))
        else {
            panic!("update was not read");
        };
        assert_eq!((request.price_list.as_deref(), request.is_price_refresh_forced), (Some("prices.json"), true));
        assert!(parse(&arguments(&["query", "SELECT 1", "--refresh-prices"])).unwrap_err().contains("--refresh-prices"));
        assert!(parse(&arguments(&["usage", "--price-list", "a"])).unwrap_err().contains("--price-list"));
    }

    #[test]
    fn reads_usage_with_its_range_its_grouping_and_its_time_zone() {
        assert_eq!(
            parse(&arguments(&[
                "usage", "--since", "2026-09-14", "--until=2026-10-14", "--by", "hour", "--time-zone", "Europe/Paris", "--by-chat",
                "--folder", "/a", "--repository", "o/n", "--format", "jsonl",
            ])),
            Ok(Parsed::Usage(UsageCommand {
                common: CommonOptions { database: None, format: Some(Format::Jsonl), verbose: false },
                repository: Some("o/n".into()),
                folder: Some("/a".into()),
                since: Some("2026-09-14".into()),
                until: Some("2026-10-14".into()),
                by: "hour".into(),
                time_zone: Some("Europe/Paris".into()),
                is_by_chat: true,
            }))
        );
        let Ok(Parsed::Usage(default)) = parse(&arguments(&["usage"])) else { panic!("usage was not read") };
        assert_eq!((default.by.as_str(), default.since, default.is_by_chat), ("day", None, false));
        assert_eq!(parse(&arguments(&["usage", "--help"])), Ok(Parsed::Help(USAGE_HELP)));
        assert!(parse(&arguments(&["usage", "--by", "week"])).unwrap_err().contains("minute, hour, or day"));
        assert!(parse(&arguments(&["usage", "now"])).unwrap_err().contains("takes no argument"));
        assert!(parse(&arguments(&["usage", "--limit", "3"])).unwrap_err().contains("--limit"));
        assert!(parse(&arguments(&["query", "SELECT 1", "--since", "2026-10-01"])).unwrap_err().contains("--since"));
        assert!(parse(&arguments(&["update", "--by", "day"])).unwrap_err().contains("--by"));
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
    fn reads_read_with_its_kind_its_key_and_its_options() {
        assert_eq!(
            parse(&arguments(&["read", "chat_session", "abc", "--full", "--folder", "/a"])),
            Ok(Parsed::Read(ReadRequest {
                common: CommonOptions::default(),
                kind: ReadKind::ChatSession,
                key: "abc".into(),
                repository: None,
                folder: Some("/a".into()),
                is_full: true,
                has_diff: true,
            }))
        );
        assert_eq!(
            parse(&arguments(&["read", "pull_request", "565", "--no-diff", "--repository", "o/n"])),
            Ok(Parsed::Read(ReadRequest {
                common: CommonOptions::default(),
                kind: ReadKind::PullRequest,
                key: "565".into(),
                repository: Some("o/n".into()),
                folder: None,
                is_full: false,
                has_diff: false,
            }))
        );
        assert!(parse(&arguments(&["read", "branch", "main"])).unwrap_err().contains("The kind branch is not known"));
        assert!(parse(&arguments(&["read", "issue"])).unwrap_err().contains("needs a key"));
        assert!(parse(&arguments(&["read", "issue", "five"])).unwrap_err().contains("is a number"));
        assert!(parse(&arguments(&["read", "issue", "5", "--no-diff"])).unwrap_err().contains("--no-diff"));
        assert!(parse(&arguments(&["read", "commit", "abc", "--full"])).unwrap_err().contains("--full"));
        assert!(parse(&arguments(&["query", "SELECT 1", "--full"])).unwrap_err().contains("--full"));
        assert!(parse(&arguments(&["update", "--no-diff"])).unwrap_err().contains("--no-diff"));
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
        assert_eq!(parse(&arguments(&["read", "--help"])), Ok(Parsed::Help(READ_HELP)));
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
        for kind in ["chat_session", "commit"] {
            let error = parse(&arguments(&["read", kind, "a", "--repository", "a/b"])).unwrap_err();
            assert!(error.contains("--repository"), "{error}");
        }
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
