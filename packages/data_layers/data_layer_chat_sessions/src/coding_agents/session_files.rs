//! Finds the chat session files of one folder, and the titles of the chat sessions of Codex.
//!
//! Claude Code writes one file for each chat session: `<claude dir>/projects/<folder name>/<id>.jsonl`. The folder name is the
//! folder where the chat session started, with every character that is not a letter or a digit replaced by a dash. A chat
//! session that started in a folder below the folder of the workspace, for example in a worktree
//! (`<folder>/.claude/worktrees/<name>`) or in a sub-folder, has its own folder name that starts with the folder name of the
//! workspace, then a dash. The caller chooses with a `FolderScope` whether these chat sessions count. Because the replacement
//! loses the slashes, the first `cwd` of the files of such a folder gives the real folder, and it must be the folder of the
//! workspace or a folder below it: the folder of a repository next to it, such as `<folder>-site`, is not one of its chat
//! sessions.
//!
//! The subagents and the workflows of a chat session write their own files, below the folder `<id>/subagents` that sits next
//! to `<id>.jsonl`. Their tokens count for the chat session that started them, so `find_claude_agent_files` lists them.
//!
//! Codex writes one file for each chat session: `<codex home>/sessions/YYYY/MM/DD/rollout-<date>-<id>.jsonl`, and it
//! compresses the files of its old chat sessions with zstd, into `rollout-<date>-<id>.jsonl.zst`. The first line gives the
//! folder of the chat session (`payload.cwd`), which must be in the `FolderScope` of the workspace. The titles are
//! in `<codex home>/session_index.jsonl`: each line has the id of a chat session and its title (`thread_name`).

use crate::coding_agents::scan::{is_compressed, read_lines_from, Scan};
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

/// Which folders give the chat session files of a workspace.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FolderScope {
    /// Only the folder of the workspace itself: the chat sessions that started in this folder.
    Exactly,
    /// The folder of the workspace and the folders below it, such as its worktrees and its sub-folders.
    WithFoldersBelow,
}

impl FolderScope {
    /// True when the chat sessions that started in `path` belong to the workspace `folder`. A slash at the end of either one
    /// does not count.
    pub fn includes(self, path: &str, folder: &str) -> bool {
        match self {
            FolderScope::Exactly => path.trim_end_matches('/') == folder.trim_end_matches('/'),
            FolderScope::WithFoldersBelow => is_in_folder(path, folder),
        }
    }
}

/// True when `path` is `folder` or a folder below it. A slash at the end of either one does not count.
pub fn is_in_folder(path: &str, folder: &str) -> bool {
    let folder = folder.trim_end_matches('/');
    let path = path.trim_end_matches('/');
    path == folder || path.strip_prefix(folder).is_some_and(|rest| rest.starts_with('/'))
}

/// The chat session files of Claude Code for `folder`, and for the folders below it when `scope` says so, in `projects`. The
/// cache forgets the files of these folders that do not exist any more.
pub fn find_claude_session_files(
    cache: &mut ScanCache,
    projects: &Path,
    folder: &str,
    scope: FolderScope,
) -> Vec<SessionFile> {
    let mut files = Vec::new();
    for directory in claude_directories(cache, projects, folder, scope) {
        let mut present = HashSet::new();
        if let Ok(entries) = std::fs::read_dir(&directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|extension| extension.to_str()) != Some("jsonl") {
                    continue;
                }
                let Some(id) = path.file_stem().map(|stem| stem.to_string_lossy().into_owned()) else { continue };
                let Ok(metadata) = entry.metadata() else { continue };
                present.insert(path.display().to_string());
                files.push(SessionFile::new(path, id, &metadata));
            }
        }
        cache.forget_missing_claude(&directory, &present);
    }
    files
}

/// The files of the subagents and of the workflows that the chat session file `main` of Claude Code started: every file
/// `.jsonl` below the folder `subagents` that sits next to `main`, at any depth (`<id>/subagents/agent-<id>.jsonl`, and
/// `<id>/subagents/workflows/<workflow>/agent-<id>.jsonl`). The cache forgets the files of this folder that do not exist any
/// more.
pub fn find_claude_agent_files(cache: &mut ScanCache, main: &Path) -> Vec<SessionFile> {
    let agents = main.with_extension("").join("subagents");
    let mut files = Vec::new();
    collect_agent_files(&agents, 0, &mut files);
    let present: HashSet<String> = files.iter().map(|file| file.path.display().to_string()).collect();
    cache.forget_missing(&agents, &present);
    files
}

/// The chat session files of Codex for `folder`, and for the folders below it when `scope` says so, in `home`. The
/// compressed files are in. A chat session that is in the two forms is listed once, with its file that is not compressed.
/// The cache forgets the files that do not exist any more.
pub fn find_codex_session_files(cache: &mut ScanCache, home: &Path, folder: &str, scope: FolderScope) -> Vec<SessionFile> {
    let mut rollouts = Vec::new();
    collect_rollouts(&home.join("sessions"), 0, &mut rollouts);
    let present: HashSet<String> = rollouts.iter().map(|path| path.display().to_string()).collect();
    cache.forget_missing(&home.join("sessions"), &present);
    rollouts.sort_by_key(|path| is_compressed(path));
    let mut ids = HashSet::new();
    let mut files = Vec::new();
    for path in rollouts {
        let Some(id) = codex_id(&path) else { continue };
        let Some(found) = cache.codex_folder(&path) else { continue };
        if scope.includes(&found, folder) == false || ids.insert(id.clone()) == false {
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

/// The folders of Claude Code to read for `folder`: the folder of the workspace itself, then, when `scope` says so, each
/// folder whose name starts with the name of the folder of the workspace and a dash, when the real folder of its chat
/// sessions is below `folder`.
fn claude_directories(cache: &mut ScanCache, projects: &Path, folder: &str, scope: FolderScope) -> Vec<PathBuf> {
    let name = claude_folder_name(folder.trim_end_matches('/'));
    let prefix = format!("{name}-");
    let mut directories = vec![projects.join(&name)];
    if scope == FolderScope::Exactly {
        return directories;
    }
    let mut below: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(projects) {
        for entry in entries.flatten() {
            let is_candidate = entry.file_name().to_str().is_some_and(|candidate| candidate.starts_with(&prefix));
            if is_candidate && entry.path().is_dir() {
                below.push(entry.path());
            }
        }
    }
    below.sort();
    let present: HashSet<String> = below.iter().map(|directory| directory.display().to_string()).collect();
    cache.forget_missing_claude_folders(&projects.join(&prefix).display().to_string(), &present);
    for directory in below {
        if cache.claude_folder(&directory).is_some_and(|found| scope.includes(&found, folder)) {
            directories.push(directory);
        }
    }
    directories
}

/// Lists the files `.jsonl` in `directory` and in the folders below it, down to a depth of four folders.
fn collect_agent_files(directory: &Path, depth: u8, found: &mut Vec<SessionFile>) {
    let Ok(entries) = std::fs::read_dir(directory) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 4 {
                collect_agent_files(&path, depth + 1, found);
            }
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl") {
            let Some(id) = path.file_stem().map(|stem| stem.to_string_lossy().into_owned()) else { continue };
            let Ok(metadata) = entry.metadata() else { continue };
            found.push(SessionFile::new(path, id, &metadata));
        }
    }
}

/// Walks `sessions/YYYY/MM/DD` and lists the files `rollout-*.jsonl` and `rollout-*.jsonl.zst`.
fn collect_rollouts(directory: &Path, depth: u8, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(directory) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 3 {
                collect_rollouts(&path, depth + 1, found);
            }
        } else if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
            if name.starts_with("rollout-") && (name.ends_with(".jsonl") || name.ends_with(".jsonl.zst")) {
                found.push(path);
            }
        }
    }
}

/// The identifier of a chat session of Codex: the last 36 characters of the name of its file, without the extension
/// `.jsonl` or `.jsonl.zst`.
fn codex_id(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_str()?;
    let stem: Vec<char> = name.strip_suffix(".jsonl.zst").or_else(|| name.strip_suffix(".jsonl"))?.chars().collect();
    if stem.len() < CODEX_ID_LENGTH {
        return None;
    }
    Some(stem[stem.len() - CODEX_ID_LENGTH..].iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{
        claude_user_line, codex_compressed_file, codex_file, codex_message, temp_folder, write_file,
    };

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
        let mut files = find_claude_session_files(
            &mut ScanCache::in_memory(),
            &directory.join("projects"),
            "/work/app",
            FolderScope::Exactly,
        );
        files.sort_by(|a, b| a.id.cmp(&b.id));
        assert_eq!(files.iter().map(|file| file.id.as_str()).collect::<Vec<_>>(), vec!["a"]);
        assert_eq!(files[0].size, 3);
        assert!(find_claude_session_files(
            &mut ScanCache::in_memory(),
            &directory.join("nothing"),
            "/work/app",
            FolderScope::Exactly
        )
        .is_empty());
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
        let mut files = find_codex_session_files(&mut cache, &directory, "/work/app", FolderScope::Exactly);
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
        let compressed = Path::new("/x/rollout-2026-10-10T01-02-03-01a12c31-175b-7513-b12c-bba764f46402.jsonl.zst");
        assert_eq!(codex_id(compressed).as_deref(), Some("01a12c31-175b-7513-b12c-bba764f46402"));
    }

    #[test]
    fn tells_a_folder_from_a_folder_below_it_and_from_a_folder_that_only_starts_with_the_same_letters() {
        assert!(is_in_folder("/work/app", "/work/app"));
        assert!(is_in_folder("/work/app/", "/work/app"));
        assert!(is_in_folder("/work/app/.claude/worktrees/fix", "/work/app/"));
        assert!(!is_in_folder("/work/app-site", "/work/app"));
        assert!(!is_in_folder("/work", "/work/app"));
    }

    #[test]
    fn finds_the_files_of_claude_code_below_the_folder_but_not_the_ones_of_a_folder_next_to_it() {
        let directory = temp_folder("find_claude_below");
        let projects = directory.join("projects");
        let chat = |folder: &str, name: &str| {
            let project = projects.join(claude_folder_name(folder));
            write_file(&project.join(format!("{name}.jsonl")), &format!("{}\n", claude_user_line(folder, "hello")), 10);
        };
        chat("/work/app", "root");
        chat("/work/app/.claude/worktrees/fix-1", "worktree");
        chat("/work/app/docs/guides", "sub_folder");
        chat("/work/app-site", "next_to_it");
        chat("/work/other", "other");
        let mut cache = ScanCache::in_memory();
        let found = |cache: &mut ScanCache, folder: &str, scope: FolderScope| {
            let mut files = find_claude_session_files(cache, &projects, folder, scope);
            files.sort_by(|a, b| a.id.cmp(&b.id));
            files.into_iter().map(|file| file.id).collect::<Vec<_>>()
        };
        assert_eq!(found(&mut cache, "/work/app", FolderScope::Exactly), vec!["root"]);
        assert_eq!(found(&mut cache, "/work/app", FolderScope::WithFoldersBelow), vec!["root", "sub_folder", "worktree"]);
        assert_eq!(cache.claude_folder(&projects.join(claude_folder_name("/work/app-site"))).as_deref(), Some("/work/app-site"));
        assert_eq!(found(&mut cache, "/work/app/", FolderScope::WithFoldersBelow).len(), 3);
    }

    #[test]
    fn finds_the_compressed_files_of_codex_and_lists_a_chat_session_once() {
        let directory = temp_folder("find_codex_zst");
        let old = "01a12c31-175b-7513-b12c-bba764f46410";
        let both = "01a12c31-175b-7513-b12c-bba764f46411";
        let other = "01a12c31-175b-7513-b12c-bba764f46412";
        codex_compressed_file(&directory, "2026/09/25", old, "/work/app", &[&codex_message("Old")], 100);
        codex_compressed_file(&directory, "2026/10/08", both, "/work/app/docs", &[&codex_message("Both")], 50);
        codex_file(&directory, "2026/10/08", both, "/work/app/docs", &[&codex_message("Both")], 40);
        codex_compressed_file(&directory, "2026/10/08", other, "/work/other", &[], 50);
        let mut cache = ScanCache::in_memory();
        let mut files = find_codex_session_files(&mut cache, &directory, "/work/app", FolderScope::WithFoldersBelow);
        files.sort_by(|x, y| x.id.cmp(&y.id));
        assert_eq!(files.iter().map(|file| file.id.as_str()).collect::<Vec<_>>(), vec![old, both]);
        let exactly = find_codex_session_files(&mut cache, &directory, "/work/app", FolderScope::Exactly);
        assert_eq!(exactly.iter().map(|file| file.id.as_str()).collect::<Vec<_>>(), vec![old]);
        assert_eq!(files[1].path.extension().and_then(|extension| extension.to_str()), Some("jsonl"));
        assert_eq!(cache.codex_folder_count(), 4);
    }

    #[test]
    fn finds_the_files_of_the_subagents_and_of_the_workflows_of_a_chat_session_of_claude_code() {
        let directory = temp_folder("find_agents");
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("abc.jsonl"), "{}\n", 10);
        let agents = project.join("abc").join("subagents");
        write_file(&agents.join("agent-1.jsonl"), "{}\n", 10);
        write_file(&agents.join("agent-1.meta.json"), "{}", 10);
        write_file(&agents.join("workflows").join("wf_1").join("agent-2.jsonl"), "{}\n", 10);
        write_file(&project.join("other").join("subagents").join("agent-3.jsonl"), "{}\n", 10);
        let mut files = find_claude_agent_files(&mut ScanCache::in_memory(), &project.join("abc.jsonl"));
        files.sort_by(|a, b| a.id.cmp(&b.id));
        assert_eq!(files.iter().map(|file| file.id.as_str()).collect::<Vec<_>>(), vec!["agent-1", "agent-2"]);
        assert!(find_claude_agent_files(&mut ScanCache::in_memory(), &project.join("missing.jsonl")).is_empty());
    }
}
