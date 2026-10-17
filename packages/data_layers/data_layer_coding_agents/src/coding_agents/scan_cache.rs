//! The cache of the scans: what each chat session file held at the last read.
//!
//! A chat session file of Claude Code can hold tens of megabytes, and the desktop application reads the list again every few
//! seconds. The cache keeps the result of the scan of each file, valid while the size and the modification date of the file
//! stay the same. A file that only grew is not read again from its start: the scan continues from where it stopped.

use crate::coding_agents::scan::{feed_claude_line, feed_claude_tokens_line, folder_in, open_lines, scan_file, Scan};
use crate::coding_agents::session_files::{find_claude_agent_files, SessionFile};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};
use std::io::BufRead;
use std::path::{Path, PathBuf};

/// The most lines of a file of Claude Code that are read to find its folder. The first lines hold the field `cwd`.
const CLAUDE_FOLDER_LINES: usize = 200;

/// The name of the file of the cache, in the folder of the data of Heidrun.
pub const CACHE_FILE_NAME: &str = "chats_cache.json";

/// The version of the content of the cache. A cache with another version is thrown away and made again.
const CACHE_VERSION: u32 = 7;

/// The result of the scan of one file, valid while the size and the modification date of the file stay the same.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
struct CacheEntry {
    /// The size of the file at the last scan, in bytes.
    size: u64,
    /// The modification date of the file at the last scan, in milliseconds since 1970.
    modified: i64,
    /// The byte where the scan stopped: the end of the last complete line. A file that grew is scanned from there.
    offset: u64,
    /// What the scan found.
    scan: Scan,
}

/// What the file of the cache holds.
#[derive(Serialize, Deserialize, Debug, Default)]
struct CacheContent {
    /// The version of the content.
    version: u32,
    /// The scan of each file, by path.
    scans: BTreeMap<String, CacheEntry>,
    /// The folder that the first line of each file of Codex gives, by path. A file never changes its folder.
    codex_folders: BTreeMap<String, String>,
    /// The folder where the chat sessions of each folder of Claude Code started, by path of the folder of Claude Code. It
    /// is the first field `cwd` of the first file that has one: a folder of Claude Code never changes its folder.
    #[serde(default)]
    claude_folders: BTreeMap<String, String>,
}

/// The cache of the scans.
pub struct ScanCache {
    /// The file of the cache, or `None` for a cache that stays in memory.
    path: Option<PathBuf>,
    /// What the cache holds.
    content: CacheContent,
    /// True when `content` differs from the file.
    is_dirty: bool,
}

impl ScanCache {
    /// A cache that stays in memory and never writes a file.
    pub fn in_memory() -> Self {
        ScanCache { path: None, content: CacheContent { version: CACHE_VERSION, ..Default::default() }, is_dirty: false }
    }

    /// Opens the cache in `path`. A missing file, a file that is not valid, and a file with another version give an empty
    /// cache.
    pub fn open(path: PathBuf) -> Self {
        let content = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<CacheContent>(&text).ok())
            .filter(|content| content.version == CACHE_VERSION)
            .unwrap_or_else(|| CacheContent { version: CACHE_VERSION, ..Default::default() });
        ScanCache { path: Some(path), content, is_dirty: false }
    }

    /// Writes the cache to its file when it changed. The file is written aside then renamed: a crash never leaves half a
    /// file.
    pub fn save(&mut self) {
        let Some(path) = self.path.as_ref().filter(|_| self.is_dirty) else { return };
        let Ok(text) = serde_json::to_string(&self.content) else { return };
        if let Some(directory) = path.parent() {
            let _ = std::fs::create_dir_all(directory);
        }
        let temporary = path.with_extension("json.tmp");
        if std::fs::write(&temporary, text).is_ok() && std::fs::rename(&temporary, path).is_ok() {
            self.is_dirty = false;
        }
    }

    /// What `file` holds. The answer of the cache when the size and the date are the same. When the file only grew, the scan
    /// continues from where the last scan stopped. Else the file is scanned from its start. `feed` reads one line.
    pub fn scan(&mut self, file: &SessionFile, feed: fn(&mut Scan, &str)) -> Scan {
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

    /// What the chat session file `file` of Claude Code holds, with the tokens of the subagents and of the workflows that it
    /// started: their answers count for this chat session, and nothing else of their files does. The scan of each of their
    /// files is kept in the cache like the scan of `file`.
    pub fn scan_claude(&mut self, file: &SessionFile) -> Scan {
        let agent_files = find_claude_agent_files(self, &file.path);
        self.scan_claude_with(file, &agent_files)
    }

    /// The same as `scan_claude`, for a caller that already listed the files of the subagents and of the workflows of `file`
    /// with `find_claude_agent_files`.
    pub fn scan_claude_with(&mut self, file: &SessionFile, agent_files: &[SessionFile]) -> Scan {
        let mut scan = self.scan(file, feed_claude_line);
        for agent_file in agent_files {
            let agent_scan = self.scan(agent_file, feed_claude_tokens_line);
            scan.tokens.add_tokens_of(&agent_scan.tokens);
        }
        scan
    }

    /// The folder that the first line of a file of Codex gives, or `None` when the file has no first line yet. The file can
    /// be compressed.
    pub fn codex_folder(&mut self, path: &Path) -> Option<String> {
        let key = path.display().to_string();
        if let Some(folder) = self.content.codex_folders.get(&key) {
            return Some(folder.clone());
        }
        let mut first_line = String::new();
        open_lines(path, 0)?.read_line(&mut first_line).ok()?;
        let record = serde_json::from_str::<Value>(&first_line).ok()?;
        let folder = record.get("payload")?.get("cwd")?.as_str()?.to_string();
        self.content.codex_folders.insert(key, folder.clone());
        self.is_dirty = true;
        Some(folder)
    }

    /// The folder where the chat sessions of the folder `directory` of Claude Code started: the first field `cwd` that the
    /// first files give. `None` when no file of the folder has one yet.
    pub fn claude_folder(&mut self, directory: &Path) -> Option<String> {
        let key = directory.display().to_string();
        if let Some(folder) = self.content.claude_folders.get(&key) {
            return Some(folder.clone());
        }
        let mut files: Vec<PathBuf> = std::fs::read_dir(directory)
            .ok()?
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|extension| extension.to_str()) == Some("jsonl"))
            .collect();
        files.sort();
        for path in files {
            let Some(reader) = open_lines(&path, 0) else { continue };
            let found = reader.lines().take(CLAUDE_FOLDER_LINES).map_while(Result::ok).find_map(|line| folder_in(&line));
            if let Some(folder) = found {
                self.content.claude_folders.insert(key, folder.clone());
                self.is_dirty = true;
                return Some(folder);
            }
        }
        None
    }

    /// Forgets what the cache holds for the files under `directory` that are not in `present` any more.
    pub fn forget_missing(&mut self, directory: &Path, present: &HashSet<String>) {
        let prefix = format!("{}/", directory.display());
        let before = self.content.scans.len() + self.content.codex_folders.len();
        self.content.scans.retain(|key, _| !key.starts_with(&prefix) || present.contains(key));
        self.content.codex_folders.retain(|key, _| !key.starts_with(&prefix) || present.contains(key));
        if self.content.scans.len() + self.content.codex_folders.len() != before {
            self.is_dirty = true;
        }
    }

    /// Forgets what the cache holds for the files under the folder `directory` of Claude Code that are not in `present` any
    /// more. The files of the subagents and of the workflows of a chat session are kept while the file of the chat session is
    /// in `present`: `find_claude_agent_files` forgets the ones that were deleted.
    pub fn forget_missing_claude(&mut self, directory: &Path, present: &HashSet<String>) {
        let prefix = format!("{}/", directory.display());
        let sessions: HashSet<&str> = present
            .iter()
            .filter_map(|path| Path::new(path).file_stem().and_then(|stem| stem.to_str()))
            .collect();
        let before = self.content.scans.len();
        self.content.scans.retain(|key, _| match key.strip_prefix(&prefix) {
            None => true,
            Some(relative) => {
                present.contains(key) || relative.split_once('/').is_some_and(|(session, _)| sessions.contains(session))
            }
        });
        if self.content.scans.len() != before {
            self.is_dirty = true;
        }
    }

    /// Forgets the folder of every folder of Claude Code whose path starts with `prefix` and is not in `present` any more.
    pub fn forget_missing_claude_folders(&mut self, prefix: &str, present: &HashSet<String>) {
        let before = self.content.claude_folders.len();
        self.content.claude_folders.retain(|key, _| !key.starts_with(prefix) || present.contains(key));
        if self.content.claude_folders.len() != before {
            self.is_dirty = true;
        }
    }

    /// The number of files whose scan the cache holds.
    pub fn scan_count(&self) -> usize {
        self.content.scans.len()
    }

    /// The number of files of Codex whose folder the cache holds.
    pub fn codex_folder_count(&self) -> usize {
        self.content.codex_folders.len()
    }

    /// The byte where the last scan of the file at `path` stopped, or `None` when the cache holds no scan of this file.
    pub fn scanned_offset(&self, path: &Path) -> Option<u64> {
        self.content.scans.get(&path.display().to_string()).map(|entry| entry.offset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coding_agents::scan::feed_claude_line;
    use crate::coding_agents::session_files::{claude_folder_name, find_claude_session_files, FolderScope};
    use crate::test_samples::{claude_answer_line, claude_user_line, temp_folder, write_compressed_file, write_file};

    /// A line of Claude Code that holds the title of the chat session.
    fn title_line(title: &str) -> String {
        format!(r#"{{"type":"custom-title","customTitle":"{title}","sessionId":"x"}}"#)
    }

    /// The file at `path` as the cache sees it.
    fn file_at(path: &Path) -> SessionFile {
        let metadata = std::fs::metadata(path).unwrap();
        SessionFile::new(path.to_path_buf(), "a".to_string(), &metadata)
    }

    #[test]
    fn does_not_read_a_file_again_while_its_size_and_date_stay_the_same() {
        let path = temp_folder("cache_hit").join("a.jsonl");
        write_file(&path, &title_line("Before"), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).title.as_deref(), Some("Before"));
        let metadata = std::fs::metadata(&path).unwrap();
        std::fs::write(&path, title_line("Afters")).unwrap();
        std::fs::File::options().write(true).open(&path).unwrap().set_modified(metadata.modified().unwrap()).unwrap();
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).title.as_deref(), Some("Before"));
    }

    #[test]
    fn reads_a_file_again_when_it_changes() {
        let path = temp_folder("cache_miss").join("a.jsonl");
        write_file(&path, &title_line("Before"), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).title.as_deref(), Some("Before"));
        write_file(&path, &format!("{}\n{}\n", title_line("Before"), title_line("After the change")), 50);
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).title.as_deref(), Some("After the change"));
    }

    #[test]
    fn continues_the_scan_of_a_file_that_grew_and_does_not_count_a_message_twice() {
        let path = temp_folder("cache_grow").join("a.jsonl");
        let line = |text: &str| format!("{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{text}\"}}}}\n");
        write_file(&path, &format!("{}{}", line("one"), line("two")), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).meta.user_messages, 2);
        write_file(&path, &format!("{}{}{}", line("one"), line("two"), line("three")), 50);
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).meta.user_messages, 3);
        assert_eq!(cache.scanned_offset(&path), Some(std::fs::metadata(&path).unwrap().len()));
    }

    #[test]
    fn scans_a_file_again_from_its_start_when_it_changes_without_growing() {
        let path = temp_folder("cache_same_size").join("a.jsonl");
        let line = |text: &str| format!("{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{text}\"}}}}\n");
        write_file(&path, &format!("{}{}", line("one"), line("two")), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).meta.user_messages, 2);
        write_file(&path, &format!("{}{}", line("uno"), line("dos")), 50);
        let scan = cache.scan(&file_at(&path), feed_claude_line);
        assert_eq!((scan.meta.user_messages, scan.first_message.as_deref()), (2, Some("uno")));
    }

    #[test]
    fn keeps_the_cache_on_the_disk_and_reads_it_at_the_next_start() {
        let directory = temp_folder("cache_disk");
        let path = directory.join("a.jsonl");
        write_file(&path, &title_line("Kept"), 100);
        let cache_file = directory.join("data").join(CACHE_FILE_NAME);
        let mut first = ScanCache::open(cache_file.clone());
        assert_eq!(first.scan(&file_at(&path), feed_claude_line).title.as_deref(), Some("Kept"));
        first.save();
        assert!(cache_file.exists());
        let metadata = std::fs::metadata(&path).unwrap();
        std::fs::write(&path, title_line("Lost")).unwrap();
        std::fs::File::options().write(true).open(&path).unwrap().set_modified(metadata.modified().unwrap()).unwrap();
        let mut second = ScanCache::open(cache_file);
        assert_eq!(second.scan(&file_at(&path), feed_claude_line).title.as_deref(), Some("Kept"));
    }

    #[test]
    fn starts_with_an_empty_cache_when_the_file_is_not_valid_or_has_another_version() {
        let directory = temp_folder("cache_invalid");
        let cache_file = directory.join(CACHE_FILE_NAME);
        write_file(&cache_file, "{ nope", 1);
        assert_eq!(ScanCache::open(cache_file.clone()).scan_count(), 0);
        let old = r#"{"version":0,"scans":{"/x":{"size":1,"modified":1,"title":"Old","first_message":null}},"codex_folders":{}}"#;
        write_file(&cache_file, old, 1);
        assert_eq!(ScanCache::open(cache_file).scan_count(), 0);
        assert_eq!(ScanCache::open(directory.join("missing.json")).scan_count(), 0);
    }

    #[test]
    fn writes_nothing_when_the_cache_did_not_change() {
        let cache_file = temp_folder("cache_clean").join(CACHE_FILE_NAME);
        ScanCache::open(cache_file.clone()).save();
        assert!(!cache_file.exists());
    }

    #[test]
    fn forgets_the_cache_of_a_file_that_was_deleted() {
        let directory = temp_folder("cache_forget");
        write_file(&directory.join("a.jsonl"), &title_line("Stays"), 100);
        write_file(&directory.join("b.jsonl"), &title_line("Goes"), 200);
        let mut cache = ScanCache::in_memory();
        cache.scan(&file_at(&directory.join("a.jsonl")), feed_claude_line);
        cache.scan(&file_at(&directory.join("b.jsonl")), feed_claude_line);
        assert_eq!(cache.scan_count(), 2);
        let present: HashSet<String> = [directory.join("a.jsonl").display().to_string()].into_iter().collect();
        cache.forget_missing(&directory, &present);
        assert_eq!(cache.scan_count(), 1);
    }

    #[test]
    fn adds_the_tokens_of_the_subagents_and_of_the_workflows_to_the_chat_session_and_nothing_else() {
        let directory = temp_folder("cache_agents");
        let main = directory.join("abc.jsonl");
        write_file(&main, &format!("{}\n{}\n", claude_user_line("/work/app", "Fix it"), claude_answer_line("m1", 5)), 100);
        let agents = directory.join("abc").join("subagents");
        let prompt = claude_user_line("/work/app", "Search the code, and write the file a.ts");
        write_file(&agents.join("agent-1.jsonl"), &format!("{prompt}\n{}\n", claude_answer_line("a1", 7)), 100);
        let workflow = agents.join("workflows").join("wf_1").join("agent-2.jsonl");
        write_file(&workflow, &format!("{}\n{}\n", claude_answer_line("b1", 11), claude_answer_line("b2", 13)), 100);
        let mut cache = ScanCache::in_memory();
        let scan = cache.scan_claude(&file_at(&main));
        assert_eq!(scan.tokens.totals()["opus"].output, 5 + 7 + 11 + 13);
        assert_eq!(scan.meta.user_messages, 1);
        assert_eq!(scan.first_message.as_deref(), Some("Fix it"));
        assert_eq!(cache.scan_count(), 3);
        assert_eq!(cache.scan_claude(&file_at(&main)).tokens.totals()["opus"].output, 36);
        assert_eq!(cache.scan(&file_at(&main), feed_claude_line).tokens.totals()["opus"].output, 5);
    }

    #[test]
    fn reads_a_new_file_of_a_subagent_and_forgets_a_deleted_one_without_losing_the_others() {
        let directory = temp_folder("cache_agents_change");
        let projects = directory.join("projects");
        let project = projects.join(claude_folder_name("/work/app"));
        write_file(&project.join("abc.jsonl"), &format!("{}\n", claude_user_line("/work/app", "Fix it")), 100);
        let agents = project.join("abc").join("subagents");
        write_file(&agents.join("agent-1.jsonl"), &format!("{}\n", claude_answer_line("a1", 7)), 100);
        write_file(&agents.join("agent-2.jsonl"), &format!("{}\n", claude_answer_line("a2", 20)), 100);
        let mut cache = ScanCache::in_memory();
        let read = |cache: &mut ScanCache| {
            let files = find_claude_session_files(cache, &projects, "/work/app", FolderScope::Exactly);
            cache.scan_claude(&files[0]).tokens.totals().get("opus").map_or(0, |counts| counts.output)
        };
        assert_eq!(read(&mut cache), 27);
        assert_eq!(read(&mut cache), 27);
        assert_eq!(cache.scan_count(), 3);
        std::fs::remove_file(agents.join("agent-2.jsonl")).unwrap();
        assert_eq!(read(&mut cache), 7);
        assert_eq!(cache.scan_count(), 2);
        std::fs::remove_file(project.join("abc.jsonl")).unwrap();
        find_claude_session_files(&mut cache, &projects, "/work/app", FolderScope::Exactly);
        assert_eq!(cache.scan_count(), 0);
    }

    #[test]
    fn keeps_the_folder_of_a_folder_of_claude_code_in_the_cache_and_forgets_a_folder_that_was_deleted() {
        let directory = temp_folder("cache_claude_folder");
        let projects = directory.join("projects");
        let project = projects.join(claude_folder_name("/work/app/docs"));
        write_file(&project.join("no_folder.jsonl"), "{\"type\":\"queue-operation\"}\n", 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(cache.claude_folder(&project), None);
        write_file(&project.join("a.jsonl"), &format!("{}\n", claude_user_line("/work/app/docs", "Hello")), 100);
        assert_eq!(cache.claude_folder(&project).as_deref(), Some("/work/app/docs"));
        std::fs::remove_dir_all(&project).unwrap();
        assert_eq!(cache.claude_folder(&project).as_deref(), Some("/work/app/docs"));
        let prefix = projects.join(claude_folder_name("/work/app")).display().to_string();
        cache.forget_missing_claude_folders(&prefix, &HashSet::new());
        assert_eq!(cache.claude_folder(&project), None);
    }

    #[test]
    fn reads_a_compressed_file_of_codex_again_from_its_start_when_it_changes() {
        let path = temp_folder("cache_compressed").join("rollout-x.jsonl.zst");
        let line = |text: &str| format!("{{\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{text}\"}}}}\n");
        write_compressed_file(&path, &format!("{}{}", line("one"), line("two")), 100);
        let mut cache = ScanCache::in_memory();
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).meta.user_messages, 2);
        write_compressed_file(&path, &format!("{}{}{}", line("one"), line("two"), line("three")), 50);
        assert_eq!(cache.scan(&file_at(&path), feed_claude_line).meta.user_messages, 3);
    }
}
