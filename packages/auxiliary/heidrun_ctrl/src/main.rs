//! The command line `heidrun_ctrl`: the commands macros list, macros add, macros update, and macros delete.

mod command_line;

use command_line::{find_format, parse, CommonOptions, Parsed, TextInput, HELP};
use heidrun_ctrl::{
    add_macro, changed_text, delete_macro, deleted_text, error_text, find_project_root, list_macros, list_text,
    personal_macros_path, update_macro, Format, MacroChanges, MacroPlaces, NewMacro,
};
use std::io::Read;
use std::process::ExitCode;

/// The two files that the orders read and change: the file of the personal macros, and the file of the project that holds
/// the folder of the options, or else the current folder.
fn places_of(common: &CommonOptions) -> Result<MacroPlaces, String> {
    let folder = match &common.folder {
        Some(folder) => std::path::PathBuf::from(folder),
        None => std::env::current_dir().map_err(|error| format!("The current folder cannot be read: {error}"))?,
    };
    let absolute = std::path::absolute(&folder).map_err(|error| format!("The path {} cannot be made absolute: {error}", folder.display()))?;
    Ok(MacroPlaces { personal_file: personal_macros_path(), project_root: find_project_root(&absolute) })
}

/// The text of a macro: the argument, or the standard input with one new line at its end removed.
fn text_of(input: TextInput) -> Result<String, String> {
    match input {
        TextInput::Given(text) => Ok(text),
        TextInput::StandardInput => {
            let mut text = String::new();
            std::io::stdin().read_to_string(&mut text).map_err(|error| format!("The standard input cannot be read: {error}"))?;
            if text.ends_with("\r\n") {
                text.truncate(text.len() - 2);
            } else if text.ends_with('\n') {
                text.truncate(text.len() - 1);
            }
            Ok(text)
        }
    }
}

/// Runs the order that the arguments ask for, and gives the text to print on the standard output.
fn run(arguments: &[String]) -> Result<String, String> {
    match parse(arguments)? {
        Parsed::Help => Ok(HELP.to_string()),
        Parsed::List { common, kind } => {
            let places = places_of(&common)?;
            let listed: Vec<_> = list_macros(&places)?.into_iter().filter(|item| kind.is_none_or(|wanted| wanted == item.kind)).collect();
            Ok(list_text(&listed, &places, kind, common.format))
        }
        Parsed::Add { common, kind, id, label, description, text } => {
            let places = places_of(&common)?;
            let new = NewMacro { id, label, description, text: text_of(text)? };
            Ok(changed_text("Added", &add_macro(&places, kind, new)?, common.format))
        }
        Parsed::Update { common, id, kind, label, description, text } => {
            let places = places_of(&common)?;
            let text = text.map(text_of).transpose()?;
            let updated = update_macro(&places, &id, kind, MacroChanges { label, description, text })?;
            Ok(changed_text("Updated", &updated, common.format))
        }
        Parsed::Delete { common, id, kind } => {
            let places = places_of(&common)?;
            Ok(deleted_text(&delete_macro(&places, &id, kind)?, common.format))
        }
    }
}

fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let format = find_format(&arguments).unwrap_or(Format::Markdown);
    match run(&arguments) {
        Ok(text) => {
            print!("{text}");
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{}", error_text(&message, format));
            ExitCode::FAILURE
        }
    }
}
