//! Chats: the conversations that Claude Code and Codex saved on this Mac for the folder of a workspace.
//!
//! The package `data_layer_coding_agents` finds the chat session files and reads what each one holds, without a model, and
//! keeps the result in `chats_cache.json`, in the data folder of Heidrun, until the size or the modification date of the file
//! changes. It also reads the files that Codex compressed (`.jsonl.zst`), and it adds the tokens of the subagents and of the
//! workflows of a conversation of Claude Code to that conversation. This file turns what the package reads into the list of the Past chats sidebar section: the title, the summary,
//! the tokens, the cost, the sort, and the limit.
//!
//! A conversation without a title shows its first message. A conversation without a title and without a message is not
//! listed.
//!
//! The list is read on demand. With the sort key "last updated", the files of a folder are sorted by their modification
//! date, and only the first `limit` conversations are opened. Every other sort key needs what each file holds, so every file
//! of the folder is opened, then the conversations are sorted and cut to `limit`.

use data_layer_coding_agents::{
    feed_codex_line, find_claude_session_files, find_codex_session_files, model_tokens_of, read_codex_titles,
    title_of_scan, ChatMeta, FolderScope, PriceTable, ScanCache, SessionFile, TokenScan, TokensByModel, CACHE_FILE_NAME,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The longest title that the list shows, in characters.
const TITLE_LENGTH: usize = 160;

/// The most conversations that one call returns for one coding agent.
pub(crate) const MAX_LIMIT: usize = 10_000;

/// One conversation.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Chat {
    pub id: String,
    /// The title, or the first message when the conversation has no title.
    pub title: String,
    /// When the file of the conversation changed, in milliseconds since 1970.
    pub updated_at: i64,
    /// What the scan of the file found: the dates, the messages, the folders, the issues, the pull requests, the files.
    pub meta: ChatMeta,
    /// The tokens that the conversation used, for each model. The front end gets `usage`, not this.
    #[serde(skip)]
    pub tokens: TokensByModel,
    /// The tokens and the cost of the conversation, or `None` when the conversation used no token.
    pub usage: Option<ChatUsage>,
}

/// The tokens that one conversation used, and what they cost.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct ChatUsage {
    /// Every input token that was sent, with the ones that the provider read from its cache and wrote to it.
    pub input_tokens: u64,
    /// The input tokens that the provider read from its cache. They are a part of `input_tokens`.
    pub cached_input_tokens: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output_tokens: u64,
    /// The estimated cost in US dollars, at the public price of each model. `None` when a model of the conversation has no
    /// known price.
    pub cost_usd: Option<f64>,
}

impl ChatUsage {
    /// The tokens of `tokens`, without a cost. `None` when no token was used.
    fn of(tokens: &TokensByModel) -> Option<ChatUsage> {
        let mut usage = ChatUsage { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cost_usd: None };
        for counts in tokens.values() {
            usage.input_tokens += counts.input_total();
            usage.cached_input_tokens += counts.cached_input;
            usage.output_tokens += counts.output;
        }
        (usage.input_tokens + usage.output_tokens > 0).then_some(usage)
    }
}

/// The newest conversations of one coding agent in one folder.
#[derive(Serialize, Debug, Default, PartialEq)]
pub struct AgentChats {
    /// The newest conversations first, at most `limit`.
    pub chats: Vec<Chat>,
    /// True when the folder holds a conversation file after the last one of `chats`.
    pub has_more: bool,
}

/// The conversations of one folder, for each coding agent.
#[derive(Serialize, Debug, Default)]
pub struct Chats {
    /// The root of the repository whose conversations these are. The files that a conversation wrote are below it.
    pub root: String,
    pub claude: AgentChats,
    pub codex: AgentChats,
}

/// What the list is sorted by. The names are the ones that the front end sends.
#[derive(Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortKey {
    /// The date of the first record that has a date, or the modification date of the file when no record has a date.
    CreatedOn,
    /// The modification date of the file of the conversation.
    #[default]
    LastUpdated,
    /// The number of messages that the developer typed.
    Messages,
    /// The number of issues that the conversation mentions.
    Issues,
    /// The number of pull requests that the conversation mentions.
    PullRequests,
    /// The number of different files that the coding agent wrote.
    FilesWritten,
}

/// Which end of the sort key comes first. "Ascending" is the smallest value first, "descending" is the largest value first.
#[derive(Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    Ascending,
    #[default]
    Descending,
}

/// How the list is sorted: by which key, and from which end.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Sorting {
    pub key: SortKey,
    pub order: SortOrder,
}

// ---- Cache on the disk -------------------------------------------------------------------------------------------

/// The cache of the scans of the application. It is opened on the first call.
static CACHE: Mutex<Option<ScanCache>> = Mutex::new(None);

/// The folder of the data of Heidrun: `HEIDRUN_DIR`, else `~/.config/heidrun`.
pub(crate) fn data_dir() -> PathBuf {
    std::env::var("HEIDRUN_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_default().join(".config").join("heidrun"))
}

/// The file of the cache: `chats_cache.json` in the folder of the data of Heidrun.
fn cache_path() -> PathBuf {
    data_dir().join(CACHE_FILE_NAME)
}

// ---- The command -------------------------------------------------------------------------------------------------

/// The first `limit` conversations of Claude Code and of Codex whose folder is the root of the repository that holds
/// `folder`, sorted by `sort_key` from the end that `order` says.
#[tauri::command]
pub async fn chats_list(folder: String, limit: usize, sort_key: SortKey, order: SortOrder) -> Result<Chats, String> {
    let sorting = Sorting { key: sort_key, order };
    // Off the main thread: the first read of the files of a coding agent takes a moment.
    tauri::async_runtime::spawn_blocking(move || list(&folder, limit, sorting, FolderScope::Exactly))
        .await
        .map_err(|e| e.to_string())
}

/// The conversations of the repository that holds `folder`, for the folders that `scope` says. The Past chats sidebar section
/// lists only the conversations that started in the root of the repository (`FolderScope::Exactly`), and the statistic of
/// the AI cost also counts the ones that started in a worktree or in a sub-folder (`FolderScope::WithFoldersBelow`).
pub(crate) fn list(folder: &str, limit: usize, sorting: Sorting, scope: FolderScope) -> Chats {
    let root = crate::project::find_root(Path::new(folder)).display().to_string();
    let chats = with_scan_cache(|cache| {
        list_in(
            cache,
            &crate::claude::claude_dir().join("projects"),
            &crate::usage::codex_home(),
            &root,
            scope,
            limit,
            sorting,
        )
    });
    apply_prices(chats, &crate::model_prices::current())
}

/// Runs `action` with the cache of the scans of the application, opened on the first call, and saves the cache on the disk
/// when `action` ends. Two calls never run at the same time.
pub(crate) fn with_scan_cache<Result>(action: impl FnOnce(&mut ScanCache) -> Result) -> Result {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let cache = guard.get_or_insert_with(|| ScanCache::open(cache_path()));
    let result = action(cache);
    cache.save();
    result
}

/// Gives each conversation the cost of its tokens at the prices of `table`.
fn apply_prices(mut chats: Chats, table: &PriceTable) -> Chats {
    for chat in chats.claude.chats.iter_mut().chain(chats.codex.chats.iter_mut()) {
        if let Some(usage) = chat.usage.as_mut() {
            usage.cost_usd = table.cost(&model_tokens_of(&chat.tokens));
        }
    }
    chats
}

fn list_in(
    cache: &mut ScanCache,
    projects: &Path,
    codex_home: &Path,
    folder: &str,
    scope: FolderScope,
    limit: usize,
    sorting: Sorting,
) -> Chats {
    let limit = limit.clamp(1, MAX_LIMIT);
    Chats {
        root: folder.to_string(),
        claude: claude_chats(cache, projects, folder, scope, limit, sorting),
        codex: codex_chats(cache, codex_home, folder, scope, limit, sorting),
    }
}

// ---- Both coding agents ------------------------------------------------------------------------------------------

/// The first `limit` conversations of `files`, in the order of `sorting`. `root` is the root of the repository, for the
/// count of the written files. A file without a title and without a message is skipped, and does not count.
///
/// With the key "last updated", the files are sorted by their modification date, and the files are opened in this order
/// until `limit` conversations have a title. Every other key needs what the files hold, so every file is opened.
fn take_chats(
    cache: &mut ScanCache,
    mut files: Vec<SessionFile>,
    limit: usize,
    root: &str,
    sorting: Sorting,
    title_of: &mut dyn FnMut(&mut ScanCache, &SessionFile) -> Option<(String, ChatMeta, TokenScan)>,
) -> AgentChats {
    let mut found = AgentChats::default();
    if sorting.key == SortKey::LastUpdated {
        files.sort_by(|a, b| {
            let by_date = match sorting.order {
                SortOrder::Descending => b.modified.cmp(&a.modified),
                SortOrder::Ascending => a.modified.cmp(&b.modified),
            };
            by_date.then_with(|| a.id.cmp(&b.id))
        });
        for file in &files {
            if found.chats.len() == limit {
                found.has_more = true;
                break;
            }
            if let Some(chat) = chat_of(cache, file, title_of) {
                found.chats.push(chat);
            }
        }
        return found;
    }
    let mut keyed: Vec<(i64, Chat)> = Vec::new();
    for file in &files {
        if let Some(chat) = chat_of(cache, file, title_of) {
            keyed.push((sort_value(&chat, root, sorting.key), chat));
        }
    }
    keyed.sort_by(|a, b| {
        let by_value = match sorting.order {
            SortOrder::Descending => b.0.cmp(&a.0),
            SortOrder::Ascending => a.0.cmp(&b.0),
        };
        by_value.then_with(|| b.1.updated_at.cmp(&a.1.updated_at)).then_with(|| a.1.id.cmp(&b.1.id))
    });
    found.has_more = keyed.len() > limit;
    found.chats = keyed.into_iter().take(limit).map(|(_, chat)| chat).collect();
    found
}

/// The conversation of a file, or `None` when the file has no title and no message.
fn chat_of(
    cache: &mut ScanCache,
    file: &SessionFile,
    title_of: &mut dyn FnMut(&mut ScanCache, &SessionFile) -> Option<(String, ChatMeta, TokenScan)>,
) -> Option<Chat> {
    let (text, meta, token_scan) = title_of(cache, file)?;
    let title = crate::claude::short(&text, TITLE_LENGTH);
    if title.is_empty() {
        return None;
    }
    let tokens = token_scan.totals();
    Some(Chat {
        id: file.id.clone(),
        title,
        updated_at: file.modified,
        meta,
        usage: ChatUsage::of(&tokens),
        tokens,
    })
}

/// The number that a conversation is sorted by: a date in milliseconds since 1970, or a count.
fn sort_value(chat: &Chat, root: &str, key: SortKey) -> i64 {
    match key {
        SortKey::CreatedOn => chat.meta.first_at.unwrap_or(chat.updated_at),
        SortKey::LastUpdated => chat.updated_at,
        SortKey::Messages => i64::from(chat.meta.user_messages),
        SortKey::Issues => chat.meta.issues.len() as i64,
        SortKey::PullRequests => chat.meta.pull_requests.len() as i64,
        SortKey::FilesWritten => written_file_count(&chat.meta.files_written, root) as i64,
    }
}

/// The number of different files that a conversation wrote. A file written in a worktree of the repository
/// (`.claude/worktrees/<name>/...` below `root`) and the same file at the root count as one, as the summary of the
/// conversation counts them.
fn written_file_count(files: &BTreeSet<String>, root: &str) -> usize {
    let prefix = format!("{}/", root.trim_end_matches('/'));
    let names: HashSet<String> = files
        .iter()
        .map(|path| match path.strip_prefix(&prefix) {
            Some(relative) => strip_worktree(relative).to_string(),
            None => path.clone(),
        })
        .collect();
    names.len()
}

/// The path without its first part `.claude/worktrees/<name>/`, when it starts with this part.
fn strip_worktree(relative: &str) -> &str {
    relative
        .strip_prefix(".claude/worktrees/")
        .and_then(|rest| rest.split_once('/'))
        .filter(|(name, _)| name.is_empty() == false)
        .map_or(relative, |(_, path)| path)
}

// ---- Claude Code ------------------------------------------------------------------------------------------------

fn claude_chats(
    cache: &mut ScanCache,
    projects: &Path,
    folder: &str,
    scope: FolderScope,
    limit: usize,
    sorting: Sorting,
) -> AgentChats {
    let files = find_claude_session_files(cache, projects, folder, scope);
    take_chats(cache, files, limit, folder, sorting, &mut |cache, file| {
        let scan = cache.scan_claude(file);
        title_of_scan(&scan).map(|text| (text, scan.meta, scan.tokens))
    })
}

// ---- Codex -------------------------------------------------------------------------------------------------------

fn codex_chats(
    cache: &mut ScanCache,
    home: &Path,
    folder: &str,
    scope: FolderScope,
    limit: usize,
    sorting: Sorting,
) -> AgentChats {
    let titles = read_codex_titles(home);
    let folder = folder.trim_end_matches('/');
    let files = find_codex_session_files(cache, home, folder, scope);
    take_chats(cache, files, limit, folder, sorting, &mut |cache, file| {
        let scan = cache.scan(file, feed_codex_line);
        if scan.meta.is_review_chat {
            return None;
        }
        titles.get(&file.id).cloned().or_else(|| title_of_scan(&scan)).map(|text| (text, scan.meta, scan.tokens))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_layer_coding_agents::claude_folder_name;
    use serde_json::Value;
    use std::time::{Duration, SystemTime};

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hd-chats-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Writes a file, and sets its date to `age_seconds` seconds before now.
    fn write(path: &Path, text: &str, age_seconds: u64) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
        let modified = SystemTime::now() - Duration::from_secs(age_seconds);
        std::fs::File::options().write(true).open(path).unwrap().set_modified(modified).unwrap();
    }

    /// The titles of a list, in order.
    fn titles(found: &AgentChats) -> Vec<&str> {
        found.chats.iter().map(|chat| chat.title.as_str()).collect()
    }

    const USER_LINE: &str = r#"{"type":"user","message":{"role":"user","content":"Fix the   tab bar"}}"#;

    fn claude_title_line(title: &str) -> String {
        format!(r#"{{"type":"custom-title","customTitle":"{title}","sessionId":"x"}}"#)
    }

    /// The folder of the conversations of Claude Code for `/work/app` in a scratch folder.
    fn claude_folder(dir: &Path) -> PathBuf {
        dir.join("projects").join(claude_folder_name("/work/app"))
    }

    fn claude(cache: &mut ScanCache, dir: &Path, limit: usize) -> AgentChats {
        claude_chats(cache, &dir.join("projects"), "/work/app", FolderScope::Exactly, limit, Sorting::default())
    }

    #[test]
    fn lists_the_conversations_of_claude_code_newest_first_and_the_last_title_wins() {
        let dir = scratch("claude-order");
        let folder = claude_folder(&dir);
        write(&folder.join("old.jsonl"), &format!("{USER_LINE}\n{}\n{}\n", claude_title_line("First name"), claude_title_line("Last name")), 500);
        write(&folder.join("new.jsonl"), &format!("{}\n", claude_title_line("Newer")), 10);
        write(&folder.join("note.txt"), "not a conversation", 1);
        let found = claude(&mut ScanCache::in_memory(), &dir, 10);
        assert_eq!(titles(&found), vec!["Newer", "Last name"]);
        assert_eq!(found.chats[0].id, "new");
        assert!(found.chats[0].updated_at > found.chats[1].updated_at);
        assert!(!found.has_more);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shows_the_first_message_of_claude_code_when_there_is_no_title() {
        let dir = scratch("claude-first-message");
        let folder = claude_folder(&dir);
        let tool_result = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"x"}]}}"#;
        let command = r#"{"type":"user","message":{"role":"user","content":"<command-name>/clear</command-name>"}}"#;
        let meta = r#"{"type":"user","isMeta":true,"message":{"role":"user","content":"Caveat"}}"#;
        let parts = r#"{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Fix the   tab bar"}]}}"#;
        write(&folder.join("a.jsonl"), &format!("{tool_result}\n{command}\n{meta}\n{parts}\n"), 5);
        write(&folder.join("b.jsonl"), &format!("{USER_LINE}\n"), 6);
        let found = claude(&mut ScanCache::in_memory(), &dir, 10);
        assert_eq!(titles(&found), vec!["Fix the tab bar", "Fix the tab bar"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_list_a_conversation_of_claude_code_without_title_and_without_message() {
        let dir = scratch("claude-empty");
        write(&claude_folder(&dir).join("a.jsonl"), "{\"type\":\"queue-operation\"}\n{\"type\":\"last-prompt\"}\n", 5);
        write(&claude_folder(&dir).join("b.jsonl"), "", 5);
        assert_eq!(claude(&mut ScanCache::in_memory(), &dir, 10), AgentChats::default());
        assert_eq!(
            claude_chats(&mut ScanCache::in_memory(), &dir.join("projects"), "/work/other", FolderScope::Exactly, 10, Sorting::default()),
            AgentChats::default()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn opens_only_the_newest_files_and_tells_when_there_are_more() {
        let dir = scratch("claude-limit");
        let folder = claude_folder(&dir);
        for (index, age) in [(1, 400), (2, 300), (3, 200), (4, 100)] {
            write(&folder.join(format!("c{index}.jsonl")), &claude_title_line(&format!("Chat {index}")), age);
        }
        let mut cache = ScanCache::in_memory();
        let found = claude(&mut cache, &dir, 2);
        assert_eq!(titles(&found), vec!["Chat 4", "Chat 3"]);
        assert!(found.has_more);
        assert_eq!(cache.scan_count(), 2, "the two older files were not opened");
        let found = claude(&mut cache, &dir, 4);
        assert_eq!(titles(&found), vec!["Chat 4", "Chat 3", "Chat 2", "Chat 1"]);
        assert!(!found.has_more);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_count_a_conversation_without_title_and_without_message_in_the_limit() {
        let dir = scratch("claude-limit-empty");
        let folder = claude_folder(&dir);
        write(&folder.join("a.jsonl"), &claude_title_line("Older"), 300);
        write(&folder.join("b.jsonl"), "", 200);
        write(&folder.join("c.jsonl"), &claude_title_line("Newer"), 100);
        let found = claude(&mut ScanCache::in_memory(), &dir, 2);
        assert_eq!(titles(&found), vec!["Newer", "Older"]);
        assert!(!found.has_more);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Replaces the text of a file with a text of the same size, and gives the file back its old modification date. Only a
    /// read of the file can see the difference.
    fn rewrite_keeping_size_and_date(path: &Path, text: &str) {
        let metadata = std::fs::metadata(path).unwrap();
        assert_eq!(metadata.len(), text.len() as u64);
        std::fs::write(path, text).unwrap();
        std::fs::File::options().write(true).open(path).unwrap().set_modified(metadata.modified().unwrap()).unwrap();
    }

    #[test]
    fn does_not_read_a_file_again_while_its_size_and_date_stay_the_same() {
        let dir = scratch("claude-cache-hit");
        let path = claude_folder(&dir).join("a.jsonl");
        write(&path, &claude_title_line("Before"), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(titles(&claude(&mut cache, &dir, 5)), vec!["Before"]);
        rewrite_keeping_size_and_date(&path, &claude_title_line("Afters"));
        assert_eq!(titles(&claude(&mut cache, &dir, 5)), vec!["Before"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn gives_the_meta_information_of_each_chat() {
        let dir = scratch("meta");
        let typed = r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;
        write(&claude_folder(&dir).join("a.jsonl"), &format!("{typed}\n{}\n", claude_title_line("Fix it")), 5);
        let found = claude(&mut ScanCache::in_memory(), &dir, 5);
        let meta = &found.chats[0].meta;
        assert_eq!(meta.user_messages, 1);
        assert_eq!(meta.first_at, Some(1_791_712_800_000));
        assert_eq!(meta.issues.iter().collect::<Vec<_>>(), vec![&250]);
        assert_eq!(meta.folders.iter().collect::<Vec<_>>(), vec!["/work/app"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn continues_the_scan_of_a_file_that_grew_and_does_not_count_a_message_twice() {
        let dir = scratch("claude-grow");
        let path = claude_folder(&dir).join("a.jsonl");
        let line = |text: &str| format!("{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{text}\"}}}}\n");
        write(&path, &format!("{}{}", line("one"), line("two")), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(claude(&mut cache, &dir, 5).chats[0].meta.user_messages, 2);
        write(&path, &format!("{}{}{}", line("one"), line("two"), line("three")), 50);
        assert_eq!(claude(&mut cache, &dir, 5).chats[0].meta.user_messages, 3);
        assert_eq!(cache.scanned_offset(&path), Some(std::fs::metadata(&path).unwrap().len()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn scans_a_file_again_from_its_start_when_it_changes_without_growing() {
        let dir = scratch("claude-same-size");
        let path = claude_folder(&dir).join("a.jsonl");
        let line = |text: &str| format!("{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{text}\"}}}}\n");
        write(&path, &format!("{}{}", line("one"), line("two")), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(claude(&mut cache, &dir, 5).chats[0].meta.user_messages, 2);
        write(&path, &format!("{}{}", line("uno"), line("dos")), 50);
        let found = claude(&mut cache, &dir, 5);
        assert_eq!(found.chats[0].meta.user_messages, 2);
        assert_eq!(found.chats[0].title, "uno");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reads_a_file_again_when_it_changes() {
        let dir = scratch("claude-cache-miss");
        let path = claude_folder(&dir).join("a.jsonl");
        write(&path, &claude_title_line("Before"), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(titles(&claude(&mut cache, &dir, 5)), vec!["Before"]);
        write(&path, &format!("{}\n{}\n", claude_title_line("Before"), claude_title_line("After the change")), 50);
        assert_eq!(titles(&claude(&mut cache, &dir, 5)), vec!["After the change"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn keeps_the_cache_on_the_disk_and_reads_it_at_the_next_start() {
        let dir = scratch("cache-disk");
        let path = claude_folder(&dir).join("a.jsonl");
        write(&path, &claude_title_line("Kept"), 100);
        let cache_file = dir.join("data").join(CACHE_FILE_NAME);
        let mut first = ScanCache::open(cache_file.clone());
        assert_eq!(titles(&claude(&mut first, &dir, 5)), vec!["Kept"]);
        first.save();
        assert!(cache_file.exists());
        rewrite_keeping_size_and_date(&path, &claude_title_line("Lost"));
        let mut second = ScanCache::open(cache_file.clone());
        assert_eq!(titles(&claude(&mut second, &dir, 5)), vec!["Kept"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn starts_with_an_empty_cache_when_the_file_is_not_valid_or_has_another_version() {
        let dir = scratch("cache-invalid");
        let cache_file = dir.join(CACHE_FILE_NAME);
        write(&cache_file, "{ nope", 1);
        assert_eq!(ScanCache::open(cache_file.clone()).scan_count(), 0);
        write(&cache_file, r#"{"version":0,"scans":{"/x":{"size":1,"modified":1,"title":"Old","first_message":null}},"codex_folders":{}}"#, 1);
        assert_eq!(ScanCache::open(cache_file.clone()).scan_count(), 0);
        assert_eq!(ScanCache::open(dir.join("missing.json")).scan_count(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn writes_nothing_when_the_cache_did_not_change() {
        let dir = scratch("cache-clean");
        let cache_file = dir.join(CACHE_FILE_NAME);
        ScanCache::open(cache_file.clone()).save();
        assert!(!cache_file.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn forgets_the_cache_of_a_file_that_was_deleted() {
        let dir = scratch("cache-forget");
        let folder = claude_folder(&dir);
        write(&folder.join("a.jsonl"), &claude_title_line("Stays"), 100);
        write(&folder.join("b.jsonl"), &claude_title_line("Goes"), 200);
        let mut cache = ScanCache::in_memory();
        assert_eq!(claude(&mut cache, &dir, 5).chats.len(), 2);
        std::fs::remove_file(folder.join("b.jsonl")).unwrap();
        assert_eq!(titles(&claude(&mut cache, &dir, 5)), vec!["Stays"]);
        assert_eq!(cache.scan_count(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn codex_file(home: &Path, day: &str, id: &str, folder: &str, messages: &[&str], age_seconds: u64) {
        let first = format!(r#"{{"type":"session_meta","payload":{{"id":"{id}","cwd":"{folder}"}}}}"#);
        let name = format!("rollout-2026-10-10T01-02-03-{id}.jsonl");
        write(&home.join("sessions").join(day).join(name), &format!("{first}\n{}\n", messages.join("\n")), age_seconds);
    }

    fn codex_message(text: &str) -> String {
        format!(
            r#"{{"type":"response_item","payload":{{"type":"message","role":"user","content":[{{"type":"input_text","text":"{text}"}}]}}}}"#
        )
    }

    #[test]
    fn lists_the_conversations_of_codex_for_the_folder_only() {
        let dir = scratch("codex-folder");
        let a = "01a12c31-175b-7513-b12c-bba764f46402";
        let b = "01a12b2c-fc3a-7513-b12c-bba764f46403";
        let c = "01a12b2c-fc3a-7513-b12c-bba764f46404";
        codex_file(&dir, "2026/10/10", a, "/work/app", &[], 100);
        codex_file(&dir, "2026/10/11", b, "/work/app/", &[], 10);
        codex_file(&dir, "2026/10/11", c, "/work/other", &[], 10);
        let index = format!(
            "{{\"id\":\"{a}\",\"thread_name\":\"Old name\"}}\n{{\"id\":\"{a}\",\"thread_name\":\"Describe image\"}}\n{{\"id\":\"{b}\",\"thread_name\":\"Newer\"}}\n{{\"id\":\"{c}\",\"thread_name\":\"Elsewhere\"}}\n"
        );
        write(&dir.join("session_index.jsonl"), &index, 1);
        let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", FolderScope::Exactly, 10, Sorting::default());
        assert_eq!(titles(&found), vec!["Newer", "Describe image"]);
        assert_eq!(found.chats[1].id, a);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_list_a_review_chat_of_codex() {
        let dir = scratch("codex-review");
        let normal = "01a12c31-175b-7513-b12c-bba764f46431";
        let review = "01a12c31-175b-7513-b12c-bba764f46432";
        codex_file(&dir, "2026/10/10", normal, "/work/app", &[&codex_message("Please fix issue 250")], 10);
        let first = format!(
            r#"{{"type":"session_meta","payload":{{"id":"{review}","cwd":"/work/app","source":{{"subagent":{{"other":"guardian"}}}}}}}}"#
        );
        let name = format!("rollout-2026-10-10T01-02-03-{review}.jsonl");
        let text = format!("{first}\n{}\n", codex_message("Review this command"));
        write(&dir.join("sessions").join("2026/10/10").join(name), &text, 5);
        let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", FolderScope::Exactly, 10, Sorting::default());
        assert_eq!(titles(&found), vec!["Please fix issue 250"]);
        assert_eq!(found.has_more, false);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn gives_the_meta_information_of_a_chat_of_codex_that_has_a_title_in_the_index() {
        let dir = scratch("codex-meta");
        let id = "01a12c31-175b-7513-b12c-bba764f46420";
        let real = codex_message("Please fix issue 250");
        codex_file(&dir, "2026/10/10", id, "/work/app", &[&real], 5);
        write(&dir.join("session_index.jsonl"), &format!("{{\"id\":\"{id}\",\"thread_name\":\"Fix it\"}}\n"), 1);
        let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", FolderScope::Exactly, 5, Sorting::default());
        assert_eq!(titles(&found), vec!["Fix it"]);
        assert_eq!(found.chats[0].meta.user_messages, 1);
        assert_eq!(found.chats[0].meta.issues.iter().collect::<Vec<_>>(), vec![&250]);
        assert_eq!(found.chats[0].meta.folders.iter().collect::<Vec<_>>(), vec!["/work/app"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shows_the_first_message_of_codex_when_the_index_has_no_title() {
        let dir = scratch("codex-first-message");
        let id = "01a12c31-175b-7513-b12c-bba764f46410";
        let agents = codex_message("# AGENTS.md instructions for /work/app");
        let environment = codex_message("<environment_context>cwd</environment_context>");
        let real = codex_message("Write the   change log");
        codex_file(&dir, "2026/10/10", id, "/work/app", &[&agents, &environment, &real], 5);
        let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", FolderScope::Exactly, 10, Sorting::default());
        assert_eq!(titles(&found), vec!["Write the change log"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn opens_only_the_newest_files_of_codex_and_keeps_the_folder_of_each_file_in_the_cache() {
        let dir = scratch("codex-limit");
        let ids = [
            "01a12c31-175b-7513-b12c-bba764f46411",
            "01a12c31-175b-7513-b12c-bba764f46412",
            "01a12c31-175b-7513-b12c-bba764f46413",
        ];
        let mut index = String::new();
        for (position, id) in ids.iter().enumerate() {
            codex_file(&dir, "2026/10/10", id, "/work/app", &[], 300 - 100 * position as u64);
            index.push_str(&format!("{{\"id\":\"{id}\",\"thread_name\":\"Chat {position}\"}}\n"));
        }
        write(&dir.join("session_index.jsonl"), &index, 1);
        let mut cache = ScanCache::in_memory();
        let found = codex_chats(&mut cache, &dir, "/work/app", FolderScope::Exactly, 2, Sorting::default());
        assert_eq!(titles(&found), vec!["Chat 2", "Chat 1"]);
        assert!(found.has_more);
        assert_eq!(cache.codex_folder_count(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lists_nothing_when_the_folders_of_the_coding_agents_do_not_exist() {
        let dir = scratch("nothing");
        let found = list_in(&mut ScanCache::in_memory(), &dir.join("projects"), &dir, "/work/app", FolderScope::Exactly, 5, Sorting::default());
        assert_eq!(found.claude, AgentChats::default());
        assert_eq!(found.codex, AgentChats::default());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn answers_the_root_of_the_repository_that_it_listed() {
        let dir = scratch("root");
        let found = list_in(&mut ScanCache::in_memory(), &dir.join("projects"), &dir, "/work/app", FolderScope::Exactly, 5, Sorting::default());
        assert_eq!(found.root, "/work/app");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cuts_a_long_title_with_an_ellipsis() {
        let dir = scratch("long-title");
        write(&claude_folder(&dir).join("a.jsonl"), &claude_title_line(&"word ".repeat(100)), 5);
        let title = claude(&mut ScanCache::in_memory(), &dir, 5).chats[0].title.clone();
        assert_eq!(title.chars().count(), TITLE_LENGTH + 1);
        assert!(title.ends_with('…'));
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---- Sorting ----

    /// A message that the developer typed, at `timestamp`.
    fn user_line(timestamp: &str, text: &str) -> String {
        format!(r#"{{"type":"user","timestamp":"{timestamp}","message":{{"role":"user","content":"{text}"}}}}"#)
    }

    /// A record where Claude Code writes the file `path`.
    fn write_tool_line(path: &str) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"2026-10-11T10:00:05.000Z","message":{{"role":"assistant","content":[{{"type":"tool_use","name":"Write","input":{{"file_path":"{path}"}}}}]}}}}"#
        )
    }

    /// Writes a conversation of Claude Code in the folder of `/work/app`. `name` is its title and its identifier.
    fn write_chat(dir: &Path, name: &str, lines: &[String], age_seconds: u64) {
        let mut all = vec![claude_title_line(name)];
        all.extend(lines.iter().cloned());
        write(&claude_folder(dir).join(format!("{name}.jsonl")), &format!("{}\n", all.join("\n")), age_seconds);
    }

    fn sorted(dir: &Path, limit: usize, key: SortKey, order: SortOrder) -> AgentChats {
        claude_chats(&mut ScanCache::in_memory(), &dir.join("projects"), "/work/app", FolderScope::Exactly, limit, Sorting { key, order })
    }

    #[test]
    fn reads_the_sort_key_and_the_order_that_the_front_end_sends() {
        let keys = ["created_on", "last_updated", "messages", "issues", "pull_requests", "files_written"];
        let read: Vec<SortKey> = keys.iter().map(|key| serde_json::from_str(&format!("\"{key}\"")).unwrap()).collect();
        assert_eq!(
            read,
            vec![
                SortKey::CreatedOn,
                SortKey::LastUpdated,
                SortKey::Messages,
                SortKey::Issues,
                SortKey::PullRequests,
                SortKey::FilesWritten
            ]
        );
        assert_eq!(serde_json::from_str::<SortOrder>("\"ascending\"").unwrap(), SortOrder::Ascending);
        assert_eq!(serde_json::from_str::<SortOrder>("\"descending\"").unwrap(), SortOrder::Descending);
        assert!(serde_json::from_str::<SortKey>("\"best_match\"").is_err());
        assert_eq!(Sorting::default(), Sorting { key: SortKey::LastUpdated, order: SortOrder::Descending });
    }

    #[test]
    fn sorts_by_the_modification_date_in_ascending_order_and_opens_only_the_first_files() {
        let dir = scratch("sort-ascending");
        for (index, age) in [(1, 400), (2, 300), (3, 200), (4, 100)] {
            write_chat(&dir, &format!("Chat {index}"), &[], age);
        }
        let mut cache = ScanCache::in_memory();
        let sorting = Sorting { key: SortKey::LastUpdated, order: SortOrder::Ascending };
        let found = claude_chats(&mut cache, &dir.join("projects"), "/work/app", FolderScope::Exactly, 2, sorting);
        assert_eq!(titles(&found), vec!["Chat 1", "Chat 2"]);
        assert!(found.has_more);
        assert_eq!(cache.scan_count(), 2, "the two newer files were not opened");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sorts_by_the_number_of_messages_and_puts_the_newest_file_first_among_equal_numbers() {
        let dir = scratch("sort-messages");
        let messages = |count: usize| -> Vec<String> {
            (0..count).map(|_| user_line("2026-10-11T10:00:00.000Z", "hello")).collect()
        };
        write_chat(&dir, "A", &messages(1), 400);
        write_chat(&dir, "B", &messages(3), 300);
        write_chat(&dir, "C", &messages(2), 200);
        write_chat(&dir, "D", &messages(3), 100);
        let descending = sorted(&dir, 10, SortKey::Messages, SortOrder::Descending);
        assert_eq!(titles(&descending), vec!["D", "B", "C", "A"]);
        let ascending = sorted(&dir, 10, SortKey::Messages, SortOrder::Ascending);
        assert_eq!(titles(&ascending), vec!["A", "C", "D", "B"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sorts_by_the_date_of_the_first_message_and_not_by_the_modification_date() {
        let dir = scratch("sort-created");
        write_chat(&dir, "A", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        write_chat(&dir, "B", &[user_line("2026-10-09T10:00:00.000Z", "hello")], 100);
        write_chat(&dir, "C", &[user_line("2026-10-10T10:00:00.000Z", "hello")], 200);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::CreatedOn, SortOrder::Descending)), vec!["A", "C", "B"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::CreatedOn, SortOrder::Ascending)), vec!["B", "C", "A"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::LastUpdated, SortOrder::Descending)), vec!["B", "C", "A"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn uses_the_modification_date_as_the_creation_date_of_a_chat_without_dated_records() {
        let dir = scratch("sort-created-fallback");
        write_chat(&dir, "Dated", &[user_line("2020-01-01T00:00:00.000Z", "hello")], 100);
        write_chat(&dir, "Undated", &[USER_LINE.to_string()], 50);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::CreatedOn, SortOrder::Descending)), vec!["Undated", "Dated"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sorts_by_the_number_of_issues_and_by_the_number_of_pull_requests() {
        let dir = scratch("sort-references");
        let time = "2026-10-11T10:00:00.000Z";
        write_chat(&dir, "A", &[user_line(time, "Fix issue 1")], 400);
        write_chat(&dir, "B", &[user_line(time, "Fix issue 2 and issue 3")], 300);
        write_chat(&dir, "C", &[user_line(time, "Merge pull request 5")], 200);
        write_chat(&dir, "D", &[user_line(time, "Merge pull request 6 and pull request 7")], 100);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::Issues, SortOrder::Descending)), vec!["B", "A", "D", "C"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::Issues, SortOrder::Ascending)), vec!["D", "C", "A", "B"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::PullRequests, SortOrder::Descending)), vec!["D", "C", "B", "A"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::PullRequests, SortOrder::Ascending)), vec!["B", "A", "C", "D"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sorts_by_the_number_of_files_and_counts_a_file_of_a_worktree_once() {
        let dir = scratch("sort-files");
        let worktree_copy = write_tool_line("/work/app/.claude/worktrees/fix-1/a.ts");
        write_chat(&dir, "A", &[write_tool_line("/work/app/a.ts"), worktree_copy], 300);
        write_chat(&dir, "B", &[write_tool_line("/work/app/a.ts"), write_tool_line("/work/app/b.ts")], 200);
        let outside = [write_tool_line("/elsewhere/x.ts"), write_tool_line("/elsewhere/y.ts"), write_tool_line("/work/app/z.ts")];
        write_chat(&dir, "C", &outside, 100);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::FilesWritten, SortOrder::Descending)), vec!["C", "B", "A"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::FilesWritten, SortOrder::Ascending)), vec!["A", "B", "C"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn counts_the_written_files_with_the_worktrees_of_the_repository_removed() {
        let files: BTreeSet<String> = [
            "/work/app/a.ts",
            "/work/app/.claude/worktrees/fix-1/a.ts",
            "/work/app/.claude/worktrees/fix-2/src/b.ts",
            "/work/app/.claude/worktrees//c.ts",
            "/other/a.ts",
        ]
        .iter()
        .map(|path| path.to_string())
        .collect();
        assert_eq!(written_file_count(&files, "/work/app"), 4);
        assert_eq!(written_file_count(&files, "/work/app/"), 4);
        assert_eq!(written_file_count(&BTreeSet::new(), "/work/app"), 0);
    }

    #[test]
    fn opens_every_file_for_a_sort_key_that_needs_the_content_and_tells_when_there_are_more() {
        let dir = scratch("sort-opens-all");
        for (index, age) in [(1, 400), (2, 300), (3, 200), (4, 100)] {
            write_chat(&dir, &format!("Chat {index}"), &[user_line("2026-10-11T10:00:00.000Z", "hello")], age);
        }
        let mut cache = ScanCache::in_memory();
        let sorting = Sorting { key: SortKey::Messages, order: SortOrder::Descending };
        let found = claude_chats(&mut cache, &dir.join("projects"), "/work/app", FolderScope::Exactly, 2, sorting);
        assert_eq!(found.chats.len(), 2);
        assert!(found.has_more);
        assert_eq!(cache.scan_count(), 4, "every file was opened");
        let found = claude_chats(&mut cache, &dir.join("projects"), "/work/app", FolderScope::Exactly, 4, sorting);
        assert_eq!(found.chats.len(), 4);
        assert!(!found.has_more);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_count_a_chat_without_title_and_without_message_when_it_sorts_by_content() {
        let dir = scratch("sort-empty");
        write_chat(&dir, "Only", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        write(&claude_folder(&dir).join("empty.jsonl"), "", 100);
        let found = sorted(&dir, 5, SortKey::Messages, SortOrder::Descending);
        assert_eq!(titles(&found), vec!["Only"]);
        assert!(!found.has_more);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sorts_the_chats_of_codex_too() {
        let dir = scratch("sort-codex");
        let one = "01a12c31-175b-7513-b12c-bba764f46431";
        let two = "01a12c31-175b-7513-b12c-bba764f46432";
        codex_file(&dir, "2026/10/10", one, "/work/app", &[&codex_message("first")], 100);
        codex_file(&dir, "2026/10/10", two, "/work/app", &[&codex_message("first"), &codex_message("second")], 300);
        let index = format!("{{\"id\":\"{one}\",\"thread_name\":\"One\"}}\n{{\"id\":\"{two}\",\"thread_name\":\"Two\"}}\n");
        write(&dir.join("session_index.jsonl"), &index, 1);
        let sorting = Sorting { key: SortKey::Messages, order: SortOrder::Descending };
        let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", FolderScope::Exactly, 5, sorting);
        assert_eq!(titles(&found), vec!["Two", "One"]);
        let sorting = Sorting { key: SortKey::Messages, order: SortOrder::Ascending };
        let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", FolderScope::Exactly, 5, sorting);
        assert_eq!(titles(&found), vec!["One", "Two"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn price_table() -> PriceTable {
        let listed = data_layer_coding_agents::parse_price_list(
            r#"{"claude-opus-5":{"litellm_provider":"anthropic","input_cost_per_token":5e-06,"output_cost_per_token":2.5e-05,
                "cache_read_input_token_cost":5e-07,"cache_creation_input_token_cost":6.25e-06}}"#,
        )
        .unwrap();
        PriceTable { version: None, prices: listed.into_iter().map(|price| (price.model, price.price)).collect() }
    }

    fn answer_line(id: &str, model: &str, output: u64) -> String {
        format!(
            r#"{{"type":"assistant","message":{{"id":"{id}","model":"{model}","content":[],"usage":{{"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":4000,"output_tokens":{output}}}}}}}"#
        )
    }

    #[test]
    fn gives_the_tokens_and_the_cost_of_a_chat_and_no_cost_for_a_model_without_a_price() {
        let dir = scratch("usage");
        let lines = [user_line("2026-10-11T10:00:00.000Z", "hello"), answer_line("msg_1", "claude-opus-5", 100), answer_line("msg_1", "claude-opus-5", 200)];
        write_chat(&dir, "Priced", &lines, 100);
        let lines = [user_line("2026-10-11T10:00:00.000Z", "hello"), answer_line("msg_1", "claude-unknown-9", 100)];
        write_chat(&dir, "Not priced", &lines, 200);
        write_chat(&dir, "No answer", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        let chats = Chats {
            root: "/work/app".to_string(),
            claude: claude(&mut ScanCache::in_memory(), &dir, 5),
            codex: AgentChats::default(),
        };
        let chats = apply_prices(chats, &price_table());
        let usage: Vec<Option<ChatUsage>> = chats.claude.chats.iter().map(|chat| chat.usage.clone()).collect();
        let cost = usage[0].as_ref().unwrap().cost_usd.unwrap();
        // 1 000 × 5e-06 + 4 000 × 5e-07 + 200 × 2.5e-05
        assert!((cost - 0.012).abs() < 1e-9, "{cost}");
        assert_eq!(
            usage[0].as_ref().map(|usage| (usage.input_tokens, usage.cached_input_tokens, usage.output_tokens)),
            Some((5_000, 4_000, 200))
        );
        assert_eq!(usage[1].as_ref().map(|usage| (usage.input_tokens, usage.cost_usd)), Some((5_000, None)));
        assert_eq!(usage[2], None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sends_the_usage_to_the_front_end_and_not_the_tokens_of_each_model() {
        let dir = scratch("usage-json");
        let lines = [user_line("2026-10-11T10:00:00.000Z", "hello"), answer_line("msg_1", "claude-opus-5", 100)];
        write_chat(&dir, "Priced", &lines, 100);
        let found = claude(&mut ScanCache::in_memory(), &dir, 5);
        let json = serde_json::to_value(&found.chats[0]).unwrap();
        assert_eq!(json["usage"]["input_tokens"], 5_000);
        assert_eq!(json["usage"]["cost_usd"], Value::Null);
        assert!(json.get("tokens").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A line of Claude Code that holds a message of the developer, typed in `folder`.
    fn claude_user_line(folder: &str, text: &str) -> String {
        format!(
            r#"{{"type":"user","cwd":"{folder}","timestamp":"2026-10-11T10:00:00.000Z","message":{{"role":"user","content":"{text}"}}}}"#
        )
    }

    /// A line of Claude Code that holds the answer `id` of the model `claude-opus-5`, with `output` output tokens, at `at`.
    fn claude_answer_line(id: &str, at: &str, output: u64) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"{at}","message":{{"id":"{id}","model":"claude-opus-5","content":[],"usage":{{"output_tokens":{output}}}}}}}"#
        )
    }

    #[test]
    fn lists_the_conversations_that_started_in_a_worktree_or_in_a_sub_folder_but_not_the_ones_of_a_folder_next_to_it() {
        let dir = scratch("claude-below");
        let chat = |folder: &str, name: &str| {
            let project = dir.join("projects").join(claude_folder_name(folder));
            write(&project.join(format!("{name}.jsonl")), &format!("{}\n", claude_user_line(folder, name)), 10);
        };
        chat("/work/app", "In the root");
        chat("/work/app/.claude/worktrees/fix-1", "In a worktree");
        chat("/work/app/docs", "In a sub-folder");
        chat("/work/app-site", "Next to it");
        let found = |scope: FolderScope| {
            let found = claude_chats(&mut ScanCache::in_memory(), &dir.join("projects"), "/work/app", scope, 10, Sorting::default());
            let mut found_titles: Vec<String> = found.chats.iter().map(|chat| chat.title.clone()).collect();
            found_titles.sort();
            found_titles
        };
        assert_eq!(found(FolderScope::Exactly), vec!["In the root"]);
        assert_eq!(found(FolderScope::WithFoldersBelow), vec!["In a sub-folder", "In a worktree", "In the root"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn counts_the_tokens_of_the_subagents_and_of_the_workflows_in_the_conversation_that_started_them() {
        let dir = scratch("claude-agents");
        let folder = claude_folder(&dir);
        let main = format!("{}\n{}\n", claude_user_line("/work/app", "Fix it"), claude_answer_line("m1", "2026-10-11T10:00:05.000Z", 5));
        write(&folder.join("abc.jsonl"), &main, 100);
        let agent = format!("{}\n", claude_answer_line("a1", "2026-10-11T12:00:05.000Z", 70));
        write(&folder.join("abc").join("subagents").join("agent-1.jsonl"), &agent, 100);
        let workflow = format!("{}\n", claude_answer_line("b1", "2026-10-11T10:30:00.000Z", 200));
        write(&folder.join("abc").join("subagents").join("workflows").join("wf_1").join("agent-2.jsonl"), &workflow, 100);
        let found = claude(&mut ScanCache::in_memory(), &dir, 10);
        assert_eq!(found.chats.len(), 1);
        assert_eq!(found.chats[0].usage.as_ref().map(|usage| usage.output_tokens), Some(5 + 70 + 200));
        assert_eq!(found.chats[0].meta.user_messages, 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lists_the_compressed_conversations_of_codex_and_the_ones_of_a_sub_folder() {
        let dir = scratch("codex-compressed");
        let old = "01a12c31-175b-7513-b12c-bba764f46430";
        let below = "01a12c31-175b-7513-b12c-bba764f46431";
        let first = format!(r#"{{"type":"session_meta","payload":{{"id":"{old}","cwd":"/work/app"}}}}"#);
        let text = format!("{first}\n{}\n", codex_message("Fix the tab bar"));
        let path = dir.join("sessions/2026/09/25").join(format!("rollout-2026-09-25T01-02-03-{old}.jsonl.zst"));
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, zstd::encode_all(text.as_bytes(), 0).unwrap()).unwrap();
        codex_file(&dir, "2026/10/10", below, "/work/app/docs", &[&codex_message("Write the guide")], 5);
        let found = |scope: FolderScope| {
            let found = codex_chats(&mut ScanCache::in_memory(), &dir, "/work/app", scope, 10, Sorting::default());
            let mut found_titles: Vec<String> = found.chats.iter().map(|chat| chat.title.clone()).collect();
            found_titles.sort();
            found_titles
        };
        assert_eq!(found(FolderScope::Exactly), vec!["Fix the tab bar"]);
        assert_eq!(found(FolderScope::WithFoldersBelow), vec!["Fix the tab bar", "Write the guide"]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
