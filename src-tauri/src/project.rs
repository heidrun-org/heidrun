//! Per-project actions, stored in `.herdr-desk.json` at the project root
//! (versioned with the code), plus commands detected from the usual project files.

use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const CONFIG_FILE: &str = ".herdr-desk.json";

#[derive(Serialize)]
pub struct Detected {
    pub label: String,
    pub command: String,
    pub source: String,
}

#[derive(Serialize)]
pub struct Project {
    pub root: String,
    pub config_path: String,
    pub config: Value,
    pub detected: Vec<Detected>,
}

/// Walks up from `cwd` to the folder holding `.herdr-desk.json` or `.git`.
fn find_root(cwd: &Path) -> PathBuf {
    let mut dir = Some(cwd);
    while let Some(d) = dir {
        if d.join(CONFIG_FILE).exists() || d.join(".git").exists() {
            return d.to_path_buf();
        }
        dir = d.parent();
    }
    cwd.to_path_buf()
}

fn package_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if root.join("yarn.lock").exists() {
        "yarn"
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        "bun"
    } else {
        "npm"
    }
}

fn detect(root: &Path) -> Vec<Detected> {
    let mut out = Vec::new();

    // package.json scripts
    if let Ok(text) = std::fs::read_to_string(root.join("package.json")) {
        if let Ok(pkg) = serde_json::from_str::<Value>(&text) {
            let pm = package_manager(root);
            out.push(Detected { label: format!("{pm} install"), command: format!("{pm} install"), source: "package.json".into() });
            if let Some(scripts) = pkg.get("scripts").and_then(Value::as_object) {
                for name in scripts.keys() {
                    let command = if pm == "npm" { format!("npm run {name}") } else { format!("{pm} {name}") };
                    out.push(Detected { label: command.clone(), command, source: "package.json".into() });
                }
            }
        }
    }

    // Makefile targets (plain `name:` rules, skipping variables and special targets)
    for file in ["Makefile", "makefile", "GNUmakefile"] {
        let Ok(text) = std::fs::read_to_string(root.join(file)) else { continue };
        let mut seen = std::collections::HashSet::new();
        for line in text.lines() {
            if line.starts_with(['\t', ' ', '.', '#']) {
                continue;
            }
            let Some((name, rest)) = line.split_once(':') else { continue };
            let name = name.trim();
            if rest.starts_with('=') || name.is_empty() || name.contains(['$', '%', ' ', '=']) {
                continue;
            }
            if seen.insert(name.to_string()) {
                out.push(Detected { label: format!("make {name}"), command: format!("make {name}"), source: file.into() });
            }
        }
        break;
    }

    // Procfile processes
    if let Ok(text) = std::fs::read_to_string(root.join("Procfile")) {
        for line in text.lines() {
            if let Some((name, cmd)) = line.split_once(':') {
                let (name, cmd) = (name.trim(), cmd.trim());
                if !name.is_empty() && !cmd.is_empty() && !name.starts_with('#') {
                    out.push(Detected { label: name.into(), command: cmd.into(), source: "Procfile".into() });
                }
            }
        }
    }

    // Flutter / Dart, Rust, Symfony: a few obvious entry points.
    if root.join("pubspec.yaml").exists() {
        for c in ["flutter pub get", "flutter run", "flutter test"] {
            out.push(Detected { label: c.into(), command: c.into(), source: "pubspec.yaml".into() });
        }
    }
    if root.join("Cargo.toml").exists() {
        for c in ["cargo run", "cargo test"] {
            out.push(Detected { label: c.into(), command: c.into(), source: "Cargo.toml".into() });
        }
    }
    if root.join("bin/console").exists() {
        out.push(Detected { label: "symfony serve".into(), command: "symfony serve".into(), source: "bin/console".into() });
    }
    out
}

#[tauri::command]
pub fn project_load(cwd: String) -> Result<Project, String> {
    let root = find_root(Path::new(&cwd));
    let path = root.join(CONFIG_FILE);
    let config = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{CONFIG_FILE} invalide : {e}"))?,
        Err(_) => json!({ "version": 1, "actions": [] }),
    };
    Ok(Project {
        root: root.display().to_string(),
        config_path: path.display().to_string(),
        detected: detect(&root),
        config,
    })
}

#[tauri::command]
pub fn project_save(root: String, config: Value) -> Result<(), String> {
    let path = Path::new(&root).join(CONFIG_FILE);
    let mut text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| format!("écriture de {} impossible : {e}", path.display()))
}
