//! Manages the skills (the folders with a `SKILL.md` file) that the coding agents read.
//!
//! Each coding agent reads its skills from its own folder, at the workspace level (the folder of the workspace) or at
//! the user level (the home folder of the user):
//!
//! | Agent       | Workspace folder  | User folder                                      |
//! |-------------|-------------------|--------------------------------------------------|
//! | Claude Code | `.claude/skills/` | `skills/` of the Claude configuration folder     |
//! | Codex       | `.agents/skills/` | `~/.agents/skills/`                              |
//!
//! The real files of an installed skill are in the folder of Codex. For every other agent that the user switched on,
//! Heidrun adds a link (a symbolic link) in the folder of that agent, so the files cannot become different from each
//! other. The search goes to skills.sh. The text and the files of a skill come from its GitHub repository. Next to
//! every skill installed from skills.sh, Heidrun writes the file `.heidrun_origin.json`, which records where the skill
//! comes from. The list of the files of each repository and the text of each `SKILL.md` file are kept in the cache
//! folder `~/Library/Caches/heidrun/skills`, fresh for one hour, and kept for 30 days for the times when GitHub
//! refuses a call or the network is not available.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const SEARCH_URL: &str = "https://skills.sh/api/search";
const ORIGIN_FILE: &str = ".heidrun_origin.json";
const MAX_FILES: usize = 200;
const MAX_FILE_BYTES: usize = 2_000_000;
/// How long the list of the files of a repository is used without asking GitHub again: GitHub allows only 60 such
/// calls per hour.
const FILE_LIST_TTL: Duration = Duration::from_secs(3600);
/// How long a list is kept on the disk, to be used when GitHub refuses a new call.
const FILE_LIST_KEPT: Duration = Duration::from_secs(30 * 24 * 3600);
/// How many SKILL.md files of a repository are read to find a skill by its name.
const MAX_NAME_LOOKUPS: usize = 60;

/// Folders of a GitHub repository where a skill is looked for, before the root of the repository.
const SKILL_PARENTS: [&str; 5] = ["skills", "", ".claude/skills", "skills/.curated", ".agents/skills"];

/// Where an installed skill comes from: written in `.heidrun_origin.json` at the installation.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct SkillOrigin {
    /// The GitHub repository, as `owner/repository`.
    pub source: String,
    /// The folder name of the skill in the repository.
    pub skill_id: String,
}

/// A skill found on the disk.
#[derive(Serialize, Debug, PartialEq)]
pub struct InstalledSkill {
    /// The folder name of the skill.
    pub name: String,
    /// The `description` of the frontmatter of the file `SKILL.md`.
    pub description: String,
    /// "workspace" or "user".
    pub level: String,
    /// `None` for a skill that Heidrun did not install.
    pub origin: Option<SkillOrigin>,
    /// The folder of the skill that holds the real files.
    pub path: String,
    /// The ids of the agents whose skills folder has the skill, a real folder or a link.
    pub agents: Vec<String>,
}

/// A result of the search on skills.sh.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct SearchResult {
    /// The GitHub repository, as `owner/repository`.
    pub source: String,
    /// The folder name of the skill in the repository.
    #[serde(rename = "skillId", alias = "skill_id")]
    pub skill_id: String,
    /// The name shown by skills.sh.
    pub name: String,
    /// How many times the skill was installed.
    #[serde(default)]
    pub installs: u64,
}

#[derive(Deserialize)]
struct SearchResponse {
    skills: Vec<SearchResult>,
}

#[derive(Deserialize)]
struct TreeResponse {
    tree: Vec<TreeEntry>,
}

#[derive(Deserialize)]
struct TreeEntry {
    path: String,
    #[serde(rename = "type")]
    kind: String,
    size: Option<u64>,
}

/// A file of a GitHub repository, from the list of the files of the repository.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct RepositoryFile {
    path: String,
    size: u64,
}

/// The list of the files of a repository, as kept in memory and in a file of the cache folder.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct FileListEntry {
    /// When GitHub gave the list, in seconds since 1970.
    fetched_at: u64,
    files: Vec<RepositoryFile>,
}

// ---- Paths and names ---------------------------------------------------------

/// True for `owner/repository` with only the characters GitHub allows.
fn is_valid_source(source: &str) -> bool {
    let Some((owner, repository)) = source.split_once('/') else {
        return false;
    };
    let is_part = |part: &str| !part.is_empty() && part != "." && part != ".." && part.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c));
    is_part(owner) && is_part(repository)
}

/// True for a folder name that cannot leave the folder of the skills.
fn is_valid_name(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".." && !name.starts_with('.') && name.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
}

/// The ids of the coding agents that Heidrun knows: the ids of `lib/agents.ts` of the frontend.
const AGENTS: [&str; 2] = ["claude", "codex"];
/// The agent whose skills folder holds the real files. Every other agent gets a link to them.
const REAL_FILES_AGENT: &str = "codex";

/// The folder of the workspace, or the home folder of the user, under which the folders of the skills are.
fn level_root(level: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    match level {
        "user" => Ok(dirs::home_dir().unwrap_or_default()),
        "workspace" => match cwd {
            Some(cwd) if !cwd.is_empty() => Ok(PathBuf::from(cwd)),
            _ => Err("skills_no_workspace_folder".into()),
        },
        _ => Err(format!("skills_unknown_level: {level}")),
    }
}

/// The folder where `agent` reads the skills of `level`.
fn skills_dir(agent: &str, level: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    let root = level_root(level, cwd)?;
    match (agent, level) {
        ("claude", "user") => Ok(crate::claude::claude_dir().join("skills")),
        ("claude", _) => Ok(root.join(".claude").join("skills")),
        ("codex", _) => Ok(root.join(".agents").join("skills")),
        _ => Err(format!("skills_unknown_agent: {agent}")),
    }
}

/// Where a skill is, for one agent.
#[derive(Debug, PartialEq)]
struct SkillLocation {
    agent: &'static str,
    path: PathBuf,
    /// True when the path is a link to the real files, false for a real folder.
    is_link: bool,
}

/// The places of a skill in the skills folders of all the agents: a real folder, or a link (broken or not).
fn skill_locations(level: &str, cwd: Option<&str>, name: &str) -> Result<Vec<SkillLocation>, String> {
    if !is_valid_name(name) {
        return Err(format!("skills_invalid_name: {name}"));
    }
    let mut locations = Vec::new();
    for agent in AGENTS {
        let path = skills_dir(agent, level, cwd)?.join(name);
        if let Ok(metadata) = std::fs::symlink_metadata(&path) {
            locations.push(SkillLocation { agent, path, is_link: metadata.file_type().is_symlink() });
        }
    }
    Ok(locations)
}

/// The path to write in the link `link` so that it leads to `target`: relative, so the link stays right when the
/// workspace folder moves. `../../.agents/skills/pdf` for the link `.claude/skills/pdf`.
fn relative_link_target(link: &Path, target: &Path) -> PathBuf {
    let from: Vec<_> = link.parent().unwrap_or(Path::new("")).components().collect();
    let to: Vec<_> = target.components().collect();
    let common = from.iter().zip(to.iter()).take_while(|(a, b)| a == b).count();
    let mut result = PathBuf::new();
    for _ in common..from.len() {
        result.push("..");
    }
    for component in &to[common..] {
        result.push(component.as_os_str());
    }
    result
}

#[cfg(unix)]
fn make_link(target: &Path, link: &Path) -> Result<(), String> {
    std::os::unix::fs::symlink(target, link).map_err(|e| format!("skills_install_failed: {e}"))
}

#[cfg(not(unix))]
fn make_link(_target: &Path, _link: &Path) -> Result<(), String> {
    Err("skills_install_failed: links are not supported on this system".into())
}

/// The path of `full` inside `dir`, or `None` when the path goes out of `dir` or holds a `..` part.
fn relative_path(dir: &str, full: &str) -> Option<PathBuf> {
    let rest = if dir.is_empty() { full } else { full.strip_prefix(dir)?.strip_prefix('/')? };
    let path = PathBuf::from(rest);
    let is_safe = !rest.is_empty() && path.components().all(|c| matches!(c, std::path::Component::Normal(_)));
    if is_safe {
        Some(path)
    } else {
        None
    }
}

/// The folder of the skill `skill_id` among the file paths of a repository: a folder with this name that holds a
/// `SKILL.md` file, at any depth. With several folders, the one under `skills/` wins, then the shallowest.
fn pick_skill_dir(paths: &[String], skill_id: &str) -> Option<String> {
    let ending = format!("/{skill_id}/SKILL.md");
    let own = format!("{skill_id}/SKILL.md");
    let mut dirs: Vec<&str> = paths
        .iter()
        .filter_map(|path| {
            if *path == own {
                Some(skill_id)
            } else {
                path.strip_suffix("/SKILL.md").filter(|_| path.ends_with(&ending))
            }
        })
        .collect();
    dirs.sort_by_key(|dir| (!dir.starts_with("skills/"), dir.matches('/').count(), dir.to_string()));
    dirs.first().map(|dir| dir.to_string())
}

/// A path of a repository for a URL: every byte that is not a letter, a digit, or one of `-_.~/` becomes `%XX`.
fn encode_path(path: &str) -> String {
    path.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

/// The files of the folder `dir` of a repository, each with its path inside the folder.
fn files_in_dir(files: &[RepositoryFile], dir: &str) -> Vec<(PathBuf, RepositoryFile)> {
    files.iter().filter_map(|file| relative_path(dir, &file.path).map(|relative| (relative, file.clone()))).collect()
}

fn now_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// The folder of the cache on the disk: `~/Library/Caches/heidrun/skills` on macOS.
fn cache_folder() -> PathBuf {
    dirs::cache_dir().unwrap_or_else(std::env::temp_dir).join("heidrun").join("skills")
}

/// The file of the cache for a repository: `owner/repository` is written `owner__repository.json`.
fn cache_file(folder: &Path, source: &str) -> PathBuf {
    folder.join(format!("{}.json", source.replace('/', "__")))
}

fn read_entry(folder: &Path, source: &str) -> Option<FileListEntry> {
    serde_json::from_str(&std::fs::read_to_string(cache_file(folder, source)).ok()?).ok()
}

/// Writes the entry of a repository, and deletes the files of the cache that are older than `FILE_LIST_KEPT`.
fn write_entry(folder: &Path, source: &str, entry: &FileListEntry) {
    if std::fs::create_dir_all(folder).is_err() {
        return;
    }
    if let Ok(text) = serde_json::to_string(entry) {
        let _ = std::fs::write(cache_file(folder, source), text);
    }
    prune_old(folder);
}

/// Deletes the `.json` files of a cache folder whose `fetched_at` is older than `FILE_LIST_KEPT`, or unreadable.
fn prune_old(folder: &Path) {
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };
    for file in entries.flatten() {
        if file.path().extension().is_some_and(|extension| extension == "json") == false {
            continue;
        }
        let fetched_at = std::fs::read_to_string(file.path())
            .ok()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            .and_then(|value| value.get("fetched_at").and_then(|moment| moment.as_u64()));
        if fetched_at.map_or(true, |moment| now_seconds().saturating_sub(moment) > FILE_LIST_KEPT.as_secs()) {
            let _ = std::fs::remove_file(file.path());
        }
    }
}

/// True when a moment (seconds since 1970) is not older than `max_age`; with no `max_age`, any moment is good.
fn is_recent(fetched_at: u64, max_age: Option<Duration>) -> bool {
    max_age.map_or(true, |age| now_seconds().saturating_sub(fetched_at) <= age.as_secs())
}

/// True when the entry is not older than `max_age`; with no `max_age`, any entry is good.
fn is_fresh(entry: &FileListEntry, max_age: Option<Duration>) -> bool {
    is_recent(entry.fetched_at, max_age)
}

/// The text of the `SKILL.md` file of a skill, as kept in a file of the cache folder `texts`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct SkillTextEntry {
    /// When the text was downloaded, in seconds since 1970.
    fetched_at: u64,
    /// The folder of the skill in its repository.
    dir: String,
    /// The text of the `SKILL.md` file.
    text: String,
}

/// The folder of the cache for the `SKILL.md` texts.
fn text_cache_folder() -> PathBuf {
    cache_folder().join("texts")
}

/// The file of the cache for a skill: `owner~repository~skill.json`. The character `~` cannot be in a name.
fn text_cache_file(folder: &Path, source: &str, skill_id: &str) -> PathBuf {
    folder.join(format!("{}~{skill_id}.json", source.replace('/', "~")))
}

fn read_text_entry(folder: &Path, source: &str, skill_id: &str) -> Option<SkillTextEntry> {
    serde_json::from_str(&std::fs::read_to_string(text_cache_file(folder, source, skill_id)).ok()?).ok()
}

/// Writes the text of a skill, and deletes the files of the folder that are older than `FILE_LIST_KEPT`.
fn write_text_entry(folder: &Path, source: &str, skill_id: &str, entry: &SkillTextEntry) {
    if std::fs::create_dir_all(folder).is_err() {
        return;
    }
    if let Ok(text) = serde_json::to_string(entry) {
        let _ = std::fs::write(text_cache_file(folder, source, skill_id), text);
    }
    prune_old(folder);
}

/// The answer when the network failed: the kept text, unless the skill is really gone from its repository.
fn fallback_to_cached_text(error: String, cached: Option<SkillTextEntry>) -> Result<(String, String), String> {
    match cached {
        Some(entry) if error.starts_with("skills_not_found") == false => Ok((entry.dir, entry.text)),
        _ => Err(error),
    }
}

/// The lists of the files of the repositories already asked, in memory, in front of the cache folder.
fn file_list_cache() -> &'static Mutex<HashMap<String, FileListEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<String, FileListEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The cached list of a repository, from memory or from the cache folder: `None` when there is none, or when it is
/// older than `max_age`.
fn cached_files(source: &str, max_age: Option<Duration>) -> Option<Vec<RepositoryFile>> {
    let mut cache = file_list_cache().lock().unwrap_or_else(|e| e.into_inner());
    if cache.contains_key(source) == false {
        let entry = read_entry(&cache_folder(), source)?;
        cache.insert(source.to_string(), entry);
    }
    let entry = cache.get(source)?;
    is_fresh(entry, max_age).then(|| entry.files.clone())
}

/// The folders of all the `SKILL.md` files of a repository, the most likely first for the skill `skill_id`: the folders
/// whose name and `skill_id` contain one another (`react-best-practices` for `vercel-react-best-practices`), then the
/// folders under `skills/`, then the shallowest.
fn candidate_dirs(paths: &[String], skill_id: &str) -> Vec<String> {
    let mut dirs: Vec<&str> = paths.iter().filter_map(|path| path.strip_suffix("/SKILL.md")).collect();
    dirs.sort_by_key(|dir| {
        let name = dir.rsplit('/').next().unwrap_or(dir);
        let is_related = name.len() >= 4 && (skill_id.contains(name) || name.contains(skill_id));
        (!is_related, !dir.starts_with("skills/"), dir.matches('/').count(), dir.to_string())
    });
    dirs.into_iter().map(|dir| dir.to_string()).collect()
}

/// The `name` of the frontmatter of a `SKILL.md` text: the identifier of the skill on skills.sh.
fn parse_name(text: &str) -> Option<String> {
    let rest = text.trim_start_matches('\u{feff}').strip_prefix("---")?;
    let end = rest.find("\n---")?;
    rest[..end].lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        let value = value.trim().trim_matches(|c| c == '"' || c == '\'');
        (key.trim() == "name" && value.is_empty() == false).then(|| value.to_string())
    })
}

/// The `description` of the frontmatter of a `SKILL.md` text (simple YAML only: one line).
fn parse_description(text: &str) -> String {
    let Some(rest) = text.trim_start_matches('\u{feff}').strip_prefix("---") else {
        return String::new();
    };
    let Some(end) = rest.find("\n---") else {
        return String::new();
    };
    for line in rest[..end].lines() {
        if let Some(("description", value)) = line.split_once(':').map(|(k, v)| (k.trim(), v)) {
            return value.trim().trim_matches(|c| c == '"' || c == '\'').replace("\\n", " ");
        }
    }
    String::new()
}

// ---- Reading the disk ----------------------------------------------------------

fn read_origin(dir: &Path) -> Option<SkillOrigin> {
    let text = std::fs::read_to_string(dir.join(ORIGIN_FILE)).ok()?;
    serde_json::from_str(&text).ok()
}

/// The skills of `level`, sorted by name. A skill that is in the folders of several agents is listed once.
fn list_level(level: &str, cwd: Option<&str>) -> Vec<InstalledSkill> {
    // name → the agents that have the skill, and the folder with the real files (or else any folder of the skill)
    let mut found: std::collections::BTreeMap<String, (Vec<String>, PathBuf, bool)> = std::collections::BTreeMap::new();
    for agent in AGENTS {
        let Ok(dir) = skills_dir(agent, level, cwd) else {
            continue;
        };
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let path = entry.path();
            if is_valid_name(&name) == false || path.join("SKILL.md").is_file() == false {
                continue;
            }
            let is_real = std::fs::symlink_metadata(&path).map(|m| m.file_type().is_symlink() == false).unwrap_or(false);
            let slot = found.entry(name).or_insert_with(|| (Vec::new(), path.clone(), is_real));
            slot.0.push(agent.to_string());
            if is_real && slot.2 == false {
                slot.1 = path;
                slot.2 = true;
            }
        }
    }
    found
        .into_iter()
        .filter_map(|(name, (agents, path, _))| {
            let text = std::fs::read_to_string(path.join("SKILL.md")).ok()?;
            Some(InstalledSkill {
                description: parse_description(&text),
                level: level.into(),
                origin: read_origin(&path),
                path: path.display().to_string(),
                agents,
                name,
            })
        })
        .collect()
}

/// The skills of the workspace folder, then the skills of the user.
#[tauri::command]
pub fn skills_list(cwd: Option<String>) -> Vec<InstalledSkill> {
    let mut skills = Vec::new();
    if cwd.as_deref().is_some_and(|folder| folder.is_empty() == false) {
        skills.extend(list_level("workspace", cwd.as_deref()));
    }
    skills.extend(list_level("user", None));
    skills
}

/// The text of the `SKILL.md` file of an installed skill.
#[tauri::command]
pub fn skills_read(level: String, cwd: Option<String>, name: String) -> Result<String, String> {
    for location in skill_locations(&level, cwd.as_deref(), &name)? {
        if let Ok(text) = std::fs::read_to_string(location.path.join("SKILL.md")) {
            return Ok(text);
        }
    }
    Err(format!("skills_not_installed: {name}"))
}

/// Deletes the links of a skill, then the real folders with `remove_real`. Gives the number of places removed.
fn delete_locations(locations: &[SkillLocation], remove_real: &dyn Fn(&Path) -> Result<(), String>) -> Result<usize, String> {
    for location in locations.iter().filter(|location| location.is_link) {
        std::fs::remove_file(&location.path).map_err(|e| format!("skills_delete_failed: {e}"))?;
    }
    for location in locations.iter().filter(|location| location.is_link == false) {
        remove_real(&location.path)?;
    }
    Ok(locations.len())
}

/// Moves a folder to the Trash, never a permanent delete.
fn move_to_trash(path: &Path) -> Result<(), String> {
    #[allow(unused_mut)]
    let mut context = trash::TrashContext::default();
    // NSFileManager: no Finder automation prompt, like the file explorer.
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context.delete(path).map_err(|e| format!("skills_delete_failed: {e}"))
}

/// Deletes an installed skill from the folders of all the agents: the links are removed, the real folder goes to the
/// Trash.
#[tauri::command]
pub fn skills_delete(level: String, cwd: Option<String>, name: String) -> Result<(), String> {
    let locations = skill_locations(&level, cwd.as_deref(), &name)?;
    if locations.is_empty() {
        return Err(format!("skills_not_installed: {name}"));
    }
    delete_locations(&locations, &move_to_trash).map(|_| ())
}

// ---- The network -----------------------------------------------------------------

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("Heidrun/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("skills_http_failed: {e}"))
}

/// Searches skills.sh. An empty query gives an empty list.
#[tauri::command]
pub async fn skills_search(query: String) -> Result<Vec<SearchResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let response = http_client()?
        .get(SEARCH_URL)
        .query(&[("q", query), ("limit", "20")])
        .send()
        .await
        .map_err(|e| format!("skills_search_failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("skills_search_failed: HTTP {}", response.status().as_u16()));
    }
    let parsed: SearchResponse = response.json().await.map_err(|e| format!("skills_search_failed: {e}"))?;
    Ok(parsed.skills.into_iter().filter(|s| is_valid_source(&s.source) && is_valid_name(&s.skill_id)).collect())
}

/// Downloads the text of a file of a repository, or `None` when the file does not exist.
async fn fetch_text(client: &reqwest::Client, source: &str, path: &str) -> Result<Option<String>, String> {
    let url = format!("https://raw.githubusercontent.com/{source}/HEAD/{}", encode_path(path));
    let Ok(response) = client.get(&url).send().await else {
        return Ok(None);
    };
    if response.status().is_success() {
        return response.text().await.map(Some).map_err(|e| format!("skills_download_failed: {e}"));
    }
    Ok(None)
}

/// The moment when GitHub accepts requests again, from the header `x-ratelimit-reset` (seconds since 1970).
fn rate_limit_reset(headers: &reqwest::header::HeaderMap) -> Option<u64> {
    if let Some(wait) = headers.get("retry-after").and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse::<u64>().ok()) {
        return Some(SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs() + wait);
    }
    headers.get("x-ratelimit-reset").and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse().ok())
}

/// All the files of a repository, in one call to GitHub. The answer is kept in memory and on the disk, and used for
/// one hour, because GitHub allows only 60 calls per hour. When GitHub refuses a new call, the older answer is used if there is one, otherwise the error
/// `skills_github_rate_limit: <seconds since 1970 when GitHub accepts requests again>`.
async fn list_repository_files(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
    if let Some(files) = cached_files(source, Some(FILE_LIST_TTL)) {
        return Ok(files);
    }
    let fetched = fetch_repository_files(client, source).await;
    match fetched {
        Ok(files) => {
            let entry = FileListEntry { fetched_at: now_seconds(), files: files.clone() };
            write_entry(&cache_folder(), source, &entry);
            file_list_cache().lock().unwrap_or_else(|e| e.into_inner()).insert(source.to_string(), entry);
            Ok(files)
        }
        Err(error) => cached_files(source, None).ok_or(error),
    }
}

async fn fetch_repository_files(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
    let url = format!("https://api.github.com/repos/{source}/git/trees/HEAD?recursive=1");
    let response = client.get(&url).send().await.map_err(|e| format!("skills_download_failed: {e}"))?;
    let status = response.status().as_u16();
    if status == 403 || status == 429 {
        return Err(match rate_limit_reset(response.headers()) {
            Some(reset) => format!("skills_github_rate_limit: {reset}"),
            None => "skills_github_rate_limit".into(),
        });
    }
    if status != 200 {
        return Err(format!("skills_download_failed: HTTP {status}"));
    }
    let parsed: TreeResponse = response.json().await.map_err(|e| format!("skills_download_failed: {e}"))?;
    Ok(parsed
        .tree
        .into_iter()
        .filter(|entry| entry.kind == "blob")
        .map(|entry| RepositoryFile { path: entry.path, size: entry.size.unwrap_or(0) })
        .collect())
}

/// Finds the folder of a skill in its repository: the folder and the text of its `SKILL.md` file.
/// The answer is kept in the cache folder and used for one hour. When the network fails, an older answer is used if
/// there is one, so a skill can be read without a network.
async fn find_skill(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
    let folder = text_cache_folder();
    let cached = read_text_entry(&folder, source, skill_id);
    if let Some(entry) = &cached {
        if is_recent(entry.fetched_at, Some(FILE_LIST_TTL)) {
            return Ok((entry.dir.clone(), entry.text.clone()));
        }
    }
    match find_skill_online(client, source, skill_id).await {
        Ok((dir, text)) => {
            write_text_entry(&folder, source, skill_id, &SkillTextEntry { fetched_at: now_seconds(), dir: dir.clone(), text: text.clone() });
            Ok((dir, text))
        }
        Err(error) => fallback_to_cached_text(error, cached),
    }
}

/// Finds the folder of a skill in its repository, on GitHub, with no cache.
/// The usual folders are tried first, with one download each. When none has the skill, the list of the files of the
/// repository gives the folder, at any depth (`skills/productivity/grill-me`). The last way is to read the `name` of
/// the `SKILL.md` files, because the folder of the skill `vercel-react-best-practices` is `react-best-practices`.
async fn find_skill_online(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
    for parent in SKILL_PARENTS {
        let dir = if parent.is_empty() { skill_id.to_string() } else { format!("{parent}/{skill_id}") };
        if let Some(text) = fetch_text(client, source, &format!("{dir}/SKILL.md")).await? {
            return Ok((dir, text));
        }
    }
    let paths: Vec<String> = list_repository_files(client, source).await?.into_iter().map(|file| file.path).collect();
    if let Some(dir) = pick_skill_dir(&paths, skill_id) {
        if let Some(text) = fetch_text(client, source, &format!("{dir}/SKILL.md")).await? {
            return Ok((dir, text));
        }
    }
    // The identifier on skills.sh is the `name` of the frontmatter, which can differ from the folder name.
    for dir in candidate_dirs(&paths, skill_id).into_iter().take(MAX_NAME_LOOKUPS) {
        if let Some(text) = fetch_text(client, source, &format!("{dir}/SKILL.md")).await? {
            if parse_name(&text).as_deref() == Some(skill_id) {
                return Ok((dir, text));
            }
        }
    }
    // A repository that is one skill: the file `SKILL.md` is at the root.
    if let Some(text) = fetch_text(client, source, "SKILL.md").await? {
        return Ok((String::new(), text));
    }
    Err(format!("skills_not_found: {source} {skill_id}"))
}

/// The text of the `SKILL.md` file of a skill of skills.sh, to read it before the installation.
#[tauri::command]
pub async fn skills_preview(source: String, skill_id: String) -> Result<String, String> {
    if !is_valid_source(&source) || !is_valid_name(&skill_id) {
        return Err(format!("skills_invalid_name: {source} {skill_id}"));
    }
    let client = http_client()?;
    find_skill(&client, &source, &skill_id).await.map(|(_, text)| text)
}

/// Installs a skill of skills.sh at `level` for the agents `agents`: the whole folder of the skill, with the file
/// `.heidrun_origin.json`, goes in the skills folder of Codex, and every other agent gets a link to it.
#[tauri::command]
pub async fn skills_install(
    level: String,
    cwd: Option<String>,
    source: String,
    skill_id: String,
    agents: Vec<String>,
) -> Result<InstalledSkill, String> {
    if is_valid_source(&source) == false {
        return Err(format!("skills_invalid_name: {source}"));
    }
    if let Some(unknown) = agents.iter().find(|agent| AGENTS.contains(&agent.as_str()) == false) {
        return Err(format!("skills_unknown_agent: {unknown}"));
    }
    if agents.is_empty() {
        return Err("skills_no_agent".into());
    }
    if skill_locations(&level, cwd.as_deref(), &skill_id)?.is_empty() == false {
        return Err(format!("skills_already_installed: {skill_id}"));
    }
    let skills_folder = skills_dir(REAL_FILES_AGENT, &level, cwd.as_deref())?;
    let target = skills_folder.join(&skill_id);
    let client = http_client()?;
    let (repository_dir, skill_text) = find_skill(&client, &source, &skill_id).await?;

    // The files are written in a hidden folder first, so a failed download leaves no half-installed skill.
    let staging = skills_folder.join(format!(".{skill_id}.installing"));
    let _ = std::fs::remove_dir_all(&staging);
    std::fs::create_dir_all(&staging).map_err(|e| format!("skills_install_failed: {e}"))?;
    let result = write_skill(&client, &source, &repository_dir, &skill_text, &staging).await;
    if let Err(error) = result {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(error);
    }
    let origin = SkillOrigin { source, skill_id: skill_id.clone() };
    let origin_text = serde_json::to_string_pretty(&origin).map_err(|e| format!("skills_install_failed: {e}"))?;
    std::fs::write(staging.join(ORIGIN_FILE), origin_text).map_err(|e| format!("skills_install_failed: {e}"))?;
    std::fs::rename(&staging, &target).map_err(|e| format!("skills_install_failed: {e}"))?;

    if let Err(error) = link_agents(&level, cwd.as_deref(), &skill_id, &target, &agents) {
        // No half-installed skill: the links already made and the real folder are removed.
        let _ = delete_locations(&skill_locations(&level, cwd.as_deref(), &skill_id).unwrap_or_default(), &|path| {
            std::fs::remove_dir_all(path).map_err(|e| format!("skills_install_failed: {e}"))
        });
        return Err(error);
    }
    list_level(&level, cwd.as_deref())
        .into_iter()
        .find(|skill| skill.name == skill_id)
        .ok_or_else(|| format!("skills_install_failed: {skill_id} is not in its folder"))
}

/// Adds, in the skills folder of every agent of `agents` except the agent of the real files, a link to `target`.
fn link_agents(level: &str, cwd: Option<&str>, name: &str, target: &Path, agents: &[String]) -> Result<(), String> {
    for agent in agents.iter().filter(|agent| agent.as_str() != REAL_FILES_AGENT) {
        let folder = skills_dir(agent, level, cwd)?;
        std::fs::create_dir_all(&folder).map_err(|e| format!("skills_install_failed: {e}"))?;
        let link = folder.join(name);
        make_link(&relative_link_target(&link, target), &link)?;
    }
    Ok(())
}

/// Writes the files of the skill into `staging`. When the list of the files of the repository is not available, only
/// `SKILL.md` is written.
async fn write_skill(client: &reqwest::Client, source: &str, repository_dir: &str, skill_text: &str, staging: &Path) -> Result<(), String> {
    std::fs::write(staging.join("SKILL.md"), skill_text).map_err(|e| format!("skills_install_failed: {e}"))?;
    // A skill at the root of a repository is the whole repository: only its `SKILL.md` is installed.
    if repository_dir.is_empty() {
        return Ok(());
    }
    let Ok(repository_files) = list_repository_files(client, source).await else {
        return Ok(());
    };
    let files = files_in_dir(&repository_files, repository_dir);
    if files.len() > MAX_FILES {
        return Err("skills_too_many_files".into());
    }
    for (relative, file) in files {
        if relative == Path::new("SKILL.md") || file.size as usize > MAX_FILE_BYTES {
            continue;
        }
        let url = format!("https://raw.githubusercontent.com/{source}/HEAD/{}", encode_path(&file.path));
        let response = client.get(&url).send().await.map_err(|e| format!("skills_download_failed: {e}"))?;
        if !response.status().is_success() {
            return Err(format!("skills_download_failed: HTTP {}", response.status().as_u16()));
        }
        let bytes = response.bytes().await.map_err(|e| format!("skills_download_failed: {e}"))?;
        let target = staging.join(&relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("skills_install_failed: {e}"))?;
        }
        std::fs::write(&target, &bytes).map_err(|e| format!("skills_install_failed: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hd-skills-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn accepts_a_source_of_a_repository() {
        assert!(is_valid_source("anthropics/skills"));
        assert!(is_valid_source("obra/super-powers.v2"));
    }

    #[test]
    fn refuses_a_source_that_is_not_a_repository() {
        for source in ["skills", "a/b/c", "../x", "a/..", "a/b c", "/skills", "a/"] {
            assert!(!is_valid_source(source), "{source}");
        }
    }

    #[test]
    fn refuses_a_name_that_leaves_the_folder_of_the_skills() {
        for name in ["", ".", "..", "../x", "a/b", ".hidden", "a b"] {
            assert!(!is_valid_name(name), "{name}");
        }
        assert!(is_valid_name("frontend-design"));
    }

    #[test]
    fn gives_the_path_of_a_file_inside_the_skill_folder() {
        assert_eq!(relative_path("skills/pdf", "skills/pdf/scripts/a.py"), Some(PathBuf::from("scripts/a.py")));
        assert_eq!(relative_path("", "a.txt"), Some(PathBuf::from("a.txt")));
    }

    #[test]
    fn refuses_a_path_outside_the_skill_folder() {
        assert_eq!(relative_path("skills/pdf", "skills/pdfx/a.py"), None);
        assert_eq!(relative_path("skills/pdf", "skills/pdf/../../etc/passwd"), None);
        assert_eq!(relative_path("skills/pdf", "skills/pdf"), None);
    }

    fn paths(list: &[&str]) -> Vec<String> {
        list.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn finds_a_skill_in_a_nested_folder() {
        let all = paths(&["README.md", "docs/productivity/grill-me.md", "skills/productivity/grill-me/SKILL.md", "skills/productivity/grill-me/agents/openai.yaml"]);
        assert_eq!(pick_skill_dir(&all, "grill-me"), Some("skills/productivity/grill-me".into()));
    }

    #[test]
    fn finds_a_skill_at_the_top_of_the_repository() {
        assert_eq!(pick_skill_dir(&paths(&["pdf/SKILL.md"]), "pdf"), Some("pdf".into()));
    }

    #[test]
    fn prefers_the_folder_skills_then_the_shallowest_folder() {
        let all = paths(&["examples/deep/a/pdf/SKILL.md", "tools/pdf/SKILL.md", "skills/team/pdf/SKILL.md", "skills/pdf/SKILL.md"]);
        assert_eq!(pick_skill_dir(&all, "pdf"), Some("skills/pdf".into()));
        let without_skills = paths(&["examples/deep/a/pdf/SKILL.md", "tools/pdf/SKILL.md"]);
        assert_eq!(pick_skill_dir(&without_skills, "pdf"), Some("tools/pdf".into()));
    }

    #[test]
    fn does_not_take_a_folder_whose_name_only_ends_like_the_skill() {
        let all = paths(&["skills/batch-grill-me/SKILL.md", "skills/grill-me.md", "skills/grill-me/notes/SKILL.md"]);
        assert_eq!(pick_skill_dir(&all, "grill-me"), None);
    }

    #[test]
    fn encodes_a_path_for_a_url() {
        assert_eq!(encode_path("skills/my skill/a#b.md"), "skills/my%20skill/a%23b.md");
        assert_eq!(encode_path("skills/pdf/scripts/a-b_c.py"), "skills/pdf/scripts/a-b_c.py");
    }

    #[test]
    fn lists_the_files_of_a_folder_with_their_path_inside_it() {
        let all = vec![
            RepositoryFile { path: "skills/pdf/SKILL.md".into(), size: 10 },
            RepositoryFile { path: "skills/pdf/scripts/a.py".into(), size: 20 },
            RepositoryFile { path: "skills/pdfx/SKILL.md".into(), size: 30 },
            RepositoryFile { path: "README.md".into(), size: 40 },
        ];
        let inside: Vec<_> = files_in_dir(&all, "skills/pdf").into_iter().map(|(relative, file)| (relative, file.size)).collect();
        assert_eq!(inside, [(PathBuf::from("SKILL.md"), 10), (PathBuf::from("scripts/a.py"), 20)]);
    }

    #[test]
    fn writes_and_reads_the_list_of_a_repository_in_the_cache_folder() {
        let folder = temp_folder("cache");
        let entry = FileListEntry { fetched_at: now_seconds(), files: vec![RepositoryFile { path: "a/SKILL.md".into(), size: 1 }] };
        assert_eq!(read_entry(&folder, "owner/repository"), None);
        write_entry(&folder, "owner/repository", &entry);
        assert!(folder.join("owner__repository.json").exists());
        assert_eq!(read_entry(&folder, "owner/repository"), Some(entry));
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn tells_a_fresh_list_from_an_old_one() {
        let now = now_seconds();
        let fresh = FileListEntry { fetched_at: now - 60, files: Vec::new() };
        let old = FileListEntry { fetched_at: now - 7200, files: Vec::new() };
        assert!(is_fresh(&fresh, Some(FILE_LIST_TTL)));
        assert!(is_fresh(&old, Some(FILE_LIST_TTL)) == false);
        // An old list is still good when GitHub refuses a new call.
        assert!(is_fresh(&old, None));
    }

    fn text_entry(age: u64) -> SkillTextEntry {
        SkillTextEntry { fetched_at: now_seconds() - age, dir: "skills/pdf".into(), text: "# PDF".into() }
    }

    #[test]
    fn writes_and_reads_the_text_of_a_skill_in_the_cache_folder() {
        let folder = temp_folder("texts");
        assert_eq!(read_text_entry(&folder, "anthropics/skills", "pdf"), None);
        let entry = text_entry(0);
        write_text_entry(&folder, "anthropics/skills", "pdf", &entry);
        assert!(folder.join("anthropics~skills~pdf.json").exists());
        assert_eq!(read_text_entry(&folder, "anthropics/skills", "pdf"), Some(entry));
        assert_eq!(read_text_entry(&folder, "anthropics/skills", "docx"), None);
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn deletes_the_texts_older_than_thirty_days_when_it_writes() {
        let folder = temp_folder("texts-prune");
        let day = 24 * 3600;
        write_text_entry(&folder, "a/b", "old", &text_entry(31 * day));
        write_text_entry(&folder, "a/b", "recent", &text_entry(29 * day));
        write_text_entry(&folder, "a/b", "new", &text_entry(0));
        assert!(folder.join("a~b~old.json").exists() == false);
        assert!(folder.join("a~b~recent.json").exists());
        assert!(folder.join("a~b~new.json").exists());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn uses_the_kept_text_when_the_network_fails_but_not_when_the_skill_is_gone() {
        let kept = Some(text_entry(7200));
        assert_eq!(fallback_to_cached_text("skills_github_rate_limit".into(), kept.clone()), Ok(("skills/pdf".into(), "# PDF".into())));
        assert_eq!(fallback_to_cached_text("skills_download_failed: timeout".into(), kept.clone()), Ok(("skills/pdf".into(), "# PDF".into())));
        assert_eq!(fallback_to_cached_text("skills_not_found: a/b pdf".into(), kept), Err("skills_not_found: a/b pdf".into()));
        assert_eq!(fallback_to_cached_text("skills_download_failed: timeout".into(), None), Err("skills_download_failed: timeout".into()));
    }

    #[test]
    fn deletes_the_lists_older_than_thirty_days_when_it_writes() {
        let folder = temp_folder("prune");
        let day = 24 * 3600;
        write_entry(&folder, "old/repository", &FileListEntry { fetched_at: now_seconds() - 31 * day, files: Vec::new() });
        write_entry(&folder, "recent/repository", &FileListEntry { fetched_at: now_seconds() - 29 * day, files: Vec::new() });
        write_entry(&folder, "new/repository", &FileListEntry { fetched_at: now_seconds(), files: Vec::new() });
        assert!(folder.join("old__repository.json").exists() == false);
        assert!(folder.join("recent__repository.json").exists());
        assert!(folder.join("new__repository.json").exists());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn keeps_a_list_in_memory_in_front_of_the_cache_folder() {
        let source = "test-owner/memory-test";
        let files = vec![RepositoryFile { path: "a/SKILL.md".into(), size: 1 }];
        let old = FileListEntry { fetched_at: now_seconds() - 7200, files: files.clone() };
        file_list_cache().lock().unwrap().insert(source.into(), old);
        assert_eq!(cached_files(source, Some(FILE_LIST_TTL)), None);
        assert_eq!(cached_files(source, None), Some(files));
    }

    #[test]
    fn reads_the_moment_when_github_accepts_requests_again() {
        let mut headers = reqwest::header::HeaderMap::new();
        assert_eq!(rate_limit_reset(&headers), None);
        headers.insert("x-ratelimit-reset", "1791637486".parse().unwrap());
        assert_eq!(rate_limit_reset(&headers), Some(1791637486));
        headers.insert("retry-after", "60".parse().unwrap());
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let reset = rate_limit_reset(&headers).unwrap();
        assert!(reset >= now + 59 && reset <= now + 61);
    }

    #[test]
    fn puts_the_related_folders_first() {
        let all = paths(&["skills/zeta/SKILL.md", "skills/react-best-practices/SKILL.md", "a/SKILL.md", "docs/readme.md"]);
        let dirs = candidate_dirs(&all, "vercel-react-best-practices");
        assert_eq!(dirs, ["skills/react-best-practices", "skills/zeta", "a"]);
    }

    #[test]
    fn reads_the_name_of_the_frontmatter() {
        assert_eq!(parse_name("---\nname: ai-sdk\ndescription: x\n---\n"), Some("ai-sdk".into()));
        assert_eq!(parse_name("---\nname: \"quoted\"\n---\n"), Some("quoted".into()));
        assert_eq!(parse_name("---\ndescription: x\n---\n"), None);
        assert_eq!(parse_name("# no frontmatter"), None);
    }

    #[test]
    fn reads_the_description_of_the_frontmatter() {
        let text = "---\nname: pdf\ndescription: \"Read, merge, and split PDF files.\"\n---\n# PDF";
        assert_eq!(parse_description(text), "Read, merge, and split PDF files.");
        assert_eq!(parse_description("# no frontmatter"), "");
    }

    /// Writes a skill folder with a `SKILL.md` file at `dir/name`.
    fn write_skill_folder(dir: &Path, name: &str, text: &str) -> PathBuf {
        let folder = dir.join(name);
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("SKILL.md"), text).unwrap();
        folder
    }

    fn cwd_of(dir: &Path) -> Option<String> {
        Some(dir.display().to_string())
    }

    #[test]
    fn lists_the_skills_with_their_origin() {
        let workspace = temp_folder("list");
        let folder = workspace.join(".agents/skills");
        let pdf = write_skill_folder(&folder, "pdf", "---\ndescription: Read PDF files.\n---\n");
        std::fs::write(pdf.join(ORIGIN_FILE), r#"{"source":"anthropics/skills","skill_id":"pdf"}"#).unwrap();
        write_skill_folder(&folder, "release-notes", "# Release notes");
        std::fs::create_dir_all(folder.join("not-a-skill")).unwrap();
        let skills = list_level("workspace", cwd_of(&workspace).as_deref());
        let names: Vec<_> = skills.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["pdf", "release-notes"]);
        assert_eq!(skills[0].origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into() }));
        assert_eq!(skills[0].description, "Read PDF files.");
        assert_eq!(skills[0].agents, ["codex"]);
        assert_eq!(skills[1].origin, None);
        assert_eq!(skills[1].level, "workspace");
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn lists_a_skill_of_several_agents_once() {
        let workspace = temp_folder("list-once");
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        let claude_folder = workspace.join(".claude/skills");
        std::fs::create_dir_all(&claude_folder).unwrap();
        make_link(&relative_link_target(&claude_folder.join("pdf"), &real), &claude_folder.join("pdf")).unwrap();
        write_skill_folder(&claude_folder, "only-claude", "# Only Claude");
        let skills = list_level("workspace", cwd_of(&workspace).as_deref());
        let found: Vec<_> = skills.iter().map(|s| (s.name.as_str(), s.agents.clone())).collect();
        assert_eq!(found, [("only-claude", vec!["claude".to_string()]), ("pdf", vec!["claude".to_string(), "codex".to_string()])]);
        let pdf = skills.iter().find(|s| s.name == "pdf").unwrap();
        assert_eq!(pdf.path, real.display().to_string());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn writes_the_link_of_an_agent_relative_to_the_real_files() {
        let link = Path::new("/work/app/.claude/skills/pdf");
        let target = Path::new("/work/app/.agents/skills/pdf");
        assert_eq!(relative_link_target(link, target), PathBuf::from("../../.agents/skills/pdf"));
        let other = Path::new("/home/me/.config/claude/skills/pdf");
        assert_eq!(relative_link_target(other, Path::new("/home/me/.agents/skills/pdf")), PathBuf::from("../../../.agents/skills/pdf"));
    }

    #[test]
    fn links_the_agents_that_are_not_the_agent_of_the_real_files() {
        let workspace = temp_folder("link");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string(), "codex".to_string()]).unwrap();
        let link = workspace.join(".claude/skills/pdf");
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(link.join("SKILL.md")).unwrap(), "# PDF");
        assert_eq!(std::fs::read_link(&link).unwrap(), PathBuf::from("../../.agents/skills/pdf"));
        // Codex reads the real folder: no link in it.
        assert!(std::fs::symlink_metadata(&real).unwrap().file_type().is_symlink() == false);
        // The link is relative: it still works after the workspace folder moves.
        let moved = temp_folder("link-moved");
        std::fs::remove_dir_all(&moved).unwrap();
        std::fs::rename(&workspace, &moved).unwrap();
        assert_eq!(std::fs::read_to_string(moved.join(".claude/skills/pdf/SKILL.md")).unwrap(), "# PDF");
        let _ = std::fs::remove_dir_all(&moved);
    }

    #[test]
    fn finds_the_places_of_a_skill_and_tells_a_link_from_a_real_folder() {
        let workspace = temp_folder("places");
        let cwd = cwd_of(&workspace);
        assert_eq!(skill_locations("workspace", cwd.as_deref(), "pdf").unwrap(), []);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string()]).unwrap();
        let places = skill_locations("workspace", cwd.as_deref(), "pdf").unwrap();
        let summary: Vec<_> = places.iter().map(|p| (p.agent, p.is_link)).collect();
        assert_eq!(summary, [("claude", true), ("codex", false)]);
        assert!(skill_locations("workspace", cwd.as_deref(), "../x").is_err());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn deletes_the_links_and_gives_the_real_folder_to_the_remover() {
        let workspace = temp_folder("delete");
        let cwd = cwd_of(&workspace);
        let real = write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# PDF");
        link_agents("workspace", cwd.as_deref(), "pdf", &real, &["claude".to_string()]).unwrap();
        let places = skill_locations("workspace", cwd.as_deref(), "pdf").unwrap();
        let removed = std::cell::RefCell::new(Vec::new());
        let count = delete_locations(&places, &|path| {
            removed.borrow_mut().push(path.to_path_buf());
            Ok(())
        })
        .unwrap();
        assert_eq!(count, 2);
        assert_eq!(*removed.borrow(), [real.clone()]);
        // The link is gone; the real folder is the business of the remover (the Trash).
        assert!(std::fs::symlink_metadata(workspace.join(".claude/skills/pdf")).is_err());
        assert!(real.join("SKILL.md").exists());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn needs_a_folder_for_the_workspace_level() {
        assert_eq!(skills_dir("codex", "workspace", None), Err("skills_no_workspace_folder".into()));
        assert_eq!(skills_dir("codex", "workspace", Some("/work/app")), Ok(PathBuf::from("/work/app/.agents/skills")));
        assert_eq!(skills_dir("claude", "workspace", Some("/work/app")), Ok(PathBuf::from("/work/app/.claude/skills")));
        assert!(skills_dir("codex", "team", None).is_err());
        assert_eq!(skills_dir("cursor", "workspace", Some("/work/app")), Err("skills_unknown_agent: cursor".into()));
    }

    #[tokio::test]
    async fn refuses_an_install_for_no_agent_or_an_unknown_agent() {
        let none = skills_install("workspace".into(), Some("/work/app".into()), "a/b".into(), "x".into(), Vec::new()).await;
        assert_eq!(none.unwrap_err(), "skills_no_agent");
        let unknown = skills_install("workspace".into(), Some("/work/app".into()), "a/b".into(), "x".into(), vec!["cursor".into()]).await;
        assert_eq!(unknown.unwrap_err(), "skills_unknown_agent: cursor");
    }

    #[test]
    fn reads_the_answer_of_the_search() {
        let json = r#"{"query":"pdf","skills":[{"id":"anthropics/skills/pdf","source":"anthropics/skills","skillId":"pdf","name":"pdf","installs":208236}],"count":1}"#;
        let parsed: SearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.skills, [SearchResult { source: "anthropics/skills".into(), skill_id: "pdf".into(), name: "pdf".into(), installs: 208236 }]);
    }

    /// Runs against GitHub: `cargo test skills_live_nested -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn skills_live_nested_skill_folder() {
        let client = http_client().unwrap();
        let (dir, text) = find_skill(&client, "mattpocock/skills", "grill-me").await.unwrap();
        assert_eq!(dir, "skills/productivity/grill-me");
        assert!(text.starts_with("---"));
        let workspace = temp_folder("live-nested");
        let cwd = workspace.display().to_string();
        let installed = skills_install("workspace".into(), Some(cwd), "mattpocock/skills".into(), "grill-me".into(), vec!["codex".into()]).await.unwrap();
        assert_eq!(installed.name, "grill-me");
        assert!(workspace.join(".agents/skills/grill-me/SKILL.md").exists());
        assert!(workspace.join(".agents/skills/grill-me/agents/openai.yaml").exists());
        let _ = std::fs::remove_dir_all(&workspace);
    }

    /// Runs against GitHub: the skill `vercel-react-best-practices` is in the folder `react-best-practices`.
    #[tokio::test]
    #[ignore]
    async fn skills_live_skill_with_another_folder_name() {
        let client = http_client().unwrap();
        let (dir, text) = find_skill(&client, "vercel-labs/agent-skills", "vercel-react-best-practices").await.unwrap();
        assert_eq!(dir, "skills/react-best-practices");
        assert_eq!(parse_name(&text).as_deref(), Some("vercel-react-best-practices"));
    }

    /// Runs against skills.sh and GitHub: `cargo test skills_live -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn skills_live_search_preview_and_install() {
        let results = skills_search("pdf".into()).await.unwrap();
        let found = results.iter().find(|r| r.source == "anthropics/skills" && r.skill_id == "pdf").expect("pdf in the results");
        assert!(found.installs > 0);
        let text = skills_preview(found.source.clone(), found.skill_id.clone()).await.unwrap();
        assert!(text.starts_with("---"));
        let workspace = temp_folder("live");
        let cwd = workspace.display().to_string();
        let installed = skills_install("workspace".into(), Some(cwd.clone()), found.source.clone(), found.skill_id.clone(), vec!["claude".into(), "codex".into()]).await.unwrap();
        assert_eq!(installed.origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into() }));
        assert!(workspace.join(".agents/skills/pdf/SKILL.md").exists());
        assert!(workspace.join(".agents/skills/pdf").join(ORIGIN_FILE).exists());
        let link = workspace.join(".claude/skills/pdf");
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert!(link.join("SKILL.md").exists());
        let listed = skills_list(Some(cwd.clone()));
        let pdf = listed.iter().find(|s| s.name == "pdf" && s.level == "workspace").expect("pdf is listed");
        assert_eq!(pdf.agents, ["claude", "codex"]);
        let again = skills_install("workspace".into(), Some(cwd), "anthropics/skills".into(), "pdf".into(), vec!["claude".into()]).await;
        assert!(again.unwrap_err().starts_with("skills_already_installed"));
        let _ = std::fs::remove_dir_all(&workspace);
    }
}
