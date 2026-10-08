//! File explorer: the project's files (respecting .gitignore), their git state,
//! images, and "open in VS Code". Reading goes through git::git_file, with the
//! same protections (known root, relative path, no symlink escape).

use crate::git::{known_root, remember_root, safe_rel};
use base64::Engine;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;

const MAX_FILES: usize = 50_000;
/// Folders never walked when the project is not a git repository.
const HEAVY: &[&str] = &[".git", "node_modules", "target", "dist", "build", ".venv", "venv", "__pycache__", ".next", ".nuxt", ".dart_tool", "Pods", "vendor"];

#[derive(Serialize)]
pub struct FileList {
    pub root: String,
    pub git: bool,
    /// Relative paths, "/" separated. Ignored folders (shown on request) end with "/".
    pub files: Vec<String>,
    /// path → git status letter (M, A, D, R, ?).
    pub status: HashMap<String, String>,
    pub truncated: bool,
}

async fn run(dir: &Path, args: &[&str]) -> Option<Vec<u8>> {
    let out = tokio::time::timeout(
        Duration::from_secs(15),
        Command::new("git").arg("-C").arg(dir).args(args).kill_on_drop(true).output(),
    )
    .await
    .ok()?
    .ok()?;
    out.status.success().then_some(out.stdout)
}

fn split_z(bytes: &[u8]) -> impl Iterator<Item = String> + '_ {
    bytes.split(|b| *b == 0).filter(|s| !s.is_empty()).map(|s| String::from_utf8_lossy(s).into_owned())
}

/// Not the whole home folder nor anything above it, and never a place for secrets
/// or system files: a project, not the disk.
fn acceptable_root(root: &Path) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_default();
    let home = std::fs::canonicalize(&home).unwrap_or(home);
    if root == Path::new("/") || home.starts_with(root) {
        return Err("Dossier trop large : ouvre un projet, pas le dossier personnel".into());
    }
    let private = [".ssh", ".aws", ".gnupg", ".config", ".kube", ".docker", "Library", ".claude", ".codex"];
    if private.iter().any(|d| root.starts_with(home.join(d))) {
        return Err("Dossier privé : non ouvert dans l’explorateur".into());
    }
    for sys in ["/etc", "/private", "/System", "/usr", "/bin", "/sbin", "/var", "/Library", "/dev"] {
        if root.starts_with(sys) {
            return Err("Dossier système : non ouvert dans l’explorateur".into());
        }
    }
    Ok(())
}

/// The folders of the panes Herdr knows: the explorer only opens projects that a
/// pane is working in, whatever the webview asks.
async fn pane_dirs() -> Vec<PathBuf> {
    let Ok(v) = crate::herdr::request("session.snapshot", serde_json::json!({})).await else { return vec![] };
    let panes = v.get("snapshot").and_then(|s| s.get("panes")).and_then(|p| p.as_array()).cloned().unwrap_or_default();
    let mut out = Vec::new();
    for p in panes {
        for key in ["foreground_cwd", "cwd"] {
            if let Some(d) = p.get(key).and_then(|x| x.as_str()).filter(|d| !d.is_empty()) {
                if let Ok(c) = std::fs::canonicalize(d) {
                    out.push(c);
                }
            }
        }
    }
    out
}

/// `root` holds the folder of at least one pane.
async fn used_by_a_pane(root: &Path) -> Result<(), String> {
    if pane_dirs().await.iter().any(|d| d.starts_with(root)) {
        Ok(())
    } else {
        Err("Ce dossier n’est le dossier d’aucun panneau : explorateur refusé".into())
    }
}

fn walk(base: &Path, dir: &Path, out: &mut Vec<String>, depth: u8) {
    if out.len() >= MAX_FILES || depth > 20 {
        return;
    }
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = rd.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for e in entries {
        let name = e.file_name().to_string_lossy().into_owned();
        let Ok(ft) = e.file_type() else { continue };
        if ft.is_symlink() {
            continue;
        }
        let p = e.path();
        if ft.is_dir() {
            if HEAVY.contains(&name.as_str()) {
                continue;
            }
            walk(base, &p, out, depth + 1);
        } else if let Ok(rel) = p.strip_prefix(base) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
        if out.len() >= MAX_FILES {
            return;
        }
    }
}

/// Files of the project containing `cwd`: the git repository (tracked and new files,
/// .gitignore respected), or the folder itself when it is not a repository.
#[tauri::command]
pub async fn files_list(cwd: String, ignored: Option<bool>) -> Result<FileList, String> {
    let dir = std::fs::canonicalize(&cwd).map_err(|_| "dossier introuvable".to_string())?;
    let top = run(&dir, &["rev-parse", "--show-toplevel"]).await.map(|b| String::from_utf8_lossy(&b).trim().to_string());
    let Some(root) = top.filter(|t| !t.is_empty()) else {
        acceptable_root(&dir)?;
        used_by_a_pane(&dir).await?;
        let walk_dir = dir.clone();
        let files = tokio::task::spawn_blocking(move || {
            let mut files = Vec::new();
            walk(&walk_dir, &walk_dir, &mut files, 0);
            files
        })
        .await
        .map_err(|e| e.to_string())?;
        let root = dir.display().to_string();
        remember_root(&root);
        let truncated = files.len() >= MAX_FILES;
        return Ok(FileList { root, git: false, files, status: HashMap::new(), truncated });
    };
    let rootp = std::fs::canonicalize(&root).unwrap_or_else(|_| PathBuf::from(&root));
    acceptable_root(&rootp)?;
    used_by_a_pane(&rootp).await?;
    let listed = run(&rootp, &["-c", "core.quotepath=off", "ls-files", "-z", "--cached", "--others", "--exclude-standard"]).await.unwrap_or_default();
    let mut files: Vec<String> = split_z(&listed).collect();
    files.sort();
    files.dedup();
    if ignored.unwrap_or(false) {
        // Ignored folders as one entry each ("node_modules/"), not their thousands of files.
        let ign = run(&rootp, &["-c", "core.quotepath=off", "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory"]).await.unwrap_or_default();
        files.extend(split_z(&ign));
    }
    let truncated = files.len() > MAX_FILES;
    files.truncate(MAX_FILES);
    let mut status = HashMap::new();
    let st = run(&rootp, &["-c", "core.quotepath=off", "status", "--porcelain=v1", "-z", "--untracked-files=all"]).await.unwrap_or_default();
    let mut it = split_z(&st);
    while let Some(entry) = it.next() {
        if entry.len() < 4 {
            continue;
        }
        let (code, path) = entry.split_at(3);
        let code = code.trim();
        let letter = if code == "??" { "?" } else if code.contains('D') { "D" } else if code.contains('A') { "A" } else if code.contains('R') { "R" } else { "M" };
        // A rename is followed by its old path: skip it.
        if code.contains('R') || code.contains('C') {
            it.next();
        }
        status.insert(path.to_string(), letter.to_string());
        // A deleted file is still worth showing in the tree.
        if letter == "D" && !files.iter().any(|f| f == path) {
            files.push(path.to_string());
        }
    }
    remember_root(&root);
    Ok(FileList { root, git: true, files, status, truncated })
}

fn full_path(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let full = base.join(rel);
    let meta = std::fs::symlink_metadata(&full).map_err(|_| "fichier introuvable".to_string())?;
    if meta.file_type().is_symlink() {
        return Err("lien symbolique : non ouvert".into());
    }
    let real = std::fs::canonicalize(&full).map_err(|e| e.to_string())?;
    if !real.starts_with(&base) {
        return Err("chemin hors du projet".into());
    }
    Ok(real)
}

/// An image of the project as a data URL (8 MB max). Off the main thread.
#[tauri::command(async)]
pub fn file_image(root: String, path: String) -> Result<String, String> {
    let real = full_path(&root, &path)?;
    let ext = real.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        _ => return Err("format d’image non pris en charge".into()),
    };
    let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
    if meta.len() > 8 * 1024 * 1024 {
        return Err(format!("image trop grosse pour l’aperçu ({} Mo)", meta.len() / 1024 / 1024));
    }
    let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[derive(Serialize)]
pub struct Resolved {
    pub root: String,
    pub path: String,
}

/// "src/app.ts" cited in a terminal, relative to the pane's folder: the project and
/// the path inside it, if the file exists there.
#[tauri::command]
pub async fn files_resolve(cwd: String, path: String) -> Result<Resolved, String> {
    let dir = std::fs::canonicalize(&cwd).map_err(|_| "dossier introuvable".to_string())?;
    let p = Path::new(&path);
    let candidate = if p.is_absolute() { p.to_path_buf() } else { dir.join(p) };
    let real = std::fs::canonicalize(&candidate).map_err(|_| format!("{path} introuvable depuis {}", dir.display()))?;
    if !real.is_file() {
        return Err(format!("{path} n’est pas un fichier"));
    }
    let top = run(&dir, &["rev-parse", "--show-toplevel"]).await.map(|b| String::from_utf8_lossy(&b).trim().to_string()).filter(|t| !t.is_empty());
    let root = PathBuf::from(top.unwrap_or_else(|| dir.display().to_string()));
    let root = std::fs::canonicalize(&root).unwrap_or(root);
    acceptable_root(&root)?;
    used_by_a_pane(&root).await?;
    let rel = real.strip_prefix(&root).map_err(|_| "fichier hors du projet".to_string())?;
    let root_s = root.display().to_string();
    remember_root(&root_s);
    Ok(Resolved { root: root_s, path: rel.to_string_lossy().replace('\\', "/") })
}

/// Opens the file in VS Code (or the default app when VS Code is not installed).
#[tauri::command(async)]
pub fn file_open_external(root: String, path: String) -> Result<(), String> {
    let real = full_path(&root, &path)?;
    let vscode = std::process::Command::new("open").arg("-a").arg("Visual Studio Code").arg(&real).status();
    if matches!(vscode, Ok(s) if s.success()) {
        return Ok(());
    }
    std::process::Command::new("open").arg(&real).status().map_err(|e| e.to_string()).and_then(|s| if s.success() { Ok(()) } else { Err("ouverture impossible".into()) })
}

/// Absolute path of a project file (for "Voir dans le Finder" / "Copier le chemin").
#[tauri::command]
pub fn file_full_path(root: String, path: String) -> Result<String, String> {
    full_path(&root, &path).map(|p| p.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_home_and_root() {
        let home = dirs::home_dir().unwrap();
        assert!(acceptable_root(&home).is_err());
        assert!(acceptable_root(Path::new("/")).is_err());
        assert!(acceptable_root(&home.join("Projects/x")).is_ok());
    }
}
