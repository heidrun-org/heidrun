//! Per-project configuration, stored in `.heidrun/config.json` at the project root
//! (versioned with the code), plus commands detected from the usual project files.
//! The format of the file is validated by the Zod schema of the web frontend
//! (`packages/web-frontend/src/lib/project_config.ts`).

use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const CONFIG_DIR: &str = ".heidrun";
const CONFIG_FILE: &str = "config.json";

fn config_path(root: &Path) -> PathBuf {
    root.join(CONFIG_DIR).join(CONFIG_FILE)
}

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

/// Walks up from `cwd` to the folder holding the folder `.heidrun` or the folder `.git`.
fn find_root(cwd: &Path) -> PathBuf {
    let mut dir = Some(cwd);
    while let Some(d) = dir {
        if d.join(CONFIG_DIR).is_dir() || d.join(".git").exists() {
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
    let path = config_path(&root);
    let config = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{CONFIG_DIR}/{CONFIG_FILE} invalide : {e}"))?,
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
    let path = config_path(Path::new(&root));
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("création de {} impossible : {e}", dir.display()))?;
    }
    let mut text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| format!("écriture de {} impossible : {e}", path.display()))
}

#[derive(Serialize)]
pub struct RepoRefs {
    pub root: String,
    /// `remote.origin.url` (or the first remote), as git stores it.
    pub remote: Option<String>,
    /// The `references` section of `.heidrun/config.json`, if any.
    pub references: Value,
}

/// What the terminal needs to turn `#12`, `!34`, `PR #5`… into links:
/// the repository's remote and the project's reference settings.
#[tauri::command]
pub async fn project_refs(cwd: String) -> Result<RepoRefs, String> {
    let root = find_root(Path::new(&cwd));
    let references = std::fs::read_to_string(config_path(&root))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v.get("references").cloned())
        .unwrap_or(Value::Null);
    let git = |args: &[&str]| {
        let root = root.clone();
        let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
        async move {
            let out = tokio::process::Command::new("git")
                .arg("-C")
                .arg(&root)
                .args(&args)
                .output()
                .await
                .ok()?;
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            (out.status.success() && !s.is_empty()).then_some(s)
        }
    };
    let mut remote = git(&["config", "--get", "remote.origin.url"]).await;
    if remote.is_none() {
        if let Some(first) = git(&["remote"]).await.and_then(|r| r.lines().next().map(str::to_string)) {
            remote = git(&["config", "--get", &format!("remote.{first}.url")]).await;
        }
    }
    Ok(RepoRefs { root: root.display().to_string(), remote, references })
}
