//! Sample data and helpers for the tests of the package. Only the tests compile this file.

use crate::model::configuration_types::{ConfigurationItem, ConfigurationKind, ConfigurationScope};
use crate::model::types::{ChatSession, ChatSessionRecord, ChatSessionRelations, CodingAgent, ModelTokens};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// A date in October 2026, in the format ISO 8601. `day` goes from 1 to 28.
pub fn date(day: u32) -> String {
    format!("2026-10-{day:02}T10:00:00.000Z")
}

/// A function that ignores the lines of progress.
pub fn ignore_log(_message: &str) {}

/// A new empty folder in the temporary folder. Each test gives its own name.
pub fn temp_folder(name: &str) -> PathBuf {
    let folder = std::env::temp_dir().join(format!("data_layer_coding_agents_{name}_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&folder);
    std::fs::create_dir_all(&folder).unwrap();
    folder
}

/// Writes a file with its folders, and sets its modification date to `age_seconds` seconds before now.
pub fn write_file(path: &Path, text: &str, age_seconds: u64) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
    let modified = SystemTime::now() - Duration::from_secs(age_seconds);
    std::fs::File::options().write(true).open(path).unwrap().set_modified(modified).unwrap();
}

/// Writes `text` compressed with zstd in a file with its folders, and sets its modification date to `age_seconds` seconds
/// before now.
pub fn write_compressed_file(path: &Path, text: &str, age_seconds: u64) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, zstd::encode_all(text.as_bytes(), 0).unwrap()).unwrap();
    let modified = SystemTime::now() - Duration::from_secs(age_seconds);
    std::fs::File::options().write(true).open(path).unwrap().set_modified(modified).unwrap();
}

/// A chat session file of Codex for `folder`, in the folder of Codex `home`, with `messages` after its first line.
pub fn codex_file(home: &Path, day: &str, id: &str, folder: &str, messages: &[&str], age_seconds: u64) {
    let first = format!(r#"{{"type":"session_meta","payload":{{"id":"{id}","cwd":"{folder}"}}}}"#);
    let name = format!("rollout-2026-10-10T01-02-03-{id}.jsonl");
    write_file(&home.join("sessions").join(day).join(name), &format!("{first}\n{}\n", messages.join("\n")), age_seconds);
}

/// The same chat session file of Codex as `codex_file`, compressed with zstd, as Codex does for its old chat sessions.
pub fn codex_compressed_file(home: &Path, day: &str, id: &str, folder: &str, messages: &[&str], age_seconds: u64) {
    let first = format!(r#"{{"type":"session_meta","payload":{{"id":"{id}","cwd":"{folder}"}}}}"#);
    let name = format!("rollout-2026-10-10T01-02-03-{id}.jsonl.zst");
    let text = format!("{first}\n{}\n", messages.join("\n"));
    write_compressed_file(&home.join("sessions").join(day).join(name), &text, age_seconds);
}

/// A line of Claude Code that holds a message of the developer, typed in `folder`.
pub fn claude_user_line(folder: &str, text: &str) -> String {
    format!(
        r#"{{"type":"user","cwd":"{folder}","timestamp":"2026-10-11T10:00:00.000Z","message":{{"role":"user","content":"{text}"}}}}"#
    )
}

/// A line of Claude Code that holds the answer `id` of the model `opus`, with `output` output tokens.
pub fn claude_answer_line(id: &str, output: u64) -> String {
    format!(
        r#"{{"type":"assistant","timestamp":"2026-10-11T10:00:05.000Z","message":{{"id":"{id}","model":"opus","content":[],"usage":{{"input_tokens":10,"output_tokens":{output}}}}}}}"#
    )
}

/// A line of Codex that holds a message of the developer.
pub fn codex_message(text: &str) -> String {
    format!(
        r#"{{"type":"response_item","payload":{{"type":"message","role":"user","content":[{{"type":"input_text","text":"{text}"}}]}}}}"#
    )
}

/// A chat session that follows the JSON schema. Its last change is on the day 2.
pub fn chat_session(id: &str) -> ChatSession {
    ChatSession {
        id: id.to_string(),
        coding_agent: CodingAgent::ClaudeCode,
        title: "A chat session".into(),
        first_record_at: Some(date(1)),
        last_record_at: Some(date(2)),
        updated_at: date(2),
        user_message_count: 3,
        tokens: vec![ModelTokens {
            model: "claude-opus-5".into(),
            fresh_input: 10,
            cached_input: 300,
            cache_write_input: 20,
            output: 5,
        }],
    }
}

/// A chat session with relations to one folder, two issues, one pull request, and two files.
pub fn chat_session_record(id: &str) -> ChatSessionRecord {
    ChatSessionRecord {
        chat_session: chat_session(id),
        relations: ChatSessionRelations {
            folders: vec!["/work/app".into()],
            issues: vec![250, 251],
            pull_requests: vec![249],
            files_written: vec!["/work/app/a.ts".into(), "/work/app/b.ts".into()],
        },
    }
}

/// A configuration item of a kind that follows the JSON schema of the kind, created on the day 1 and changed on the day 2. A
/// memory file has a type and the chat session that wrote it.
pub fn configuration_item(kind: ConfigurationKind, id: &str) -> ConfigurationItem {
    let is_memory_file = kind == ConfigurationKind::MemoryFile;
    ConfigurationItem {
        id: id.to_string(),
        coding_agent: Some(CodingAgent::ClaudeCode),
        scope: ConfigurationScope::Project,
        folder: "/work/app/.claude".into(),
        name: "a-name".into(),
        description: Some("A description".into()),
        created_at: date(1),
        updated_at: date(2),
        removed_at: None,
        memory_type: if is_memory_file { Some("feedback".into()) } else { None },
        origin_chat_session_id: if is_memory_file { Some("abc".into()) } else { None },
    }
}
