//! Tests of the executable `data_layer_source_control`, with a real Git repository in a temporary folder. The repository has
//! three commits in a line, and the remote `origin` `git@github.com:fake-owner/fake-name.git`.

use data_layer_source_control::SourceControlDatabase;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Runs `git` in a folder with a fixed identity and no configuration file of the developer, and gives its standard output.
fn git(folder: &Path, arguments: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(folder)
        .args(arguments)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_AUTHOR_NAME", "Ada Author")
        .env("GIT_AUTHOR_EMAIL", "ada@example.com")
        .env("GIT_COMMITTER_NAME", "Cora Committer")
        .env("GIT_COMMITTER_EMAIL", "cora@example.com")
        .output()
        .unwrap();
    assert!(output.status.success(), "git {} failed: {}", arguments.join(" "), String::from_utf8_lossy(&output.stderr));
    String::from_utf8_lossy(&output.stdout).trim_end().to_string()
}

/// Writes a file in the repository, and makes a commit with it.
fn commit_file(repository_folder: &Path, file_name: &str, subject: &str) {
    std::fs::write(repository_folder.join(file_name), format!("{subject}\n")).unwrap();
    git(repository_folder, &["add", file_name]);
    git(repository_folder, &["commit", "--quiet", "-m", subject]);
}

/// A folder with a Git repository of three commits, a folder that is not a Git repository, and the path of a database file.
struct Fixture {
    folder: PathBuf,
    repository_folder: PathBuf,
    database_path: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

impl Fixture {
    /// Makes the folder and the repository.
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("data_layer_source_control_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        let repository_folder = folder.join("repository");
        std::fs::create_dir_all(&repository_folder).unwrap();
        std::fs::create_dir_all(folder.join("plain_folder")).unwrap();
        git(&repository_folder, &["init", "--quiet", "--initial-branch=main"]);
        git(&repository_folder, &["remote", "add", "origin", "git@github.com:fake-owner/fake-name.git"]);
        commit_file(&repository_folder, "first.txt", "First commit");
        commit_file(&repository_folder, "second.txt", "Second commit");
        commit_file(&repository_folder, "third.txt", "Third commit");
        let database_path = folder.join("data_layer.sqlite");
        Fixture { folder, repository_folder, database_path }
    }

    /// Runs the executable with `arguments`, in the folder `directory`.
    fn run_in(&self, directory: &Path, arguments: &[&str]) -> CliResult {
        let output = Command::new(env!("CARGO_BIN_EXE_data_layer_source_control"))
            .args(arguments)
            .env("HEIDRUN_REQUEST_LOG_FILE", "off")
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .current_dir(directory)
            .output()
            .unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code(),
        }
    }

    /// Runs the executable with `arguments`, in the folder that holds the repository.
    fn run(&self, arguments: &[&str]) -> CliResult {
        self.run_in(&self.folder, arguments)
    }

    /// The path of the repository, as text.
    fn repository(&self) -> &str {
        self.repository_folder.to_str().unwrap()
    }

    /// The path of the database file, as text.
    fn database(&self) -> &str {
        self.database_path.to_str().unwrap()
    }
}

#[test]
fn initialize_writes_the_rows_of_the_repository_that_the_remote_origin_names() {
    let fixture = Fixture::new("initialize");
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--folder", fixture.repository()]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("fake-owner/fake-name"));
    assert!(result.stdout.contains("(initialize)"));
    assert!(result.stdout.contains("commits: 3 written, 0 already in the database"));
    let database = SourceControlDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_commits("fake-owner/fake-name"), Ok(3));
}

#[test]
fn initialize_without_the_option_folder_reads_the_current_folder() {
    let fixture = Fixture::new("current_folder");
    let result = fixture.run_in(&fixture.repository_folder, &["initialize", "--database", fixture.database()]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("commits: 3 written"));
}

#[test]
fn update_reads_only_the_commits_that_the_database_does_not_hold() {
    let fixture = Fixture::new("update");
    fixture.run(&["initialize", "--database", fixture.database(), "--folder", fixture.repository()]);
    commit_file(&fixture.repository_folder, "fourth.txt", "Fourth commit");
    let result = fixture.run(&["update", "--database", fixture.database(), "--folder", fixture.repository()]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("(update)"));
    assert!(result.stdout.contains("commits: 1 written, 3 already in the database"));
    let database = SourceControlDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_commits("fake-owner/fake-name"), Ok(4));
}

#[test]
fn the_option_repository_gives_the_name_of_the_repository_in_the_database() {
    let fixture = Fixture::new("repository_option");
    let result = fixture.run(&[
        "initialize",
        "--database",
        fixture.database(),
        "--folder",
        fixture.repository(),
        "--repository",
        "owner/name",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let database = SourceControlDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_commits("owner/name"), Ok(3));
    assert_eq!(database.count_commits("fake-owner/fake-name"), Ok(0));
}

#[test]
fn verbose_prints_the_progress_on_the_standard_error_output() {
    let fixture = Fixture::new("verbose");
    let result = fixture.run(&[
        "initialize",
        "--database",
        fixture.database(),
        "--folder",
        fixture.repository(),
        "--repository",
        "owner/name",
        "--verbose",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("repository: owner/name"));
    assert!(result.stderr.contains(&format!("database: {}", fixture.database())));
    assert!(result.stderr.contains("git: 3 commits are reachable"));
    assert!(result.stderr.contains("git: batch 1 of 1 read, commit count 3"));
    assert!(result.stderr.contains(&format!("commits: written row count 3, file {}", fixture.database())));
    assert!(!result.stdout.contains("batch"));
}

#[test]
fn without_verbose_nothing_is_printed_on_the_standard_error_output() {
    let fixture = Fixture::new("quiet");
    let result = fixture.run(&[
        "initialize",
        "--database",
        fixture.database(),
        "--folder",
        fixture.repository(),
        "--repository",
        "owner/name",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(result.stderr, "");
}

#[test]
fn query_prints_the_rows_as_a_text_table() {
    let fixture = Fixture::new("query_table");
    fixture.run(&["initialize", "--database", fixture.database(), "--folder", fixture.repository()]);
    let result = fixture.run(&[
        "query",
        "--database",
        fixture.database(),
        "SELECT json_extract(data, '$.subject') AS subject FROM commits ORDER BY subject",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("subject"));
    assert!(result.stdout.contains("First commit"));
    assert!(result.stdout.contains("row count: 3"));
}

#[test]
fn query_with_the_option_json_prints_a_json_list() {
    let fixture = Fixture::new("query_json");
    fixture.run(&["initialize", "--database", fixture.database(), "--folder", fixture.repository()]);
    let result = fixture.run(&[
        "query",
        "--database",
        fixture.database(),
        "--json",
        "SELECT count(*) AS count FROM commits WHERE json_array_length(data, '$.parents') = 0",
    ]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(serde_json::from_str::<Value>(&result.stdout).unwrap(), json!([{ "count": 1 }]));
}

#[test]
fn query_refuses_a_statement_that_writes_and_the_rows_stay() {
    let fixture = Fixture::new("query_write");
    fixture.run(&["initialize", "--database", fixture.database(), "--folder", fixture.repository()]);
    let result = fixture.run(&["query", "--database", fixture.database(), "DELETE FROM commits"]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("readonly"));
    let database = SourceControlDatabase::open(&fixture.database_path).unwrap();
    assert_eq!(database.count_commits("fake-owner/fake-name"), Ok(3));
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
fn prints_the_error_and_exits_with_the_code_1_when_the_folder_is_not_in_a_git_repository() {
    let fixture = Fixture::new("not_a_repository");
    let plain_folder = fixture.folder.join("plain_folder");
    let result = fixture.run(&[
        "initialize",
        "--database",
        fixture.database(),
        "--folder",
        plain_folder.to_str().unwrap(),
        "--repository",
        "owner/name",
    ]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("not a git repository"));
}

#[test]
fn prints_the_error_and_exits_with_the_code_1_when_the_repository_has_no_remote_origin() {
    let fixture = Fixture::new("no_origin");
    git(&fixture.repository_folder, &["remote", "remove", "origin"]);
    let result = fixture.run(&["initialize", "--database", fixture.database(), "--folder", fixture.repository()]);
    assert_eq!(result.exit_code, Some(1));
    assert!(result.stderr.contains("Error:"));
    assert!(result.stderr.contains("origin"));
    assert!(result.stderr.contains("--repository") || result.stderr.contains("cannot be found"));
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
