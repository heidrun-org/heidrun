//! Tests of the executable `heidrun_data`, with a real Git repository of two commits and the remote `origin`
//! `fake-owner/fake-name`, a fake `gh` command put at the start of the PATH, a fake folder of Claude Code with one chat
//! session, an empty fake folder of Codex, and a fake file of two user activity records.

use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// The fake `gh` command. It fails when the file `fail` exists, answers `gh repo view`, and prints the answer file of the list
/// that the query asks for.
const FAKE_GH_SCRIPT: &str = r#"#!/bin/sh
if [ -f "$FAKE_GH_DIRECTORY/fail" ]; then echo "fake gh: not signed in" >&2; exit 1; fi
if [ "$1" = "repo" ]; then echo "fake-owner/fake-name"; exit 0; fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ]; then cat "$FAKE_GH_DIRECTORY/pull_request.diff"; exit 0; fi
case "$*" in
  *"issue(number: 1)"*) cat "$FAKE_GH_DIRECTORY/issue.json" ;;
  *"pullRequest(number: 2)"*) cat "$FAKE_GH_DIRECTORY/pull_request.json" ;;
  *"pullRequests("*) cat "$FAKE_GH_DIRECTORY/pull_requests.json" ;;
  *) cat "$FAKE_GH_DIRECTORY/issues.json" ;;
esac
"#;

/// A message of the developer, in a chat session file of Claude Code.
const TYPED: &str = r#"{"type":"user","cwd":"FOLDER","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 1"}}"#;

/// A date in October 2026, in the format ISO 8601.
fn date(day: u32) -> String {
    format!("2026-10-{day:02}T10:00:00Z")
}

/// The answer of GitHub for the issue 1 and its comments.
fn issue_answer() -> String {
    json!({ "data": { "repository": { "issue": {
        "number": 1, "title": "An issue", "body": "The text of the issue.", "createdAt": date(1), "state": "CLOSED",
        "author": { "login": "jeromeetienne" },
        "comments": { "pageInfo": { "hasNextPage": false, "endCursor": null }, "nodes": [
            { "createdAt": date(2), "body": "A comment.", "author": { "login": "eric" } },
        ] },
    } } } })
    .to_string()
}

/// The answer of GitHub for the pull request 2, its comments, and its reviews.
fn pull_request_answer() -> String {
    json!({ "data": { "repository": { "pullRequest": {
        "number": 2, "title": "A pull request", "body": "Fixes #1.", "createdAt": date(1), "state": "MERGED",
        "author": { "login": "jeromeetienne" },
        "comments": { "pageInfo": { "hasNextPage": false, "endCursor": null }, "nodes": [] },
        "reviews": { "nodes": [{
            "submittedAt": date(2), "body": "", "state": "COMMENTED", "author": { "login": "eric" },
            "comments": { "nodes": [{
                "createdAt": date(2), "body": "Rename this.", "path": "first.txt", "line": 1, "originalLine": 1,
                "author": { "login": "eric" },
            }] },
        }] },
    } } } })
    .to_string()
}

/// The answer of GitHub for one page of issues that is the last page.
fn issues_answer() -> String {
    json!({ "data": { "repository": { "issues": {
        "pageInfo": { "hasNextPage": false, "endCursor": null },
        "nodes": [{
            "number": 1, "title": "An issue", "body": "The text of the issue.", "state": "CLOSED",
            "stateReason": "COMPLETED", "createdAt": date(1), "updatedAt": date(3), "closedAt": date(2),
            "author": { "login": "jeromeetienne" }, "assignees": { "nodes": [] },
            "labels": { "nodes": [] }, "comments": { "totalCount": 1 },
        }],
    } } } })
    .to_string()
}

/// The answer of GitHub for one page of pull requests that is the last page.
fn pull_requests_answer() -> String {
    json!({ "data": { "repository": { "pullRequests": {
        "pageInfo": { "hasNextPage": false, "endCursor": null },
        "nodes": [{
            "number": 2, "title": "A pull request", "body": "Fixes #1.", "state": "MERGED", "isDraft": false,
            "baseRefName": "dev_jerome", "headRefName": "a-branch-1", "createdAt": date(1), "updatedAt": date(5),
            "closedAt": date(2), "mergedAt": date(2), "additions": 10, "deletions": 2, "changedFiles": 3,
            "author": { "login": "jeromeetienne" }, "mergedBy": { "login": "jeromeetienne" },
            "mergeCommit": { "oid": "5065bbeb7a356b9e76c1e47e0b1c19876642f604" }, "labels": { "nodes": [] },
            "commits": { "totalCount": 4 },
        }],
    } } } })
    .to_string()
}

/// The line of a user activity record of the file, at the hour `hour` of the day 14 of October 2026, in UTC.
fn user_activity_line(hour: u32) -> String {
    json!({
        "workspaceFolder": "/work/heidrun",
        "startedAt": format!("2026-10-14T{hour:02}:00:00.000Z"),
        "lastActionAt": format!("2026-10-14T{hour:02}:10:00.000Z"),
        "endedAt": format!("2026-10-14T{hour:02}:10:05.000Z"),
        "keyboardActionCount": 40,
        "mouseActionCount": 12,
        "endReason": "cool_down",
    })
    .to_string()
}

/// Runs `git` in a folder with a fixed author and no configuration file of the developer.
fn git(folder: &Path, arguments: &[&str]) {
    let status = Command::new("git")
        .arg("-C")
        .arg(folder)
        .args(arguments)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_AUTHOR_NAME", "Ada Author")
        .env("GIT_AUTHOR_EMAIL", "ada@example.com")
        .env("GIT_COMMITTER_NAME", "Ada Author")
        .env("GIT_COMMITTER_EMAIL", "ada@example.com")
        .status()
        .unwrap();
    assert!(status.success());
}

/// The name that Claude Code gives to the folder of its chat sessions of `folder`.
fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

/// The fake sources of the four data layers in a temporary folder, and the path of a database file.
struct Fixture {
    folder: PathBuf,
    repository: PathBuf,
    database_path: PathBuf,
    user_activity_file: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

impl CliResult {
    /// Each line of the standard output, read as one JSON object.
    fn json_lines(&self) -> Vec<Value> {
        self.stdout
            .lines()
            .map(|line| {
                let value: Value = serde_json::from_str(line).unwrap_or_else(|_| panic!("Not a JSON line: {line}"));
                assert!(value.is_object(), "Not a JSON object: {line}");
                value
            })
            .collect()
    }
}

impl Fixture {
    /// Makes the folder and the fake sources.
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("heidrun_data_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(folder.join("repository")).unwrap();
        let repository = folder.join("repository").canonicalize().unwrap();
        git(&repository, &["init", "--quiet", "--initial-branch", "main"]);
        git(&repository, &["remote", "add", "origin", "git@github.com:fake-owner/fake-name.git"]);
        for (file, subject) in [("first.txt", "First commit"), ("second.txt", "Second commit")] {
            std::fs::write(repository.join(file), subject).unwrap();
            git(&repository, &["add", file]);
            git(&repository, &["commit", "--quiet", "-m", subject]);
        }
        std::fs::create_dir_all(folder.join("bin")).unwrap();
        let gh_path = folder.join("bin").join("gh");
        std::fs::write(&gh_path, FAKE_GH_SCRIPT).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&gh_path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        std::fs::write(folder.join("issues.json"), issues_answer()).unwrap();
        std::fs::write(folder.join("pull_requests.json"), pull_requests_answer()).unwrap();
        std::fs::write(folder.join("issue.json"), issue_answer()).unwrap();
        std::fs::write(folder.join("pull_request.json"), pull_request_answer()).unwrap();
        std::fs::write(folder.join("pull_request.diff"), "diff --git a/first.txt b/first.txt\n+First commit\n").unwrap();
        let project = folder.join("claude").join("projects").join(claude_folder_name(&repository.display().to_string()));
        std::fs::create_dir_all(&project).unwrap();
        let typed = TYPED.replace("FOLDER", &repository.display().to_string());
        std::fs::write(project.join("a-chat-session.jsonl"), format!("{typed}\n")).unwrap();
        std::fs::create_dir_all(folder.join("codex")).unwrap();
        let user_activity_file = folder.join("user_activity.jsonl");
        std::fs::write(&user_activity_file, format!("{}\n{}\n", user_activity_line(10), user_activity_line(11))).unwrap();
        Fixture { database_path: folder.join("data_layer.sqlite"), repository, user_activity_file, folder }
    }

    /// Writes a compressed chat session file of Codex with the id `id`, which started in the repository.
    fn write_compressed_codex_file(&self, id: &str) {
        let folder = self.folder.join("codex").join("sessions").join("2026").join("10").join("10");
        std::fs::create_dir_all(&folder).unwrap();
        let at = "2026-10-10T10:00:00.000Z";
        let lines = [
            json!({ "type": "session_meta", "timestamp": at, "payload": { "id": id, "cwd": self.repository.display().to_string() } }),
            json!({ "type": "response_item", "timestamp": at, "payload": { "type": "message", "role": "user", "content": [{ "type": "input_text", "text": "Fix the issue 1" }] } }),
            json!({ "type": "response_item", "timestamp": at, "payload": { "type": "function_call", "name": "shell", "arguments": "{\"command\":[\"ls\"]}" } }),
            json!({ "type": "response_item", "timestamp": at, "payload": { "type": "message", "role": "assistant", "content": [{ "type": "output_text", "text": "Done." }] } }),
        ];
        let text: String = lines.iter().map(|line| format!("{line}\n")).collect();
        let path = folder.join(format!("rollout-2026-10-10T10-00-00-{id}.jsonl.zst"));
        std::fs::write(path, zstd::encode_all(text.as_bytes(), 0).unwrap()).unwrap();
    }

    /// Runs the executable in the Git repository with the fake sources, and gives `input` on the standard input.
    fn run_with_input(&self, arguments: &[&str], input: &str) -> CliResult {
        let mut child = Command::new(env!("CARGO_BIN_EXE_heidrun_data"))
            .args(arguments)
            .env("PATH", format!("{}:/usr/bin:/bin", self.folder.join("bin").display()))
            .env("FAKE_GH_DIRECTORY", &self.folder)
            .env("CLAUDE_CONFIG_DIR", self.folder.join("claude"))
            .env("CODEX_HOME", self.folder.join("codex"))
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env_remove("HEIDRUN_DIR")
            .current_dir(&self.repository)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(input.as_bytes()).unwrap();
        let output = child.wait_with_output().unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code: output.status.code(),
        }
    }

    /// Runs the executable with the database file of the fixture, after the other arguments.
    fn run(&self, arguments: &[&str]) -> CliResult {
        let database = self.database_path.display().to_string();
        let mut all_arguments = arguments.to_vec();
        all_arguments.extend(["--database", database.as_str()]);
        self.run_with_input(&all_arguments, "")
    }

    /// Runs `update` with the file of the user activity records of the fixture, and more arguments.
    fn update(&self, more: &[&str]) -> CliResult {
        let file = self.user_activity_file.display().to_string();
        let mut arguments = vec!["update", "--file", file.as_str()];
        arguments.extend_from_slice(more);
        self.run(&arguments)
    }

    /// Runs one query in the format jsonl, and gives its rows.
    fn query(&self, sql: &str) -> Vec<Value> {
        let result = self.run(&["query", "--format", "jsonl", sql]);
        assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
        result.json_lines()
    }
}

#[test]
fn prints_the_help_of_the_program_and_of_each_command() {
    let fixture = Fixture::new("help");
    let result = fixture.run_with_input(&["--help"], "");
    assert_eq!(result.exit_code, Some(0));
    assert!(result.stdout.starts_with("Usage: heidrun_data <command> [options]"));
    for command in ["sources", "update", "initialize", "query"] {
        assert!(result.stdout.contains(&format!("  {command}")), "{command}");
    }
    let result = fixture.run_with_input(&["query", "--help"], "");
    assert!(result.stdout.starts_with("Usage: heidrun_data query <sql>") && result.stdout.contains("--limit"));
    let result = fixture.run_with_input(&["update", "--help"], "");
    assert!(result.stdout.starts_with("Usage: heidrun_data update") && result.stdout.contains("--file"));
}

#[test]
fn update_with_no_source_writes_the_tables_of_the_four_sources_in_one_run() {
    let fixture = Fixture::new("update_all");
    let result = fixture.update(&["--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.stderr, "");
    assert_eq!(
        result.json_lines(),
        vec![
            json!({ "source": "source_control", "mode": "update", "repository": "fake-owner/fake-name", "writtenRows": { "commits": 2 } }),
            json!({ "source": "code_hosting", "mode": "update", "repository": "fake-owner/fake-name", "writtenRows": { "issues": 1, "pull_requests": 1 } }),
            json!({ "source": "chat_sessions", "mode": "update", "repository": "fake-owner/fake-name", "writtenRows": { "chat_sessions": 1 } }),
            json!({ "source": "user_activity", "mode": "update", "repository": null, "writtenRows": { "user_activity_records": 2 } }),
        ]
    );
    let counts = fixture.query(
        "SELECT (SELECT count(*) FROM commits) AS commits, (SELECT count(*) FROM issues) AS issues,
                (SELECT count(*) FROM pull_requests) AS pullRequests, (SELECT count(*) FROM chat_sessions) AS chatSessions,
                (SELECT count(*) FROM chat_session_issues) AS chatSessionIssues,
                (SELECT count(*) FROM user_activity_records) AS userActivityRecords",
    );
    assert_eq!(
        counts,
        vec![json!({ "commits": 2, "issues": 1, "pullRequests": 1, "chatSessions": 1, "chatSessionIssues": 1, "userActivityRecords": 2 })]
    );
}

#[test]
fn update_with_one_source_that_fails_writes_the_other_three_and_exits_with_the_code_1() {
    let fixture = Fixture::new("update_one_fails");
    std::fs::write(fixture.folder.join("fail"), "").unwrap();
    let result = fixture.update(&["--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(1));
    let sources: Vec<Value> = result.json_lines().into_iter().map(|line| line["source"].clone()).collect();
    assert_eq!(sources, vec![json!("source_control"), json!("chat_sessions"), json!("user_activity")]);
    let error_lines: Vec<&str> = result.stderr.lines().collect();
    assert_eq!(error_lines.len(), 1, "{}", result.stderr);
    let error: Value = serde_json::from_str(error_lines[0]).unwrap();
    assert_eq!(error["source"], json!("code_hosting"));
    assert!(error["error"].as_str().unwrap().contains("not signed in"), "{error}");
    assert_eq!(fixture.query("SELECT count(*) AS count FROM commits"), vec![json!({ "count": 2 })]);
}

#[test]
fn update_with_the_sources_given_runs_only_them_in_the_fixed_order() {
    let fixture = Fixture::new("update_some");
    let result = fixture.update(&["user_activity", "source_control", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let sources: Vec<Value> = result.json_lines().into_iter().map(|line| line["source"].clone()).collect();
    assert_eq!(sources, vec![json!("source_control"), json!("user_activity")]);
    let tables = fixture.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    assert_eq!(tables, vec![json!({ "name": "commits" }), json!({ "name": "user_activity_records" })]);
}

#[test]
fn initialize_and_update_give_the_counts_of_the_rows_written() {
    let fixture = Fixture::new("initialize_then_update");
    let file = fixture.user_activity_file.display().to_string();
    let result = fixture.run(&["initialize", "source_control", "user_activity", "--file", &file, "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.json_lines()[0]["mode"], json!("initialize"));
    let result = fixture.update(&["source_control", "--format", "jsonl"]);
    assert_eq!(result.json_lines(), vec![json!({
        "source": "source_control", "mode": "update", "repository": "fake-owner/fake-name", "writtenRows": { "commits": 0 },
    })]);
}

#[test]
fn update_writes_one_line_per_source_with_the_format_table_and_one_list_with_the_format_json() {
    let fixture = Fixture::new("update_formats");
    let result = fixture.update(&["source_control", "user_activity", "--format", "table"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(
        result.stdout,
        "source_control: fake-owner/fake-name (update): commits 2 written\nuser_activity (update): user_activity_records 2 written\n"
    );
    let result = fixture.update(&["source_control", "--json"]);
    let list: Value = serde_json::from_str(&result.stdout).unwrap();
    assert_eq!(list.as_array().map(Vec::len), Some(1));
    assert_eq!(list[0]["writtenRows"]["commits"], json!(0));
}

#[test]
fn update_with_verbose_prints_the_progress_on_the_standard_error_output() {
    let fixture = Fixture::new("update_verbose");
    let result = fixture.update(&["source_control", "--verbose", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("source source_control: mode update"), "{}", result.stderr);
    assert!(result.stderr.contains("commits: written row count 2"), "{}", result.stderr);
    assert_eq!(result.json_lines().len(), 1);
}

#[test]
fn sources_prints_the_tables_the_rows_and_the_last_date_of_each_source() {
    let fixture = Fixture::new("sources");
    fixture.update(&["--format", "jsonl"]);
    let result = fixture.run(&["sources", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let lines = result.json_lines();
    assert_eq!(lines.len(), 4);
    assert_eq!(lines[1], json!({
        "source": "code_hosting", "tables": { "issues": 1, "pull_requests": 1 }, "lastUpdatedAt": date(5),
    }));
    assert_eq!(lines[2]["tables"]["chat_session_issues"], json!(1));
    assert_eq!(lines[3]["lastUpdatedAt"], json!("2026-10-14T11:10:05.000Z"));
    let result = fixture.run(&["sources", "--format", "table"]);
    assert!(result.stdout.starts_with("source "), "{}", result.stdout);
    assert!(result.stdout.ends_with("row count: 9\n"), "{}", result.stdout);
}

#[test]
fn sources_on_a_file_that_does_not_exist_gives_0_rows_and_creates_no_file() {
    let fixture = Fixture::new("sources_missing");
    let result = fixture.run(&["sources", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.json_lines()[0], json!({ "source": "source_control", "tables": { "commits": 0 }, "lastUpdatedAt": null }));
    assert!(!fixture.database_path.exists());
}

#[test]
fn query_prints_one_json_object_per_line_or_one_list_or_a_table() {
    let fixture = Fixture::new("query_formats");
    fixture.update(&["source_control", "--format", "jsonl"]);
    let sql = "SELECT json_extract(data, '$.subject') AS subject FROM commits ORDER BY subject";
    let result = fixture.run(&["query", "--format", "jsonl", sql]);
    assert_eq!(result.stdout, "{\"subject\":\"First commit\"}\n{\"subject\":\"Second commit\"}\n");
    let result = fixture.run(&["query", "--json", sql]);
    assert_eq!(serde_json::from_str::<Value>(&result.stdout).unwrap(), json!([{ "subject": "First commit" }, { "subject": "Second commit" }]));
    let result = fixture.run(&["query", "--format", "table", sql]);
    assert_eq!(result.stdout, "subject\n-------------\nFirst commit\nSecond commit\nrow count: 2\n");
}

#[test]
fn query_with_a_statement_that_writes_fails_with_one_json_error() {
    let fixture = Fixture::new("query_write");
    fixture.update(&["source_control", "--format", "jsonl"]);
    let result = fixture.run(&["query", "--format", "jsonl", "DELETE FROM commits"]);
    assert_eq!(result.exit_code, Some(1));
    assert_eq!(result.stdout, "");
    let error: Value = serde_json::from_str(result.stderr.trim_end()).unwrap();
    assert!(error["error"].as_str().unwrap().contains("readonly"), "{error}");
    assert_eq!(error.get("source"), None);
    assert_eq!(fixture.query("SELECT count(*) AS count FROM commits"), vec![json!({ "count": 2 })]);
}

#[test]
fn query_on_a_file_that_does_not_exist_fails_and_creates_no_file() {
    let fixture = Fixture::new("query_missing");
    let result = fixture.run(&["query", "--format", "table", "SELECT 1"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.starts_with("Error: The database file does not exist"), "{}", result.stderr);
    assert!(!fixture.database_path.exists());
}

#[test]
fn query_adds_the_limit_1000_only_when_the_statement_has_no_limit_and_the_limit_is_not_0() {
    let fixture = Fixture::new("query_limit");
    fixture.update(&["source_control", "--format", "jsonl"]);
    let numbers = "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1500) SELECT i FROM n";
    assert_eq!(fixture.run(&["query", "--format", "jsonl", numbers]).json_lines().len(), 1000);
    assert_eq!(fixture.run(&["query", "--format", "jsonl", "--limit", "0", numbers]).json_lines().len(), 1500);
    assert_eq!(fixture.run(&["query", "--format", "jsonl", "--limit", "7", numbers]).json_lines().len(), 7);
    let with_limit = format!("{numbers} LIMIT 1200");
    assert_eq!(fixture.run(&["query", "--format", "jsonl", &with_limit]).json_lines().len(), 1200);
}

#[test]
fn query_reads_the_statement_from_the_standard_input_when_the_argument_is_a_dash() {
    let fixture = Fixture::new("query_stdin");
    fixture.update(&["source_control", "--format", "jsonl"]);
    let database = fixture.database_path.display().to_string();
    let result = fixture.run_with_input(
        &["query", "-", "--format", "jsonl", "--database", &database],
        "SELECT count(*) AS count FROM commits;\n",
    );
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.json_lines(), vec![json!({ "count": 2 })]);
}

#[test]
fn an_error_of_the_arguments_is_one_json_object_with_a_json_format_and_plain_text_with_the_format_table() {
    let fixture = Fixture::new("argument_error");
    let result = fixture.run_with_input(&["fetch", "--format", "jsonl"], "");
    assert_eq!(result.exit_code, Some(1));
    let error: Value = serde_json::from_str(result.stderr.trim_end()).unwrap();
    assert!(error["error"].as_str().unwrap().contains("fetch"));
    let result = fixture.run_with_input(&["fetch", "--format", "table"], "");
    assert!(result.stderr.starts_with("Error: The command fetch is not known"), "{}", result.stderr);
}

#[test]
fn the_default_format_is_jsonl_when_the_standard_output_is_not_a_terminal() {
    let fixture = Fixture::new("default_format");
    let result = fixture.run(&["sources"]);
    assert_eq!(result.json_lines().len(), 4);
}

#[test]
fn schema_with_no_table_prints_every_table_of_the_file_with_no_database_file() {
    let fixture = Fixture::new("schema_all");
    let result = fixture.run(&["schema", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let lines = result.json_lines();
    let tables: Vec<&str> = lines.iter().map(|line| line["table"].as_str().unwrap()).collect();
    assert_eq!(
        tables,
        [
            "commits",
            "issues",
            "pull_requests",
            "chat_sessions",
            "chat_session_folders",
            "chat_session_issues",
            "chat_session_pull_requests",
            "chat_session_files",
            "user_activity_records",
        ]
    );
    assert_eq!(lines[0]["primaryKey"], json!(["repository", "hash"]));
    assert_eq!(lines[0]["dataSchema"], json!("commit.schema.json"));
    assert_eq!(lines[5]["joins"][1]["table"], json!("issues"));
    assert!(!fixture.database_path.exists());
}

#[test]
fn schema_of_a_table_prints_bytes_equal_to_the_json_schema_file_of_its_package() {
    let fixture = Fixture::new("schema_table");
    let folder = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    for (table, file) in [
        ("chat_sessions", "data_layer_chat_sessions/schemas/chat_session.schema.json"),
        ("commits", "data_layer_source_control/schemas/commit.schema.json"),
        ("issues", "data_layer_code_hosting/schemas/issue.schema.json"),
        ("pull_requests", "data_layer_code_hosting/schemas/pull_request.schema.json"),
        ("user_activity_records", "data_layer_user_activity/schemas/user_activity_record.schema.json"),
    ] {
        let result = fixture.run(&["schema", table, "--format", "jsonl"]);
        assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
        assert_eq!(result.stdout, std::fs::read_to_string(folder.join(file)).unwrap(), "{table}");
    }
    let result = fixture.run(&["schema", "chat_session_files", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("link table"), "{}", result.stderr);
}

#[test]
fn schema_with_the_format_sql_prints_the_create_table_statements() {
    let fixture = Fixture::new("schema_sql");
    let result = fixture.run(&["schema", "--format", "sql"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.starts_with("CREATE TABLE commits (\n    repository TEXT NOT NULL,"), "{}", result.stdout);
    assert_eq!(result.stdout.matches("CREATE TABLE").count(), 9);
}

#[test]
fn read_chat_session_prints_the_records_of_a_chat_session_of_claude_code() {
    let fixture = Fixture::new("read_claude");
    let result = fixture.run(&["read", "chat_session", "a-chat-session", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.json_lines(), vec![json!({ "at": "2026-10-11T10:00:00.000Z", "role": "developer", "text": "Fix the issue 1" })]);
    assert!(!fixture.database_path.exists());
}

#[test]
fn read_chat_session_prints_the_records_of_a_compressed_chat_session_of_codex_from_a_sub_folder() {
    let fixture = Fixture::new("read_codex");
    let id = "01a12c31-175b-7513-b12c-bba764f46402";
    fixture.write_compressed_codex_file(id);
    std::fs::create_dir_all(fixture.repository.join("sub")).unwrap();
    let folder = fixture.repository.join("sub").display().to_string();
    let result = fixture.run(&["read", "chat_session", id, "--folder", &folder, "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let roles: Vec<Value> = result.json_lines().into_iter().map(|line| line["role"].clone()).collect();
    assert_eq!(roles, vec![json!("developer"), json!("tool"), json!("coding_agent")]);
    let result = fixture.run(&["read", "chat_session", id, "--format", "table"]);
    assert_eq!(result.stdout.lines().next(), Some("[2026-10-10T10:00:00.000Z] developer: Fix the issue 1"));
}

#[test]
fn read_chat_session_with_an_unknown_id_fails_with_one_json_error() {
    let fixture = Fixture::new("read_unknown");
    let result = fixture.run(&["read", "chat_session", "nothing", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(1));
    let error: Value = serde_json::from_str(result.stderr.trim_end()).unwrap();
    assert!(error["error"].as_str().unwrap().contains("has the id nothing"), "{error}");
}

#[test]
fn read_commit_prints_the_message_the_files_and_the_diff_of_a_commit_of_the_real_repository() {
    let fixture = Fixture::new("read_commit");
    let result = fixture.run(&["read", "commit", "HEAD", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let commit = &result.json_lines()[0];
    assert_eq!(commit["message"], json!("Second commit"));
    assert_eq!(commit["authorName"], json!("Ada Author"));
    assert_eq!(commit["files"], json!([{ "path": "second.txt", "insertions": 1, "deletions": 0 }]));
    assert!(commit["diff"].as_str().unwrap().contains("+Second commit"), "{commit}");
    let result = fixture.run(&["read", "commit", "HEAD~1", "--no-diff", "--format", "jsonl"]);
    let commit = &result.json_lines()[0];
    assert_eq!(commit["message"], json!("First commit"));
    assert_eq!(commit.get("diff"), None);
    let result = fixture.run(&["read", "commit", "0000000", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(1));
}

#[test]
fn read_issue_prints_the_body_then_the_comments_that_the_fake_gh_returns() {
    let fixture = Fixture::new("read_issue");
    let result = fixture.run(&["read", "issue", "1", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(
        result.json_lines(),
        vec![
            json!({ "kind": "issue", "author": "jeromeetienne", "at": date(1), "number": 1, "title": "An issue", "state": "CLOSED", "text": "The text of the issue." }),
            json!({ "kind": "comment", "author": "eric", "at": date(2), "text": "A comment." }),
        ]
    );
}

#[test]
fn read_pull_request_prints_the_body_the_review_comments_and_the_diff() {
    let fixture = Fixture::new("read_pull_request");
    let result = fixture.run(&["read", "pull_request", "2", "--repository", "fake-owner/fake-name", "--format", "jsonl"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let lines = result.json_lines();
    let kinds: Vec<Value> = lines.iter().map(|line| line["kind"].clone()).collect();
    assert_eq!(kinds, vec![json!("pull_request"), json!("review"), json!("review_comment"), json!("diff")]);
    assert_eq!(lines[2]["path"], json!("first.txt"));
    assert_eq!(lines[2]["line"], json!(1));
    assert_eq!(lines[3]["text"], json!("diff --git a/first.txt b/first.txt\n+First commit\n"));
    let result = fixture.run(&["read", "pull_request", "2", "--no-diff", "--format", "jsonl"]);
    assert_eq!(result.json_lines().len(), 3);
}
