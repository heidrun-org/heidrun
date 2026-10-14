//! The preview and the installation of a skill of skills.sh.

use std::path::Path;
use super::agent_folders::{AGENTS, REAL_FILES_AGENT, link_agents, skill_locations, skills_dir};
use super::github::{find_skill, http_client, list_repository_files};
use super::installed::{delete_locations, list_level};
use super::repository_paths::{encode_path, files_in_dir};
use super::types::{InstalledSkill, ORIGIN_FILE, SkillOrigin, is_valid_name, is_valid_source};

pub(super) const MAX_FILES: usize = 200;
pub(super) const MAX_FILE_BYTES: usize = 2_000_000;

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

/// Writes the files of the skill into `staging`. When the list of the files of the repository is not available, only
/// `SKILL.md` is written.
pub(super) async fn write_skill(client: &reqwest::Client, source: &str, repository_dir: &str, skill_text: &str, staging: &Path) -> Result<(), String> {
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
    use crate::skills::test_support::*;
    use super::super::{installed::skills_list, search::skills_search, skill_text::parse_name};

    #[tokio::test]
    async fn refuses_an_install_for_no_agent_or_an_unknown_agent() {
        let none = skills_install("workspace".into(), Some("/work/app".into()), "a/b".into(), "x".into(), Vec::new()).await;
        assert_eq!(none.unwrap_err(), "skills_no_agent");
        let unknown = skills_install("workspace".into(), Some("/work/app".into()), "a/b".into(), "x".into(), vec!["cursor".into()]).await;
        assert_eq!(unknown.unwrap_err(), "skills_unknown_agent: cursor");
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
