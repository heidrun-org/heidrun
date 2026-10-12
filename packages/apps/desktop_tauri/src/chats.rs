//! Chats: the conversations that Claude Code and Codex saved on this Mac for the folder of a workspace.
//!
//! Claude Code writes one file for each conversation: `<claude dir>/projects/<folder name>/<id>.jsonl`. The folder name is
//! the folder of the workspace with every character that is not a letter or a digit replaced by a dash. Each line of the
//! file is one record. The title is the field `customTitle` of the last record of type `custom-title`.
//!
//! Codex writes one file for each conversation: `<codex home>/sessions/YYYY/MM/DD/rollout-<date>-<id>.jsonl`. The first
//! line gives the folder of the conversation (`payload.cwd`). The titles are in `<codex home>/session_index.jsonl`: each
//! line has the id of a conversation and its title (`thread_name`).
//!
//! A conversation without a title shows its first message. A conversation without a title and without a message is not
//! listed.
//!
//! The list is read on demand. With the sort key "last updated", the files of a folder are sorted by their modification
//! date, and only the first `limit` conversations are opened. Every other sort key needs what each file holds, so every file
//! of the folder is opened, then the conversations are sorted and cut to `limit`. What a file holds is found by
//! `chats_scan` and kept on the disk, in `chats_cache.json`, until the size or the modification date of the file changes.
//! A file that only grew is not read again from its start: the scan continues from where it stopped.

use crate::chats_scan::{feed_claude_line, feed_codex_line, read_lines_from, scan_file, ChatMeta, Scan};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

/// The longest title that the list shows, in characters.
const TITLE_LENGTH: usize = 160;

/// The length of the identifier of a conversation of Codex, at the end of the name of its file.
const CODEX_ID_LENGTH: usize = 36;

/// The most conversations that one call returns for one coding agent.
const MAX_LIMIT: usize = 10_000;

/// The name of the file of the cache, in the folder of the data of Heidrun.
const CACHE_FILE: &str = "chats_cache.json";

/// The version of the content of the cache. A cache with another version is thrown away and made again.
const CACHE_VERSION: u32 = 3;

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

/// Which end of the sort key comes first. "Newest" is the largest value first, "oldest" is the smallest value first.
#[derive(Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    Oldest,
    #[default]
    Newest,
}

/// How the list is sorted: by which key, and from which end.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Sorting {
    pub key: SortKey,
    pub order: SortOrder,
}

// ---- Cache on the disk -------------------------------------------------------------------------------------------

/// The result of the scan of one file, valid while the size and the modification date of the file stay the same.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
struct CacheEntry {
    size: u64,
    /// The modification date of the file, in milliseconds since 1970.
    modified: i64,
    /// The byte where the scan stopped: the end of the last complete line. A file that grew is scanned from there.
    offset: u64,
    scan: Scan,
}

/// What the file of the cache holds.
#[derive(Serialize, Deserialize, Debug, Default)]
struct CacheContent {
    version: u32,
    /// The scan of each file, by path.
    scans: BTreeMap<String, CacheEntry>,
    /// The folder that the first line of each file of Codex gives, by path. A file never changes its folder.
    codex_folders: BTreeMap<String, String>,
}

/// The cache of the scans. A file of Claude Code can hold tens of megabytes, and the list is read again every few seconds.
struct ChatsCache {
    /// The file of the cache, or `None` for a cache that stays in memory.
    path: Option<PathBuf>,
    content: CacheContent,
    /// True when `content` differs from the file.
    is_dirty: bool,
}

/// The cache of the application. It is opened on the first call.
static CACHE: Mutex<Option<ChatsCache>> = Mutex::new(None);

impl ChatsCache {
    #[cfg(test)]
    fn in_memory() -> Self {
        ChatsCache { path: None, content: CacheContent { version: CACHE_VERSION, ..Default::default() }, is_dirty: false }
    }

    /// Opens the cache in `path`. A missing file, a file that is not valid, and a file with another version give an empty cache.
    fn open(path: PathBuf) -> Self {
        let content = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<CacheContent>(&text).ok())
            .filter(|content| content.version == CACHE_VERSION)
            .unwrap_or_else(|| CacheContent { version: CACHE_VERSION, ..Default::default() });
        ChatsCache { path: Some(path), content, is_dirty: false }
    }

    /// Writes the cache to its file when it changed. The file is written aside then renamed: a crash never leaves half a file.
    fn save(&mut self) {
        let Some(path) = self.path.as_ref().filter(|_| self.is_dirty) else { return };
        let Ok(text) = serde_json::to_string(&self.content) else { return };
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let temporary = path.with_extension("json.tmp");
        if std::fs::write(&temporary, text).is_ok() && std::fs::rename(&temporary, path).is_ok() {
            self.is_dirty = false;
        }
    }

    /// What `file` holds. The answer of the cache when the size and the date are the same. When the file only grew, the
    /// scan continues from where the last scan stopped. Else the file is scanned from its start.
    fn scan(&mut self, file: &FileInfo, feed: fn(&mut Scan, &str)) -> Scan {
        let key = file.path.display().to_string();
        let (mut scan, from) = match self.content.scans.get(&key) {
            Some(entry) if entry.size == file.size && entry.modified == file.modified => return entry.scan.clone(),
            Some(entry) if file.size > entry.size && entry.offset <= entry.size => (entry.scan.clone(), entry.offset),
            _ => (Scan::default(), 0),
        };
        let offset = scan_file(&file.path, from, &mut scan, feed);
        let entry = CacheEntry { size: file.size, modified: file.modified, offset, scan: scan.clone() };
        self.content.scans.insert(key, entry);
        self.is_dirty = true;
        scan
    }

    /// The folder that the first line of a file of Codex gives, or `None` when the file has no first line yet.
    fn codex_folder(&mut self, path: &Path) -> Option<String> {
        let key = path.display().to_string();
        if let Some(folder) = self.content.codex_folders.get(&key) {
            return Some(folder.clone());
        }
        let mut first_line = String::new();
        BufReader::new(std::fs::File::open(path).ok()?).read_line(&mut first_line).ok()?;
        let record = serde_json::from_str::<Value>(&first_line).ok()?;
        let folder = record.get("payload")?.get("cwd")?.as_str()?.to_string();
        self.content.codex_folders.insert(key, folder.clone());
        self.is_dirty = true;
        Some(folder)
    }

    /// Forgets what the cache holds for the files under `dir` that are not in `present` any more.
    fn forget_missing(&mut self, dir: &Path, present: &HashSet<String>) {
        let prefix = format!("{}/", dir.display());
        let before = self.content.scans.len() + self.content.codex_folders.len();
        self.content.scans.retain(|key, _| !key.starts_with(&prefix) || present.contains(key));
        self.content.codex_folders.retain(|key, _| !key.starts_with(&prefix) || present.contains(key));
        if self.content.scans.len() + self.content.codex_folders.len() != before {
            self.is_dirty = true;
        }
    }
}

/// The folder of the data of Heidrun: `HEIDRUN_DIR`, else `~/.config/heidrun`.
pub(crate) fn data_dir() -> PathBuf {
    std::env::var("HEIDRUN_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_default().join(".config").join("heidrun"))
}

/// The file of the cache: `chats_cache.json` in the folder of the data of Heidrun.
fn cache_path() -> PathBuf {
    data_dir().join(CACHE_FILE)
}

// ---- The command -------------------------------------------------------------------------------------------------

/// The first `limit` conversations of Claude Code and of Codex whose folder is the root of the repository that holds
/// `folder`, sorted by `sort_key` from the end that `order` says.
#[tauri::command]
pub async fn chats_list(folder: String, limit: usize, sort_key: SortKey, order: SortOrder) -> Result<Chats, String> {
    let sorting = Sorting { key: sort_key, order };
    // Off the main thread: the first read of the files of a coding agent takes a moment.
    tauri::async_runtime::spawn_blocking(move || list(&folder, limit, sorting)).await.map_err(|e| e.to_string())
}

fn list(folder: &str, limit: usize, sorting: Sorting) -> Chats {
    let root = crate::project::find_root(Path::new(folder)).display().to_string();
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let cache = guard.get_or_insert_with(|| ChatsCache::open(cache_path()));
    let chats = list_in(
        cache,
        &crate::claude::claude_dir().join("projects"),
        &crate::usage::codex_home(),
        &root,
        limit,
        sorting,
    );
    cache.save();
    chats
}

fn list_in(
    cache: &mut ChatsCache,
    projects: &Path,
    codex_home: &Path,
    folder: &str,
    limit: usize,
    sorting: Sorting,
) -> Chats {
    let limit = limit.clamp(1, MAX_LIMIT);
    Chats {
        root: folder.to_string(),
        claude: claude_chats(cache, projects, folder, limit, sorting),
        codex: codex_chats(cache, codex_home, folder, limit, sorting),
    }
}

// ---- Both coding agents ------------------------------------------------------------------------------------------

/// One file of a conversation.
struct FileInfo {
    path: PathBuf,
    id: String,
    size: u64,
    /// The modification date of the file, in milliseconds since 1970.
    modified: i64,
}

impl FileInfo {
    fn new(path: PathBuf, id: String, metadata: &std::fs::Metadata) -> Self {
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0);
        FileInfo { path, id, size: metadata.len(), modified }
    }
}

/// The first `limit` conversations of `files`, in the order of `sorting`. `root` is the root of the repository, for the
/// count of the written files. A file without a title and without a message is skipped, and does not count.
///
/// With the key "last updated", the files are sorted by their modification date, and the files are opened in this order
/// until `limit` conversations have a title. Every other key needs what the files hold, so every file is opened.
fn take_chats(
    cache: &mut ChatsCache,
    mut files: Vec<FileInfo>,
    limit: usize,
    root: &str,
    sorting: Sorting,
    title_of: &mut dyn FnMut(&mut ChatsCache, &FileInfo) -> Option<(String, ChatMeta)>,
) -> AgentChats {
    let mut found = AgentChats::default();
    if sorting.key == SortKey::LastUpdated {
        files.sort_by(|a, b| {
            let by_date = match sorting.order {
                SortOrder::Newest => b.modified.cmp(&a.modified),
                SortOrder::Oldest => a.modified.cmp(&b.modified),
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
            SortOrder::Newest => b.0.cmp(&a.0),
            SortOrder::Oldest => a.0.cmp(&b.0),
        };
        by_value.then_with(|| b.1.updated_at.cmp(&a.1.updated_at)).then_with(|| a.1.id.cmp(&b.1.id))
    });
    found.has_more = keyed.len() > limit;
    found.chats = keyed.into_iter().take(limit).map(|(_, chat)| chat).collect();
    found
}

/// The conversation of a file, or `None` when the file has no title and no message.
fn chat_of(
    cache: &mut ChatsCache,
    file: &FileInfo,
    title_of: &mut dyn FnMut(&mut ChatsCache, &FileInfo) -> Option<(String, ChatMeta)>,
) -> Option<Chat> {
    let (text, meta) = title_of(cache, file)?;
    let title = crate::claude::short(&text, TITLE_LENGTH);
    if title.is_empty() {
        return None;
    }
    Some(Chat { id: file.id.clone(), title, updated_at: file.modified, meta })
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

/// The title of a scan, or its first message.
fn title_of_scan(scan: &Scan) -> Option<String> {
    scan.title.clone().filter(|title| !title.trim().is_empty()).or_else(|| scan.first_message.clone())
}

// ---- Claude Code ------------------------------------------------------------------------------------------------

/// The name that Claude Code gives to the folder of the conversations of `folder`.
fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

fn claude_chats(cache: &mut ChatsCache, projects: &Path, folder: &str, limit: usize, sorting: Sorting) -> AgentChats {
    let dir = projects.join(claude_folder_name(folder));
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }
            let Some(id) = path.file_stem().map(|s| s.to_string_lossy().into_owned()) else { continue };
            let Ok(metadata) = entry.metadata() else { continue };
            files.push(FileInfo::new(path, id, &metadata));
        }
    }
    let present: HashSet<String> = files.iter().map(|file| file.path.display().to_string()).collect();
    cache.forget_missing(&dir, &present);
    take_chats(cache, files, limit, folder, sorting, &mut |cache, file| {
        let scan = cache.scan(file, feed_claude_line);
        title_of_scan(&scan).map(|text| (text, scan.meta))
    })
}

// ---- Codex -------------------------------------------------------------------------------------------------------

fn codex_chats(cache: &mut ChatsCache, home: &Path, folder: &str, limit: usize, sorting: Sorting) -> AgentChats {
    let titles = codex_titles(&home.join("session_index.jsonl"));
    let mut rollouts = Vec::new();
    collect_rollouts(&home.join("sessions"), 0, &mut rollouts);
    let present: HashSet<String> = rollouts.iter().map(|path| path.display().to_string()).collect();
    cache.forget_missing(&home.join("sessions"), &present);
    let folder = folder.trim_end_matches('/');
    let mut files = Vec::new();
    for path in rollouts {
        let Some(id) = codex_id(&path) else { continue };
        if cache.codex_folder(&path).as_deref().map(|f| f.trim_end_matches('/')) != Some(folder) {
            continue;
        }
        let Ok(metadata) = std::fs::metadata(&path) else { continue };
        files.push(FileInfo::new(path, id, &metadata));
    }
    take_chats(cache, files, limit, folder, sorting, &mut |cache, file| {
        let scan = cache.scan(file, feed_codex_line);
        titles.get(&file.id).cloned().or_else(|| title_of_scan(&scan)).map(|text| (text, scan.meta))
    })
}

/// The titles of the index of Codex, by identifier. When an identifier is there twice, the last line wins.
fn codex_titles(index: &Path) -> HashMap<String, String> {
    let mut titles = HashMap::new();
    read_lines_from(index, 0, |text| {
        let Ok(record) = serde_json::from_str::<Value>(text) else { return };
        if let (Some(id), Some(title)) =
            (record.get("id").and_then(Value::as_str), record.get("thread_name").and_then(Value::as_str))
        {
            titles.insert(id.to_string(), title.to_string());
        }
    });
    titles
}

/// Walks `sessions/YYYY/MM/DD` and lists the files `rollout-*.jsonl`.
fn collect_rollouts(dir: &Path, depth: u8, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 3 {
                collect_rollouts(&path, depth + 1, out);
            }
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                out.push(path);
            }
        }
    }
}

/// The identifier of a conversation: the last 36 characters of the name of its file, without the extension.
fn codex_id(path: &Path) -> Option<String> {
    let stem: Vec<char> = path.file_stem()?.to_str()?.chars().collect();
    if stem.len() < CODEX_ID_LENGTH {
        return None;
    }
    Some(stem[stem.len() - CODEX_ID_LENGTH..].iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

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

    fn claude(cache: &mut ChatsCache, dir: &Path, limit: usize) -> AgentChats {
        claude_chats(cache, &dir.join("projects"), "/work/app", limit, Sorting::default())
    }

    #[test]
    fn names_the_folder_of_claude_code_with_dashes() {
        assert_eq!(claude_folder_name("/Users/jetienne/webwork/heidrun"), "-Users-jetienne-webwork-heidrun");
        assert_eq!(
            claude_folder_name("/Users/jetienne/webwork/heidrun/.claude/worktrees/issue-1"),
            "-Users-jetienne-webwork-heidrun--claude-worktrees-issue-1"
        );
    }

    #[test]
    fn lists_the_conversations_of_claude_code_newest_first_and_the_last_title_wins() {
        let dir = scratch("claude-order");
        let folder = claude_folder(&dir);
        write(&folder.join("old.jsonl"), &format!("{USER_LINE}\n{}\n{}\n", claude_title_line("First name"), claude_title_line("Last name")), 500);
        write(&folder.join("new.jsonl"), &format!("{}\n", claude_title_line("Newer")), 10);
        write(&folder.join("note.txt"), "not a conversation", 1);
        let found = claude(&mut ChatsCache::in_memory(), &dir, 10);
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
        let found = claude(&mut ChatsCache::in_memory(), &dir, 10);
        assert_eq!(titles(&found), vec!["Fix the tab bar", "Fix the tab bar"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_list_a_conversation_of_claude_code_without_title_and_without_message() {
        let dir = scratch("claude-empty");
        write(&claude_folder(&dir).join("a.jsonl"), "{\"type\":\"queue-operation\"}\n{\"type\":\"last-prompt\"}\n", 5);
        write(&claude_folder(&dir).join("b.jsonl"), "", 5);
        assert_eq!(claude(&mut ChatsCache::in_memory(), &dir, 10), AgentChats::default());
        assert_eq!(
            claude_chats(&mut ChatsCache::in_memory(), &dir.join("projects"), "/work/other", 10, Sorting::default()),
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
        let mut cache = ChatsCache::in_memory();
        let found = claude(&mut cache, &dir, 2);
        assert_eq!(titles(&found), vec!["Chat 4", "Chat 3"]);
        assert!(found.has_more);
        assert_eq!(cache.content.scans.len(), 2, "the two older files were not opened");
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
        let found = claude(&mut ChatsCache::in_memory(), &dir, 2);
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
        let mut cache = ChatsCache::in_memory();
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
        let found = claude(&mut ChatsCache::in_memory(), &dir, 5);
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
        let mut cache = ChatsCache::in_memory();
        assert_eq!(claude(&mut cache, &dir, 5).chats[0].meta.user_messages, 2);
        write(&path, &format!("{}{}{}", line("one"), line("two"), line("three")), 50);
        assert_eq!(claude(&mut cache, &dir, 5).chats[0].meta.user_messages, 3);
        let entry = cache.content.scans.values().next().unwrap();
        assert_eq!(entry.offset, entry.size);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn scans_a_file_again_from_its_start_when_it_changes_without_growing() {
        let dir = scratch("claude-same-size");
        let path = claude_folder(&dir).join("a.jsonl");
        let line = |text: &str| format!("{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{text}\"}}}}\n");
        write(&path, &format!("{}{}", line("one"), line("two")), 100);
        let mut cache = ChatsCache::in_memory();
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
        let mut cache = ChatsCache::in_memory();
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
        let cache_file = dir.join("data").join(CACHE_FILE);
        let mut first = ChatsCache::open(cache_file.clone());
        assert_eq!(titles(&claude(&mut first, &dir, 5)), vec!["Kept"]);
        first.save();
        assert!(cache_file.exists());
        rewrite_keeping_size_and_date(&path, &claude_title_line("Lost"));
        let mut second = ChatsCache::open(cache_file.clone());
        assert_eq!(titles(&claude(&mut second, &dir, 5)), vec!["Kept"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn starts_with_an_empty_cache_when_the_file_is_not_valid_or_has_another_version() {
        let dir = scratch("cache-invalid");
        let cache_file = dir.join(CACHE_FILE);
        write(&cache_file, "{ nope", 1);
        assert_eq!(ChatsCache::open(cache_file.clone()).content.scans.len(), 0);
        write(&cache_file, r#"{"version":0,"scans":{"/x":{"size":1,"modified":1,"title":"Old","first_message":null}},"codex_folders":{}}"#, 1);
        assert_eq!(ChatsCache::open(cache_file.clone()).content.scans.len(), 0);
        assert_eq!(ChatsCache::open(dir.join("missing.json")).content.scans.len(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn writes_nothing_when_the_cache_did_not_change() {
        let dir = scratch("cache-clean");
        let cache_file = dir.join(CACHE_FILE);
        ChatsCache::open(cache_file.clone()).save();
        assert!(!cache_file.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn forgets_the_cache_of_a_file_that_was_deleted() {
        let dir = scratch("cache-forget");
        let folder = claude_folder(&dir);
        write(&folder.join("a.jsonl"), &claude_title_line("Stays"), 100);
        write(&folder.join("b.jsonl"), &claude_title_line("Goes"), 200);
        let mut cache = ChatsCache::in_memory();
        assert_eq!(claude(&mut cache, &dir, 5).chats.len(), 2);
        std::fs::remove_file(folder.join("b.jsonl")).unwrap();
        assert_eq!(titles(&claude(&mut cache, &dir, 5)), vec!["Stays"]);
        assert_eq!(cache.content.scans.len(), 1);
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
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 10, Sorting::default());
        assert_eq!(titles(&found), vec!["Newer", "Describe image"]);
        assert_eq!(found.chats[1].id, a);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn gives_the_meta_information_of_a_chat_of_codex_that_has_a_title_in_the_index() {
        let dir = scratch("codex-meta");
        let id = "01a12c31-175b-7513-b12c-bba764f46420";
        let real = codex_message("Please fix issue 250");
        codex_file(&dir, "2026/10/10", id, "/work/app", &[&real], 5);
        write(&dir.join("session_index.jsonl"), &format!("{{\"id\":\"{id}\",\"thread_name\":\"Fix it\"}}\n"), 1);
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 5, Sorting::default());
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
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 10, Sorting::default());
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
        let mut cache = ChatsCache::in_memory();
        let found = codex_chats(&mut cache, &dir, "/work/app", 2, Sorting::default());
        assert_eq!(titles(&found), vec!["Chat 2", "Chat 1"]);
        assert!(found.has_more);
        assert_eq!(cache.content.codex_folders.len(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lists_nothing_when_the_folders_of_the_coding_agents_do_not_exist() {
        let dir = scratch("nothing");
        let found = list_in(&mut ChatsCache::in_memory(), &dir.join("projects"), &dir, "/work/app", 5, Sorting::default());
        assert_eq!(found.claude, AgentChats::default());
        assert_eq!(found.codex, AgentChats::default());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn answers_the_root_of_the_repository_that_it_listed() {
        let dir = scratch("root");
        let found = list_in(&mut ChatsCache::in_memory(), &dir.join("projects"), &dir, "/work/app", 5, Sorting::default());
        assert_eq!(found.root, "/work/app");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cuts_a_long_title_with_an_ellipsis() {
        let dir = scratch("long-title");
        write(&claude_folder(&dir).join("a.jsonl"), &claude_title_line(&"word ".repeat(100)), 5);
        let title = claude(&mut ChatsCache::in_memory(), &dir, 5).chats[0].title.clone();
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
        claude_chats(&mut ChatsCache::in_memory(), &dir.join("projects"), "/work/app", limit, Sorting { key, order })
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
        assert_eq!(serde_json::from_str::<SortOrder>("\"oldest\"").unwrap(), SortOrder::Oldest);
        assert_eq!(serde_json::from_str::<SortOrder>("\"newest\"").unwrap(), SortOrder::Newest);
        assert!(serde_json::from_str::<SortKey>("\"best_match\"").is_err());
        assert_eq!(Sorting::default(), Sorting { key: SortKey::LastUpdated, order: SortOrder::Newest });
    }

    #[test]
    fn sorts_by_the_modification_date_from_the_oldest_and_opens_only_the_oldest_files() {
        let dir = scratch("sort-oldest");
        for (index, age) in [(1, 400), (2, 300), (3, 200), (4, 100)] {
            write_chat(&dir, &format!("Chat {index}"), &[], age);
        }
        let mut cache = ChatsCache::in_memory();
        let sorting = Sorting { key: SortKey::LastUpdated, order: SortOrder::Oldest };
        let found = claude_chats(&mut cache, &dir.join("projects"), "/work/app", 2, sorting);
        assert_eq!(titles(&found), vec!["Chat 1", "Chat 2"]);
        assert!(found.has_more);
        assert_eq!(cache.content.scans.len(), 2, "the two newer files were not opened");
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
        let newest = sorted(&dir, 10, SortKey::Messages, SortOrder::Newest);
        assert_eq!(titles(&newest), vec!["D", "B", "C", "A"]);
        let oldest = sorted(&dir, 10, SortKey::Messages, SortOrder::Oldest);
        assert_eq!(titles(&oldest), vec!["A", "C", "D", "B"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn sorts_by_the_date_of_the_first_message_and_not_by_the_modification_date() {
        let dir = scratch("sort-created");
        write_chat(&dir, "A", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        write_chat(&dir, "B", &[user_line("2026-10-09T10:00:00.000Z", "hello")], 100);
        write_chat(&dir, "C", &[user_line("2026-10-10T10:00:00.000Z", "hello")], 200);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::CreatedOn, SortOrder::Newest)), vec!["A", "C", "B"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::CreatedOn, SortOrder::Oldest)), vec!["B", "C", "A"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::LastUpdated, SortOrder::Newest)), vec!["B", "C", "A"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn uses_the_modification_date_as_the_creation_date_of_a_chat_without_dated_records() {
        let dir = scratch("sort-created-fallback");
        write_chat(&dir, "Dated", &[user_line("2020-01-01T00:00:00.000Z", "hello")], 100);
        write_chat(&dir, "Undated", &[USER_LINE.to_string()], 50);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::CreatedOn, SortOrder::Newest)), vec!["Undated", "Dated"]);
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
        assert_eq!(titles(&sorted(&dir, 10, SortKey::Issues, SortOrder::Newest)), vec!["B", "A", "D", "C"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::Issues, SortOrder::Oldest)), vec!["D", "C", "A", "B"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::PullRequests, SortOrder::Newest)), vec!["D", "C", "B", "A"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::PullRequests, SortOrder::Oldest)), vec!["B", "A", "C", "D"]);
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
        assert_eq!(titles(&sorted(&dir, 10, SortKey::FilesWritten, SortOrder::Newest)), vec!["C", "B", "A"]);
        assert_eq!(titles(&sorted(&dir, 10, SortKey::FilesWritten, SortOrder::Oldest)), vec!["A", "B", "C"]);
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
        let mut cache = ChatsCache::in_memory();
        let sorting = Sorting { key: SortKey::Messages, order: SortOrder::Newest };
        let found = claude_chats(&mut cache, &dir.join("projects"), "/work/app", 2, sorting);
        assert_eq!(found.chats.len(), 2);
        assert!(found.has_more);
        assert_eq!(cache.content.scans.len(), 4, "every file was opened");
        let found = claude_chats(&mut cache, &dir.join("projects"), "/work/app", 4, sorting);
        assert_eq!(found.chats.len(), 4);
        assert!(!found.has_more);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_count_a_chat_without_title_and_without_message_when_it_sorts_by_content() {
        let dir = scratch("sort-empty");
        write_chat(&dir, "Only", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        write(&claude_folder(&dir).join("empty.jsonl"), "", 100);
        let found = sorted(&dir, 5, SortKey::Messages, SortOrder::Newest);
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
        let sorting = Sorting { key: SortKey::Messages, order: SortOrder::Newest };
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 5, sorting);
        assert_eq!(titles(&found), vec!["Two", "One"]);
        let sorting = Sorting { key: SortKey::Messages, order: SortOrder::Oldest };
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 5, sorting);
        assert_eq!(titles(&found), vec!["One", "Two"]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
