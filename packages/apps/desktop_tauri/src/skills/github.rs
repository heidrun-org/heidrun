//! The lookup of a skill on GitHub: the list of the files of a repository and the folder of a skill.

use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};
use super::cache::{FILE_LIST_TTL, FileListEntry, SkillTextEntry, cache_folder, cached_files, fallback_to_cached_text, file_list_cache, is_recent, now_seconds, read_text_entry, text_cache_folder, write_entry, write_text_entry};
use super::repository_paths::{candidate_dirs, encode_path, pick_skill_dir};
use super::skill_text::parse_name;
use super::types::RepositoryFile;

/// How many SKILL.md files of a repository are read to find a skill by its name.
pub(super) const MAX_NAME_LOOKUPS: usize = 60;

/// Folders of a GitHub repository where a skill is looked for, before the root of the repository.
pub(super) const SKILL_PARENTS: [&str; 5] = ["skills", "", ".claude/skills", "skills/.curated", ".agents/skills"];

#[derive(Deserialize)]
pub(super) struct TreeResponse {
    pub(super) tree: Vec<TreeEntry>,
}

#[derive(Deserialize)]
pub(super) struct TreeEntry {
    pub(super) path: String,
    #[serde(rename = "type")]
    pub(super) kind: String,
    pub(super) size: Option<u64>,
}

pub(super) fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("Heidrun/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("skills_http_failed: {e}"))
}

/// Downloads the text of a file of a repository, or `None` when the file does not exist.
pub(super) async fn fetch_text(client: &reqwest::Client, source: &str, path: &str) -> Result<Option<String>, String> {
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
pub(super) fn rate_limit_reset(headers: &reqwest::header::HeaderMap) -> Option<u64> {
    if let Some(wait) = headers.get("retry-after").and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse::<u64>().ok()) {
        return Some(SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs() + wait);
    }
    headers.get("x-ratelimit-reset").and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse().ok())
}

/// All the files of a repository, in one call to GitHub. The answer is kept in memory and on the disk, and used for
/// one hour, because GitHub allows only 60 calls per hour. When GitHub refuses a new call, the older answer is used if there is one, otherwise the error
/// `skills_github_rate_limit: <seconds since 1970 when GitHub accepts requests again>`.
pub(super) async fn list_repository_files(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
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

pub(super) async fn fetch_repository_files(client: &reqwest::Client, source: &str) -> Result<Vec<RepositoryFile>, String> {
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
pub(super) async fn find_skill(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
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
pub(super) async fn find_skill_online(client: &reqwest::Client, source: &str, skill_id: &str) -> Result<(String, String), String> {
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
