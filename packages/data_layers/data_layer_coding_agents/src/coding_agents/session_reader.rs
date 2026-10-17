//! Reads the chat sessions of one folder from the files of Claude Code and of Codex, and turns each one into the stored shape.

use crate::coding_agents::scan::{feed_codex_line, shorten, Scan};
use crate::coding_agents::scan_cache::ScanCache;
use crate::coding_agents::tokens::model_tokens_of;
use crate::coding_agents::session_files::{
    find_claude_session_files, find_codex_session_files, read_codex_titles, title_of_scan, FolderScope, SessionFile,
};
use crate::model::types::{ChatSession, ChatSessionRecord, ChatSessionRelations, CodingAgent};
use chrono::{DateTime, SecondsFormat, Utc};
use std::path::Path;

/// The most characters of the title of a stored chat session. A longer title ends with an ellipsis.
const TITLE_LENGTH: usize = 160;

/// Reads the chat sessions of Claude Code and of Codex whose folder is `folder`, in the order of the files. The compressed
/// files of Codex are read, and the tokens of the subagents and of the workflows of a chat session of Claude Code count for it. A chat session
/// whose file changed before `modified_since` (milliseconds since 1970) is not read. A chat session without a title and
/// without a message is left out, and so is a review chat of Codex. `log` receives one line of progress for each coding agent.
pub fn read_chat_sessions(
    cache: &mut ScanCache,
    claude_projects: &Path,
    codex_home: &Path,
    folder: &str,
    modified_since: Option<i64>,
    log: &dyn Fn(&str),
) -> Vec<ChatSessionRecord> {
    let is_recent = |file: &SessionFile| modified_since.is_none_or(|since| file.modified >= since);
    let mut records = Vec::new();

    let claude_files = find_claude_session_files(cache, claude_projects, folder, FolderScope::Exactly);
    let recent_files: Vec<&SessionFile> = claude_files.iter().filter(|file| is_recent(file)).collect();
    log(&format!("claude code: {} chat session files, {} to read", claude_files.len(), recent_files.len()));
    for file in recent_files {
        let scan = cache.scan_claude(file);
        let title = title_of_scan(&scan);
        records.extend(record_of(CodingAgent::ClaudeCode, file, &scan, title));
    }

    let codex_files = find_codex_session_files(cache, codex_home, folder, FolderScope::Exactly);
    let recent_files: Vec<&SessionFile> = codex_files.iter().filter(|file| is_recent(file)).collect();
    log(&format!("codex: {} chat session files, {} to read", codex_files.len(), recent_files.len()));
    let titles = read_codex_titles(codex_home);
    for file in recent_files {
        let scan = cache.scan(file, feed_codex_line);
        if scan.meta.is_review_chat {
            continue;
        }
        let title = titles.get(&file.id).cloned().or_else(|| title_of_scan(&scan));
        records.extend(record_of(CodingAgent::Codex, file, &scan, title));
    }
    records
}

/// The date in milliseconds since 1970 as a text in the format ISO 8601, with the milliseconds and the zone `Z`. `None` when
/// the date is out of range.
pub fn format_date(milliseconds: i64) -> Option<String> {
    DateTime::<Utc>::from_timestamp_millis(milliseconds).map(|date| date.to_rfc3339_opts(SecondsFormat::Millis, true))
}

/// The date of a text in the format ISO 8601, in milliseconds since 1970. `None` when the text is not a date.
pub fn parse_date(text: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(text).ok().map(|date| date.timestamp_millis())
}

/// The stored shape of the chat session of one file. `None` when the chat session has no title and no message.
fn record_of(coding_agent: CodingAgent, file: &SessionFile, scan: &Scan, title: Option<String>) -> Option<ChatSessionRecord> {
    let title = shorten(&title?, TITLE_LENGTH);
    if title.is_empty() {
        return None;
    }
    let tokens = model_tokens_of(&scan.tokens.totals());
    let meta = &scan.meta;
    let chat_session = ChatSession {
        id: file.id.clone(),
        coding_agent,
        title,
        first_record_at: meta.first_at.and_then(format_date),
        last_record_at: meta.last_at.and_then(format_date),
        updated_at: format_date(file.modified)?,
        user_message_count: meta.user_messages,
        tokens,
    };
    let relations = ChatSessionRelations {
        folders: meta.folders.iter().cloned().collect(),
        issues: meta.issues.iter().map(|number| i64::from(*number)).collect(),
        pull_requests: meta.pull_requests.iter().map(|number| i64::from(*number)).collect(),
        files_written: meta.files_written.iter().cloned().collect(),
    };
    Some(ChatSessionRecord { chat_session, relations })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::types::ModelTokens;
    use crate::coding_agents::session_files::claude_folder_name;
    use crate::test_samples::{
        claude_answer_line, claude_user_line, codex_compressed_file, codex_file, codex_message, ignore_log, temp_folder,
        write_file,
    };

    const TYPED: &str = r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;
    const ANSWER: &str = r#"{"type":"assistant","cwd":"/work/app","timestamp":"2026-10-11T10:00:05.000Z","message":{"id":"msg_1","model":"claude-opus-5","role":"assistant","content":[{"type":"text","text":"Opening pull request #249"},{"type":"tool_use","name":"Write","input":{"file_path":"/work/app/a.ts"}}],"usage":{"input_tokens":10,"cache_creation_input_tokens":20,"cache_read_input_tokens":300,"output_tokens":5}}}"#;

    fn claude_file(directory: &Path, name: &str, lines: &[&str], age_seconds: u64) {
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join(format!("{name}.jsonl")), &format!("{}\n", lines.join("\n")), age_seconds);
    }

    fn read(directory: &Path, since: Option<i64>) -> Vec<ChatSessionRecord> {
        read_chat_sessions(&mut ScanCache::in_memory(), &directory.join("projects"), directory, "/work/app", since, &ignore_log)
    }

    #[test]
    fn turns_a_chat_session_of_claude_code_into_its_facts_and_its_relations() {
        let directory = temp_folder("reader_claude");
        let title = r#"{"type":"custom-title","customTitle":"Fix it"}"#;
        claude_file(&directory, "abc", &[TYPED, ANSWER, title], 100);
        let records = read(&directory, None);
        assert_eq!(records.len(), 1);
        let chat_session = &records[0].chat_session;
        assert_eq!((chat_session.id.as_str(), chat_session.title.as_str()), ("abc", "Fix it"));
        assert_eq!(chat_session.coding_agent, CodingAgent::ClaudeCode);
        assert_eq!(chat_session.first_record_at.as_deref(), Some("2026-10-11T10:00:00.000Z"));
        assert_eq!(chat_session.last_record_at.as_deref(), Some("2026-10-11T10:00:05.000Z"));
        assert_eq!(chat_session.user_message_count, 1);
        assert_eq!(
            chat_session.tokens,
            vec![ModelTokens {
                model: "claude-opus-5".into(),
                fresh_input: 10,
                cached_input: 300,
                cache_write_input: 20,
                output: 5
            }]
        );
        assert!(parse_date(&chat_session.updated_at).is_some());
        let relations = &records[0].relations;
        assert_eq!(relations.folders, vec!["/work/app"]);
        assert_eq!(relations.issues, vec![250]);
        assert_eq!(relations.pull_requests, vec![249]);
        assert_eq!(relations.files_written, vec!["/work/app/a.ts"]);
    }

    #[test]
    fn uses_the_first_message_as_the_title_and_leaves_out_a_chat_session_without_title_and_message() {
        let directory = temp_folder("reader_titles");
        claude_file(&directory, "with_message", &[TYPED], 100);
        claude_file(&directory, "empty", &[r#"{"type":"queue-operation"}"#], 100);
        let records = read(&directory, None);
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].chat_session.title, "Fix the issue 250");
    }

    #[test]
    fn reads_a_chat_session_of_codex_with_the_title_of_its_index() {
        let directory = temp_folder("reader_codex");
        let id = "01a12c31-175b-7513-b12c-bba764f46420";
        codex_file(&directory, "2026/10/10", id, "/work/app", &[&codex_message("Please fix issue 250")], 5);
        write_file(&directory.join("session_index.jsonl"), &format!("{{\"id\":\"{id}\",\"thread_name\":\"Fix it\"}}\n"), 1);
        let records = read(&directory, None);
        assert_eq!(records.len(), 1);
        assert_eq!((records[0].chat_session.id.as_str(), records[0].chat_session.title.as_str()), (id, "Fix it"));
        assert_eq!(records[0].chat_session.coding_agent, CodingAgent::Codex);
        assert_eq!(records[0].relations.issues, vec![250]);
    }

    #[test]
    fn leaves_out_a_review_chat_of_codex() {
        let directory = temp_folder("reader_codex_review");
        let id = "01a12c31-175b-7513-b12c-bba764f46430";
        let review = format!(
            r#"{{"type":"session_meta","payload":{{"id":"{id}","cwd":"/work/app","source":{{"subagent":{{"other":"guardian"}}}}}}}}"#
        );
        let name = format!("rollout-2026-10-10T01-02-03-{id}.jsonl");
        let text = format!("{review}\n{}\n", codex_message("Review this command"));
        write_file(&directory.join("sessions").join("2026/10/10").join(name), &text, 5);
        assert!(read(&directory, None).is_empty());
    }

    #[test]
    fn reads_only_the_files_that_changed_since_the_date() {
        let directory = temp_folder("reader_since");
        claude_file(&directory, "old", &[TYPED], 1000);
        claude_file(&directory, "new", &[TYPED], 10);
        let since = parse_date(&read(&directory, None).iter().map(|record| record.chat_session.updated_at.clone()).min().unwrap());
        assert_eq!(read(&directory, since).len(), 2);
        let newest = parse_date(&read(&directory, None).iter().map(|record| record.chat_session.updated_at.clone()).max().unwrap());
        let records = read(&directory, newest);
        assert_eq!(records.iter().map(|record| record.chat_session.id.as_str()).collect::<Vec<_>>(), vec!["new"]);
    }

    #[test]
    fn writes_and_reads_a_date_in_the_format_iso_8601() {
        assert_eq!(format_date(1_791_712_800_000).as_deref(), Some("2026-10-11T10:00:00.000Z"));
        assert_eq!(parse_date("2026-10-11T10:00:00.000Z"), Some(1_791_712_800_000));
        assert_eq!(parse_date("yesterday"), None);
    }

    #[test]
    fn cuts_a_long_title_with_an_ellipsis() {
        let directory = temp_folder("reader_long_title");
        let title = format!(r#"{{"type":"custom-title","customTitle":"{}"}}"#, "word ".repeat(100));
        claude_file(&directory, "long", &[&title], 5);
        let found = read(&directory, None);
        assert_eq!(found[0].chat_session.title.chars().count(), TITLE_LENGTH + 1);
        assert!(found[0].chat_session.title.ends_with('…'));
    }

    #[test]
    fn reads_a_compressed_chat_session_of_codex_but_not_a_chat_session_below_the_folder() {
        let directory = temp_folder("reader_compressed");
        let old = "01a12c31-175b-7513-b12c-bba764f46420";
        let below = "01a12c31-175b-7513-b12c-bba764f46421";
        codex_compressed_file(&directory, "2026/09/25", old, "/work/app", &[&codex_message("Please fix issue 250")], 5);
        codex_file(&directory, "2026/10/10", below, "/work/app/docs", &[&codex_message("Write the guide")], 5);
        let mut records = read(&directory, None);
        records.sort_by(|a, b| a.chat_session.id.cmp(&b.chat_session.id));
        assert_eq!(records.iter().map(|record| record.chat_session.id.as_str()).collect::<Vec<_>>(), vec![old]);
        assert_eq!(records[0].chat_session.title, "Please fix issue 250");
        assert_eq!(records[0].relations.issues, vec![250]);
    }

    #[test]
    fn counts_the_tokens_of_the_subagents_for_the_chat_session_and_does_not_read_a_chat_session_of_a_worktree() {
        let directory = temp_folder("reader_agents");
        claude_file(&directory, "abc", &[TYPED, ANSWER], 100);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        let agent = format!("{}\n", claude_answer_line("a1", 70));
        write_file(&project.join("abc").join("subagents").join("agent-1.jsonl"), &agent, 100);
        let worktree = directory.join("projects").join(claude_folder_name("/work/app/.claude/worktrees/fix"));
        write_file(&worktree.join("wt.jsonl"), &format!("{}\n", claude_user_line("/work/app/.claude/worktrees/fix", "Hi")), 50);
        let records = read(&directory, None);
        assert_eq!(records.len(), 1);
        let chat_session = &records.iter().find(|record| record.chat_session.id == "abc").unwrap().chat_session;
        let output: u64 = chat_session.tokens.iter().map(|tokens| tokens.output).sum();
        assert_eq!(output, 5 + 70);
        assert_eq!(chat_session.user_message_count, 1);
    }
}
