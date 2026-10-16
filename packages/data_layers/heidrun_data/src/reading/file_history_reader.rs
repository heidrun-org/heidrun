//! Reads the history of one file from the chat session files: every tool call of Claude Code or of Codex that wrote the
//! file, in the order of the dates, with the chat session that made it. A memory file, a subagent, or a skill has no other
//! history, because the tables keep only its last state.

use crate::output::QueryRow;
use crate::reading::chat_session_reader::{read_claude_record, read_codex_record, ChatRecord, Role};
use data_layer_coding_agents::{
    find_claude_session_files, find_codex_session_files, read_lines_from, FolderScope, ScanCache, SessionFile,
};
use serde_json::{json, Value};
use std::path::Path;

/// The tools that always write the file that their input names.
const WRITE_TOOLS: [&str; 5] = ["Write", "Edit", "MultiEdit", "NotebookEdit", "apply_patch"];

/// The tools that never write a file.
const READ_TOOLS: [&str; 4] = ["Read", "Grep", "Glob", "LS"];

/// The texts that show that a command of the shell writes, moves, or removes a file. A command that only reads the file,
/// for example `cat <path>`, has none of them.
const WRITE_SIGNS: [&str; 9] = [">", "sed -i", "tee ", "mv ", "cp ", "rm ", "'w'", "\"w\"", "apply_patch"];

/// One tool call that wrote the file.
#[derive(Debug, Clone, PartialEq)]
pub struct FileChange {
    /// The date of the tool call, as the coding agent wrote it, or `None` when the record has no date.
    pub at: Option<String>,
    /// The id of the chat session of the tool call.
    pub chat_session_id: String,
    /// The name of the tool, for example `Write`, `Edit`, `Bash`, or `apply_patch`.
    pub tool: String,
    /// The input of the tool call, whole: a JSON object when the input is JSON, else a text.
    pub input: Value,
}

impl FileChange {
    /// The change as one row: `at`, `chatSessionId`, `tool`, and `input`.
    pub fn to_row(&self) -> QueryRow {
        match json!({ "at": self.at, "chatSessionId": self.chat_session_id, "tool": self.tool, "input": self.input }) {
            Value::Object(row) => row,
            _ => unreachable!("The change is an object"),
        }
    }

    /// The change as text for a person: one line with the date, the chat session, and the tool, then each field of the
    /// input with its value whole, so that `old_string` and `new_string` of an edit read as the diff.
    pub fn to_text(&self) -> String {
        let mut text = format!("[{}] {} {}\n", self.at.as_deref().unwrap_or("no date"), self.chat_session_id, self.tool);
        let fields: Vec<(String, String)> = match &self.input {
            Value::Object(object) => object
                .iter()
                .map(|(key, value)| (key.clone(), value.as_str().map(str::to_string).unwrap_or_else(|| value.to_string())))
                .collect(),
            Value::String(input) => vec![("input".to_string(), input.clone())],
            other => vec![("input".to_string(), other.to_string())],
        };
        for (key, value) in fields {
            text.push_str(&format!("  {key}:\n"));
            for line in value.lines() {
                text.push_str(&format!("    {line}\n"));
            }
        }
        text
    }
}

/// Reads every tool call that wrote the file `path` in the chat sessions of the repository at `root`, of its worktrees, and
/// of its sub-folders, sorted by date. `path` is the path as the coding agent wrote it, most often an absolute path. A
/// tool call of `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, or `apply_patch` whose input names the path counts. A command
/// of the shell counts when it names the path and shows a sign of a write, such as `>` or `sed -i`.
pub fn read_file_history(path: &str, root: &Path, claude_projects_folder: &Path, codex_home: &Path) -> Vec<FileChange> {
    let folder = root.display().to_string();
    let mut cache = ScanCache::in_memory();
    let claude_files = find_claude_session_files(&mut cache, claude_projects_folder, &folder, FolderScope::WithFoldersBelow);
    let codex_files = find_codex_session_files(&mut cache, codex_home, &folder, FolderScope::WithFoldersBelow);
    let mut changes = Vec::new();
    for (file, is_claude) in claude_files.iter().map(|file| (file, true)).chain(codex_files.iter().map(|file| (file, false))) {
        read_file_changes(file, is_claude, path, &mut changes);
    }
    changes.sort_by(|left, right| left.at.cmp(&right.at));
    changes
}

/// Adds the changes of the file `path` that one chat session file holds. A line that does not hold the name of the file is
/// skipped before it is read as JSON, so that most lines cost nothing.
fn read_file_changes(file: &SessionFile, is_claude: bool, path: &str, changes: &mut Vec<FileChange>) {
    let file_name = path.rsplit('/').next().unwrap_or(path);
    read_lines_from(&file.path, 0, |line| {
        if !line.contains(file_name) {
            return;
        }
        let Ok(record) = serde_json::from_str::<Value>(line) else { return };
        let mut records: Vec<ChatRecord> = Vec::new();
        if is_claude {
            read_claude_record(&record, true, &mut records);
        } else {
            read_codex_record(&record, true, &mut records);
        }
        for record in records.into_iter().filter(|record| record.role == Role::Tool) {
            if let Some(change) = change_of(&record, &file.id, path) {
                changes.push(change);
            }
        }
    });
}

/// The change of one tool call, or `None` when the tool call did not write the file.
fn change_of(record: &ChatRecord, chat_session_id: &str, path: &str) -> Option<FileChange> {
    let (tool, input) = record.text.split_once(": ")?;
    if tool == "result" || READ_TOOLS.contains(&tool) || !input.contains(path) {
        return None;
    }
    if !WRITE_TOOLS.contains(&tool) && !WRITE_SIGNS.iter().any(|sign| input.contains(sign)) {
        return None;
    }
    let input = serde_json::from_str::<Value>(input).unwrap_or_else(|_| Value::String(input.to_string()));
    if WRITE_TOOLS[..4].contains(&tool) {
        let file_path = input.get("file_path").or_else(|| input.get("notebook_path")).and_then(Value::as_str);
        if file_path != Some(path) && !file_path.is_some_and(|file_path| file_path.ends_with(&format!("/{path}"))) {
            return None;
        }
    }
    Some(FileChange { at: record.at.clone(), chat_session_id: chat_session_id.to_string(), tool: tool.to_string(), input })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PATH: &str = "/home/memory/merge-only.md";

    /// A tool call record with a date.
    fn tool_call(text: &str) -> ChatRecord {
        ChatRecord { at: Some("2026-10-11T10:00:00.000Z".into()), role: Role::Tool, text: text.into() }
    }

    #[test]
    fn keeps_a_write_and_an_edit_of_the_file_and_gives_the_input_as_json() {
        let write = tool_call(&format!(r#"Write: {{"file_path":"{PATH}","content":"a"}}"#));
        let change = change_of(&write, "abc", PATH).unwrap();
        assert_eq!((change.tool.as_str(), change.chat_session_id.as_str()), ("Write", "abc"));
        assert_eq!(change.input["content"], json!("a"));
        let edit = tool_call(&format!(r#"Edit: {{"file_path":"{PATH}","old_string":"blah","new_string":"blibli"}}"#));
        assert_eq!(change_of(&edit, "abc", PATH).unwrap().input["new_string"], json!("blibli"));
    }

    #[test]
    fn keeps_a_shell_command_that_writes_the_file_and_skips_one_that_reads_it() {
        let rewrite = tool_call(&format!(r#"Bash: {{"command":"cat > {PATH} <<'EOF'\nnew\nEOF"}}"#));
        assert_eq!(change_of(&rewrite, "abc", PATH).unwrap().tool, "Bash");
        let read = tool_call(&format!(r#"Bash: {{"command":"cat {PATH}"}}"#));
        assert_eq!(change_of(&read, "abc", PATH), None);
        let codex = tool_call(&format!("apply_patch: *** Begin Patch\n*** Update File: {PATH}\n-a\n+b"));
        assert_eq!(change_of(&codex, "abc", PATH).unwrap().input, json!(format!("*** Begin Patch\n*** Update File: {PATH}\n-a\n+b")));
    }

    #[test]
    fn skips_a_read_a_result_and_a_write_of_another_file_with_the_same_name() {
        assert_eq!(change_of(&tool_call(&format!(r#"Read: {{"file_path":"{PATH}"}}"#)), "abc", PATH), None);
        assert_eq!(change_of(&tool_call(&format!("result: wrote {PATH} > ok")), "abc", PATH), None);
        let other = tool_call(r#"Write: {"file_path":"/other/merge-only.md","content":"a"}"#);
        assert_eq!(change_of(&other, "abc", PATH), None);
    }

    #[test]
    fn writes_each_field_of_the_input_whole_in_the_text() {
        let change = FileChange {
            at: Some("2026-10-11T10:00:00.000Z".into()),
            chat_session_id: "abc".into(),
            tool: "Edit".into(),
            input: json!({ "old_string": "blah\nblah", "new_string": "blibli" }),
        };
        assert_eq!(
            change.to_text(),
            "[2026-10-11T10:00:00.000Z] abc Edit\n  old_string:\n    blah\n    blah\n  new_string:\n    blibli\n"
        );
    }
}
