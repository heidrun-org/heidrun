//! Tests of the executable `data_layer_code_hosting`, with a fake `gh` command put at the start of the PATH. The fake `gh` command
//! answers the GraphQL queries from two files, and answers `gh repo view` with the repository `fake-owner/fake-name`.

use data_layer_code_hosting::{CodeHostingDatabase, CodeHostingTable};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

/// The fake `gh` command. It fails when the file `fail` exists, answers `gh repo view`, and prints the answer file of the list
/// that the query asks for.
const FAKE_GH_SCRIPT: &str = r#"#!/bin/sh
if [ -f "$FAKE_GH_DIRECTORY/fail" ]; then echo "fake gh: not signed in" >&2; exit 1; fi
if [ "$1" = "repo" ]; then echo "fake-owner/fake-name"; exit 0; fi
case "$*" in
  *"pullRequests("*) cat "$FAKE_GH_DIRECTORY/pull_requests.json" ;;
  *) cat "$FAKE_GH_DIRECTORY/issues.json" ;;
esac
"#;

/// A date in October 2026, in the format ISO 8601.
fn date(day: u32) -> String {
    format!("2026-10-{day:02}T10:00:00Z")
}

/// An issue as the GraphQL interface of GitHub answers it.
fn issue_node(number: i64, updated_at: &str) -> Value {
    json!({
        "number": number, "title": "An issue", "body": "The text of the issue.", "state": "CLOSED",
        "stateReason": "COMPLETED", "createdAt": date(1), "updatedAt": updated_at, "closedAt": date(2),
        "author": { "login": "jeromeetienne" }, "assignees": { "nodes": [] },
        "labels": { "nodes": [{ "name": "enhancement" }] }, "comments": { "totalCount": 1 },
    })
}

/// A pull request as the GraphQL interface of GitHub answers it.
fn pull_request_node(number: i64, updated_at: &str) -> Value {
    json!({
        "number": number, "title": "A pull request", "body": "Fixes #1.", "state": "MERGED", "isDraft": false,
        "baseRefName": "dev_jerome", "headRefName": "a-branch-1", "createdAt": date(1), "updatedAt": updated_at,
        "closedAt": date(2), "mergedAt": date(2), "additions": 10, "deletions": 2, "changedFiles": 3,
        "author": { "login": "jeromeetienne" }, "mergedBy": { "login": "jeromeetienne" },
        "mergeCommit": { "oid": "5065bbeb7a356b9e76c1e47e0b1c19876642f604" }, "labels": { "nodes": [] },
        "commits": { "totalCount": 4 },
    })
}

/// The answer of GitHub for one page that is the last page.
fn graphql_answer(connection_name: &str, nodes: Vec<Value>) -> String {
    json!({
        "data": { "repository": { connection_name: { "pageInfo": { "hasNextPage": false, "endCursor": null }, "nodes": nodes } } }
    })
    .to_string()
}

/// A folder with the fake `gh` command, its two answer files, and the path of a database file.
struct Fixture {
    folder: PathBuf,
    database_path: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

impl Fixture {
    /// Makes the folder. The two issues are the numbers 2 (changed on the day 4) and 1 (day 3), and the pull request is the
    /// number 3 (day 5).
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("data_layer_code_hosting_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(folder.join("bin")).unwrap();
        let gh_path = folder.join("bin").join("gh");
        std::fs::write(&gh_path, FAKE_GH_SCRIPT).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&gh_path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        std::fs::write(
            folder.join("issues.json"),
            graphql_answer("issues", vec![issue_node(2, &date(4)), issue_node(1, &date(3))]),
        )
        .unwrap();
        std::fs::write(
            folder.join("pull_requests.json"),
            graphql_answer("pullRequests", vec![pull_request_node(3, &date(5))]),
        )
        .unwrap();
        let database_path = folder.join("data_layer.sqlite");
        Fixture { folder, database_path }
    }

    /// Runs the executable with `arguments`, with the fake `gh` command first in the PATH.
    fn run(&self, arguments: &[&str]) -> CliResult {
        let output = Command::new(env!("CARGO_BIN_EXE_data_layer_code_hosting"))
            .args(arguments)
            .env("HEIDRUN_REQUEST_LOG_FILE", "off")
            .env("PATH", format!("{}:/usr/bin:/bin", self.folder.join("bin").display()))
            .env("FAKE_GH_DIRECTORY", &self.folder)
            .current_dir(&self.folder)
            .output()
            .unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code(),
        }
    }

    /// The path of the database file, as text.
    fn database(&self) -> &str {
        self.database_path.to_str().unwrap()
    }
}

#[test]
fn initialize_writes_the_rows_of_the_repository_that_the_command_gh_finds() {
    let fixture = Fixture::new("initialize");
    let result = fixture.run(&["initialize", "--database", fixture.database()]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("fake-owner/fake-name"));
    assert!(result.stdout.contains("issues: 2 written, read since the beginning"));
    assert!(result.stdout.contains("pull requests: 1 written, read since the beginning"));
    let database = CodeHostingDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(CodeHostingTable::Issues, "fake-owner/fake-name"), Ok(2));
    assert_eq!(database.find_pull_request("fake-owner/fake-name", 3).unwrap().unwrap().number, 3);
}

#[test]
fn update_reads_since_the_date_of_the_last_read_and_takes_the_repository_of_the_option_repository() {
    let fixture = Fixture::new("update");
    fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name"]);
    let result = fixture.run(&["update", "--database", fixture.database(), "--repository", "owner/name"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains(&format!("issues: 1 written, read since {}", date(4))));
    assert!(result.stdout.contains(&format!("pull requests: 1 written, read since {}", date(5))));
    let database = CodeHostingDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(CodeHostingTable::Issues, "owner/name"), Ok(2));
}

#[test]
fn verbose_prints_the_progress_on_the_standard_error_output() {
    let fixture = Fixture::new("verbose");
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name", "--verbose"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("repository: owner/name"));
    assert!(result.stderr.contains(&format!("database: {}", fixture.database())));
    assert!(result.stderr.contains("issues: asking for page 1 of owner/name"));
    assert!(result.stderr.contains("issues: stop, page 1 is the last page"));
    assert!(result.stderr.contains("pullRequests: page 1 read, item count 1"));
    assert!(result.stderr.contains(&format!("issues: written row count 2, file {}", fixture.database())));
    assert!(!result.stdout.contains("asking for page"));
}

#[test]
fn without_verbose_nothing_is_printed_on_the_standard_error_output() {
    let fixture = Fixture::new("quiet");
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.stderr, "");
}

#[test]
fn query_prints_the_rows_as_a_text_table() {
    let fixture = Fixture::new("query_table");
    fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name"]);
    let result = fixture.run(&[
        "query",
        "--database",
        fixture.database(),
        "SELECT number, json_extract(data, '$.title') AS title FROM issues ORDER BY number",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("number  title"));
    assert!(result.stdout.contains("1       An issue"));
    assert!(result.stdout.contains("row count: 2"));
}

#[test]
fn query_with_the_option_json_prints_a_json_list() {
    let fixture = Fixture::new("query_json");
    fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name"]);
    let result = fixture.run(&["query", "--database", fixture.database(), "--json", "SELECT count(*) AS count FROM issues"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(serde_json::from_str::<Value>(&result.stdout).unwrap(), json!([{ "count": 2 }]));
}

#[test]
fn query_refuses_a_statement_that_writes_and_the_rows_stay() {
    let fixture = Fixture::new("query_write");
    fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name"]);
    let result = fixture.run(&["query", "--database", fixture.database(), "DELETE FROM issues"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("readonly"));
    let database = CodeHostingDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(CodeHostingTable::Issues, "owner/name"), Ok(2));
}

#[test]
fn query_exits_with_the_code_1_and_creates_no_file_when_the_database_does_not_exist() {
    let fixture = Fixture::new("query_missing");
    let result = fixture.run(&["query", "--database", fixture.database(), "SELECT 1"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("does not exist"));
    assert!(!fixture.database_path.exists());
}

#[test]
fn prints_the_error_and_exits_with_the_code_1_when_the_command_gh_fails() {
    let fixture = Fixture::new("gh_fails");
    std::fs::write(fixture.folder.join("fail"), "").unwrap();
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--repository", "owner/name"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("fake gh: not signed in"));
}

#[test]
fn prints_the_error_and_exits_with_the_code_1_when_the_command_is_wrong() {
    let fixture = Fixture::new("wrong_command");
    let result = fixture.run(&["fetch"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error: The command fetch is not known"));
}

#[test]
fn shows_the_three_commands_in_the_help() {
    let fixture = Fixture::new("help");
    let result = fixture.run(&["--help"]);
    assert_eq!(result.exit_code, Some(0));
    for command in ["initialize", "update", "query"] {
        assert!(result.stdout.contains(command), "{command}");
    }
}
