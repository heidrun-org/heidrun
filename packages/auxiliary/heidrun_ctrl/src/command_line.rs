//! The arguments of the command line `heidrun_ctrl`, and the texts of its help.

use heidrun_ctrl::{Format, MacroKind};

/// The text of `heidrun_ctrl --help`.
pub const HELP: &str = r#"Usage: heidrun_ctrl macros <command> [options]

Controls the Heidrun application. The first part is the macros: a macro is a reusable
text that the developer writes into a pane. There are three kinds of macro:
  hard_coded   Written in the source code of Heidrun. It is listed, and it cannot be
               added, changed, or deleted.
  personal     Made by the developer, and kept in the file "macros.json" of the folder
               of the variable HEIDRUN_DIR, or else of "~/.config/heidrun".
  project      Made by the developer, and kept in the key "prompts" of the file
               ".heidrun/config.json" of the project.

The command line changes files. The Heidrun application watches the files, so a running
Heidrun shows each change in its window within about one second, and a change works
when Heidrun is not running.

Commands:
  macros list                 List every macro, the hard-coded macros included.
  macros add                  Add a macro.
  macros update <id>          Change the title, the description, or the text of a macro.
  macros delete <id>          Delete a macro.

Options:
  --kind <name>               hard_coded, personal, or project. For list, only the
                              macros of that kind. For add, the kind to add:
                              personal or project. (default: personal) For update and
                              delete, the kind to search, when the id exists in two
                              kinds.
  --id <id>                   For add, the id of the macro. (default: made from the
                              title, then a dash and three characters)
  --label <text>              For add and update, the title of the macro. An empty
                              title becomes the first 40 characters of the text.
  --description <text>        For add and update, the line shown under the title.
  --text <text>               For add and update, the text of the macro. With "-", the
                              text is read from the standard input, and one new line
                              at its end is removed. It cannot be empty.
  --folder <path>             A folder of the project, for the project macros.
                              (default: the current folder)
  --format <name>             markdown or json. (default: markdown)
  --json                      The same as --format json.
  -h, --help                  Print this help.

Output:
  markdown   Text for a person, or for a renderer: pipe it to glow to get colors.
  json       One JSON value: a list of macros for list, and one macro for add and
             update. A macro has the fields "id", "label", "description", "text",
             "kind", and "file" (null for a hard-coded macro). An error is one JSON
             object on one line on the standard error output, with the field "error".

Exit codes:
  0   The command worked.
  1   An error happened. The message is on the standard error output. No file changed.

Examples:
  $ heidrun_ctrl macros list
  $ heidrun_ctrl macros list --kind personal --format json
  $ heidrun_ctrl macros add --label "Run the tests" --text "Run the tests first."
  $ printf 'Review the branch.\nList the risks.' | heidrun_ctrl macros add --kind project --label Review --text -
  $ heidrun_ctrl macros update run-the-tests-x7q --text "Run the tests, then the linter."
  $ heidrun_ctrl macros delete run-the-tests-x7q
  $ heidrun_ctrl macros list | glow
"#;

/// Where the text of a macro comes from.
#[derive(Debug, PartialEq, Clone)]
pub enum TextInput {
    /// The text is in the argument.
    Given(String),
    /// The text is read from the standard input.
    StandardInput,
}

/// The options of every order.
#[derive(Debug, PartialEq, Default)]
pub struct CommonOptions {
    /// The format of the output.
    pub format: Format,
    /// A folder of the project, or `None` for the current folder.
    pub folder: Option<String>,
}

/// What the arguments ask for.
#[derive(Debug, PartialEq)]
pub enum Parsed {
    /// Print the help.
    Help,
    /// List the macros.
    List {
        /// The options of every order.
        common: CommonOptions,
        /// The kind to list, or `None` for every kind.
        kind: Option<MacroKind>,
    },
    /// Add a macro.
    Add {
        /// The options of every order.
        common: CommonOptions,
        /// The kind to add.
        kind: MacroKind,
        /// The id, or `None` to make one.
        id: Option<String>,
        /// The title.
        label: Option<String>,
        /// The description.
        description: Option<String>,
        /// The text.
        text: TextInput,
    },
    /// Change a macro.
    Update {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the macro.
        id: String,
        /// The kind to search, or `None` to search every kind.
        kind: Option<MacroKind>,
        /// The new title.
        label: Option<String>,
        /// The new description.
        description: Option<String>,
        /// The new text.
        text: Option<TextInput>,
    },
    /// Delete a macro.
    Delete {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the macro.
        id: String,
        /// The kind to search, or `None` to search every kind.
        kind: Option<MacroKind>,
    },
}

/// The options that the arguments hold, before the order is known.
#[derive(Default)]
struct RawOptions {
    format: Option<Format>,
    folder: Option<String>,
    kind: Option<MacroKind>,
    id: Option<String>,
    label: Option<String>,
    description: Option<String>,
    text: Option<TextInput>,
    /// The names of the options that were given, to refuse the ones an order does not accept.
    given: Vec<&'static str>,
}

/// The format that the arguments ask for, read without the other checks, so that an error of the arguments is written in
/// that format too. `None` when no valid format is given.
pub fn find_format(arguments: &[String]) -> Option<Format> {
    let mut format = None;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
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

/// The value of the option `name`: the text after the sign `=`, or else the next argument.
fn value_of<'a>(name: &str, inline: Option<String>, rest: &mut impl Iterator<Item = &'a String>) -> Result<String, String> {
    match inline {
        Some(value) => Ok(value),
        None => rest.next().cloned().ok_or_else(|| format!("The option {name} needs a value.")),
    }
}

/// The kind that a name gives, or an error that lists the three names.
fn kind_of(name: &str) -> Result<MacroKind, String> {
    MacroKind::from_name(name).ok_or_else(|| format!("The kind {name} is not known: use hard_coded, personal, or project."))
}

/// Reads the arguments of the command line, without the name of the program.
///
/// # Errors
/// An unknown command, kind, option, or format, an option without a value, an option that the command does not accept, a
/// missing id or text, or a wrong number of arguments.
pub fn parse(arguments: &[String]) -> Result<Parsed, String> {
    let mut options = RawOptions::default();
    let mut positionals: Vec<String> = Vec::new();
    let mut is_help = false;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if !argument.starts_with('-') || argument == "-" {
            positionals.push(argument.clone());
            continue;
        }
        let (name, inline) = match argument.split_once('=') {
            Some((name, value)) => (name.to_string(), Some(value.to_string())),
            None => (argument.clone(), None),
        };
        match name.as_str() {
            "-h" | "--help" => is_help = true,
            "--json" => {
                options.format = Some(Format::Json);
                options.given.push("--json");
            }
            "--format" => {
                let value = value_of(&name, inline, &mut rest)?;
                options.format = Some(
                    Format::from_name(&value).ok_or_else(|| format!("The format {value} is not known: use markdown or json."))?,
                );
                options.given.push("--format");
            }
            "--folder" => {
                options.folder = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--folder");
            }
            "--kind" => {
                options.kind = Some(kind_of(&value_of(&name, inline, &mut rest)?)?);
                options.given.push("--kind");
            }
            "--id" => {
                options.id = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--id");
            }
            "--label" => {
                options.label = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--label");
            }
            "--description" => {
                options.description = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--description");
            }
            "--text" => {
                let value = value_of(&name, inline, &mut rest)?;
                options.text = Some(if value == "-" { TextInput::StandardInput } else { TextInput::Given(value) });
                options.given.push("--text");
            }
            _ => return Err(format!("The option {name} is not known. Run `heidrun_ctrl --help`.")),
        }
    }
    if is_help {
        return Ok(Parsed::Help);
    }
    let Some(group) = positionals.first() else {
        return Err("A command is needed: macros. Run `heidrun_ctrl --help`.".to_string());
    };
    if group != "macros" {
        return Err(format!("The command {group} is not known: use macros. Run `heidrun_ctrl --help`."));
    }
    let Some(command) = positionals.get(1) else {
        return Err("The command macros needs one of list, add, update, or delete. Run `heidrun_ctrl --help`.".to_string());
    };
    let accepted: &[&str] = match command.as_str() {
        "list" => &["--json", "--format", "--folder", "--kind"],
        "add" => &["--json", "--format", "--folder", "--kind", "--id", "--label", "--description", "--text"],
        "update" => &["--json", "--format", "--folder", "--kind", "--label", "--description", "--text"],
        "delete" => &["--json", "--format", "--folder", "--kind"],
        other => return Err(format!("The command macros {other} is not known: use list, add, update, or delete.")),
    };
    if let Some(refused) = options.given.iter().find(|name| !accepted.contains(name)) {
        return Err(format!("The command macros {command} does not accept the option {refused}."));
    }
    let wanted_positionals = if command == "update" || command == "delete" { 3 } else { 2 };
    if positionals.len() != wanted_positionals {
        return Err(match wanted_positionals {
            3 if positionals.len() < 3 => format!("The command macros {command} needs the id of a macro."),
            _ => format!("The command macros {command} has too many arguments: {}.", positionals[wanted_positionals..].join(" ")),
        });
    }
    let common = CommonOptions { format: options.format.unwrap_or_default(), folder: options.folder.clone() };
    match command.as_str() {
        "list" => Ok(Parsed::List { common, kind: options.kind }),
        "add" => Ok(Parsed::Add {
            common,
            kind: options.kind.unwrap_or(MacroKind::Personal),
            id: options.id,
            label: options.label,
            description: options.description,
            text: options.text.ok_or_else(|| "The command macros add needs the option --text.".to_string())?,
        }),
        "update" => Ok(Parsed::Update {
            common,
            id: positionals[2].clone(),
            kind: options.kind,
            label: options.label,
            description: options.description,
            text: options.text,
        }),
        _ => Ok(Parsed::Delete { common, id: positionals[2].clone(), kind: options.kind }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| word.to_string()).collect()
    }

    #[test]
    fn the_help_is_asked_with_a_short_or_a_long_option() {
        assert_eq!(parse(&arguments(&["--help"])), Ok(Parsed::Help));
        assert_eq!(parse(&arguments(&["macros", "list", "-h"])), Ok(Parsed::Help));
    }

    #[test]
    fn a_list_has_no_kind_and_the_format_markdown_by_default() {
        assert_eq!(
            parse(&arguments(&["macros", "list"])),
            Ok(Parsed::List { common: CommonOptions { format: Format::Markdown, folder: None }, kind: None })
        );
    }

    #[test]
    fn the_options_take_a_value_after_a_space_or_after_a_sign_equal() {
        let parsed = parse(&arguments(&["macros", "list", "--kind=project", "--format", "json", "--folder", "/tmp/x"])).unwrap();
        assert_eq!(
            parsed,
            Parsed::List { common: CommonOptions { format: Format::Json, folder: Some("/tmp/x".into()) }, kind: Some(MacroKind::Project) }
        );
    }

    #[test]
    fn an_add_is_personal_by_default_and_needs_a_text() {
        let parsed = parse(&arguments(&["macros", "add", "--text", "Hello"])).unwrap();
        assert!(matches!(parsed, Parsed::Add { kind: MacroKind::Personal, text: TextInput::Given(ref text), .. } if text == "Hello"));
        assert_eq!(parse(&arguments(&["macros", "add", "--label", "A"])), Err("The command macros add needs the option --text.".to_string()));
    }

    #[test]
    fn a_text_of_one_dash_is_read_from_the_standard_input() {
        let parsed = parse(&arguments(&["macros", "add", "--text", "-"])).unwrap();
        assert!(matches!(parsed, Parsed::Add { text: TextInput::StandardInput, .. }));
    }

    #[test]
    fn an_update_and_a_delete_need_one_id() {
        assert!(matches!(parse(&arguments(&["macros", "update", "a", "--text", "B"])), Ok(Parsed::Update { ref id, .. }) if id == "a"));
        assert!(matches!(parse(&arguments(&["macros", "delete", "a"])), Ok(Parsed::Delete { ref id, .. }) if id == "a"));
        assert_eq!(parse(&arguments(&["macros", "delete"])), Err("The command macros delete needs the id of a macro.".to_string()));
        assert!(parse(&arguments(&["macros", "delete", "a", "b"])).unwrap_err().contains("too many arguments: b"));
    }

    #[test]
    fn an_option_that_the_command_does_not_accept_is_an_error() {
        assert_eq!(
            parse(&arguments(&["macros", "list", "--text", "x"])),
            Err("The command macros list does not accept the option --text.".to_string())
        );
        assert!(parse(&arguments(&["macros", "delete", "a", "--label", "x"])).is_err());
        assert!(parse(&arguments(&["macros", "update", "a", "--id", "x"])).is_err());
    }

    #[test]
    fn an_unknown_command_kind_format_or_option_is_an_error_that_says_the_choices() {
        assert!(parse(&arguments(&["panes"])).unwrap_err().contains("use macros"));
        assert!(parse(&arguments(&["macros", "run"])).unwrap_err().contains("list, add, update, or delete"));
        assert!(parse(&arguments(&["macros", "list", "--kind", "x"])).unwrap_err().contains("hard_coded, personal, or project"));
        assert!(parse(&arguments(&["macros", "list", "--format", "table"])).unwrap_err().contains("markdown or json"));
        assert!(parse(&arguments(&["macros", "list", "--color"])).unwrap_err().contains("--color"));
        assert!(parse(&arguments(&["macros", "list", "--kind"])).unwrap_err().contains("needs a value"));
        assert!(parse(&arguments(&[])).unwrap_err().contains("A command is needed"));
    }

    #[test]
    fn the_format_is_found_even_when_the_arguments_are_wrong() {
        assert_eq!(find_format(&arguments(&["macros", "oops", "--format", "json"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["macros", "--json"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["macros"])), None);
    }
}
