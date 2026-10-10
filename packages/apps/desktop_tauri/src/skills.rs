//! Manages the skills (the folders with a `SKILL.md` file) that Claude Code reads.
//!
//! A skill lives in `<folder>/.claude/skills/<name>/SKILL.md`, at the workspace level (the folder of the
//! workspace) or at the user level (the Claude configuration folder). The search goes to skills.sh. The text and the
//! files of a skill come from its GitHub repository. Next to every skill installed from skills.sh, Heidrun writes the
//! file `.heidrun_origin.json`, which records where the skill comes from.

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
    /// The folder of the skill.
    pub path: String,
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

/// The folder that holds the skills of `level`.
fn skills_dir(level: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    match level {
        "user" => Ok(crate::claude::claude_dir().join("skills")),
        "workspace" => match cwd {
            Some(cwd) if !cwd.is_empty() => Ok(Path::new(cwd).join(".claude").join("skills")),
            _ => Err("skills_no_workspace_folder".into()),
        },
        _ => Err(format!("skills_unknown_level: {level}")),
    }
}

/// The folder of one skill, after the check of its name.
fn skill_dir(level: &str, cwd: Option<&str>, name: &str) -> Result<PathBuf, String> {
    if !is_valid_name(name) {
        return Err(format!("skills_invalid_name: {name}"));
    }
    Ok(skills_dir(level, cwd)?.join(name))
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
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };
    for file in entries.flatten() {
        let is_old = std::fs::read_to_string(file.path())
            .ok()
            .and_then(|text| serde_json::from_str::<FileListEntry>(&text).ok())
            .map_or(true, |other| now_seconds().saturating_sub(other.fetched_at) > FILE_LIST_KEPT.as_secs());
        if is_old && file.path().extension().is_some_and(|extension| extension == "json") {
            let _ = std::fs::remove_file(file.path());
        }
    }
}

/// True when the entry is not older than `max_age`; with no `max_age`, any entry is good.
fn is_fresh(entry: &FileListEntry, max_age: Option<Duration>) -> bool {
    max_age.map_or(true, |age| now_seconds().saturating_sub(entry.fetched_at) <= age.as_secs())
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

/// The skills in `dir`, sorted by name: every sub-folder that holds a `SKILL.md` file.
fn list_level(level: &str, dir: &Path) -> Vec<InstalledSkill> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut skills: Vec<InstalledSkill> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let text = std::fs::read_to_string(path.join("SKILL.md")).ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            Some(InstalledSkill {
                description: parse_description(&text),
                level: level.into(),
                origin: read_origin(&path),
                path: path.display().to_string(),
                name,
            })
        })
        .collect();
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

/// The skills of the workspace folder, then the skills of the user.
#[tauri::command]
pub fn skills_list(cwd: Option<String>) -> Vec<InstalledSkill> {
    let mut skills = Vec::new();
    if let Ok(dir) = skills_dir("workspace", cwd.as_deref()) {
        skills.extend(list_level("workspace", &dir));
    }
    if let Ok(dir) = skills_dir("user", None) {
        skills.extend(list_level("user", &dir));
    }
    skills
}

/// The text of the `SKILL.md` file of an installed skill.
#[tauri::command]
pub fn skills_read(level: String, cwd: Option<String>, name: String) -> Result<String, String> {
    let dir = skill_dir(&level, cwd.as_deref(), &name)?;
    std::fs::read_to_string(dir.join("SKILL.md")).map_err(|e| format!("skills_read_failed: {e}"))
}

/// Moves an installed skill to the Trash.
#[tauri::command]
pub fn skills_delete(level: String, cwd: Option<String>, name: String) -> Result<(), String> {
    let dir = skill_dir(&level, cwd.as_deref(), &name)?;
    if !dir.join("SKILL.md").exists() {
        return Err(format!("skills_not_installed: {name}"));
    }
    #[allow(unused_mut)]
    let mut context = trash::TrashContext::default();
    // NSFileManager: no Finder automation prompt, like the file explorer.
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context.delete(&dir).map_err(|e| format!("skills_delete_failed: {e}"))
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
/// The usual folders are tried first, with one download each. When none has the skill, the list of the files of the
/// repository gives the folder, at any depth (`skills/productivity/grill-me`). The last way is to read the `name` of
/// the `SKILL.md` files, because the folder of the skill `vercel-react-best-practices` is `react-best-practices`.
async fn find_skill(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
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

/// Installs a skill of skills.sh at `level`: the whole folder of the skill, and the file `.heidrun_origin.json`.
#[tauri::command]
pub async fn skills_install(level: String, cwd: Option<String>, source: String, skill_id: String) -> Result<InstalledSkill, String> {
    if !is_valid_source(&source) {
        return Err(format!("skills_invalid_name: {source}"));
    }
    let target = skill_dir(&level, cwd.as_deref(), &skill_id)?;
    if target.exists() {
        return Err(format!("skills_already_installed: {skill_id}"));
    }
    let client = http_client()?;
    let (repository_dir, skill_text) = find_skill(&client, &source, &skill_id).await?;

    // The files are written in a hidden folder first, so a failed download leaves no half-installed skill.
    let skills_folder = skills_dir(&level, cwd.as_deref())?;
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
    Ok(InstalledSkill {
        name: skill_id,
        description: parse_description(&skill_text),
        level,
        origin: Some(origin),
        path: target.display().to_string(),
    })
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

    #[test]
    fn lists_the_skills_with_their_origin() {
        let dir = temp_folder("list");
        std::fs::create_dir_all(dir.join("pdf")).unwrap();
        std::fs::write(dir.join("pdf/SKILL.md"), "---\ndescription: Read PDF files.\n---\n").unwrap();
        std::fs::write(dir.join("pdf").join(ORIGIN_FILE), r#"{"source":"anthropics/skills","skill_id":"pdf"}"#).unwrap();
        std::fs::create_dir_all(dir.join("release-notes")).unwrap();
        std::fs::write(dir.join("release-notes/SKILL.md"), "# Release notes").unwrap();
        std::fs::create_dir_all(dir.join("not-a-skill")).unwrap();
        let skills = list_level("user", &dir);
        let names: Vec<_> = skills.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["pdf", "release-notes"]);
        assert_eq!(skills[0].origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into() }));
        assert_eq!(skills[0].description, "Read PDF files.");
        assert_eq!(skills[1].origin, None);
        assert_eq!(skills[1].level, "user");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn needs_a_folder_for_the_workspace_level() {
        assert_eq!(skills_dir("workspace", None), Err("skills_no_workspace_folder".into()));
        assert_eq!(skills_dir("workspace", Some("/work/app")), Ok(PathBuf::from("/work/app/.claude/skills")));
        assert!(skills_dir("team", None).is_err());
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
        let installed = skills_install("workspace".into(), Some(cwd), "mattpocock/skills".into(), "grill-me".into()).await.unwrap();
        assert_eq!(installed.name, "grill-me");
        assert!(workspace.join(".claude/skills/grill-me/SKILL.md").exists());
        assert!(workspace.join(".claude/skills/grill-me/agents/openai.yaml").exists());
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
        let installed = skills_install("workspace".into(), Some(cwd.clone()), found.source.clone(), found.skill_id.clone()).await.unwrap();
        assert_eq!(installed.origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into() }));
        assert!(workspace.join(".claude/skills/pdf/SKILL.md").exists());
        assert!(workspace.join(".claude/skills/pdf").join(ORIGIN_FILE).exists());
        let listed = skills_list(Some(cwd.clone()));
        assert!(listed.iter().any(|s| s.name == "pdf" && s.level == "workspace"));
        let again = skills_install("workspace".into(), Some(cwd), "anthropics/skills".into(), "pdf".into()).await;
        assert!(again.unwrap_err().starts_with("skills_already_installed"));
        let _ = std::fs::remove_dir_all(&workspace);
    }
}
