//! The preview and the installation of a skill: from the search on skills.sh, or from the web address of a skill folder
//! on GitHub.

use std::path::{Path, PathBuf};
use super::agent_folders::{AGENTS, REAL_FILES_AGENT, link_agents, skill_locations, skills_dir};
use super::folder_address::{FolderAddress, parse_folder_address};
use super::github::{fetch_folder_text, find_skill, http_client, list_folder_files, list_repository_files};
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

/// The text of the `SKILL.md` file of the skill folder at a GitHub web address, to read it before the installation.
#[tauri::command]
pub async fn skills_preview_folder(url: String) -> Result<String, String> {
    let address = parse_folder_address(&url)?;
    let client = http_client()?;
    fetch_folder_text(&client, &address).await
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
    let plan = plan_install(level, cwd, &skill_id, agents)?;
    let client = http_client()?;
    let (repository_dir, skill_text) = find_skill(&client, &source, &skill_id).await?;
    prepare_staging(&plan)?;
    let written = write_skill(&client, &source, &repository_dir, &skill_text, &plan.staging).await;
    finish_install(&plan, SkillOrigin { source, skill_id, folder_url: None }, written)
}

/// Installs the skill folder at a GitHub web address, in the same way as `skills_install`: every file below the folder
/// is downloaded, and the folder gets the name of the last part of the address. The repository must be public.
#[tauri::command]
pub async fn skills_install_folder(
    level: String,
    cwd: Option<String>,
    url: String,
    agents: Vec<String>,
) -> Result<InstalledSkill, String> {
    let address = parse_folder_address(&url)?;
    let plan = plan_install(level, cwd, address.skill_id(), agents)?;
    let client = http_client()?;
    let skill_text = fetch_folder_text(&client, &address).await?;
    prepare_staging(&plan)?;
    let written = write_folder_skill(&client, &address, &skill_text, &plan.staging).await;
    let origin = SkillOrigin { source: address.source.clone(), skill_id: address.skill_id().to_string(), folder_url: Some(address.url()) };
    finish_install(&plan, origin, written)
}

/// What the installation of one skill needs, checked before any download.
struct InstallPlan {
    level: String,
    cwd: Option<String>,
    skill_id: String,
    agents: Vec<String>,
    /// The folder of the skill in the skills folder of Codex: the folder with the real files.
    target: PathBuf,
    /// A hidden folder next to `target`, where the files go first.
    staging: PathBuf,
}

/// Checks the agents and the level, and that the skill is not installed yet.
fn plan_install(level: String, cwd: Option<String>, skill_id: &str, agents: Vec<String>) -> Result<InstallPlan, String> {
    if let Some(unknown) = agents.iter().find(|agent| AGENTS.contains(&agent.as_str()) == false) {
        return Err(format!("skills_unknown_agent: {unknown}"));
    }
    if agents.is_empty() {
        return Err("skills_no_agent".into());
    }
    if skill_locations(&level, cwd.as_deref(), skill_id)?.is_empty() == false {
        return Err(format!("skills_already_installed: {skill_id}"));
    }
    let skills_folder = skills_dir(REAL_FILES_AGENT, &level, cwd.as_deref())?;
    let target = skills_folder.join(skill_id);
    let staging = skills_folder.join(format!(".{skill_id}.installing"));
    Ok(InstallPlan { level, cwd, skill_id: skill_id.to_string(), agents, target, staging })
}

/// Makes an empty hidden folder for the files, so a failed download leaves no half-installed skill.
fn prepare_staging(plan: &InstallPlan) -> Result<(), String> {
    let _ = std::fs::remove_dir_all(&plan.staging);
    std::fs::create_dir_all(&plan.staging).map_err(|e| format!("skills_install_failed: {e}"))
}

/// Ends an installation, once the files are written in the hidden folder (`written` is the result of the writing):
/// writes the file `.heidrun_origin.json`, moves the hidden folder to its place, and links the agents.
fn finish_install(plan: &InstallPlan, origin: SkillOrigin, written: Result<(), String>) -> Result<InstalledSkill, String> {
    if let Err(error) = written {
        let _ = std::fs::remove_dir_all(&plan.staging);
        return Err(error);
    }
    let origin_text = serde_json::to_string_pretty(&origin).map_err(|e| format!("skills_install_failed: {e}"))?;
    std::fs::write(plan.staging.join(ORIGIN_FILE), origin_text).map_err(|e| format!("skills_install_failed: {e}"))?;
    std::fs::rename(&plan.staging, &plan.target).map_err(|e| format!("skills_install_failed: {e}"))?;

    let (level, cwd, skill_id) = (&plan.level, plan.cwd.as_deref(), &plan.skill_id);
    if let Err(error) = link_agents(level, cwd, skill_id, &plan.target, &plan.agents) {
        // No half-installed skill: the links already made and the real folder are removed.
        let _ = delete_locations(&skill_locations(level, cwd, skill_id).unwrap_or_default(), &|path| {
            std::fs::remove_dir_all(path).map_err(|e| format!("skills_install_failed: {e}"))
        });
        return Err(error);
    }
    list_level(level, cwd)
        .into_iter()
        .find(|skill| &skill.name == skill_id)
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
        download_file(client, &url, &staging.join(&relative)).await?;
    }
    Ok(())
}

/// Writes the files of the skill folder of an address into `staging`. Unlike `write_skill`, a list of files that GitHub
/// refuses is an error, because the developer asked for every file below the folder.
pub(super) async fn write_folder_skill(client: &reqwest::Client, address: &FolderAddress, skill_text: &str, staging: &Path) -> Result<(), String> {
    std::fs::write(staging.join("SKILL.md"), skill_text).map_err(|e| format!("skills_install_failed: {e}"))?;
    let folder_files = list_folder_files(client, address).await?;
    let files = files_in_dir(&folder_files, "");
    if files.len() > MAX_FILES {
        return Err("skills_too_many_files".into());
    }
    let folder = encode_path(&address.reference_and_path());
    for (relative, file) in files {
        if relative == Path::new("SKILL.md") || file.size as usize > MAX_FILE_BYTES {
            continue;
        }
        let url = format!("https://raw.githubusercontent.com/{}/{folder}/{}", address.source, encode_path(&file.path));
        download_file(client, &url, &staging.join(&relative)).await?;
    }
    Ok(())
}

/// Downloads the file at `url` and writes it at `target`, with the folders above it.
async fn download_file(client: &reqwest::Client, url: &str, target: &Path) -> Result<(), String> {
    let response = client.get(url).send().await.map_err(|e| format!("skills_download_failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("skills_download_failed: HTTP {}", response.status().as_u16()));
    }
    let bytes = response.bytes().await.map_err(|e| format!("skills_download_failed: {e}"))?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("skills_install_failed: {e}"))?;
    }
    std::fs::write(target, &bytes).map_err(|e| format!("skills_install_failed: {e}"))
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

    #[tokio::test]
    async fn refuses_a_folder_install_for_a_bad_address_no_agent_or_an_unknown_agent() {
        let address = "https://github.com/anthropics/skills/tree/main/skills/pdf";
        let bad = skills_install_folder("workspace".into(), Some("/work/app".into()), "skills".into(), vec!["codex".into()]).await;
        assert_eq!(bad.unwrap_err(), "skills_invalid_address: skills");
        let none = skills_install_folder("workspace".into(), Some("/work/app".into()), address.into(), Vec::new()).await;
        assert_eq!(none.unwrap_err(), "skills_no_agent");
        let unknown = skills_install_folder("workspace".into(), Some("/work/app".into()), address.into(), vec!["cursor".into()]).await;
        assert_eq!(unknown.unwrap_err(), "skills_unknown_agent: cursor");
        assert_eq!(skills_preview_folder("skills".into()).await.unwrap_err(), "skills_invalid_address: skills");
    }

    #[tokio::test]
    async fn refuses_a_folder_install_of_a_skill_that_is_already_installed() {
        let workspace = temp_folder("folder-already");
        write_skill_folder(&workspace.join(".agents/skills"), "pdf", "# pdf");
        let again = skills_install_folder(
            "workspace".into(),
            cwd_of(&workspace),
            "https://github.com/anthropics/skills/tree/main/skills/pdf".into(),
            vec!["codex".into()],
        )
        .await;
        assert_eq!(again.unwrap_err(), "skills_already_installed: pdf");
        let _ = std::fs::remove_dir_all(&workspace);
    }

    /// Runs against GitHub: `cargo test skills_live_folder -- --ignored`. The address names a folder of a public
    /// repository, and the install gives the same files as the install of the same skill from skills.sh.
    #[tokio::test]
    #[ignore]
    async fn skills_live_folder_install_from_an_address() {
        let address = "https://github.com/anthropics/skills/tree/main/skills/pdf";
        let text = skills_preview_folder(address.into()).await.unwrap();
        assert!(text.starts_with("---"));
        let workspace = temp_folder("live-folder");
        let installed = skills_install_folder("workspace".into(), cwd_of(&workspace), address.into(), vec!["claude".into(), "codex".into()]).await.unwrap();
        assert_eq!(installed.name, "pdf");
        assert_eq!(installed.origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into(), folder_url: Some(address.into()) }));
        assert_eq!(installed.agents, ["claude", "codex"]);
        let folder = workspace.join(".agents/skills/pdf");
        assert!(folder.join("SKILL.md").exists());
        assert!(folder.join("scripts").is_dir(), "the files below the folder are downloaded");
        assert!(folder.join(ORIGIN_FILE).exists());
        assert!(workspace.join(".agents/skills/.pdf.installing").exists() == false);
        let _ = std::fs::remove_dir_all(&workspace);
    }

    /// Runs against GitHub: a branch name with a slash, and the folders that GitHub does not give.
    #[tokio::test]
    #[ignore]
    async fn skills_live_folder_branch_with_a_slash_and_missing_folders() {
        let slash = "https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator";
        assert!(skills_preview_folder(slash.into()).await.unwrap().starts_with("---"));
        let workspace = temp_folder("live-folder-slash");
        let installed = skills_install_folder("workspace".into(), cwd_of(&workspace), slash.into(), vec!["codex".into()]).await.unwrap();
        assert_eq!(installed.name, "skill-creator");
        let _ = std::fs::remove_dir_all(&workspace);
        let missing = "https://github.com/anthropics/skills/tree/main/skills/does-not-exist";
        assert_eq!(skills_preview_folder(missing.into()).await.unwrap_err(), "skills_folder_not_found: anthropics/skills/main/skills/does-not-exist");
        let private = "https://github.com/anthropics/this-repository-does-not-exist-xyz/tree/main/skills/pdf";
        assert!(skills_preview_folder(private.into()).await.unwrap_err().starts_with("skills_folder_not_found"));
        let empty = temp_folder("live-folder-missing");
        let failed = skills_install_folder("workspace".into(), cwd_of(&empty), missing.into(), vec!["codex".into()]).await;
        assert!(failed.unwrap_err().starts_with("skills_folder_not_found"));
        assert!(empty.join(".agents/skills").exists() == false || std::fs::read_dir(empty.join(".agents/skills")).unwrap().count() == 0);
        let _ = std::fs::remove_dir_all(&empty);
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
        assert_eq!(installed.origin, Some(SkillOrigin { source: "anthropics/skills".into(), skill_id: "pdf".into(), folder_url: None }));
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
