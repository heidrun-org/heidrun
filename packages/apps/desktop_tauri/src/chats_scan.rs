//! Chats scan: what one conversation file of Claude Code or of Codex holds, found without a model.
//!
//! A scan reads the file line by line. Each line is one record. The scan keeps the title, the first message, and the meta
//! information of the conversation: the first and the last date, the number of messages from the developer, the folders,
//! the issues and the pull requests that the conversation mentions, and the files that the coding agent wrote.
//!
//! A conversation file only grows at its end. So a scan can stop at the end of the last complete line, and the next scan
//! of the same file continues from there with the state that the first scan kept (`scan_file`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;

/// The most digits of the number of an issue or of a pull request. A longer number is not a reference.
const REFERENCE_DIGITS: usize = 5;

/// What the scan found about one conversation, besides its title.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct ChatMeta {
    /// The date of the first record that has a date, in milliseconds since 1970.
    pub first_at: Option<i64>,
    /// The date of the last record that has a date, in milliseconds since 1970.
    pub last_at: Option<i64>,
    /// The number of messages that the developer typed.
    pub user_messages: u32,
    /// The folders where the coding agent ran during the conversation.
    pub folders: BTreeSet<String>,
    /// The numbers of the issues that the conversation mentions.
    pub issues: BTreeSet<u32>,
    /// The numbers of the pull requests that the conversation mentions.
    pub pull_requests: BTreeSet<u32>,
    /// The files that the coding agent wrote: the files of its Write and Edit tools, and the files of its patches.
    pub files_written: BTreeSet<String>,
}

/// What a scan found, and the state that lets the next scan continue.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct Scan {
    pub title: Option<String>,
    pub first_message: Option<String>,
    pub meta: ChatMeta,
}

/// Which kind of reference a number is.
#[derive(Debug, PartialEq, Clone, Copy)]
enum Reference {
    Issue,
    PullRequest,
}

impl ChatMeta {
    /// Keeps the first date and the last date of the records.
    fn note_time(&mut self, at: i64) {
        self.first_at = Some(self.first_at.map_or(at, |first| first.min(at)));
        self.last_at = Some(self.last_at.map_or(at, |last| last.max(at)));
    }

    /// A pull request number is never an issue number too: the number goes to the pull requests only.
    fn note_pull_request(&mut self, number: u32) {
        self.pull_requests.insert(number);
        self.issues.remove(&number);
    }

    fn note_issue(&mut self, number: u32) {
        if !self.pull_requests.contains(&number) {
            self.issues.insert(number);
        }
    }

    /// Reads the date and the folder of one line, with a search in the text and no parsing of the line.
    fn note_line(&mut self, line: &str) {
        if let Some(at) = date_in(line) {
            self.note_time(at);
        }
        if let Some(folder) = folder_in(line) {
            self.folders.insert(folder);
        }
    }

    /// Finds the issues and the pull requests that `text` mentions. With `allow_bare`, a bare `#123` is an issue.
    fn note_references(&mut self, text: &str, allow_bare: bool) {
        let bytes = text.as_bytes();
        let mut index = 0;
        while index < bytes.len() {
            if !bytes[index].is_ascii_digit() {
                index += 1;
                continue;
            }
            let start = index;
            while index < bytes.len() && bytes[index].is_ascii_digit() {
                index += 1;
            }
            if index - start > REFERENCE_DIGITS || continues_a_word(bytes, index) {
                continue;
            }
            let Ok(number) = text[start..index].parse::<u32>() else { continue };
            if number == 0 {
                continue;
            }
            match classify_reference(&text[..start], allow_bare) {
                Some(Reference::Issue) => self.note_issue(number),
                Some(Reference::PullRequest) => self.note_pull_request(number),
                None => {}
            }
        }
    }
}

// ---- Reading a file ----------------------------------------------------------------------------------------------

/// Calls `each` with every complete line of the file from the byte `from`, and returns the byte after the last complete
/// line. A line is complete when it ends with a line break, or when it is valid JSON: the coding agent may still be writing
/// the last line. A line that is not valid text is skipped. A file that cannot be read has no line.
pub fn read_lines_from(path: &Path, from: u64, mut each: impl FnMut(&str)) -> u64 {
    let Ok(mut file) = std::fs::File::open(path) else { return from };
    if file.seek(SeekFrom::Start(from)).is_err() {
        return from;
    }
    let mut reader = BufReader::new(file);
    let mut line = Vec::new();
    let mut offset = from;
    loop {
        line.clear();
        match reader.read_until(b'\n', &mut line) {
            Ok(0) | Err(_) => return offset,
            Ok(_) => {}
        }
        let Ok(text) = std::str::from_utf8(&line) else {
            offset += line.len() as u64;
            continue;
        };
        if !text.ends_with('\n') && serde_json::from_str::<Value>(text).is_err() {
            return offset;
        }
        each(text);
        offset += line.len() as u64;
    }
}

/// Scans the file from the byte `from` into `scan` with `feed`, and returns the byte where the next scan starts.
pub fn scan_file(path: &Path, from: u64, scan: &mut Scan, feed: fn(&mut Scan, &str)) -> u64 {
    read_lines_from(path, from, |line| feed(scan, line))
}

// ---- Claude Code ------------------------------------------------------------------------------------------------

/// Reads one line of a file of Claude Code into `scan`.
pub fn feed_claude_line(scan: &mut Scan, line: &str) {
    scan.meta.note_line(line);
    if line.contains(r#""type":"custom-title""#) {
        let Ok(record) = serde_json::from_str::<Value>(line) else { return };
        if record.get("type").and_then(Value::as_str) == Some("custom-title") {
            scan.title = record.get("customTitle").and_then(Value::as_str).map(str::to_string);
        }
    } else if line.contains(r#""type":"pr-link""#) {
        let Ok(record) = serde_json::from_str::<Value>(line) else { return };
        if let Some(number) = record.get("prNumber").and_then(Value::as_u64) {
            scan.meta.note_pull_request(number as u32);
        }
    } else if line.contains(r#""type":"user""#) && !line.contains(r#""type":"tool_result""#) {
        if let Some(text) = serde_json::from_str::<Value>(line).ok().as_ref().and_then(claude_typed_message) {
            scan.meta.user_messages += 1;
            scan.meta.note_references(&text, true);
            scan.first_message.get_or_insert(text);
        }
    } else if line.contains(r#""type":"assistant""#) {
        if let Ok(record) = serde_json::from_str::<Value>(line) {
            feed_claude_assistant(scan, &record);
        }
    }
}

/// The text that the developer typed, from one record of Claude Code. A record of a tool result, a note of the program, or
/// a command in angle brackets, such as `<command-name>`, is not a message of the developer.
fn claude_typed_message(record: &Value) -> Option<String> {
    if record.get("type").and_then(Value::as_str) != Some("user")
        || record.get("isMeta").and_then(Value::as_bool) == Some(true)
        || record.get("isSidechain").and_then(Value::as_bool) == Some(true)
    {
        return None;
    }
    text_of_content(record.get("message")?.get("content")?)
}

/// The text and the tool calls of one answer of Claude Code: the issues and the pull requests that the text mentions, and
/// the files that the tools Write, Edit, MultiEdit, and NotebookEdit write.
fn feed_claude_assistant(scan: &mut Scan, record: &Value) {
    if record.get("type").and_then(Value::as_str) != Some("assistant") {
        return;
    }
    let Some(parts) = record.get("message").and_then(|message| message.get("content")).and_then(Value::as_array) else {
        return;
    };
    for part in parts {
        match part.get("type").and_then(Value::as_str) {
            Some("text") => {
                if let Some(text) = part.get("text").and_then(Value::as_str) {
                    scan.meta.note_references(text, false);
                }
            }
            Some("tool_use") => feed_claude_tool_use(scan, part),
            _ => {}
        }
    }
}

fn feed_claude_tool_use(scan: &mut Scan, part: &Value) {
    let Some(input) = part.get("input") else { return };
    let name = part.get("name").and_then(Value::as_str).unwrap_or("");
    let path_field = match name {
        "Write" | "Edit" | "MultiEdit" => Some("file_path"),
        "NotebookEdit" => Some("notebook_path"),
        _ => None,
    };
    if let Some(path) = path_field.and_then(|field| input.get(field)).and_then(Value::as_str) {
        scan.meta.files_written.insert(path.to_string());
    }
    if name == "Bash" {
        if let Some(command) = input.get("command").and_then(Value::as_str) {
            scan.meta.note_references(command, is_command_with_references(command));
        }
    }
}

// ---- Codex -------------------------------------------------------------------------------------------------------

/// Reads one line of a file of Codex into `scan`.
pub fn feed_codex_line(scan: &mut Scan, line: &str) {
    scan.meta.note_line(line);
    if line.contains(r#""role":"user""#) || line.contains(r#""role":"assistant""#) {
        let Ok(record) = serde_json::from_str::<Value>(line) else { return };
        feed_codex_message(scan, &record);
    } else if line.contains(r#""type":"function_call""#) || line.contains(r#""type":"custom_tool_call""#) {
        scan.meta.note_references(line, is_command_with_references(line));
        note_patch_files(&mut scan.meta, line);
    }
}

fn feed_codex_message(scan: &mut Scan, record: &Value) {
    let Some(payload) = record.get("payload") else { return };
    if record.get("type").and_then(Value::as_str) != Some("response_item")
        || payload.get("type").and_then(Value::as_str) != Some("message")
    {
        return;
    }
    let Some(content) = payload.get("content") else { return };
    match payload.get("role").and_then(Value::as_str) {
        Some("user") => {
            // Codex starts every conversation with a message that holds the instructions of `AGENTS.md`, and a message in
            // angle brackets that describes the environment. Neither one is a message of the developer.
            if let Some(text) = text_of_content(content).filter(|text| !text.starts_with("# AGENTS.md")) {
                scan.meta.user_messages += 1;
                scan.meta.note_references(&text, true);
                scan.first_message.get_or_insert(text);
            }
        }
        Some("assistant") => {
            if let Some(parts) = content.as_array() {
                for text in parts.iter().filter_map(|part| part.get("text").and_then(Value::as_str)) {
                    scan.meta.note_references(text, false);
                }
            }
        }
        _ => {}
    }
}

/// Finds the files of a patch of Codex: the lines `*** Add File: <path>`, `*** Update File: <path>`, and
/// `*** Delete File: <path>`. The line is still inside a JSON text, so the path ends at the next `\n`, quote, or backslash.
fn note_patch_files(meta: &mut ChatMeta, line: &str) {
    for marker in ["*** Add File: ", "*** Update File: ", "*** Delete File: "] {
        let mut rest = line;
        while let Some(at) = rest.find(marker) {
            rest = &rest[at + marker.len()..];
            let end = rest.find(['\\', '"', '\n', '\r']).unwrap_or(rest.len());
            if end > 0 {
                meta.files_written.insert(rest[..end].to_string());
            }
        }
    }
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

/// The date of a line, from the first field `"timestamp":"<date>"`, in milliseconds since 1970.
fn date_in(line: &str) -> Option<i64> {
    let after = &line[line.find(r#""timestamp":""#)? + r#""timestamp":""#.len()..];
    let text = &after[..after.find('"')?];
    chrono::DateTime::parse_from_rfc3339(text).ok().map(|date| date.timestamp_millis())
}

/// The folder of a line, from the first field `"cwd":"<folder>"`. A folder with an escape in its name is skipped.
fn folder_in(line: &str) -> Option<String> {
    let after = &line[line.find(r#""cwd":""#)? + r#""cwd":""#.len()..];
    let folder = &after[..after.find('"')?];
    if folder.is_empty() || folder.contains('\\') {
        return None;
    }
    Some(folder.to_string())
}

/// True for a command that names a number on purpose: a commit message with `#123`, or a `gh` command.
fn is_command_with_references(command: &str) -> bool {
    command.contains("git commit") || command.contains("gh ")
}

/// True when the digits that end at `end` continue as part of a longer word or number, such as `12abc`, `12_3`, or `1.2`.
fn continues_a_word(bytes: &[u8], end: usize) -> bool {
    let Some(&next) = bytes.get(end) else { return false };
    next.is_ascii_alphanumeric()
        || next == b'_'
        || (next == b'.' && bytes.get(end + 1).is_some_and(|after| after.is_ascii_digit()))
}

/// Tells what the number that comes right after `before` is. A number is a reference when it comes after `#`, after a
/// space that follows the word "issue" or "pull request" (or `gh issue view`, `gh pr view`), or after `/issues/` or `/pull/`
/// in an address. A bare `#123` is an issue only with `allow_bare`.
fn classify_reference(before: &str, allow_bare: bool) -> Option<Reference> {
    match before.as_bytes().last()? {
        b'#' => {
            let head = &before[..before.len() - 1];
            if head.chars().last().is_some_and(|c| c.is_alphanumeric() || c == '&') {
                return None;
            }
            keyword_reference(head).or(if allow_bare { Some(Reference::Issue) } else { None })
        }
        b' ' => keyword_reference(before),
        b'/' if before.ends_with("/issues/") => Some(Reference::Issue),
        b'/' if before.ends_with("/pull/") => Some(Reference::PullRequest),
        _ => None,
    }
}

/// Reads the words at the end of `head` and tells whether they announce an issue or a pull request: "issue", "issues",
/// "issue number", "pull request", "pull requests", "pr", "prs", "pull", or `gh issue <verb>` and `gh pr <verb>`.
fn keyword_reference(head: &str) -> Option<Reference> {
    let words: Vec<String> = head.split_whitespace().rev().take(3).map(|word| word.to_lowercase()).collect();
    let word = |index: usize| words.get(index).map(String::as_str).unwrap_or("");
    let as_keyword = |text: &str| match text {
        "issue" | "issues" => Some(Reference::Issue),
        "pr" | "prs" | "pull" => Some(Reference::PullRequest),
        _ => None,
    };
    let (last, before_last) = (word(0), word(1));
    if matches!(last, "request" | "requests") && before_last == "pull" {
        return Some(Reference::PullRequest);
    }
    if last == "number" {
        return as_keyword(before_last).or(if before_last == "request" && word(2) == "pull" {
            Some(Reference::PullRequest)
        } else {
            None
        });
    }
    if let Some(kind) = as_keyword(last) {
        return Some(kind);
    }
    let is_gh_verb = matches!(
        last,
        "view" | "close" | "comment" | "edit" | "reopen" | "develop" | "checkout" | "merge" | "ready" | "diff" | "checks" | "review"
    );
    if is_gh_verb && word(2) == "gh" {
        return as_keyword(before_last);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The references that `text` holds, as (issues, pull requests).
    fn references(text: &str, allow_bare: bool) -> (Vec<u32>, Vec<u32>) {
        let mut meta = ChatMeta::default();
        meta.note_references(text, allow_bare);
        (meta.issues.into_iter().collect(), meta.pull_requests.into_iter().collect())
    }

    #[test]
    fn finds_an_issue_after_the_word_issue() {
        assert_eq!(references("fix the issue 250 now", false), (vec![250], vec![]));
        assert_eq!(references("Issue #250 is done", false), (vec![250], vec![]));
        assert_eq!(references("the issue number 7", false), (vec![7], vec![]));
        assert_eq!(references("issues 12 and 13", false), (vec![12], vec![]));
    }

    #[test]
    fn finds_a_pull_request_after_the_words_pull_request_or_pr() {
        assert_eq!(references("Merge pull request #249 from x", false), (vec![], vec![249]));
        assert_eq!(references("see PR 249", false), (vec![], vec![249]));
        assert_eq!(references("PR #249", false), (vec![], vec![249]));
        assert_eq!(references("pull request number 3", false), (vec![], vec![3]));
    }

    #[test]
    fn finds_the_numbers_of_github_addresses() {
        let text = "https://github.com/heidrun-org/heidrun/issues/250 and https://github.com/heidrun-org/heidrun/pull/249";
        assert_eq!(references(text, false), (vec![250], vec![249]));
    }

    #[test]
    fn finds_the_numbers_of_gh_commands() {
        assert_eq!(references("gh issue view 250 --json body", false), (vec![250], vec![]));
        assert_eq!(references("gh pr merge 249 --squash", false), (vec![], vec![249]));
        assert_eq!(references("gh issue create --title x", false), (vec![], vec![]));
    }

    #[test]
    fn finds_a_bare_number_only_when_it_is_allowed() {
        assert_eq!(references("Fixes #12, refs #13", true), (vec![12, 13], vec![]));
        assert_eq!(references("Fixes #12, refs #13", false), (vec![], vec![]));
        assert_eq!(references("color: #222;", false), (vec![], vec![]));
    }

    #[test]
    fn does_not_take_other_numbers_for_references() {
        assert_eq!(references("version 1.2.3 has 12abc and abc#12 and &#123; and issue 123456", true), (vec![], vec![]));
        assert_eq!(references("issue 0", true), (vec![], vec![]));
        assert_eq!(references("the tissue 12", true), (vec![], vec![]));
    }

    #[test]
    fn keeps_a_number_in_the_pull_requests_only_when_it_is_in_both() {
        let mut meta = ChatMeta::default();
        meta.note_references("issue 5", false);
        meta.note_pull_request(5);
        assert_eq!((meta.issues.len(), meta.pull_requests.len()), (0, 1));
        meta.note_references("issue 5", false);
        assert_eq!(meta.issues.len(), 0);
    }

    #[test]
    fn reads_the_date_and_the_folder_of_a_line() {
        let line = r#"{"type":"user","cwd":"/work/app","message":{"content":"x"},"timestamp":"2026-10-11T17:55:32.467Z"}"#;
        assert_eq!(date_in(line), Some(1_791_741_332_467));
        assert_eq!(folder_in(line), Some("/work/app".to_string()));
        assert_eq!(date_in(r#"{"timestamp":"not a date"}"#), None);
        assert_eq!(folder_in(r#"{"cwd":"/a\\b"}"#), None);
    }

    #[test]
    fn feeds_a_conversation_of_claude_code() {
        let lines = [
            r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250 please"}}"#,
            r#"{"type":"assistant","cwd":"/work/app","timestamp":"2026-10-11T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Opening pull request #249"},{"type":"tool_use","name":"Edit","input":{"file_path":"/work/app/a.ts"}},{"type":"tool_use","name":"Write","input":{"file_path":"/work/app/b.ts"}},{"type":"tool_use","name":"Bash","input":{"command":"git commit -m \"Fix it, fixes #250\" && gh issue close 251"}}]}}"#,
            r#"{"type":"user","timestamp":"2026-10-11T10:00:09.000Z","message":{"role":"user","content":[{"type":"tool_result","content":"issue 999"}]}}"#,
            r#"{"type":"pr-link","prNumber":248,"prUrl":"https://github.com/o/r/pull/248","timestamp":"2026-10-11T10:00:10.000Z"}"#,
            r#"{"type":"user","cwd":"/work/app/sub","timestamp":"2026-10-11T11:30:00.000Z","message":{"role":"user","content":"thanks"}}"#,
            r#"{"type":"custom-title","customTitle":"Fix it"}"#,
        ];
        let mut scan = Scan::default();
        for line in lines {
            feed_claude_line(&mut scan, line);
        }
        assert_eq!(scan.title.as_deref(), Some("Fix it"));
        assert_eq!(scan.first_message.as_deref(), Some("Fix the issue 250 please"));
        let meta = scan.meta;
        assert_eq!(meta.user_messages, 2);
        assert_eq!(meta.first_at, Some(1_791_712_800_000));
        assert_eq!(meta.last_at, Some(1_791_718_200_000));
        assert_eq!(meta.folders.into_iter().collect::<Vec<_>>(), vec!["/work/app", "/work/app/sub"]);
        assert_eq!(meta.issues.into_iter().collect::<Vec<_>>(), vec![250, 251]);
        assert_eq!(meta.pull_requests.into_iter().collect::<Vec<_>>(), vec![248, 249]);
        assert_eq!(meta.files_written.into_iter().collect::<Vec<_>>(), vec!["/work/app/a.ts", "/work/app/b.ts"]);
    }

    #[test]
    fn feeds_a_conversation_of_codex() {
        let message = |role: &str, kind: &str, text: &str| {
            format!(
                r#"{{"timestamp":"2026-10-11T10:00:00.000Z","type":"response_item","payload":{{"type":"message","role":"{role}","content":[{{"type":"{kind}","text":"{text}"}}]}}}}"#
            )
        };
        let lines = [
            r#"{"timestamp":"2026-10-11T09:59:00.000Z","type":"session_meta","payload":{"id":"x","cwd":"/work/app"}}"#.to_string(),
            message("user", "input_text", "# AGENTS.md instructions for /work/app"),
            message("user", "input_text", "<environment_context>x</environment_context>"),
            message("user", "input_text", "Please fix issue 250"),
            message("assistant", "output_text", "Done, see pull request 249"),
            r#"{"timestamp":"2026-10-11T10:05:00.000Z","type":"response_item","payload":{"type":"custom_tool_call","name":"apply_patch","input":"*** Begin Patch\n*** Update File: /work/app/a.ts\n@@\n*** Add File: /work/app/b.ts\n*** End Patch"}}"#.to_string(),
        ];
        let mut scan = Scan::default();
        for line in &lines {
            feed_codex_line(&mut scan, line);
        }
        assert_eq!(scan.first_message.as_deref(), Some("Please fix issue 250"));
        let meta = scan.meta;
        assert_eq!(meta.user_messages, 1);
        assert_eq!(meta.first_at, Some(1_791_712_740_000));
        assert_eq!(meta.last_at, Some(1_791_713_100_000));
        assert_eq!(meta.folders.into_iter().collect::<Vec<_>>(), vec!["/work/app"]);
        assert_eq!(meta.issues.into_iter().collect::<Vec<_>>(), vec![250]);
        assert_eq!(meta.pull_requests.into_iter().collect::<Vec<_>>(), vec![249]);
        assert_eq!(meta.files_written.into_iter().collect::<Vec<_>>(), vec!["/work/app/a.ts", "/work/app/b.ts"]);
    }

    fn scratch_file(name: &str, text: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("hd-chats-scan-{}-{name}.jsonl", std::process::id()));
        std::fs::write(&path, text).unwrap();
        path
    }

    #[test]
    fn continues_a_scan_from_the_end_of_the_last_complete_line() {
        let first = r#"{"type":"user","message":{"role":"user","content":"one"}}"#;
        let second = r#"{"type":"user","message":{"role":"user","content":"two"}}"#;
        let path = scratch_file("resume", &format!("{first}\n{second}"));
        let mut scan = Scan::default();
        // The second line has no line break, and it is valid JSON: it is complete.
        let offset = scan_file(&path, 0, &mut scan, feed_claude_line);
        assert_eq!(scan.meta.user_messages, 2);
        assert_eq!(offset, (first.len() + 1 + second.len()) as u64);
        std::fs::write(&path, format!("{first}\n{second}\n{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"thr")).unwrap();
        // The third line is not finished: it waits, and the lines before it are not counted twice.
        let offset = scan_file(&path, offset, &mut scan, feed_claude_line);
        assert_eq!(scan.meta.user_messages, 2);
        assert_eq!(offset, (first.len() + 1 + second.len() + 1) as u64);
        std::fs::write(&path, format!("{first}\n{second}\n{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"three\"}}}}\n")).unwrap();
        scan_file(&path, offset, &mut scan, feed_claude_line);
        assert_eq!(scan.meta.user_messages, 3);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn skips_a_line_that_is_not_valid_text_and_goes_on() {
        let path = std::env::temp_dir().join(format!("hd-chats-scan-{}-binary.jsonl", std::process::id()));
        let mut bytes = vec![0xff, 0xfe, b'\n'];
        bytes.extend_from_slice(br#"{"type":"user","message":{"role":"user","content":"ok"}}"#);
        bytes.push(b'\n');
        std::fs::write(&path, bytes).unwrap();
        let mut scan = Scan::default();
        scan_file(&path, 0, &mut scan, feed_claude_line);
        assert_eq!(scan.meta.user_messages, 1);
        let _ = std::fs::remove_file(&path);
    }
}
