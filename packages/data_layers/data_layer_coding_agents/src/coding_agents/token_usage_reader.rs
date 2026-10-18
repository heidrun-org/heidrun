//! Reads the tokens of each minute from the chat session files of Claude Code and of Codex, for the workspace of a folder.
//!
//! A workspace owns the chat sessions that started in its folder or in a folder below it (a worktree, a sub-folder): the same
//! scope as the Statistics window. Each chat session gives its start folder, and its tokens by minute and by model. The rules
//! of the scan stay those of `tokens`: an answer counts once, a resumed or forked chat session does not count the tokens of its
//! parent again, and the answers of the subagents and of the workflows of Claude Code count for the chat session that started
//! them.
//!
//! A chat session counts as changed at the latest modification date of its file, of the files of its subagents, and of the
//! files of its workflows: a subagent that ends after the main file stopped still makes the chat session be read again. A review
//! chat of Codex is left out, as the list of chat sessions leaves it out. A chat session that used no token is still given with
//! no minute, so the database can delete the rows of a chat session whose files were emptied.
//!
//! Two files can hold the same chat session identifier: Claude Code copies a chat session into the folder where it is resumed.
//! The chat session counts once, with the file that changed last, because the copy that was resumed holds the whole chat
//! session and what came after. The result does not depend on the order of the files, and it is the same for a read of
//! everything and for a read of the files that changed.

use crate::coding_agents::scan::feed_codex_line;
use crate::coding_agents::scan_cache::ScanCache;
use crate::coding_agents::session_files::{
    find_claude_agent_files, find_claude_session_files, find_codex_session_files, FolderScope, SessionFile,
};
use crate::coding_agents::session_reader::format_date;
use crate::coding_agents::tokens::TokenScan;
use crate::model::token_usage_types::{ChatTokenUsage, MinuteTokens};
use crate::model::types::CodingAgent;
use std::collections::HashMap;
use std::path::Path;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record_value, OperationKind, OperationSpec, Summary};

/// Where the chat session files are, and the cache of their scans.
pub struct TokenUsageFiles<'a> {
    /// The cache of the scans. A caller that reads often keeps it, so a file that did not change is not read again.
    pub cache: &'a mut ScanCache,
    /// The folder `projects` of the folder of Claude Code.
    pub claude_projects: &'a Path,
    /// The folder of the data of Codex.
    pub codex_home: &'a Path,
}

/// Reads the token usage of the chat sessions of Claude Code and of Codex that started in `folder` or below it. A chat session
/// whose files all changed before `modified_since` (milliseconds since 1970) is not read. `log` receives one line of progress
/// for each coding agent.
pub fn read_token_usage(
    files: &mut TokenUsageFiles,
    folder: &str,
    modified_since: Option<i64>,
    log: &dyn Fn(&str),
) -> Vec<ChatTokenUsage> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "read_token_usage", OperationKind::Collection)
        .parameter("folder", folder)
        .parameter("modifiedSince", modified_since)
        .state("scanCacheEntries", files.cache.scan_count());
    record_value(spec, || read_token_usage_inside(files, folder, modified_since, log), |usages| Summary::count(usages.len()))
}

/// The work of `read_token_usage`, between the start event and the completion event of its operation.
fn read_token_usage_inside(
    files: &mut TokenUsageFiles,
    folder: &str,
    modified_since: Option<i64>,
    log: &dyn Fn(&str),
) -> Vec<ChatTokenUsage> {
    let TokenUsageFiles { cache, claude_projects, codex_home } = files;
    let is_recent = |modified: i64| modified_since.is_none_or(|since| modified >= since);
    let mut usages = Vec::new();

    let claude_files = find_claude_session_files(cache, claude_projects, folder, FolderScope::WithFoldersBelow);
    let mut read_count = 0;
    for file in &claude_files {
        let agent_files = find_claude_agent_files(cache, &file.path);
        let modified = agent_files.iter().map(|agent_file| agent_file.modified).fold(file.modified, i64::max);
        if !is_recent(modified) {
            continue;
        }
        read_count += 1;
        let scan = cache.scan_claude_with(file, &agent_files);
        let start_folder = file.path.parent().and_then(|directory| cache.claude_folder(directory));
        let start_folder = start_folder.unwrap_or_else(|| folder.to_string());
        usages.extend(usage_of(CodingAgent::ClaudeCode, file, modified, start_folder, &scan.tokens));
    }
    log(&format!("claude code: {} chat session files, {} to read", claude_files.len(), read_count));

    let codex_files = find_codex_session_files(cache, codex_home, folder, FolderScope::WithFoldersBelow);
    let mut read_count = 0;
    for file in &codex_files {
        if !is_recent(file.modified) {
            continue;
        }
        read_count += 1;
        let scan = cache.scan(file, feed_codex_line);
        if scan.meta.is_review_chat {
            continue;
        }
        let start_folder = cache.codex_folder(&file.path).unwrap_or_else(|| folder.to_string());
        usages.extend(usage_of(CodingAgent::Codex, file, file.modified, start_folder, &scan.tokens));
    }
    log(&format!("codex: {} chat session files, {} to read", codex_files.len(), read_count));
    let (usages, copy_count) = keep_the_latest_of_each_chat_session(usages);
    if copy_count > 0 {
        log(&format!("{copy_count} chat session files hold a chat session that a file changed later holds too, and are left out"));
    }
    usages
}

/// Keeps one token usage for each chat session identifier: the one whose files changed last. When two have the same date, the
/// first one stays. The order of the others does not change. Gives the token usages and the number that were left out.
fn keep_the_latest_of_each_chat_session(usages: Vec<ChatTokenUsage>) -> (Vec<ChatTokenUsage>, usize) {
    let mut position_of: HashMap<String, usize> = HashMap::new();
    let mut kept: Vec<ChatTokenUsage> = Vec::with_capacity(usages.len());
    let mut left_out_count = 0;
    for usage in usages {
        match position_of.get(&usage.id) {
            None => {
                position_of.insert(usage.id.clone(), kept.len());
                kept.push(usage);
            }
            Some(&position) => {
                left_out_count += 1;
                if usage.updated_at > kept[position].updated_at {
                    kept[position] = usage;
                }
            }
        }
    }
    (kept, left_out_count)
}

/// The tokens of each minute and each model of a scan, sorted by minute, then by model. A minute without a token is left out.
pub fn minutes_of(tokens: &TokenScan) -> Vec<MinuteTokens> {
    let mut minutes = Vec::new();
    for (minute, models) in tokens.by_minute() {
        for (model, counts) in models {
            if counts.is_empty() {
                continue;
            }
            minutes.push(MinuteTokens {
                minute,
                model,
                fresh_input: counts.fresh_input,
                cached_input: counts.cached_input,
                cache_write_input: counts.cache_write_input,
                output: counts.output,
            });
        }
    }
    minutes
}

/// The token usage of one chat session. `None` when the modification date is out of the range of dates.
fn usage_of(
    coding_agent: CodingAgent,
    file: &SessionFile,
    modified: i64,
    folder: String,
    tokens: &TokenScan,
) -> Option<ChatTokenUsage> {
    Some(ChatTokenUsage {
        id: file.id.clone(),
        coding_agent,
        folder,
        updated_at: format_date(modified)?,
        minutes: minutes_of(tokens),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coding_agents::session_files::claude_folder_name;
    use crate::model::token_usage_types::UNDATED_MINUTE;
    use crate::test_samples::{claude_answer_line, codex_file, ignore_log, temp_folder, write_file};

    const TYPED: &str = r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;
    const ANSWER: &str = r#"{"type":"assistant","cwd":"/work/app","timestamp":"2026-10-11T10:00:05.000Z","message":{"id":"msg_1","model":"claude-opus-5","role":"assistant","content":[{"type":"text","text":"Done"}],"usage":{"input_tokens":10,"cache_creation_input_tokens":20,"cache_read_input_tokens":300,"output_tokens":5}}}"#;
    const MINUTE: i64 = 29_861_880;

    fn claude_file(directory: &Path, folder: &str, name: &str, lines: &[&str], age_seconds: u64) {
        let project = directory.join("projects").join(claude_folder_name(folder));
        write_file(&project.join(format!("{name}.jsonl")), &format!("{}\n", lines.join("\n")), age_seconds);
    }

    fn read(directory: &Path, since: Option<i64>) -> Vec<ChatTokenUsage> {
        let mut cache = ScanCache::in_memory();
        let claude_projects = directory.join("projects");
        let mut files = TokenUsageFiles { cache: &mut cache, claude_projects: &claude_projects, codex_home: directory };
        let mut usages = read_token_usage(&mut files, "/work/app", since, &ignore_log);
        usages.sort_by(|a, b| a.id.cmp(&b.id));
        usages
    }

    #[test]
    fn gives_the_tokens_of_each_minute_and_the_start_folder_of_a_chat_session() {
        let directory = temp_folder("token_reader_claude");
        claude_file(&directory, "/work/app", "abc", &[TYPED, ANSWER], 100);
        let usages = read(&directory, None);
        assert_eq!(usages.len(), 1);
        assert_eq!((usages[0].id.as_str(), usages[0].folder.as_str(), usages[0].coding_agent), ("abc", "/work/app", CodingAgent::ClaudeCode));
        assert_eq!(
            usages[0].minutes,
            vec![MinuteTokens {
                minute: MINUTE,
                model: "claude-opus-5".into(),
                fresh_input: 10,
                cached_input: 300,
                cache_write_input: 20,
                output: 5
            }]
        );
    }

    #[test]
    fn reads_the_chat_sessions_of_a_worktree_and_of_a_sub_folder_with_their_own_start_folder() {
        let directory = temp_folder("token_reader_below");
        claude_file(&directory, "/work/app", "root", &[TYPED, ANSWER], 100);
        let worktree = r#"{"type":"user","cwd":"/work/app/.claude/worktrees/fix","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Hi"}}"#;
        claude_file(&directory, "/work/app/.claude/worktrees/fix", "wt", &[worktree, ANSWER], 100);
        let next = r#"{"type":"user","cwd":"/work/app-site","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Hi"}}"#;
        claude_file(&directory, "/work/app-site", "site", &[next, ANSWER], 100);
        let usages = read(&directory, None);
        let found: Vec<(&str, &str)> = usages.iter().map(|usage| (usage.id.as_str(), usage.folder.as_str())).collect();
        assert_eq!(found, [("root", "/work/app"), ("wt", "/work/app/.claude/worktrees/fix")]);
    }

    #[test]
    fn counts_the_answers_of_the_subagents_for_the_chat_session_that_started_them() {
        let directory = temp_folder("token_reader_agents");
        claude_file(&directory, "/work/app", "abc", &[TYPED, ANSWER], 100);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("abc").join("subagents").join("agent-1.jsonl"), &format!("{}\n", claude_answer_line("a1", 70)), 100);
        let usages = read(&directory, None);
        let output: u64 = usages[0].minutes.iter().map(|minute| minute.output).sum();
        assert_eq!(output, 5 + 70);
    }

    #[test]
    fn reads_a_chat_session_again_when_only_the_file_of_its_subagent_changed() {
        let directory = temp_folder("token_reader_agent_date");
        claude_file(&directory, "/work/app", "abc", &[TYPED, ANSWER], 1000);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("abc").join("subagents").join("agent-1.jsonl"), &format!("{}\n", claude_answer_line("a1", 70)), 10);
        let one_hundred_seconds_ago = chrono::Utc::now().timestamp_millis() - 100_000;
        let usages = read(&directory, Some(one_hundred_seconds_ago));
        assert_eq!(usages.len(), 1, "the file of the chat session is older than the date, the file of its subagent is not");
        let ten_minutes_ago = chrono::Utc::now().timestamp_millis() - 600_000;
        let usages = read(&directory, Some(ten_minutes_ago));
        assert_eq!(usages.len(), 1);
        let in_the_future = chrono::Utc::now().timestamp_millis() + 600_000;
        assert!(read(&directory, Some(in_the_future)).is_empty());
    }

    #[test]
    fn reads_a_chat_session_of_codex_and_leaves_out_a_review_chat() {
        let directory = temp_folder("token_reader_codex");
        let id = "01a12c31-175b-7513-b12c-bba764f46420";
        codex_file(&directory, "2026/10/10", id, "/work/app/docs", &[&crate::test_samples::codex_message("Write the guide")], 5);
        let usages = read(&directory, None);
        assert_eq!((usages[0].id.as_str(), usages[0].folder.as_str(), usages[0].coding_agent), (id, "/work/app/docs", CodingAgent::Codex));
        let review_id = "01a12c31-175b-7513-b12c-bba764f46430";
        let review = format!(r#"{{"type":"session_meta","payload":{{"id":"{review_id}","cwd":"/work/app","source":{{"subagent":{{"other":"guardian"}}}}}}}}"#);
        let name = format!("rollout-2026-10-10T01-02-03-{review_id}.jsonl");
        write_file(&directory.join("sessions").join("2026/10/10").join(name), &format!("{review}\n"), 5);
        assert_eq!(read(&directory, None).len(), 1);
    }

    #[test]
    fn gives_a_chat_session_without_token_with_no_minute_and_puts_a_record_without_date_in_the_undated_minute() {
        let directory = temp_folder("token_reader_empty");
        claude_file(&directory, "/work/app", "empty", &[TYPED], 100);
        let undated = ANSWER.replace(r#""timestamp":"2026-10-11T10:00:05.000Z","#, "");
        claude_file(&directory, "/work/app", "undated", &[TYPED, &undated], 100);
        let usages = read(&directory, None);
        assert!(usages[0].minutes.is_empty());
        assert_eq!(usages[1].minutes.iter().map(|minute| minute.minute).collect::<Vec<_>>(), [UNDATED_MINUTE]);
    }

    #[test]
    fn reads_only_the_chat_sessions_that_changed_since_the_date() {
        let directory = temp_folder("token_reader_since");
        claude_file(&directory, "/work/app", "old", &[TYPED, ANSWER], 1000);
        claude_file(&directory, "/work/app", "new", &[TYPED, ANSWER], 10);
        let newest = read(&directory, None).iter().map(|usage| crate::coding_agents::session_reader::parse_date(&usage.updated_at).unwrap()).max();
        assert_eq!(read(&directory, newest).iter().map(|usage| usage.id.as_str()).collect::<Vec<_>>(), ["new"]);
    }

    const LATER_ANSWER: &str = r#"{"type":"assistant","cwd":"/work/app","timestamp":"2026-10-11T10:07:05.000Z","message":{"id":"msg_2","model":"claude-opus-5","role":"assistant","content":[{"type":"text","text":"More"}],"usage":{"input_tokens":1,"cache_creation_input_tokens":2,"cache_read_input_tokens":3,"output_tokens":4}}}"#;

    #[test]
    fn counts_a_chat_session_that_two_files_hold_once_with_the_file_that_changed_last() {
        let worktree = "/work/app/.claude/worktrees/fix";
        for (root_age, worktree_age, expected_folder, expected_minute_count) in
            [(1_000, 100, worktree, 2), (100, 1_000, "/work/app", 1)]
        {
            let directory = temp_folder(&format!("token_reader_copy_{root_age}"));
            claude_file(&directory, "/work/app", "same", &[TYPED, ANSWER], root_age);
            let resumed = r#"{"type":"user","cwd":"/work/app/.claude/worktrees/fix","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;
            claude_file(&directory, worktree, "same", &[resumed, ANSWER, LATER_ANSWER], worktree_age);
            let usages = read(&directory, None);
            assert_eq!(usages.len(), 1, "the chat session counts once");
            assert_eq!(usages[0].folder, expected_folder);
            assert_eq!(usages[0].minutes.len(), expected_minute_count);
        }
    }

    #[test]
    fn gives_the_same_chat_session_when_only_the_file_that_changed_last_is_read_again() {
        let directory = temp_folder("token_reader_copy_incremental");
        claude_file(&directory, "/work/app", "same", &[TYPED, ANSWER], 1_000);
        claude_file(&directory, "/work/app/.claude/worktrees/fix", "same", &[TYPED, ANSWER, LATER_ANSWER], 100);
        let everything = read(&directory, None);
        let since = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64 - 500_000;
        assert_eq!(read(&directory, Some(since)), everything);
    }
}
