//! The project macros: the key `prompts` of the file `.heidrun/config.json` of a project.
//!
//! The key keeps the old name of the feature, because other people already have the file. The format of the file is
//! checked by the Zod schema of the web frontend (`packages/apps/web_frontend/src/lib/project_config.ts`). This file reads
//! and changes only the key `prompts`, and keeps every other key as it is.

use crate::macro_types::Macro;
use crate::personal_macros::write_file_aside;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

/// The folder of the project configuration, at the root of a project.
const CONFIG_FOLDER: &str = ".heidrun";

/// The file of the project configuration, in the folder `.heidrun`.
const CONFIG_FILE: &str = "config.json";

/// The key of the list of macros. It keeps the old name of the feature.
const MACROS_KEY: &str = "prompts";

/// The number of characters of the text that become the title of a macro that has no title.
pub const LABEL_FROM_TEXT_LENGTH: usize = 40;

/// The root of the project that holds `folder`: the nearest folder, from `folder` up, that has a folder `.heidrun` or a
/// folder `.git`, else `folder` itself. It is the same search as the window makes.
pub fn find_project_root(folder: &Path) -> PathBuf {
    let mut candidate = Some(folder);
    while let Some(current) = candidate {
        if current.join(CONFIG_FOLDER).is_dir() || current.join(".git").exists() {
            return current.to_path_buf();
        }
        candidate = current.parent();
    }
    folder.to_path_buf()
}

/// The file `.heidrun/config.json` of the project at `root`.
pub fn project_config_path(root: &Path) -> PathBuf {
    root.join(CONFIG_FOLDER).join(CONFIG_FILE)
}

/// The first characters of a text, the title of a macro that has none.
pub fn label_from_text(text: &str) -> String {
    text.chars().take(LABEL_FROM_TEXT_LENGTH).collect()
}

/// The id of the macro at `index` in the key `prompts` when the entry has no id: the same id that the window gives.
fn fallback_id(index: usize) -> String {
    format!("projet-{index}")
}

/// Reads the whole file `.heidrun/config.json` as a JSON object. A missing file gives `None`.
fn read_config(path: &Path) -> Result<Option<Map<String, Value>>, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The file {} cannot be read: {error}", path.display())),
    };
    match serde_json::from_str::<Value>(&text) {
        Ok(Value::Object(config)) => Ok(Some(config)),
        Ok(_) => Err(format!("The file {} is not a JSON object.", path.display())),
        Err(error) => Err(format!("The file {} is not valid JSON: {error}", path.display())),
    }
}

/// The macro that an entry of the key `prompts` holds. An entry without an id gets the id `projet-<index>`, and an entry
/// without a title gets the first characters of its text, as the window does.
fn macro_of_entry(entry: &Value, index: usize, path: &Path) -> Result<Macro, String> {
    let text = entry.get("text").and_then(Value::as_str).filter(|text| !text.is_empty()).ok_or_else(|| {
        format!("The file {} is not valid: the macro {} of the key {MACROS_KEY} has no text.", path.display(), index + 1)
    })?;
    let text_of = |key: &str| entry.get(key).and_then(Value::as_str).filter(|value| !value.is_empty());
    Ok(Macro {
        id: text_of("id").map(str::to_string).unwrap_or_else(|| fallback_id(index)),
        label: text_of("label").map(str::to_string).unwrap_or_else(|| label_from_text(text)),
        description: entry.get("description").and_then(Value::as_str).unwrap_or_default().to_string(),
        text: text.to_string(),
    })
}

/// Reads the project macros of the project at `root`. A project with no file, or with no key `prompts`, has none.
///
/// # Errors
/// The file cannot be read, is not a JSON object, or has a macro with no text.
pub fn read_project_macros(root: &Path) -> Result<Vec<Macro>, String> {
    let path = project_config_path(root);
    let Some(config) = read_config(&path)? else {
        return Ok(Vec::new());
    };
    match config.get(MACROS_KEY) {
        None => Ok(Vec::new()),
        Some(Value::Array(entries)) => {
            entries.iter().enumerate().map(|(index, entry)| macro_of_entry(entry, index, &path)).collect()
        }
        Some(_) => Err(format!("The file {} is not valid: the key {MACROS_KEY} is not a list.", path.display())),
    }
}

/// Changes the key `prompts` of the file `.heidrun/config.json` of the project at `root` with `change`, and keeps every
/// other key and every other field of a macro as it is. A project that has no file gets a new file with the version 1 and
/// no launcher.
///
/// `change` receives the entries of the key `prompts` and returns the new entries.
///
/// # Errors
/// The file cannot be read, is not a JSON object, or cannot be written, or `change` gives an error.
pub fn change_project_macros(
    root: &Path,
    change: impl FnOnce(Vec<Value>) -> Result<Vec<Value>, String>,
) -> Result<(), String> {
    let path = project_config_path(root);
    let mut config = read_config(&path)?.unwrap_or_else(|| {
        let mut config = Map::new();
        config.insert("version".to_string(), json!(1));
        config.insert("launchers".to_string(), json!([]));
        config
    });
    let entries = match config.get(MACROS_KEY) {
        None => Vec::new(),
        Some(Value::Array(entries)) => entries.clone(),
        Some(_) => return Err(format!("The file {} is not valid: the key {MACROS_KEY} is not a list.", path.display())),
    };
    config.insert(MACROS_KEY.to_string(), Value::Array(change(entries)?));
    let mut text = serde_json::to_string_pretty(&Value::Object(config)).map_err(|error| error.to_string())?;
    text.push('\n');
    write_file_aside(&path, &text)
}

/// The id that the entry at `index` has: its own id, or else `projet-<index>`.
pub fn entry_id(entry: &Value, index: usize) -> String {
    entry.get("id").and_then(Value::as_str).filter(|id| !id.is_empty()).map(str::to_string).unwrap_or_else(|| fallback_id(index))
}

/// The entry of the key `prompts` for a macro.
pub fn entry_of_macro(content: &Macro) -> Value {
    json!({ "id": content.id, "label": content.label, "description": content.description, "text": content.text })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A new empty project folder for one test.
    fn test_project(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("heidrun_ctrl_project_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join(".heidrun")).unwrap();
        root
    }

    #[test]
    fn a_project_with_no_file_has_no_macro() {
        let root = std::env::temp_dir().join(format!("heidrun_ctrl_project_empty_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        assert_eq!(read_project_macros(&root), Ok(Vec::new()));
    }

    #[test]
    fn an_entry_without_id_and_without_label_gets_the_id_and_the_label_that_the_window_gives() {
        let root = test_project("fallback");
        std::fs::write(
            project_config_path(&root),
            r#"{"version":1,"launchers":[],"prompts":[{"text":"Review the branch"},{"id":"b","label":"B","text":"Two"}]}"#,
        )
        .unwrap();
        let macros = read_project_macros(&root).unwrap();
        assert_eq!(macros[0].id, "projet-0");
        assert_eq!(macros[0].label, "Review the branch");
        assert_eq!(macros[1].id, "b");
    }

    #[test]
    fn a_change_keeps_every_other_key_in_its_order() {
        let root = test_project("keep_keys");
        std::fs::write(
            project_config_path(&root),
            r#"{"version":1,"launchers":[{"id":"l","label":"L","command":"ls"}],"guards":{"block":["rm"]},"prompts":[]}"#,
        )
        .unwrap();
        change_project_macros(&root, |mut entries| {
            entries.push(json!({ "id": "n", "label": "N", "description": "", "text": "New" }));
            Ok(entries)
        })
        .unwrap();
        let text = std::fs::read_to_string(project_config_path(&root)).unwrap();
        let config: Value = serde_json::from_str(&text).unwrap();
        let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["version", "launchers", "guards", "prompts"]);
        assert_eq!(config["guards"]["block"][0], "rm");
        assert_eq!(config["prompts"][0]["id"], "n");
        assert!(text.ends_with("}\n"));
    }

    #[test]
    fn a_change_makes_the_file_when_the_project_has_none() {
        let root = std::env::temp_dir().join(format!("heidrun_ctrl_project_new_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        change_project_macros(&root, |_| Ok(vec![json!({ "id": "n", "label": "N", "description": "", "text": "New" })])).unwrap();
        let config: Value = serde_json::from_str(&std::fs::read_to_string(project_config_path(&root)).unwrap()).unwrap();
        assert_eq!(config["version"], 1);
        assert_eq!(config["launchers"], json!([]));
        assert_eq!(config["prompts"][0]["text"], "New");
    }

    #[test]
    fn a_file_that_is_not_valid_json_is_an_error_and_stays_as_it_is() {
        let root = test_project("not_json");
        std::fs::write(project_config_path(&root), "{ not json").unwrap();
        assert!(change_project_macros(&root, Ok).unwrap_err().contains("is not valid JSON"));
        assert_eq!(std::fs::read_to_string(project_config_path(&root)).unwrap(), "{ not json");
    }

    #[test]
    fn the_root_is_the_nearest_folder_with_a_folder_heidrun_or_git() {
        let root = test_project("root");
        let deeper = root.join("a").join("b");
        std::fs::create_dir_all(&deeper).unwrap();
        assert_eq!(find_project_root(&deeper), root);
    }
}
