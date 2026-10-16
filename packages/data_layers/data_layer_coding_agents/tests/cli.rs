//! Tests of the executable `data_layer_coding_agents`, with fake folders of Claude Code and of Codex given by the variables
//! `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and a real Git repository with the remote `origin` `fake-owner/fake-name`.

use data_layer_coding_agents::{ChatSessionTable, ChatSessionsDatabase};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};

/// A message of the developer, in a chat session file of Claude Code.
const TYPED: &str = r#"{"type":"user","cwd":"FOLDER","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;

/// A folder with a Git repository, a fake folder of Claude Code, a fake folder of Codex, and the path of a database file.
struct Fixture {
    folder: PathBuf,
    repository: PathBuf,
    database_path: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

/// The name that Claude Code gives to the folder of its chat sessions of `folder`.
fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

/// Writes a file with its folders, and sets its modification date to `age_seconds` seconds before now.
fn write_file(path: &Path, text: &str, age_seconds: u64) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
    let modified = SystemTime::now() - Duration::from_secs(age_seconds);
    std::fs::File::options().write(true).open(path).unwrap().set_modified(modified).unwrap();
}

impl Fixture {
    /// Makes the folders. The repository holds two chat sessions of Claude Code (`older` and `newer`).
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("data_layer_coding_agents_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        let repository = folder.join("repository").canonicalize_or_create();
        for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:fake-owner/fake-name.git"]] {
            let status = Command::new("git").arg("-C").arg(&repository).args(arguments).status().unwrap();
            assert!(status.success());
        }
        let typed = TYPED.replace("FOLDER", &repository.display().to_string());
        let project = folder.join("claude").join("projects").join(claude_folder_name(&repository.display().to_string()));
        write_file(&project.join("older.jsonl"), &format!("{typed}\n"), 1000);
        write_file(&project.join("newer.jsonl"), &format!("{typed}\n"), 500);
        Fixture { database_path: folder.join("data_layer.sqlite"), repository, folder }
    }

    /// Runs the executable with the fake folders of the coding agents.
    fn run(&self, arguments: &[&str]) -> CliResult {
        let output = Command::new(env!("CARGO_BIN_EXE_data_layer_coding_agents"))
            .args(arguments)
            .env("CLAUDE_CONFIG_DIR", self.folder.join("claude"))
            .env("CODEX_HOME", self.folder.join("codex"))
            .output()
            .unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code: output.status.code(),
        }
    }

    /// The options that give the repository folder and the database file.
    fn options(&self) -> Vec<String> {
        vec![
            "--folder".to_string(),
            self.repository.display().to_string(),
            "--database".to_string(),
            self.database_path.display().to_string(),
        ]
    }

    /// Runs a command with the options of the fixture and some more arguments.
    fn run_with_options(&self, command: &str, more: &[&str]) -> CliResult {
        let options = self.options();
        let mut arguments: Vec<&str> = vec![command];
        arguments.extend(options.iter().map(String::as_str));
        arguments.extend_from_slice(more);
        self.run(&arguments)
    }
}

/// Makes a folder and gives its real path, so that the path equals the path that `git` and the program find.
trait CanonicalizeOrCreate {
    /// Creates the folder, and gives its canonical path.
    fn canonicalize_or_create(&self) -> PathBuf;
}

impl CanonicalizeOrCreate for PathBuf {
    fn canonicalize_or_create(&self) -> PathBuf {
        std::fs::create_dir_all(self).unwrap();
        self.canonicalize().unwrap()
    }
}

#[test]
fn prints_the_help_and_exits_with_the_code_0() {
    let result = Fixture::new("help").run(&["--help"]);
    assert_eq!(result.exit_code, Some(0));
    assert!(result.stdout.contains("Usage: data_layer_coding_agents"));
    assert!(result.stdout.contains("initialize") && result.stdout.contains("chat_session_issues"));
}

#[test]
fn initialize_writes_every_chat_session_and_prints_a_report_of_two_lines() {
    let fixture = Fixture::new("initialize");
    let result = fixture.run_with_options("initialize", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let lines: Vec<&str> = result.stdout.lines().collect();
    assert_eq!(lines.len(), 2, "{}", result.stdout);
    assert!(lines[0].starts_with("fake-owner/fake-name -> ") && lines[0].ends_with("(initialize)"), "{}", lines[0]);
    assert_eq!(lines[1], "chat sessions: 2 written, read since the beginning");
    let database = ChatSessionsDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "fake-owner/fake-name"), Ok(2));
    let relations = database.find_relations("fake-owner/fake-name", "newer").unwrap();
    assert_eq!(relations.issues, vec![250]);
    assert_eq!(relations.folders, vec![fixture.repository.display().to_string()]);
}

#[test]
fn update_reads_again_only_the_newest_file_and_reports_the_date_of_the_last_read() {
    let fixture = Fixture::new("update");
    fixture.run_with_options("initialize", &[]);
    let result = fixture.run_with_options("update", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("chat sessions: 1 written, read since 2026-"), "{}", result.stdout);
    let database = ChatSessionsDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "fake-owner/fake-name"), Ok(2));
}

#[test]
fn the_option_repository_replaces_the_remote_origin() {
    let fixture = Fixture::new("repository_option");
    let result = fixture.run_with_options("initialize", &["--repository", "other-owner/other-name"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.starts_with("other-owner/other-name -> "), "{}", result.stdout);
}

#[test]
fn the_option_verbose_prints_the_progress_on_the_standard_error_output_only() {
    let fixture = Fixture::new("verbose");
    let result = fixture.run_with_options("initialize", &["--verbose"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("repository: fake-owner/fake-name"), "{}", result.stderr);
    assert!(result.stderr.contains("claude code: 2 chat session files, 2 to read"), "{}", result.stderr);
    assert!(!result.stdout.contains("claude code"), "{}", result.stdout);
}

#[test]
fn query_prints_a_text_table_and_a_json_list() {
    let fixture = Fixture::new("query");
    fixture.run_with_options("initialize", &[]);
    let table = fixture.run(&["query", "--database", &fixture.database_path.display().to_string(), "SELECT id FROM chat_sessions ORDER BY id"]);
    assert_eq!(table.exit_code, Some(0), "{}", table.stderr);
    assert_eq!(table.stdout.trim_end(), "id\n-----\nnewer\nolder\nrow count: 2");
    let json = fixture.run(&[
        "query",
        "--json",
        "--database",
        &fixture.database_path.display().to_string(),
        "SELECT count(*) AS count FROM chat_session_issues",
    ]);
    assert_eq!(json.exit_code, Some(0), "{}", json.stderr);
    let rows: serde_json::Value = serde_json::from_str(&json.stdout).unwrap();
    assert_eq!(rows, serde_json::json!([{ "count": 2 }]));
}

#[test]
fn query_refuses_a_statement_that_writes_and_a_database_that_does_not_exist() {
    let fixture = Fixture::new("query_refused");
    let missing = fixture.run(&["query", "--database", &fixture.database_path.display().to_string(), "SELECT 1"]);
    assert_eq!(missing.exit_code, Some(1));
    assert!(missing.stderr.contains("does not exist"), "{}", missing.stderr);
    fixture.run_with_options("initialize", &[]);
    let write = fixture.run(&["query", "--database", &fixture.database_path.display().to_string(), "DELETE FROM chat_sessions"]);
    assert_eq!(write.exit_code, Some(1));
    assert!(write.stderr.starts_with("Error: "), "{}", write.stderr);
    let database = ChatSessionsDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "fake-owner/fake-name"), Ok(2));
}

#[test]
fn exits_with_the_code_1_for_a_folder_without_remote_origin_and_for_an_unknown_command() {
    let fixture = Fixture::new("errors");
    let bare = fixture.folder.join("bare").canonicalize_or_create();
    Command::new("git").arg("-C").arg(&bare).args(["init", "-q"]).status().unwrap();
    let no_origin = fixture.run(&["initialize", "--folder", &bare.display().to_string(), "--database", &fixture.database_path.display().to_string()]);
    assert_eq!(no_origin.exit_code, Some(1));
    assert!(no_origin.stderr.contains("--repository"), "{}", no_origin.stderr);
    let unknown = fixture.run(&["fetch"]);
    assert_eq!(unknown.exit_code, Some(1));
    assert!(unknown.stderr.starts_with("Error: The command fetch is not known"), "{}", unknown.stderr);
}
