//! The arguments of the command line `raw_coding_agent_cli`, and the prompt that they give.

/// The agent that the command line runs when the option `--agent` is missing. The library has no default: the caller always
/// names the coding agent.
pub const DEFAULT_AGENT: &str = "codex";

/// The text of the option `--help`.
pub const HELP: &str = r#"Usage: raw_coding_agent_cli [options] [prompt]

Sends one prompt to a coding agent (codex, claude, or agy), waits for the answer,
and prints the answer on the standard output.

Arguments:
  prompt                    A short prompt, written directly on the command
                            line. Put it in quotes. If the standard input has
                            text, the command adds it after the prompt, with a
                            blank line between them.

Options:
  -a, --agent <name>        The coding agent to run: "codex" runs "codex exec",
                            "claude" runs "claude -p", "agy" runs "agy -p".
                            (choices: "codex", "claude", "agy", default: "codex")
  -f, --prompt-file <path>  Read a long prompt from a file, in place of the
                            argument.
  -v, --version             Print the version number.
  -h, --help                Print this help.

Exit codes:
  0   The coding agent answered. The answer is on the standard output.
  1   An error happened. The message is on the standard error output.

Examples:
  $ raw_coding_agent_cli "Write one sentence that explains a change log."
  $ raw_coding_agent_cli --agent claude "Write one sentence about Git."
  $ raw_coding_agent_cli --prompt-file prompt.md
  $ git log --oneline -20 | raw_coding_agent_cli "Summarize these commits:"
"#;

/// What the arguments ask for.
#[derive(Debug, PartialEq)]
pub enum Parsed {
    /// Print the help text.
    Help,
    /// Print the version number.
    Version,
    /// Send a prompt to a coding agent.
    Run(Request),
}

/// The request to send a prompt to a coding agent.
#[derive(Debug, PartialEq)]
pub struct Request {
    /// The coding agent to run.
    pub agent: String,
    /// The prompt written on the command line, or `None`.
    pub prompt_argument: Option<String>,
    /// The path of the file that holds the prompt, or `None`.
    pub prompt_file: Option<String>,
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
/// An unknown option, an option without a value, or more than one prompt.
pub fn parse(arguments: &[String]) -> Result<Parsed, String> {
    let mut agent = None;
    let mut prompt_file = None;
    let mut prompts: Vec<String> = Vec::new();
    let mut options_ended = false;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if options_ended || argument == "-" || !argument.starts_with('-') {
            prompts.push(argument.clone());
            continue;
        }
        if argument == "--" {
            options_ended = true;
            continue;
        }
        let (name, inline) = match argument.split_once('=') {
            Some((name, value)) if name.starts_with("--") => (name, Some(value.to_string())),
            _ => (argument.as_str(), None),
        };
        match name {
            "-h" | "--help" => return Ok(Parsed::Help),
            "-v" | "--version" => return Ok(Parsed::Version),
            "-a" | "--agent" => agent = Some(value_of(name, inline, &mut rest)?),
            "-f" | "--prompt-file" => prompt_file = Some(value_of(name, inline, &mut rest)?),
            _ => return Err(format!("Unknown option \"{name}\". Use --help.")),
        }
    }
    if prompts.len() > 1 {
        return Err("Too many arguments. Put the prompt in quotes.".to_string());
    }
    Ok(Parsed::Run(Request {
        agent: agent.unwrap_or_else(|| DEFAULT_AGENT.to_string()),
        prompt_argument: prompts.pop(),
        prompt_file,
    }))
}

/// Builds the prompt from the argument or from the file, then adds the text of the standard input after it, with a blank
/// line between them.
///
/// # Errors
/// The argument and the file are both given, the file cannot be read, or there is no text at all.
pub fn resolve_prompt(request: &Request, standard_input: &str) -> Result<String, String> {
    if request.prompt_argument.is_some() && request.prompt_file.is_some() {
        return Err("Give a prompt argument or the option --prompt-file, not both.".to_string());
    }
    let main_prompt = match (&request.prompt_file, &request.prompt_argument) {
        (Some(path), _) => std::fs::read_to_string(path).map_err(|_| format!("Cannot read the prompt file \"{path}\"."))?,
        (None, Some(prompt)) => prompt.clone(),
        (None, None) => String::new(),
    };
    let parts: Vec<&str> = [main_prompt.trim(), standard_input.trim()].into_iter().filter(|part| !part.is_empty()).collect();
    if parts.is_empty() {
        return Err("No prompt. Give a prompt argument, the option --prompt-file, or text on the standard input.".to_string());
    }
    Ok(parts.join("\n\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| word.to_string()).collect()
    }

    fn request(agent: &str, prompt_argument: Option<&str>, prompt_file: Option<&str>) -> Request {
        Request {
            agent: agent.to_string(),
            prompt_argument: prompt_argument.map(str::to_string),
            prompt_file: prompt_file.map(str::to_string),
        }
    }

    #[test]
    fn asks_for_the_help_and_for_the_version() {
        assert_eq!(parse(&arguments(&["-h"])), Ok(Parsed::Help));
        assert_eq!(parse(&arguments(&["--help"])), Ok(Parsed::Help));
        assert_eq!(parse(&arguments(&["-v"])), Ok(Parsed::Version));
        assert_eq!(parse(&arguments(&["--version", "a prompt"])), Ok(Parsed::Version));
    }

    #[test]
    fn runs_codex_by_default_and_reads_the_prompt_argument() {
        assert_eq!(parse(&arguments(&["the prompt"])), Ok(Parsed::Run(request("codex", Some("the prompt"), None))));
    }

    #[test]
    fn reads_the_agent_and_the_prompt_file_in_every_form() {
        for words in [["-a", "claude", "-f", "p.md"], ["--agent", "claude", "--prompt-file", "p.md"]] {
            assert_eq!(parse(&arguments(&words)), Ok(Parsed::Run(request("claude", None, Some("p.md")))));
        }
        assert_eq!(
            parse(&arguments(&["--agent=claude", "--prompt-file=p.md"])),
            Ok(Parsed::Run(request("claude", None, Some("p.md"))))
        );
    }

    #[test]
    fn takes_a_prompt_that_starts_with_a_dash_after_the_two_dashes() {
        assert_eq!(parse(&arguments(&["--", "-the prompt"])), Ok(Parsed::Run(request("codex", Some("-the prompt"), None))));
    }

    #[test]
    fn gives_an_error_for_an_unknown_option_a_missing_value_and_two_prompts() {
        assert_eq!(parse(&arguments(&["--model", "x"])), Err("Unknown option \"--model\". Use --help.".to_string()));
        assert_eq!(parse(&arguments(&["--agent"])), Err("The option --agent needs a value.".to_string()));
        assert_eq!(parse(&arguments(&["a", "b"])), Err("Too many arguments. Put the prompt in quotes.".to_string()));
    }

    #[test]
    fn adds_the_standard_input_after_the_prompt_with_a_blank_line_between_them() {
        let prompt = resolve_prompt(&request("codex", Some(" Summarize: "), None), "commit one\ncommit two\n");
        assert_eq!(prompt, Ok("Summarize:\n\ncommit one\ncommit two".to_string()));
    }

    #[test]
    fn uses_the_standard_input_alone_when_there_is_no_prompt_argument() {
        assert_eq!(resolve_prompt(&request("codex", None, None), "only this\n"), Ok("only this".to_string()));
    }

    #[test]
    fn gives_an_error_when_there_is_no_text_at_all() {
        let answer = resolve_prompt(&request("codex", None, None), "  \n");
        assert!(matches!(&answer, Err(text) if text.starts_with("No prompt.")), "{answer:?}");
    }

    #[test]
    fn gives_an_error_when_the_argument_and_the_file_are_both_given() {
        let answer = resolve_prompt(&request("codex", Some("a"), Some("p.md")), "");
        assert_eq!(answer, Err("Give a prompt argument or the option --prompt-file, not both.".to_string()));
    }

    #[test]
    fn gives_an_error_when_the_prompt_file_cannot_be_read() {
        let answer = resolve_prompt(&request("codex", None, Some("/no/such/folder/p.md")), "");
        assert_eq!(answer, Err("Cannot read the prompt file \"/no/such/folder/p.md\".".to_string()));
    }
}
