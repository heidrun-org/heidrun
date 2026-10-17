//! The command line `coding_agent_cli`: sends one prompt to a coding agent and prints the answer.

mod command_line;

use command_line::{parse, resolve_prompt, Parsed, HELP};
use coding_agent_cli::{ask, AgentShell};
use std::io::{IsTerminal, Read};
use std::process::ExitCode;

/// Reads all the text of the standard input. When the standard input is a terminal, nobody pipes text to the command, so
/// the function does not wait and gives an empty text.
fn read_standard_input() -> String {
    let mut text = String::new();
    if !std::io::stdin().is_terminal() {
        let _ = std::io::stdin().read_to_string(&mut text);
    }
    text
}

/// Runs the command line, and prints the answer on the standard output.
async fn run(arguments: &[String]) -> Result<(), String> {
    let request = match parse(arguments)? {
        Parsed::Help => {
            print!("{HELP}");
            return Ok(());
        }
        Parsed::Version => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            return Ok(());
        }
        Parsed::Run(request) => request,
    };
    let prompt = resolve_prompt(&request, &read_standard_input())?;
    let answer = ask(&AgentShell::plain(), Some(&request.agent), &prompt, None, None).await?;
    println!("{}", answer.text);
    Ok(())
}

/// Exits with the code 1 and the message on the standard error output when an error happens.
#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match run(&arguments).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("Error: {message}");
            ExitCode::from(1)
        }
    }
}
