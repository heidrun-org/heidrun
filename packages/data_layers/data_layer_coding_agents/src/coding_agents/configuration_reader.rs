//! Reads the configuration of the coding agent for one repository: the memory files of Claude Code, the subagents of Claude
//! Code, and the skills of Claude Code, of Codex, and of the folders `.agents` that several coding agents read.
//!
//! The places, for the root folder `<root>` of the repository:
//! - the memory files: `<Claude Code>/projects/<project folder of the main checkout>/memory/*.md`, because Claude Code keeps
//!   one memory for the main checkout and all its worktrees;
//! - the subagents: `<root>/.claude/agents/*.md` and `<Claude Code>/agents/*.md`;
//! - the skills: the folders with a file `SKILL.md` in `<root>/.claude/skills`, `<root>/.agents/skills`,
//!   `<Claude Code>/skills`, `<Codex>/skills`, and `~/.agents/skills`.
//!
//! The code reads the header of each file, between the two lines `---`, and never writes in these folders.

use crate::coding_agents::session_files::claude_folder_name;
use crate::coding_agents::session_reader::format_date;
use crate::model::configuration_types::{ConfigurationItem, ConfigurationKind, ConfigurationRead, ConfigurationScope};
use crate::model::types::CodingAgent;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// The folders where the configuration of the coding agent is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigurationFolders {
    /// The root folder of the repository, or of the worktree.
    pub root: PathBuf,
    /// The folder of the main checkout of the repository. It is `root` when `root` is not a worktree.
    pub main_root: PathBuf,
    /// The folder of the configuration of Claude Code, for example `~/.claude`.
    pub claude_dir: PathBuf,
    /// The folder of Codex, for example `~/.codex`.
    pub codex_home: PathBuf,
    /// The folder `.agents` of the home folder, which several coding agents read, for example `~/.agents`.
    pub agents_home: PathBuf,
}

/// One folder that holds configuration items of one kind.
struct ItemFolder {
    /// The folder.
    folder: PathBuf,
    /// The coding agent that reads the folder, or `None` for a folder `.agents`.
    coding_agent: Option<CodingAgent>,
    /// Where the items of the folder apply.
    scope: ConfigurationScope,
}

/// Reads the memory files, the subagents, and the skills of the repository, in the order of `ConfigurationKind::ALL`. A folder
/// that does not exist gives no item.
pub fn read_configuration(folders: &ConfigurationFolders) -> Vec<ConfigurationRead> {
    ConfigurationKind::ALL
        .into_iter()
        .map(|kind| {
            let mut items: Vec<ConfigurationItem> =
                item_folders(kind, folders).iter().flat_map(|item_folder| read_folder(kind, item_folder)).collect();
            items.sort_by(|left, right| left.id.cmp(&right.id));
            ConfigurationRead { kind, items }
        })
        .collect()
}

/// The folders of one kind of configuration item.
fn item_folders(kind: ConfigurationKind, folders: &ConfigurationFolders) -> Vec<ItemFolder> {
    let claude = Some(CodingAgent::ClaudeCode);
    let item_folder = |folder: PathBuf, coding_agent: Option<CodingAgent>, scope: ConfigurationScope| ItemFolder {
        folder,
        coding_agent,
        scope,
    };
    let root = &folders.root;
    match kind {
        ConfigurationKind::MemoryFile => {
            let project = claude_folder_name(&folders.main_root.display().to_string());
            let memory = folders.claude_dir.join("projects").join(project).join("memory");
            vec![item_folder(memory, claude, ConfigurationScope::Project)]
        }
        ConfigurationKind::Subagent => vec![
            item_folder(root.join(".claude").join("agents"), claude, ConfigurationScope::Project),
            item_folder(folders.claude_dir.join("agents"), claude, ConfigurationScope::User),
        ],
        ConfigurationKind::Skill => vec![
            item_folder(root.join(".claude").join("skills"), claude, ConfigurationScope::Project),
            item_folder(root.join(".agents").join("skills"), None, ConfigurationScope::Project),
            item_folder(folders.claude_dir.join("skills"), claude, ConfigurationScope::User),
            item_folder(folders.codex_home.join("skills"), Some(CodingAgent::Codex), ConfigurationScope::User),
            item_folder(folders.agents_home.join("skills"), None, ConfigurationScope::User),
        ],
    }
}

/// Reads the items of one folder. A memory file or a subagent is a file that ends with `.md`. A skill is a folder with a file
/// `SKILL.md`. A name that starts with a dot is skipped.
fn read_folder(kind: ConfigurationKind, item_folder: &ItemFolder) -> Vec<ConfigurationItem> {
    let Ok(entries) = std::fs::read_dir(&item_folder.folder) else {
        return Vec::new();
    };
    let mut items = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if file_name.starts_with('.') {
            continue;
        }
        let (header_file, default_name) = match kind {
            ConfigurationKind::Skill => (path.join("SKILL.md"), file_name.clone()),
            ConfigurationKind::MemoryFile | ConfigurationKind::Subagent => {
                let Some(stem) = file_name.strip_suffix(".md") else {
                    continue;
                };
                (path.clone(), stem.to_string())
            }
        };
        if let Some(item) = read_item(kind, item_folder, &path, &header_file, &default_name) {
            items.push(item);
        }
    }
    items
}

/// Reads one item: the dates of the file that holds its header, and the fields of the header. The date of the creation is
/// never after the date of the last change, because a copy keeps the date of the change and takes a new date of creation.
/// `None` when the file is not a readable file.
fn read_item(
    kind: ConfigurationKind,
    item_folder: &ItemFolder,
    path: &Path,
    header_file: &Path,
    default_name: &str,
) -> Option<ConfigurationItem> {
    let metadata = std::fs::metadata(header_file).ok().filter(|metadata| metadata.is_file())?;
    let text = std::fs::read_to_string(header_file).ok()?;
    let header = read_header(&text);
    let modified = metadata.modified().ok()?;
    let created = metadata.created().ok().filter(|created| *created < modified).unwrap_or(modified);
    let updated_at = date_of(modified)?;
    let created_at = date_of(created)?;
    let field = |key: &str| header.get(key).filter(|value| !value.is_empty()).cloned();
    let is_memory_file = kind == ConfigurationKind::MemoryFile;
    Some(ConfigurationItem {
        id: path.display().to_string(),
        coding_agent: item_folder.coding_agent,
        scope: item_folder.scope,
        folder: item_folder.folder.display().to_string(),
        name: field("name").unwrap_or_else(|| default_name.to_string()),
        description: field("description"),
        created_at,
        updated_at,
        removed_at: None,
        memory_type: if is_memory_file { field("type") } else { None },
        origin_chat_session_id: if is_memory_file { field("originSessionId") } else { None },
    })
}

/// A date of the system in the format ISO 8601, or `None` when the date is before 1970.
fn date_of(time: SystemTime) -> Option<String> {
    let milliseconds = time.duration_since(UNIX_EPOCH).ok()?.as_millis();
    format_date(i64::try_from(milliseconds).ok()?)
}

/// The fields of the header of a file, between a first line `---` and the next line `---`: each line `key: value`, at any
/// depth, so that `metadata:` and its lines below give `type` and `originSessionId`. A value `>` or `|`, or an empty value,
/// takes the deeper lines that follow, joined with spaces. The quotes around a value are removed. A file without a header
/// gives no field.
pub fn read_header(text: &str) -> HashMap<String, String> {
    let mut fields = HashMap::new();
    let mut lines = text.lines();
    if lines.next().map(str::trim_end) != Some("---") {
        return fields;
    }
    let header: Vec<&str> = lines.take_while(|line| line.trim_end() != "---").collect();
    let mut index = 0;
    while index < header.len() {
        let line = header[index];
        index += 1;
        let indent = line.len() - line.trim_start().len();
        let Some((key, value)) = line.trim().split_once(':') else {
            continue;
        };
        let key = key.trim().to_string();
        let mut value = value.trim().to_string();
        if value.is_empty() || value.starts_with('>') || value.starts_with('|') {
            let mut parts = Vec::new();
            while index < header.len() {
                let next = header[index];
                let next_indent = next.len() - next.trim_start().len();
                if !next.trim().is_empty() && next_indent <= indent {
                    break;
                }
                parts.push(next.trim());
                index += 1;
            }
            if value.is_empty() && parts.iter().any(|part| part.contains(':')) {
                index -= parts.len();
                continue;
            }
            value = parts.into_iter().filter(|part| !part.is_empty()).collect::<Vec<_>>().join(" ");
        }
        fields.entry(key).or_insert_with(|| unquote(&value));
    }
    fields
}

/// The value without the quotes around it.
fn unquote(value: &str) -> String {
    for quote in ['"', '\''] {
        if value.len() >= 2 && value.starts_with(quote) && value.ends_with(quote) {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{temp_folder, write_file};

    /// The folders of a fake computer in a new temporary folder, with the repository in `work/app`.
    fn fake_folders(name: &str) -> ConfigurationFolders {
        let directory = temp_folder(name);
        ConfigurationFolders {
            root: directory.join("work").join("app"),
            main_root: directory.join("work").join("app"),
            claude_dir: directory.join("claude"),
            codex_home: directory.join("codex"),
            agents_home: directory.join("agents"),
        }
    }

    /// The memory folder of Claude Code for the repository of the fake computer.
    fn memory_folder(folders: &ConfigurationFolders) -> PathBuf {
        folders.claude_dir.join("projects").join(claude_folder_name(&folders.main_root.display().to_string())).join("memory")
    }

    const MEMORY_TEXT: &str = "---\nname: never-rebase\ndescription: Never rebase, merge only\nmetadata:\n  node_type: memory\n  type: feedback\n  originSessionId: 43406b78-fddd\n  modified: 2026-10-13T04:00:53.815Z\n---\n\nNever rebase.\n";

    #[test]
    fn reads_the_header_with_nested_fields_quotes_and_folded_values() {
        let header = read_header(MEMORY_TEXT);
        assert_eq!(header.get("name").map(String::as_str), Some("never-rebase"));
        assert_eq!(header.get("type").map(String::as_str), Some("feedback"));
        assert_eq!(header.get("originSessionId").map(String::as_str), Some("43406b78-fddd"));
        let header = read_header("---\nname: \"a skill\"\ndescription: >\n  Two lines\n  of text\ntools: Read\n---\nbody\n");
        assert_eq!(header.get("name").map(String::as_str), Some("a skill"));
        assert_eq!(header.get("description").map(String::as_str), Some("Two lines of text"));
        assert_eq!(header.get("tools").map(String::as_str), Some("Read"));
        assert!(read_header("# MEMORY\n- a line: with a colon\n").is_empty());
    }

    #[test]
    fn reads_the_memory_files_with_their_type_and_their_chat_session_and_the_index_without_a_type() {
        let folders = fake_folders("memory");
        let memory = memory_folder(&folders);
        write_file(&memory.join("never-rebase.md"), MEMORY_TEXT, 10);
        write_file(&memory.join("MEMORY.md"), "- [Never rebase](never-rebase.md)\n", 10);
        write_file(&memory.join("notes.txt"), "not a memory file", 10);
        let reads = read_configuration(&folders);
        assert_eq!(reads.iter().map(|read| read.kind).collect::<Vec<_>>(), ConfigurationKind::ALL);
        let items = &reads[0].items;
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "MEMORY");
        assert_eq!((items[0].memory_type.as_deref(), items[0].description.as_deref()), (None, None));
        let item = &items[1];
        assert_eq!(item.id, memory.join("never-rebase.md").display().to_string());
        assert_eq!(item.folder, memory.display().to_string());
        assert_eq!((item.coding_agent, item.scope), (Some(CodingAgent::ClaudeCode), ConfigurationScope::Project));
        assert_eq!(item.description.as_deref(), Some("Never rebase, merge only"));
        assert_eq!(item.memory_type.as_deref(), Some("feedback"));
        assert_eq!(item.origin_chat_session_id.as_deref(), Some("43406b78-fddd"));
        assert_eq!(item.removed_at, None);
        assert!(item.created_at <= item.updated_at);
    }

    #[test]
    fn reads_the_memory_of_the_main_checkout_from_a_worktree() {
        let mut folders = fake_folders("memory_worktree");
        let main_memory = memory_folder(&folders);
        folders.root = folders.root.join(".claude").join("worktrees").join("a-fix");
        write_file(&main_memory.join("never-rebase.md"), MEMORY_TEXT, 10);
        let items = &read_configuration(&folders)[0].items;
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].folder, main_memory.display().to_string());
    }

    #[test]
    fn reads_the_subagents_of_the_repository_and_of_the_user() {
        let folders = fake_folders("subagents");
        write_file(&folders.root.join(".claude/agents/reviewer.md"), "---\nname: reviewer\ndescription: Reviews\n---\n", 10);
        write_file(&folders.claude_dir.join("agents/planner.md"), "No header\n", 10);
        let items = &read_configuration(&folders)[1].items;
        let summary: Vec<(&str, ConfigurationScope, Option<&str>)> =
            items.iter().map(|item| (item.name.as_str(), item.scope, item.description.as_deref())).collect();
        assert_eq!(
            summary,
            [("planner", ConfigurationScope::User, None), ("reviewer", ConfigurationScope::Project, Some("Reviews"))]
        );
        assert!(items.iter().all(|item| item.memory_type.is_none() && item.origin_chat_session_id.is_none()));
    }

    #[test]
    fn reads_the_skills_of_the_five_folders_with_their_coding_agent_and_skips_a_folder_without_skill_file() {
        let folders = fake_folders("skills");
        let skill = |folder: PathBuf, name: &str| {
            write_file(&folder.join(name).join("SKILL.md"), &format!("---\nname: {name}\ndescription: d\n---\n"), 10)
        };
        skill(folders.root.join(".claude/skills"), "a-claude-project");
        skill(folders.root.join(".agents/skills"), "b-agents-project");
        skill(folders.claude_dir.join("skills"), "c-claude-user");
        skill(folders.codex_home.join("skills"), "d-codex-user");
        skill(folders.agents_home.join("skills"), "e-agents-user");
        std::fs::create_dir_all(folders.claude_dir.join("skills/synced")).unwrap();
        std::fs::create_dir_all(folders.claude_dir.join("skills/.hidden")).unwrap();
        let mut items = read_configuration(&folders)[2].items.clone();
        items.sort_by(|left, right| left.name.cmp(&right.name));
        let summary: Vec<(&str, Option<CodingAgent>, ConfigurationScope)> =
            items.iter().map(|item| (item.name.as_str(), item.coding_agent, item.scope)).collect();
        assert_eq!(
            summary,
            [
                ("a-claude-project", Some(CodingAgent::ClaudeCode), ConfigurationScope::Project),
                ("b-agents-project", None, ConfigurationScope::Project),
                ("c-claude-user", Some(CodingAgent::ClaudeCode), ConfigurationScope::User),
                ("d-codex-user", Some(CodingAgent::Codex), ConfigurationScope::User),
                ("e-agents-user", None, ConfigurationScope::User),
            ]
        );
        assert_eq!(items[0].id, folders.root.join(".claude/skills/a-claude-project").display().to_string());
    }

    #[test]
    fn gives_no_item_for_folders_that_do_not_exist() {
        let folders = fake_folders("nothing");
        assert!(read_configuration(&folders).iter().all(|read| read.items.is_empty()));
    }
}
