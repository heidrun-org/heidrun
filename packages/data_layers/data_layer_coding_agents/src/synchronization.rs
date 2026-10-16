//! Fills the tables of the chat sessions from the files of Claude Code and of Codex, in the mode initialize or update.
//!
//! The date of the last read is not stored anywhere else: it is the largest value of the column `updatedAt` of the table
//! `chat_sessions`, for the repository. The mode update reads again only the chat session files that changed at this date or
//! later. When the table has no row for the repository, the mode update reads everything, as the mode initialize does.
//!
//! The tables of the configuration of the coding agent are small, so both modes read every memory file, subagent, and skill.

use crate::coding_agents::configuration_reader::{read_configuration, ConfigurationFolders};
use crate::coding_agents::scan_cache::ScanCache;
use crate::coding_agents::session_reader::{format_date, parse_date, read_chat_sessions};
use crate::model::configuration_types::ConfigurationWriteCount;
use crate::model::types::{SynchronizationMode, SynchronizationReport};
use crate::storage::configuration_database::ConfigurationDatabase;
use crate::storage::database::ChatSessionsDatabase;
use std::path::Path;

/// Reads the chat sessions of a folder, and writes them in the database. `log` receives one line of progress for the date
/// where the read starts, for each coding agent, and for the write.
///
/// # Errors
/// An error when the database cannot be read or written, or when a chat session does not follow its JSON schema.
pub fn run(
    mode: SynchronizationMode,
    repository: &str,
    folder: &str,
    claude_projects: &Path,
    codex_home: &Path,
    database: &mut ChatSessionsDatabase,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let since = match mode {
        SynchronizationMode::Initialize => None,
        SynchronizationMode::Update => database.find_last_updated_at(repository)?,
    };
    log(&format!("mode {}: chat sessions are read {}", mode.name(), describe_since(since.as_deref())));
    let modified_since = since.as_deref().and_then(parse_date);
    let mut cache = ScanCache::in_memory();
    let records = read_chat_sessions(&mut cache, claude_projects, codex_home, folder, modified_since, log);
    database.upsert_chat_sessions(repository, &records)?;
    log(&format!("chat sessions: written row count {}, file {}", records.len(), database.database_path().display()));
    Ok(SynchronizationReport {
        mode,
        repository: repository.to_string(),
        since,
        chat_session_count: records.len(),
    })
}

/// Reads the memory files, the subagents, and the skills of the repository, and writes them in the database. A row whose
/// file the read does not find any more is marked as removed at the date of now. `log` receives one line of progress for
/// each table.
///
/// # Errors
/// An error when the database cannot be written, or when an item does not follow its JSON schema.
pub fn run_configuration(
    repository: &str,
    folders: &ConfigurationFolders,
    database: &mut ConfigurationDatabase,
    log: &dyn Fn(&str),
) -> Result<Vec<ConfigurationWriteCount>, String> {
    let milliseconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();
    let now = format_date(milliseconds).ok_or("The date of now cannot be written.")?;
    let mut counts = Vec::new();
    for read in read_configuration(folders) {
        let count = database.write_configuration(repository, &read, &now)?;
        log(&format!(
            "{}: written row count {}, marked as removed {}",
            read.kind.table_name(),
            count.written_count,
            count.removed_count
        ));
        counts.push(count);
    }
    Ok(counts)
}

/// Writes in words the date where a read starts: `since the beginning` for `None`, otherwise `since` and the date.
pub fn describe_since(since: Option<&str>) -> String {
    match since {
        None => "since the beginning".to_string(),
        Some(date) => format!("since {date}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coding_agents::session_files::claude_folder_name;
    use crate::model::types::ChatSessionTable;
    use crate::test_samples::{codex_file, codex_message, ignore_log, temp_folder, write_file};

    const REPOSITORY: &str = "heidrun-org/heidrun";
    const TYPED: &str = r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;

    /// Writes a chat session file of Claude Code for `/work/app`.
    fn claude_file(directory: &Path, name: &str, age_seconds: u64) {
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join(format!("{name}.jsonl")), &format!("{TYPED}\n"), age_seconds);
    }

    /// A folder with two chat sessions of Claude Code and one of Codex, and an empty database.
    fn fixture(name: &str) -> (PathBuf, ChatSessionsDatabase) {
        let directory = temp_folder(name);
        claude_file(&directory, "older", 1000);
        claude_file(&directory, "newer", 500);
        codex_file(&directory, "2026/10/10", "01a12c31-175b-7513-b12c-bba764f46420", "/work/app", &[&codex_message("Hi")], 800);
        let database = ChatSessionsDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        (directory, database)
    }

    fn synchronize(mode: SynchronizationMode, directory: &Path, database: &mut ChatSessionsDatabase) -> SynchronizationReport {
        run(mode, REPOSITORY, "/work/app", &directory.join("projects"), directory, database, &ignore_log).unwrap()
    }

    use std::path::PathBuf;

    #[test]
    fn initialize_reads_everything_since_the_beginning_and_writes_every_row() {
        let (directory, mut database) = fixture("initialize");
        let report = synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                repository: REPOSITORY.to_string(),
                since: None,
                chat_session_count: 3,
            }
        );
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(2));
        assert_eq!(database.find_relations(REPOSITORY, "newer").unwrap().issues, vec![250]);
    }

    #[test]
    fn initialize_two_times_in_a_row_gives_the_same_rows_with_no_row_written_two_times() {
        let (directory, mut database) = fixture("initialize_twice");
        synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        let report = synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!(report.chat_session_count, 3);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(2));
    }

    #[test]
    fn update_on_an_empty_database_reads_everything() {
        let (directory, mut database) = fixture("update_empty");
        let report = synchronize(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.since, report.chat_session_count), (None, 3));
    }

    #[test]
    fn update_reads_again_only_the_files_that_changed_since_the_last_read() {
        let (directory, mut database) = fixture("update_changes");
        synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        let last = database.find_last_updated_at(REPOSITORY).unwrap().unwrap();
        let report = synchronize(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.since.as_deref(), report.chat_session_count), (Some(last.as_str()), 1));
        let changed = format!("{TYPED}\n{}\n", r#"{"type":"user","message":{"role":"user","content":"Merge pull request 249"}}"#);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("older.jsonl"), &changed, 1);
        let report = synchronize(SynchronizationMode::Update, &directory, &mut database);
        // The file that gave the date of the last read is read again, with the file that changed.
        assert_eq!(report.chat_session_count, 2);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(3));
        assert_eq!(database.find_relations(REPOSITORY, "older").unwrap().pull_requests, vec![249]);
        assert_eq!(database.find_chat_session(REPOSITORY, "older").unwrap().unwrap().user_message_count, 2);
    }

    #[test]
    fn writes_nothing_for_a_folder_without_chat_sessions() {
        let directory = temp_folder("no_session");
        let mut database = ChatSessionsDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        let report = synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!(report.chat_session_count, 0);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(0));
    }

    #[test]
    fn writes_the_configuration_and_marks_a_removed_skill_on_the_next_run() {
        use crate::model::configuration_types::ConfigurationKind;
        let directory = temp_folder("configuration_run");
        let folders = ConfigurationFolders {
            root: directory.join("app"),
            claude_dir: directory.join("claude"),
            codex_home: directory.join("codex"),
            agents_home: directory.join("agents"),
        };
        let skill_file = folders.root.join(".claude/skills/a/SKILL.md");
        write_file(&skill_file, "---\nname: a\n---\n", 10);
        write_file(&folders.claude_dir.join("agents/b.md"), "---\nname: b\n---\n", 10);
        let mut database = ConfigurationDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        let counts = run_configuration(REPOSITORY, &folders, &mut database, &ignore_log).unwrap();
        let written: Vec<(usize, usize)> = counts.iter().map(|count| (count.written_count, count.removed_count)).collect();
        assert_eq!(written, [(0, 0), (1, 0), (1, 0)]);
        std::fs::remove_file(&skill_file).unwrap();
        let counts = run_configuration(REPOSITORY, &folders, &mut database, &ignore_log).unwrap();
        assert_eq!((counts[2].written_count, counts[2].removed_count), (0, 1));
        let skill_id = folders.root.join(".claude/skills/a").display().to_string();
        let skill = database.find_item(ConfigurationKind::Skill, REPOSITORY, &skill_id).unwrap().unwrap();
        assert!(skill.removed_at.is_some());
    }

    #[test]
    fn writes_in_words_the_date_where_a_read_starts() {
        assert_eq!(describe_since(None), "since the beginning");
        assert_eq!(describe_since(Some("2026-10-11T10:00:00.000Z")), "since 2026-10-11T10:00:00.000Z");
    }
}
