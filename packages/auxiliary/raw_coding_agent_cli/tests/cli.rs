//! Tests of the executable `raw_coding_agent_cli`, with fake `codex` and `claude` commands put at the start of the PATH.

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// The fake command script that prints its arguments, then its standard input.
const ECHO_SCRIPT: &str = "printf 'arguments:%s\\n' \"$*\"\nprintf 'standard input:'\ncat";

/// A folder with fake commands. The PATH of the executable under test is this folder and the system commands.
struct FakeCommands {
    folder: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

impl FakeCommands {
    /// Makes a folder with one script for each pair `(command, script)`.
    fn new(name: &str, scripts: &[(&str, &str)]) -> Self {
        let folder = std::env::temp_dir().join(format!("raw_coding_agent_cli_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        for (command, script) in scripts {
            let path = folder.join(command);
            std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
            }
        }
        FakeCommands { folder }
    }

    /// Both coding agents print their arguments, then their standard input.
    fn echoing(name: &str) -> Self {
        FakeCommands::new(name, &[("codex", ECHO_SCRIPT), ("claude", ECHO_SCRIPT)])
    }

    /// Runs the executable with `arguments`, writes `standard_input` on its standard input, and waits for it to exit.
    fn run(&self, arguments: &[&str], standard_input: &str) -> CliResult {
        let mut child = Command::new(env!("CARGO_BIN_EXE_raw_coding_agent_cli"))
            .args(arguments)
            .env("PATH", format!("{}:/usr/bin:/bin", self.folder.display()))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(standard_input.as_bytes()).unwrap();
        let output = child.wait_with_output().unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code(),
        }
    }

    /// The path of a file in the folder of the fake commands.
    fn file(&self, name: &str) -> PathBuf {
        self.folder.join(name)
    }
}

impl Drop for FakeCommands {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.folder);
    }
}

#[test]
fn prints_the_version_of_the_package() {
    let fake = FakeCommands::echoing("version");
    for flag in ["-v", "--version"] {
        let result = fake.run(&[flag], "");
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(result.stdout.trim(), env!("CARGO_PKG_VERSION"));
    }
}

#[test]
fn prints_the_help_text() {
    let fake = FakeCommands::echoing("help");
    for flag in ["-h", "--help"] {
        let result = fake.run(&[flag], "");
        assert_eq!(result.exit_code, Some(0));
        let help = result.stdout.split_whitespace().collect::<Vec<_>>().join(" ");
        assert!(result.stdout.contains("Usage: raw_coding_agent_cli [options] [prompt]"), "{}", result.stdout);
        assert!(result.stdout.contains("-a, --agent <name>"));
        assert!(help.contains("(choices: \"codex\", \"claude\", default: \"codex\")"), "{help}");
        assert!(result.stdout.contains("-f, --prompt-file <path>"));
        assert!(result.stdout.contains("-v, --version"));
        assert!(result.stdout.contains("Exit codes:"));
        assert!(result.stdout.contains("Examples:"));
    }
}

#[test]
fn runs_codex_by_default_and_prints_the_answer() {
    let fake = FakeCommands::echoing("default");
    let result = fake.run(&["the prompt text"], "");
    assert_eq!(result.exit_code, Some(0));
    assert_eq!(result.stdout, "arguments:exec --skip-git-repo-check -\nstandard input:the prompt text\n");
}

#[test]
fn runs_claude_with_the_option_agent() {
    let fake = FakeCommands::echoing("claude");
    for flag in ["-a", "--agent"] {
        let result = fake.run(&[flag, "claude", "the prompt text"], "");
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(result.stdout, "arguments:-p\nstandard input:the prompt text\n");
    }
}

#[test]
fn adds_the_standard_input_after_the_prompt_with_a_blank_line_between_them() {
    let fake = FakeCommands::echoing("standard_input");
    let result = fake.run(&["Summarize these commits:"], "commit one\ncommit two\n");
    assert_eq!(result.exit_code, Some(0));
    assert!(result.stdout.contains("standard input:Summarize these commits:\n\ncommit one\ncommit two\n"), "{}", result.stdout);
}

#[test]
fn reads_the_prompt_from_the_file_of_the_option_prompt_file() {
    let fake = FakeCommands::echoing("prompt_file");
    let prompt_file = fake.file("prompt.md");
    std::fs::write(&prompt_file, "a long prompt\nwith two lines\n").unwrap();
    for flag in ["-f", "--prompt-file"] {
        let result = fake.run(&[flag, prompt_file.to_str().unwrap()], "");
        assert_eq!(result.exit_code, Some(0));
        assert!(result.stdout.contains("standard input:a long prompt\nwith two lines\n"), "{}", result.stdout);
    }
}

#[test]
fn exits_with_code_1_when_the_prompt_file_does_not_exist() {
    let fake = FakeCommands::echoing("missing_file");
    let result = fake.run(&["--prompt-file", fake.file("missing.md").to_str().unwrap()], "");
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Cannot read the prompt file"), "{}", result.stderr);
}

#[test]
fn exits_with_code_1_when_a_prompt_argument_and_a_prompt_file_are_both_given() {
    let fake = FakeCommands::echoing("both");
    let prompt_file = fake.file("prompt.md");
    std::fs::write(&prompt_file, "a long prompt").unwrap();
    let result = fake.run(&["--prompt-file", prompt_file.to_str().unwrap(), "the prompt text"], "");
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Give a prompt argument or the option --prompt-file, not both."), "{}", result.stderr);
}

#[test]
fn exits_with_code_1_when_there_is_no_prompt_at_all() {
    let fake = FakeCommands::echoing("no_prompt");
    let result = fake.run(&[], "");
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("No prompt."), "{}", result.stderr);
    assert_eq!(result.stdout, "");
}

#[test]
fn exits_with_code_1_when_the_agent_name_is_not_known() {
    let fake = FakeCommands::echoing("unknown_agent");
    let result = fake.run(&["--agent", "gemini", "the prompt text"], "");
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Unknown coding agent \"gemini\". Use codex or claude."), "{}", result.stderr);
}

#[test]
fn exits_with_code_1_when_the_command_is_not_installed() {
    let fake = FakeCommands::new("not_installed", &[]);
    let result = fake.run(&["--agent", "claude", "the prompt text"], "");
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("The command \"claude\" is not installed or is not in the PATH."), "{}", result.stderr);
}

#[test]
fn exits_with_code_1_and_prints_the_standard_error_output_of_a_failing_coding_agent() {
    let fake = FakeCommands::new("failure", &[("codex", "echo 'something broke' >&2\nexit 3")]);
    let result = fake.run(&["the prompt text"], "");
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("codex : something broke"), "{}", result.stderr);
}

#[test]
fn sends_a_prompt_larger_than_the_limit_of_the_command_line_through_the_standard_input() {
    let fake = FakeCommands::echoing("large");
    let prompt = "x".repeat(2_000_000);
    let result = fake.run(&["--agent", "claude"], &prompt);
    assert_eq!(result.exit_code, Some(0));
    assert_eq!(result.stdout, format!("arguments:-p\nstandard input:{prompt}\n"));
}
