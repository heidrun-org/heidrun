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

use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

/// The longest title that the list shows, in characters.
const TITLE_LENGTH: usize = 160;

/// The length of the identifier of a conversation of Codex, at the end of the name of its file.
const CODEX_ID_LENGTH: usize = 36;

/// One conversation.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Chat {
    pub id: String,
    /// The title, or the first message when the conversation has no title.
    pub title: String,
    /// When the file of the conversation changed, in milliseconds since 1970.
    pub updated_at: i64,
}

/// The conversations of one folder, newest first, for each coding agent.
#[derive(Serialize, Debug, Default)]
pub struct Chats {
    pub claude: Vec<Chat>,
    pub codex: Vec<Chat>,
}

/// What a scan of one file found.
#[derive(Clone, Default)]
struct Scan {
    title: Option<String>,
    first_message: Option<String>,
}

/// The result of the scan of a file, kept while the size and the date of the file do not change. A file of Claude Code can
/// hold tens of megabytes, and the list is read again every few seconds.
struct CachedScan {
    len: u64,
    modified: SystemTime,
    scan: Scan,
}

static CLAUDE_SCANS: Mutex<BTreeMap<PathBuf, CachedScan>> = Mutex::new(BTreeMap::new());
static CODEX_SCANS: Mutex<BTreeMap<PathBuf, CachedScan>> = Mutex::new(BTreeMap::new());

/// The folder that the first line of a file of Codex gives. A file never changes its folder, so the folder is kept for good.
static CODEX_FOLDERS: Mutex<BTreeMap<PathBuf, String>> = Mutex::new(BTreeMap::new());

/// The conversations of Claude Code and of Codex whose folder is the root of the repository that holds `folder`.
#[tauri::command]
pub async fn chats_list(folder: String) -> Result<Chats, String> {
    // Off the main thread: the first read of the files of Claude Code takes a moment.
    tauri::async_runtime::spawn_blocking(move || list(&folder)).await.map_err(|e| e.to_string())
}

fn list(folder: &str) -> Chats {
    let root = crate::project::find_root(Path::new(folder)).display().to_string();
    Chats {
        claude: claude_chats(&crate::claude::claude_dir().join("projects"), &root),
        codex: codex_chats(&crate::usage::codex_home(), &root),
    }
}

// ---- Claude Code ------------------------------------------------------------------------------------------------

/// The name that Claude Code gives to the folder of the conversations of `folder`.
fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

fn claude_chats(projects: &Path, folder: &str) -> Vec<Chat> {
    let Ok(entries) = std::fs::read_dir(projects.join(claude_folder_name(folder))) else { return vec![] };
    let mut chats = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let Some(id) = path.file_stem().map(|s| s.to_string_lossy().into_owned()) else { continue };
        let Ok(metadata) = entry.metadata() else { continue };
        let scan = cached_scan(&CLAUDE_SCANS, &path, &metadata, scan_claude_file);
        if let Some(chat) = chat_from(id, &scan, &metadata) {
            chats.push(chat);
        }
    }
    newest_first(chats)
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

fn codex_chats(home: &Path, folder: &str) -> Vec<Chat> {
    let titles = codex_titles(&home.join("session_index.jsonl"));
    let mut files = Vec::new();
    collect_rollouts(&home.join("sessions"), 0, &mut files);
    let folder = folder.trim_end_matches('/');
    let mut chats = Vec::new();
    for path in files {
        let Some(id) = codex_id(&path) else { continue };
        if codex_folder(&path).as_deref().map(|f| f.trim_end_matches('/')) != Some(folder) {
            continue;
        }
        let Ok(metadata) = std::fs::metadata(&path) else { continue };
        let scan = match titles.get(&id) {
            Some(title) => Scan { title: Some(title.clone()), first_message: None },
            None => cached_scan(&CODEX_SCANS, &path, &metadata, scan_codex_file),
        };
        if let Some(chat) = chat_from(id, &scan, &metadata) {
            chats.push(chat);
        }
    }
    newest_first(chats)
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

/// The folder that the first line of the file gives, or `None` when the file has no first line yet.
fn codex_folder(path: &Path) -> Option<String> {
    if let Some(folder) = CODEX_FOLDERS.lock().unwrap_or_else(|e| e.into_inner()).get(path) {
        return Some(folder.clone());
    }
    let mut first_line = String::new();
    BufReader::new(std::fs::File::open(path).ok()?).read_line(&mut first_line).ok()?;
    let record = serde_json::from_str::<Value>(&first_line).ok()?;
    let folder = record.get("payload")?.get("cwd")?.as_str()?.to_string();
    CODEX_FOLDERS.lock().unwrap_or_else(|e| e.into_inner()).insert(path.to_path_buf(), folder.clone());
    Some(folder)
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

// ---- Both coding agents ------------------------------------------------------------------------------------------

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

fn cached_scan(
    cache: &Mutex<BTreeMap<PathBuf, CachedScan>>,
    path: &Path,
    metadata: &std::fs::Metadata,
    scan_file: fn(&Path) -> Scan,
) -> Scan {
    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    if let Some(cached) = cache.lock().unwrap_or_else(|e| e.into_inner()).get(path) {
        if cached.len == metadata.len() && cached.modified == modified {
            return cached.scan.clone();
        }
    }
    let scan = scan_file(path);
    cache.lock().unwrap_or_else(|e| e.into_inner()).insert(
        path.to_path_buf(),
        CachedScan { len: metadata.len(), modified, scan: scan.clone() },
    );
    scan
}

fn chat_from(id: String, scan: &Scan, metadata: &std::fs::Metadata) -> Option<Chat> {
    let text = [scan.title.as_deref(), scan.first_message.as_deref()]
        .into_iter()
        .flatten()
        .map(|text| crate::claude::short(text, TITLE_LENGTH))
        .find(|text| !text.is_empty())?;
    let updated_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0);
    Some(Chat { id, title: text, updated_at })
}

fn newest_first(mut chats: Vec<Chat>) -> Vec<Chat> {
    chats.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then_with(|| a.id.cmp(&b.id)));
    chats
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

    const USER_LINE: &str = r#"{"type":"user","message":{"role":"user","content":"Fix the   tab bar"}}"#;

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
        let folder = dir.join("projects").join(claude_folder_name("/work/app"));
        let title = |t: &str| format!(r#"{{"type":"custom-title","customTitle":"{t}","sessionId":"x"}}"#);
        write(&folder.join("old.jsonl"), &format!("{USER_LINE}\n{}\n{}\n", title("First name"), title("Last name")), 500);
        write(&folder.join("new.jsonl"), &format!("{}\n", title("Newer")), 10);
        write(&folder.join("note.txt"), "not a conversation", 1);
        let chats = claude_chats(&dir.join("projects"), "/work/app");
        let titles: Vec<&str> = chats.iter().map(|c| c.title.as_str()).collect();
        assert_eq!(titles, vec!["Newer", "Last name"]);
        assert_eq!(chats[0].id, "new");
        assert!(chats[0].updated_at > chats[1].updated_at);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shows_the_first_message_of_claude_code_when_there_is_no_title() {
        let dir = scratch("claude-first-message");
        let folder = dir.join("projects").join(claude_folder_name("/work/app"));
        let tool_result = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"x"}]}}"#;
        let command = r#"{"type":"user","message":{"role":"user","content":"<command-name>/clear</command-name>"}}"#;
        let meta = r#"{"type":"user","isMeta":true,"message":{"role":"user","content":"Caveat"}}"#;
        let parts = r#"{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Fix the   tab bar"}]}}"#;
        write(&folder.join("a.jsonl"), &format!("{tool_result}\n{command}\n{meta}\n{parts}\n"), 5);
        write(&folder.join("b.jsonl"), &format!("{USER_LINE}\n"), 6);
        let chats = claude_chats(&dir.join("projects"), "/work/app");
        assert_eq!(chats.iter().map(|c| c.title.as_str()).collect::<Vec<_>>(), vec!["Fix the tab bar", "Fix the tab bar"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn does_not_list_a_conversation_of_claude_code_without_title_and_without_message() {
        let dir = scratch("claude-empty");
        let folder = dir.join("projects").join(claude_folder_name("/work/app"));
        write(&folder.join("a.jsonl"), "{\"type\":\"queue-operation\"}\n{\"type\":\"last-prompt\"}\n", 5);
        write(&folder.join("b.jsonl"), "", 5);
        assert_eq!(claude_chats(&dir.join("projects"), "/work/app"), vec![]);
        assert_eq!(claude_chats(&dir.join("projects"), "/work/other"), vec![]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reads_a_file_of_claude_code_again_when_it_changes() {
        let dir = scratch("claude-cache");
        let path = dir.join("projects").join(claude_folder_name("/work/app")).join("a.jsonl");
        let title = |t: &str| format!(r#"{{"type":"custom-title","customTitle":"{t}"}}"#);
        write(&path, &title("Before"), 100);
        assert_eq!(claude_chats(&dir.join("projects"), "/work/app")[0].title, "Before");
        write(&path, &format!("{}\n{}\n", title("Before"), title("After the change")), 50);
        assert_eq!(claude_chats(&dir.join("projects"), "/work/app")[0].title, "After the change");
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
        let chats = codex_chats(&dir, "/work/app");
        assert_eq!(chats.iter().map(|c| c.title.as_str()).collect::<Vec<_>>(), vec!["Newer", "Describe image"]);
        assert_eq!(chats[1].id, a);
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
        let chats = codex_chats(&dir, "/work/app");
        assert_eq!(chats.iter().map(|c| c.title.as_str()).collect::<Vec<_>>(), vec!["Write the change log"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lists_nothing_when_the_folders_of_the_coding_agents_do_not_exist() {
        let dir = scratch("nothing");
        assert_eq!(claude_chats(&dir.join("projects"), "/work/app"), vec![]);
        assert_eq!(codex_chats(&dir, "/work/app"), vec![]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cuts_a_long_title_with_an_ellipsis() {
        let dir = scratch("long-title");
        let path = dir.join("projects").join(claude_folder_name("/work/app")).join("a.jsonl");
        write(&path, &format!(r#"{{"type":"custom-title","customTitle":"{}"}}"#, "word ".repeat(100)), 5);
        let title = claude_chats(&dir.join("projects"), "/work/app")[0].title.clone();
        assert_eq!(title.chars().count(), TITLE_LENGTH + 1);
        assert!(title.ends_with('…'));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
