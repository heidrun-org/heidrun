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
//! The list is read on demand: the files of a folder are sorted by their modification date, and only the newest `limit`
//! conversations are opened. What a file holds is kept on the disk, in `chats_cache.json`, until the size or the
//! modification date of the file changes, so a file is never read twice for the same content.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
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
const CACHE_VERSION: u32 = 1;

/// One conversation.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Chat {
    pub id: String,
    /// The title, or the first message when the conversation has no title.
    pub title: String,
    /// When the file of the conversation changed, in milliseconds since 1970.
    pub updated_at: i64,
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
    pub claude: AgentChats,
    pub codex: AgentChats,
}

// ---- Cache on the disk -------------------------------------------------------------------------------------------

/// What a scan of one file found.
#[derive(Clone, Default)]
struct Scan {
    title: Option<String>,
    first_message: Option<String>,
}

/// The result of the scan of one file, valid while the size and the modification date of the file stay the same.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
struct CacheEntry {
    size: u64,
    /// The modification date of the file, in milliseconds since 1970.
    modified: i64,
    title: Option<String>,
    first_message: Option<String>,
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

    /// What `file` holds: the answer of the cache when the size and the date are the same, else the result of `scan_file`.
    fn scan(&mut self, file: &FileInfo, scan_file: fn(&Path) -> Scan) -> Scan {
        let key = file.path.display().to_string();
        if let Some(entry) = self.content.scans.get(&key) {
            if entry.size == file.size && entry.modified == file.modified {
                return Scan { title: entry.title.clone(), first_message: entry.first_message.clone() };
            }
        }
        let scan = scan_file(&file.path);
        let entry = CacheEntry {
            size: file.size,
            modified: file.modified,
            title: scan.title.clone(),
            first_message: scan.first_message.clone(),
        };
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

/// The file of the cache: `chats_cache.json` in the folder of the data of Heidrun.
fn cache_path() -> PathBuf {
    std::env::var("HEIDRUN_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_default().join(".config").join("heidrun"))
        .join(CACHE_FILE)
}

// ---- The command -------------------------------------------------------------------------------------------------

/// The newest `limit` conversations of Claude Code and of Codex whose folder is the root of the repository that holds
/// `folder`.
#[tauri::command]
pub async fn chats_list(folder: String, limit: usize) -> Result<Chats, String> {
    // Off the main thread: the first read of the files of a coding agent takes a moment.
    tauri::async_runtime::spawn_blocking(move || list(&folder, limit)).await.map_err(|e| e.to_string())
}

fn list(folder: &str, limit: usize) -> Chats {
    let root = crate::project::find_root(Path::new(folder)).display().to_string();
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let cache = guard.get_or_insert_with(|| ChatsCache::open(cache_path()));
    let chats = list_in(
        cache,
        &crate::claude::claude_dir().join("projects"),
        &crate::usage::codex_home(),
        &root,
        limit,
    );
    cache.save();
    chats
}

fn list_in(cache: &mut ChatsCache, projects: &Path, codex_home: &Path, folder: &str, limit: usize) -> Chats {
    let limit = limit.clamp(1, MAX_LIMIT);
    Chats {
        claude: claude_chats(cache, projects, folder, limit),
        codex: codex_chats(cache, codex_home, folder, limit),
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

/// Opens the files from the newest one, and stops when `limit` conversations have a title. A file without a title and
/// without a message is skipped, and does not count.
fn take_chats(
    cache: &mut ChatsCache,
    mut files: Vec<FileInfo>,
    limit: usize,
    title_of: &mut dyn FnMut(&mut ChatsCache, &FileInfo) -> Option<String>,
) -> AgentChats {
    files.sort_by(|a, b| b.modified.cmp(&a.modified).then_with(|| a.id.cmp(&b.id)));
    let mut found = AgentChats::default();
    for file in &files {
        if found.chats.len() == limit {
            found.has_more = true;
            break;
        }
        let Some(text) = title_of(cache, file) else { continue };
        let title = crate::claude::short(&text, TITLE_LENGTH);
        if !title.is_empty() {
            found.chats.push(Chat { id: file.id.clone(), title, updated_at: file.modified });
        }
    }
    found
}

/// The title of a scan, or its first message.
fn title_of_scan(scan: &Scan) -> Option<String> {
    scan.title.clone().filter(|title| !title.trim().is_empty()).or_else(|| scan.first_message.clone())
}

/// Calls `each` with every line of the file that is valid text. A file that cannot be read has no line.
fn for_each_line(path: &Path, mut each: impl FnMut(&str)) {
    let Ok(file) = std::fs::File::open(path) else { return };
    let mut reader = BufReader::new(file);
    let mut line = Vec::new();
    loop {
        line.clear();
        match reader.read_until(b'\n', &mut line) {
            Ok(0) | Err(_) => return,
            Ok(_) => {}
        }
        if let Ok(text) = std::str::from_utf8(&line) {
            each(text);
        }
    }
}

/// The first text of a message content that is not in angle brackets. A content is a string, or a list of parts.
fn text_of_content(content: &Value) -> Option<String> {
    let text = match content {
        Value::String(text) => Some(text.as_str()),
        Value::Array(parts) => parts.iter().find_map(|part| part.get("text").and_then(Value::as_str)),
        _ => None,
    }?;
    let text = text.trim();
    if text.is_empty() || text.starts_with('<') {
        return None;
    }
    Some(text.to_string())
}

// ---- Claude Code ------------------------------------------------------------------------------------------------

/// The name that Claude Code gives to the folder of the conversations of `folder`.
fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

fn claude_chats(cache: &mut ChatsCache, projects: &Path, folder: &str, limit: usize) -> AgentChats {
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
    take_chats(cache, files, limit, &mut |cache, file| title_of_scan(&cache.scan(file, scan_claude_file)))
}

fn scan_claude_file(path: &Path) -> Scan {
    let mut scan = Scan::default();
    for_each_line(path, |text| {
        if text.contains(r#""type":"custom-title""#) {
            let Ok(record) = serde_json::from_str::<Value>(text) else { return };
            if record.get("type").and_then(Value::as_str) == Some("custom-title") {
                scan.title = record.get("customTitle").and_then(Value::as_str).map(str::to_string);
            }
        } else if scan.first_message.is_none() && text.contains(r#""type":"user""#) {
            scan.first_message = claude_user_message(text);
        }
    });
    scan
}

/// The text that the developer typed, from one line of a file of Claude Code. A line that holds a tool result, a note of
/// the program, or a command in angle brackets, such as `<command-name>`, is not a message.
fn claude_user_message(line: &str) -> Option<String> {
    let record = serde_json::from_str::<Value>(line).ok()?;
    if record.get("type").and_then(Value::as_str) != Some("user")
        || record.get("isMeta").and_then(Value::as_bool) == Some(true)
        || record.get("isSidechain").and_then(Value::as_bool) == Some(true)
    {
        return None;
    }
    text_of_content(record.get("message")?.get("content")?)
}

// ---- Codex -------------------------------------------------------------------------------------------------------

fn codex_chats(cache: &mut ChatsCache, home: &Path, folder: &str, limit: usize) -> AgentChats {
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
    take_chats(cache, files, limit, &mut |cache, file| match titles.get(&file.id) {
        Some(title) => Some(title.clone()),
        None => title_of_scan(&cache.scan(file, scan_codex_file)),
    })
}

/// The titles of the index of Codex, by identifier. When an identifier is there twice, the last line wins.
fn codex_titles(index: &Path) -> HashMap<String, String> {
    let mut titles = HashMap::new();
    for_each_line(index, |text| {
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

fn scan_codex_file(path: &Path) -> Scan {
    let mut scan = Scan::default();
    for_each_line(path, |text| {
        if scan.first_message.is_none() && text.contains(r#""role":"user""#) {
            scan.first_message = codex_user_message(text);
        }
    });
    scan
}

/// The text that the developer typed, from one line of a file of Codex. Codex starts every conversation with a message
/// that holds the instructions of `AGENTS.md`, and a message in angle brackets that describes the environment. Neither
/// one is a message of the developer.
fn codex_user_message(line: &str) -> Option<String> {
    let record = serde_json::from_str::<Value>(line).ok()?;
    let payload = record.get("payload")?;
    if record.get("type").and_then(Value::as_str) != Some("response_item")
        || payload.get("type").and_then(Value::as_str) != Some("message")
        || payload.get("role").and_then(Value::as_str) != Some("user")
    {
        return None;
    }
    let text = text_of_content(payload.get("content")?)?;
    if text.starts_with("# AGENTS.md") {
        return None;
    }
    Some(text)
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
        claude_chats(cache, &dir.join("projects"), "/work/app", limit)
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
            claude_chats(&mut ChatsCache::in_memory(), &dir.join("projects"), "/work/other", 10),
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
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 10);
        assert_eq!(titles(&found), vec!["Newer", "Describe image"]);
        assert_eq!(found.chats[1].id, a);
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
        let found = codex_chats(&mut ChatsCache::in_memory(), &dir, "/work/app", 10);
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
        let found = codex_chats(&mut cache, &dir, "/work/app", 2);
        assert_eq!(titles(&found), vec!["Chat 2", "Chat 1"]);
        assert!(found.has_more);
        assert_eq!(cache.content.codex_folders.len(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lists_nothing_when_the_folders_of_the_coding_agents_do_not_exist() {
        let dir = scratch("nothing");
        let found = list_in(&mut ChatsCache::in_memory(), &dir.join("projects"), &dir, "/work/app", 5);
        assert_eq!(found.claude, AgentChats::default());
        assert_eq!(found.codex, AgentChats::default());
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
}
