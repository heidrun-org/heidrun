//! Finds the chat session files of one folder, and the titles of the chat sessions of Codex.
//!
//! Claude Code writes one file for each chat session: `<claude dir>/projects/<folder name>/<id>.jsonl`. The folder name is the
//! folder of the workspace with every character that is not a letter or a digit replaced by a dash.
//!
//! Codex writes one file for each chat session: `<codex home>/sessions/YYYY/MM/DD/rollout-<date>-<id>.jsonl`. The first line
//! gives the folder of the chat session (`payload.cwd`). The titles are in `<codex home>/session_index.jsonl`: each line has the
//! id of a chat session and its title (`thread_name`).

use crate::coding_agents::scan::{read_lines_from, Scan};
use crate::coding_agents::scan_cache::ScanCache;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// The length of the identifier of a chat session of Codex, at the end of the name of its file.
const CODEX_ID_LENGTH: usize = 36;

/// One chat session file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionFile {
    /// The path of the file.
    pub path: PathBuf,
    /// The identifier of the chat session.
    pub id: String,
    /// The size of the file, in bytes.
    pub size: u64,
    /// The modification date of the file, in milliseconds since 1970.
    pub modified: i64,
}

impl SessionFile {
    /// The file at `path`, with the size and the modification date of its `metadata`.
    pub fn new(path: PathBuf, id: String, metadata: &std::fs::Metadata) -> Self {
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0);
        SessionFile { path, id, size: metadata.len(), modified }
    }
}

/// The name that Claude Code gives to the folder of the chat sessions of `folder`.
pub fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

/// The chat session files of Claude Code for `folder`, in `projects`. The cache forgets the files of this folder that do not
/// exist any more.
pub fn find_claude_session_files(cache: &mut ScanCache, projects: &Path, folder: &str) -> Vec<SessionFile> {
    let directory = projects.join(claude_folder_name(folder));
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|extension| extension.to_str()) != Some("jsonl") {
                continue;
            }
            let Some(id) = path.file_stem().map(|stem| stem.to_string_lossy().into_owned()) else { continue };
            let Ok(metadata) = entry.metadata() else { continue };
            files.push(SessionFile::new(path, id, &metadata));
        }
    }
    let present: HashSet<String> = files.iter().map(|file| file.path.display().to_string()).collect();
    cache.forget_missing(&directory, &present);
    files
}

/// The chat session files of Codex for `folder`, in `home`. The cache forgets the files that do not exist any more.
pub fn find_codex_session_files(cache: &mut ScanCache, home: &Path, folder: &str) -> Vec<SessionFile> {
    let mut rollouts = Vec::new();
    collect_rollouts(&home.join("sessions"), 0, &mut rollouts);
    let present: HashSet<String> = rollouts.iter().map(|path| path.display().to_string()).collect();
    cache.forget_missing(&home.join("sessions"), &present);
    let folder = folder.trim_end_matches('/');
    let mut files = Vec::new();
    for path in rollouts {
        let Some(id) = codex_id(&path) else { continue };
        if cache.codex_folder(&path).as_deref().map(|found| found.trim_end_matches('/')) != Some(folder) {
            continue;
        }
        let Ok(metadata) = std::fs::metadata(&path) else { continue };
        files.push(SessionFile::new(path, id, &metadata));
    }
    files
}

/// The titles of the index of Codex in `home`, by identifier. When an identifier is there twice, the last line wins.
pub fn read_codex_titles(home: &Path) -> HashMap<String, String> {
    let mut titles = HashMap::new();
    read_lines_from(&home.join("session_index.jsonl"), 0, |text| {
        let Ok(record) = serde_json::from_str::<Value>(text) else { return };
        if let (Some(id), Some(title)) =
            (record.get("id").and_then(Value::as_str), record.get("thread_name").and_then(Value::as_str))
        {
            titles.insert(id.to_string(), title.to_string());
        }
    });
    titles
}

/// The title of a scan, or its first message. `None` when the scan has neither.
pub fn title_of_scan(scan: &Scan) -> Option<String> {
    scan.title.clone().filter(|title| !title.trim().is_empty()).or_else(|| scan.first_message.clone())
}

/// Walks `sessions/YYYY/MM/DD` and lists the files `rollout-*.jsonl`.
fn collect_rollouts(directory: &Path, depth: u8, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(directory) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 3 {
                collect_rollouts(&path, depth + 1, found);
            }
        } else if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
            if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                found.push(path);
            }
        }
    }
}

/// The identifier of a chat session of Codex: the last 36 characters of the name of its file, without the extension.
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
    use crate::test_samples::{codex_file, temp_folder, write_file};

    #[test]
    fn names_the_folder_of_claude_code_with_dashes() {
        assert_eq!(claude_folder_name("/Users/jetienne/webwork/heidrun"), "-Users-jetienne-webwork-heidrun");
        assert_eq!(
            claude_folder_name("/Users/jetienne/webwork/heidrun/.claude/worktrees/issue-1"),
            "-Users-jetienne-webwork-heidrun--claude-worktrees-issue-1"
        );
    }

    #[test]
    fn finds_only_the_jsonl_files_of_the_folder_of_claude_code() {
        let directory = temp_folder("find_claude");
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("a.jsonl"), "{}\n", 10);
        write_file(&project.join("note.txt"), "not a chat session", 10);
        write_file(&directory.join("projects").join(claude_folder_name("/work/other")).join("b.jsonl"), "{}\n", 10);
        let mut files = find_claude_session_files(&mut ScanCache::in_memory(), &directory.join("projects"), "/work/app");
        files.sort_by(|a, b| a.id.cmp(&b.id));
        assert_eq!(files.iter().map(|file| file.id.as_str()).collect::<Vec<_>>(), vec!["a"]);
        assert_eq!(files[0].size, 3);
        assert!(find_claude_session_files(&mut ScanCache::in_memory(), &directory.join("nothing"), "/work/app").is_empty());
    }

    #[test]
    fn finds_the_files_of_codex_for_the_folder_only_and_ignores_a_trailing_slash() {
        let directory = temp_folder("find_codex");
        let a = "01a12c31-175b-7513-b12c-bba764f46402";
        let b = "01a12b2c-fc3a-7513-b12c-bba764f46403";
        let c = "01a12b2c-fc3a-7513-b12c-bba764f46404";
        codex_file(&directory, "2026/10/10", a, "/work/app", &[], 100);
        codex_file(&directory, "2026/10/11", b, "/work/app/", &[], 10);
        codex_file(&directory, "2026/10/11", c, "/work/other", &[], 10);
        let mut cache = ScanCache::in_memory();
        let mut files = find_codex_session_files(&mut cache, &directory, "/work/app");
        files.sort_by(|x, y| x.id.cmp(&y.id));
        assert_eq!(files.iter().map(|file| file.id.as_str()).collect::<Vec<_>>(), vec![b, a]);
        assert_eq!(cache.codex_folder_count(), 3);
    }

    #[test]
    fn reads_the_titles_of_codex_and_the_last_line_of_an_identifier_wins() {
        let directory = temp_folder("codex_titles");
        let index = "{\"id\":\"x\",\"thread_name\":\"Old name\"}\n{\"id\":\"x\",\"thread_name\":\"New name\"}\n{\"id\":\"y\",\"thread_name\":\"Other\"}\nnot json\n";
        write_file(&directory.join("session_index.jsonl"), index, 1);
        let titles = read_codex_titles(&directory);
        assert_eq!((titles["x"].as_str(), titles["y"].as_str(), titles.len()), ("New name", "Other", 2));
        assert!(read_codex_titles(&directory.join("missing")).is_empty());
    }

    #[test]
    fn takes_the_title_of_a_scan_or_else_its_first_message() {
        let mut scan = Scan::default();
        assert_eq!(title_of_scan(&scan), None);
        scan.first_message = Some("First message".to_string());
        assert_eq!(title_of_scan(&scan).as_deref(), Some("First message"));
        scan.title = Some("   ".to_string());
        assert_eq!(title_of_scan(&scan).as_deref(), Some("First message"));
        scan.title = Some("A title".to_string());
        assert_eq!(title_of_scan(&scan).as_deref(), Some("A title"));
    }

    #[test]
    fn finds_the_identifier_of_codex_at_the_end_of_the_file_name() {
        let path = Path::new("/x/rollout-2026-10-10T01-02-03-01a12c31-175b-7513-b12c-bba764f46402.jsonl");
        assert_eq!(codex_id(path).as_deref(), Some("01a12c31-175b-7513-b12c-bba764f46402"));
        assert_eq!(codex_id(Path::new("/x/short.jsonl")), None);
    }
}
