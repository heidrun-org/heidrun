//! Reads the records of one chat session file of Claude Code or of Codex, found with the library of
//! `data_layer_chat_sessions`, which also opens the compressed files of Codex.

use crate::output::QueryRow;
use data_layer_chat_sessions::{
    find_claude_session_files, find_codex_session_files, read_lines_from, shorten, FolderScope, ScanCache, SessionFile,
};
use serde_json::{json, Value};
use std::path::Path;

/// The number of characters of a tool call or of a tool result when the option `--full` is not given.
pub const SHORT_TOOL_LENGTH: usize = 200;

/// The role of the author of one record of a chat session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    /// The developer typed the text.
    Developer,
    /// The coding agent wrote the text.
    CodingAgent,
    /// A tool call of the coding agent, or the result of a tool.
    Tool,
}

impl Role {
    /// The name of the role in the output.
    pub fn name(self) -> &'static str {
        match self {
            Role::Developer => "developer",
            Role::CodingAgent => "coding_agent",
            Role::Tool => "tool",
        }
    }
}

/// One record of a chat session.
#[derive(Debug, Clone, PartialEq)]
pub struct ChatRecord {
    /// The date of the record, as the coding agent wrote it, or `None` when the record has no date.
    pub at: Option<String>,
    /// The role of the author.
    pub role: Role,
    /// The text. A tool call is `<name>: <input>`, and a tool result is `result: <output>`.
    pub text: String,
    /// The error flag of a tool result: `Some(true)` when the coding agent marks the tool result as failed, `Some(false)`
    /// when it marks it as a success, and `None` when the coding agent gives no flag, or for any other record.
    pub is_error: Option<bool>,
}

impl ChatRecord {
    /// The record as one row: `at`, `role`, `text`, and `isError`.
    pub fn to_row(&self) -> QueryRow {
        match json!({ "at": self.at, "role": self.role.name(), "text": self.text, "isError": self.is_error }) {
            Value::Object(row) => row,
            _ => unreachable!("The record is an object"),
        }
    }
}

/// The coding agent that wrote a chat session file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CodingAgent {
    /// Claude Code.
    Claude,
    /// Codex.
    Codex,
}

/// Reads the records of the chat session `id` of the repository at `root`, or of one of its worktrees and sub-folders.
/// A tool call and a tool result are shortened to one line, unless `is_full` is true.
///
/// # Errors
/// An error when no chat session file of Claude Code or of Codex has this id.
pub fn read_chat_session(
    id: &str,
    root: &Path,
    claude_projects_folder: &Path,
    codex_home: &Path,
    is_full: bool,
) -> Result<Vec<ChatRecord>, String> {
    let folder = root.display().to_string();
    let mut cache = ScanCache::in_memory();
    let find = |files: Vec<SessionFile>| files.into_iter().find(|file| file.id == id);
    let (file, coding_agent) =
        match find(find_claude_session_files(&mut cache, claude_projects_folder, &folder, FolderScope::WithFoldersBelow)) {
            Some(file) => (file, CodingAgent::Claude),
            None => match find(find_codex_session_files(&mut cache, codex_home, &folder, FolderScope::WithFoldersBelow)) {
                Some(file) => (file, CodingAgent::Codex),
                None => {
                    return Err(format!(
                        "No chat session file of Claude Code or of Codex has the id {id} for the folder {folder}."
                    ))
                }
            },
        };
    let mut records = Vec::new();
    read_lines_from(&file.path, 0, |line| {
        let Ok(record) = serde_json::from_str::<Value>(line) else { return };
        match coding_agent {
            CodingAgent::Claude => read_claude_record(&record, is_full, &mut records),
            CodingAgent::Codex => read_codex_record(&record, is_full, &mut records),
        }
    });
    Ok(records)
}

/// The text of a tool call or of a tool result: whole, or on one line and shortened.
fn tool_text(text: &str, is_full: bool) -> String {
    if is_full {
        text.to_string()
    } else {
        shorten(text, SHORT_TOOL_LENGTH)
    }
}

/// A value as text: a string as it is, and any other value as JSON.
fn value_text(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.clone(),
        Some(other) => other.to_string(),
        None => String::new(),
    }
}

/// The text of the content of a tool result of Claude Code: a string, or a list of parts with a text.
fn claude_result_text(content: Option<&Value>) -> String {
    match content {
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("\n"),
        other => value_text(other),
    }
}

/// Reads one line of a file of Claude Code. A note of the program (`isMeta`) and a line of a subagent (`isSidechain`) are
/// skipped, and so is the thinking of the coding agent.
fn read_claude_record(record: &Value, is_full: bool, records: &mut Vec<ChatRecord>) {
    let kind = record.get("type").and_then(Value::as_str);
    if !matches!(kind, Some("user") | Some("assistant"))
        || record.get("isMeta").and_then(Value::as_bool) == Some(true)
        || record.get("isSidechain").and_then(Value::as_bool) == Some(true)
    {
        return;
    }
    let at = record.get("timestamp").and_then(Value::as_str).map(str::to_string);
    let Some(content) = record.get("message").and_then(|message| message.get("content")) else { return };
    let text_role = if kind == Some("user") { Role::Developer } else { Role::CodingAgent };
    let parts = match content {
        Value::String(text) => vec![json!({ "type": "text", "text": text })],
        Value::Array(parts) => parts.clone(),
        _ => return,
    };
    for part in &parts {
        let (role, text, is_error) = match part.get("type").and_then(Value::as_str) {
            Some("text") => (text_role, value_text(part.get("text")), None),
            Some("tool_use") => {
                let name = part.get("name").and_then(Value::as_str).unwrap_or("tool");
                (Role::Tool, tool_text(&format!("{name}: {}", value_text(part.get("input"))), is_full), None)
            }
            Some("tool_result") => (
                Role::Tool,
                tool_text(&format!("result: {}", claude_result_text(part.get("content"))), is_full),
                part.get("is_error").and_then(Value::as_bool),
            ),
            _ => continue,
        };
        if !text.trim().is_empty() {
            records.push(ChatRecord { at: at.clone(), role, text, is_error });
        }
    }
}

/// Reads one line of a file of Codex: the messages, the tool calls, and their results. The message that holds the
/// instructions of `AGENTS.md`, the message that describes the environment, the reasoning, and the events, which repeat the
/// messages, are skipped.
fn read_codex_record(record: &Value, is_full: bool, records: &mut Vec<ChatRecord>) {
    if record.get("type").and_then(Value::as_str) != Some("response_item") {
        return;
    }
    let Some(payload) = record.get("payload") else { return };
    let at = record.get("timestamp").and_then(Value::as_str).map(str::to_string);
    let push = |records: &mut Vec<ChatRecord>, role: Role, text: String| {
        if !text.trim().is_empty() {
            records.push(ChatRecord { at: at.clone(), role, text, is_error: None });
        }
    };
    match payload.get("type").and_then(Value::as_str) {
        Some("message") => {
            let role = match payload.get("role").and_then(Value::as_str) {
                Some("user") => Role::Developer,
                Some("assistant") => Role::CodingAgent,
                _ => return,
            };
            let Some(parts) = payload.get("content").and_then(Value::as_array) else { return };
            for text in parts.iter().filter_map(|part| part.get("text").and_then(Value::as_str)) {
                let is_context = text.starts_with("# AGENTS.md") || text.starts_with("<environment_context>");
                if role == Role::Developer && is_context {
                    continue;
                }
                push(records, role, text.to_string());
            }
        }
        Some("function_call") | Some("custom_tool_call") => {
            let name = payload.get("name").and_then(Value::as_str).unwrap_or("tool");
            let input = payload.get("arguments").or_else(|| payload.get("input"));
            push(records, Role::Tool, tool_text(&format!("{name}: {}", value_text(input)), is_full));
        }
        Some("function_call_output") | Some("custom_tool_call_output") => {
            push(records, Role::Tool, tool_text(&format!("result: {}", value_text(payload.get("output"))), is_full));
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The records of lines of Claude Code.
    fn claude_records(lines: &[Value], is_full: bool) -> Vec<ChatRecord> {
        let mut records = Vec::new();
        for line in lines {
            read_claude_record(line, is_full, &mut records);
        }
        records
    }

    /// The records of lines of Codex.
    fn codex_records(lines: &[Value], is_full: bool) -> Vec<ChatRecord> {
        let mut records = Vec::new();
        for line in lines {
            read_codex_record(line, is_full, &mut records);
        }
        records
    }

    /// A record with a date.
    fn record(role: Role, text: &str) -> ChatRecord {
        ChatRecord { at: Some("2026-10-11T10:00:00.000Z".into()), role, text: text.into(), is_error: None }
    }

    #[test]
    fn reads_the_error_flag_of_a_tool_result_of_claude_code() {
        let result = |flag: Option<bool>| {
            let mut part = json!({ "type": "tool_result", "content": "Exit code 1" });
            if let Some(flag) = flag {
                part["is_error"] = json!(flag);
            }
            json!({ "type": "user", "message": { "content": [part] } })
        };
        let lines = [result(Some(true)), result(Some(false)), result(None)];
        let flags: Vec<Option<bool>> = claude_records(&lines, false).iter().map(|record| record.is_error).collect();
        assert_eq!(flags, vec![Some(true), Some(false), None]);
        let row = claude_records(&lines[..1], false)[0].to_row();
        assert_eq!(row["isError"], json!(true));
    }

    #[test]
    fn reads_the_texts_and_the_tools_of_claude_code() {
        let at = "2026-10-11T10:00:00.000Z";
        let lines = [
            json!({ "type": "user", "timestamp": at, "message": { "content": "Fix the issue 1" } }),
            json!({ "type": "user", "isMeta": true, "timestamp": at, "message": { "content": "a note" } }),
            json!({ "type": "assistant", "timestamp": at, "message": { "content": [
                { "type": "thinking", "thinking": "hidden" },
                { "type": "text", "text": "I read the file." },
                { "type": "tool_use", "name": "Bash", "input": { "command": "ls" } },
            ] } }),
            json!({ "type": "user", "timestamp": at, "message": { "content": [
                { "type": "tool_result", "content": [{ "type": "text", "text": "a.txt\nb.txt" }] },
            ] } }),
            json!({ "type": "summary", "summary": "skipped" }),
        ];
        assert_eq!(
            claude_records(&lines, false),
            vec![
                record(Role::Developer, "Fix the issue 1"),
                record(Role::CodingAgent, "I read the file."),
                record(Role::Tool, "Bash: {\"command\":\"ls\"}"),
                record(Role::Tool, "result: a.txt b.txt"),
            ]
        );
        assert_eq!(claude_records(&lines[3..4], true), vec![record(Role::Tool, "result: a.txt\nb.txt")]);
    }

    #[test]
    fn shortens_a_long_tool_result_unless_the_record_is_full() {
        let long = "x".repeat(500);
        let lines = [json!({ "type": "user", "message": { "content": [{ "type": "tool_result", "content": long }] } })];
        assert_eq!(claude_records(&lines, false)[0].text.chars().count(), SHORT_TOOL_LENGTH + 1);
        assert_eq!(claude_records(&lines, true)[0].text, format!("result: {long}"));
        assert_eq!(claude_records(&lines, true)[0].at, None);
    }

    #[test]
    fn reads_the_messages_and_the_tools_of_codex_without_the_context_and_the_events() {
        let at = "2026-10-11T10:00:00.000Z";
        let message = |role: &str, text: &str| {
            json!({ "type": "response_item", "timestamp": at, "payload": {
                "type": "message", "role": role, "content": [{ "type": "input_text", "text": text }],
            } })
        };
        let lines = [
            message("user", "# AGENTS.md instructions"),
            message("user", "<environment_context>a</environment_context>"),
            message("developer", "the rules of the system"),
            message("user", "Fix the issue 2"),
            json!({ "type": "event_msg", "timestamp": at, "payload": { "type": "user_message", "message": "Fix the issue 2" } }),
            json!({ "type": "response_item", "timestamp": at, "payload": { "type": "reasoning", "summary": [] } }),
            json!({ "type": "response_item", "timestamp": at, "payload": { "type": "function_call", "name": "shell", "arguments": "{\"command\":[\"ls\"]}" } }),
            json!({ "type": "response_item", "timestamp": at, "payload": { "type": "function_call_output", "output": "a.txt" } }),
            message("assistant", "Done."),
        ];
        assert_eq!(
            codex_records(&lines, false),
            vec![
                record(Role::Developer, "Fix the issue 2"),
                record(Role::Tool, "shell: {\"command\":[\"ls\"]}"),
                record(Role::Tool, "result: a.txt"),
                record(Role::CodingAgent, "Done."),
            ]
        );
    }
}
