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

// ---- Editing -------------------------------------------------------------------------

const MAX_EDIT: u64 = 5 * 1024 * 1024;

/// Content fingerprint: a same-size write within the same second is still seen
/// (timestamps alone miss it on some file systems).
fn fingerprint(bytes: &[u8]) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut h);
    format!("{:016x}-{}", h.finish(), bytes.len())
}

#[derive(Serialize, Debug)]
pub struct FileText {
    pub text: String,
    /// Fingerprint when read: a save checks the file is still the same.
    pub hash: String,
}

#[derive(Serialize, Debug)]
pub struct FileStamp {
    /// None: the file is gone (deleted on the disk).
    pub hash: Option<String>,
}

/// Never inside .git (hooks, config): editing those is not what the explorer is for.
fn not_in_git_dir(path: &str) -> Result<(), String> {
    if Path::new(path).components().any(|c| c.as_os_str() == ".git") {
        return Err("fichier interne de git : non modifiable ici".into());
    }
    Ok(())
}

/// A text file to edit, with its fingerprint.
#[tauri::command(async)]
pub fn file_read(root: String, path: String) -> Result<FileText, String> {
    let real = full_path(&root, &path)?;
    let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
    if meta.len() > MAX_EDIT {
        return Err(format!("fichier trop gros pour l’édition ({} Ko)", meta.len() / 1024));
    }
    let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return Err("fichier binaire : non modifiable".into());
    }
    let hash = fingerprint(&bytes);
    let text = String::from_utf8(bytes).map_err(|_| "fichier qui n’est pas en UTF-8 : non modifiable ici (risque d’abîmer les accents)".to_string())?;
    Ok(FileText { text, hash })
}

/// Fingerprint of a file now, to see whether someone (an agent) changed it.
#[tauri::command(async)]
pub fn file_stat(root: String, path: String) -> Result<FileStamp, String> {
    known_root(&root)?;
    let rel = safe_rel(&path)?;
    let base = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
    if std::fs::symlink_metadata(base.join(rel)).is_err() {
        return Ok(FileStamp { hash: None });
    }
    let real = full_path(&root, &path)?;
    let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
    Ok(FileStamp { hash: Some(fingerprint(&bytes)) })
}

static TMP_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Saves a file of the project. Refused when the file on the disk is not the one
/// the editor started from (`expected`: its fingerprint, or None when it was gone),
/// never in .git, never through a symlink, never a read-only file. Written next to
/// it then renamed (a crash never leaves half a file), permissions kept; a file
/// with several hard links is written in place so they stay linked.
#[tauri::command(async)]
pub fn file_write(root: String, path: String, content: String, expected: Option<String>) -> Result<FileStamp, String> {
    not_in_git_dir(&path)?;
    known_root(&root)?;
    let rel = safe_rel(&path)?;
    if content.len() as u64 > MAX_EDIT {
        return Err("contenu trop gros".into());
    }
    let base = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
    let target = base.join(rel);
    let exists = std::fs::symlink_metadata(&target).is_ok();
    let real = if exists {
        full_path(&root, &path)?
    } else {
        // Deleted meanwhile, and the user chose to write it back: its folder must
        // still be inside the project.
        let parent = target.parent().ok_or("dossier introuvable")?;
        let parent = std::fs::canonicalize(parent).map_err(|_| "le dossier du fichier n’existe plus".to_string())?;
        if !parent.starts_with(&base) {
            return Err("chemin hors du projet".into());
        }
        parent.join(target.file_name().ok_or("nom invalide")?)
    };
    let current = if exists { Some(fingerprint(&std::fs::read(&real).map_err(|e| e.to_string())?)) } else { None };
    if current != expected {
        return Err("changed_on_disk".into());
    }
    let bytes = content.as_bytes();
    if exists {
        let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
        if !meta.is_file() {
            return Err("ce n’est pas un fichier".into());
        }
        if meta.permissions().readonly() {
            return Err("fichier en lecture seule : non modifié".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if meta.nlink() > 1 {
                std::fs::write(&real, bytes).map_err(|e| format!("écriture impossible : {e}"))?;
                return Ok(FileStamp { hash: Some(fingerprint(bytes)) });
            }
        }
        let dir = real.parent().ok_or("dossier introuvable")?;
        let name = real.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let n = TMP_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let tmp = dir.join(format!(".{name}.heidrun-{}-{n}", std::process::id()));
        {
            use std::io::Write;
            let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e| format!("écriture impossible : {e}"))?;
            f.write_all(bytes).map_err(|e| format!("écriture impossible : {e}"))?;
            f.sync_all().ok();
        }
        let _ = std::fs::set_permissions(&tmp, meta.permissions());
        if let Err(e) = std::fs::rename(&tmp, &real) {
            let _ = std::fs::remove_file(&tmp);
            return Err(format!("enregistrement impossible : {e}"));
        }
    } else {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&real).map_err(|e| format!("écriture impossible : {e}"))?;
        f.write_all(bytes).map_err(|e| format!("écriture impossible : {e}"))?;
    }
    Ok(FileStamp { hash: Some(fingerprint(bytes)) })
}

// ---- Search, create, rename, delete ------------------------------------------------

#[derive(Serialize, Debug)]
pub struct GrepHit {
    pub path: String,
    pub line: u32,
    pub text: String,
}

#[derive(Serialize, Debug)]
pub struct GrepResult {
    pub hits: Vec<GrepHit>,
    pub truncated: bool,
}

const MAX_HITS: usize = 2000;

/// `path\0line\0text` (git grep -z) or `path\0line:text` (grep --null) lines → hits.
/// The NUL after the path keeps names containing ':' intact.
fn parse_grep(out: &str, strip: Option<&str>) -> GrepResult {
    let mut hits = Vec::new();
    let mut truncated = false;
    for l in out.split('\n') {
        let Some((p, rest)) = l.split_once('\0') else { continue };
        let Some((n, t)) = rest.split_once('\0').or_else(|| rest.split_once(':')) else { continue };
        let Ok(line) = n.parse::<u32>() else { continue };
        if hits.len() >= MAX_HITS {
            truncated = true;
            break;
        }
        let path = strip.and_then(|s| p.strip_prefix(s)).unwrap_or(p).trim_start_matches("./").to_string();
        let text: String = t.trim_end_matches('\r').chars().take(300).collect();
        hits.push(GrepHit { path, line, text });
    }
    GrepResult { hits, truncated }
}

/// Text (or regular expression) in the project's files: git grep (fast, .gitignore
/// respected, untracked files included), or grep -r outside git. Binary files skipped.
#[tauri::command]
pub async fn files_grep(root: String, query: String, regex: Option<bool>, case: Option<bool>) -> Result<GrepResult, String> {
    known_root(&root)?;
    if query.trim().is_empty() {
        return Ok(GrepResult { hits: vec![], truncated: false });
    }
    if query.len() > 500 {
        return Err("recherche trop longue".into());
    }
    let regex = regex.unwrap_or(false);
    let case = case.unwrap_or(false);
    let is_git = run(Path::new(&root), &["rev-parse", "--is-inside-work-tree"]).await.is_some();
    let mut cmd = if is_git {
        let mut c = Command::new("git");
        c.arg("-C").arg(&root).args(["-c", "core.quotepath=off", "grep", "-z", "-n", "-I", "--no-color", "--untracked", "--max-count", "200"]);
        c
    } else {
        let mut c = Command::new("grep");
        // --null (GNU and BSD grep): NUL after the name. -s: unreadable files skipped.
        c.current_dir(&root).args(["-rnIs", "--null", "--color=never", "-m", "200"]);
        for d in HEAVY {
            c.arg(format!("--exclude-dir={d}"));
        }
        c
    };
    cmd.arg(if regex { "-E" } else { "-F" });
    if !case {
        cmd.arg("-i");
    }
    // "-e": a query starting with "-" is a pattern, not an option.
    cmd.arg("-e").arg(&query);
    if !is_git {
        cmd.arg(".");
    }
    cmd.kill_on_drop(true);
    let out = tokio::time::timeout(Duration::from_secs(15), cmd.output())
        .await
        .map_err(|_| "recherche trop longue (plus de 15 s) : précise-la".to_string())?
        .map_err(|e| e.to_string())?;
    // Exit 1: nothing found. 2: bad pattern (or, for grep -r, an unreadable file:
    // the hits found are still good).
    let partial = !is_git && out.status.code() == Some(2) && !out.stdout.is_empty();
    if !partial && !out.status.success() && out.status.code() != Some(1) {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("recherche impossible : {}", err.lines().next().unwrap_or("expression invalide")));
    }
    Ok(parse_grep(&String::from_utf8_lossy(&out.stdout), None))
}

/// The parent folder of `path`, inside the project (created paths do not exist yet).
fn new_target(root: &str, path: &str) -> Result<PathBuf, String> {
    known_root(root)?;
    let rel = safe_rel(path)?;
    not_in_git_dir(rel)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    let target = base.join(rel);
    let name = target.file_name().ok_or("nom invalide")?.to_string_lossy().into_owned();
    if name.is_empty() || name == "." || name.contains('\0') {
        return Err("nom invalide".into());
    }
    let parent = std::fs::canonicalize(target.parent().ok_or("dossier introuvable")?).map_err(|_| "le dossier n’existe pas".to_string())?;
    if !parent.starts_with(&base) {
        return Err("chemin hors du projet".into());
    }
    // The real folder too: a symlink "x -> .git/hooks" must not lead into .git.
    not_in_git_dir(&parent.strip_prefix(&base).map_err(|e| e.to_string())?.to_string_lossy())?;
    Ok(parent.join(name))
}

fn taken(p: &Path) -> Result<(), String> {
    if std::fs::symlink_metadata(p).is_ok() {
        return Err("un fichier ou dossier porte déjà ce nom".into());
    }
    Ok(())
}

/// New empty file, or folder.
#[tauri::command(async)]
pub fn file_create(root: String, path: String, dir: bool) -> Result<(), String> {
    let target = new_target(&root, &path)?;
    taken(&target)?;
    if dir {
        std::fs::create_dir(&target).map_err(|e| e.to_string())
    } else {
        std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map(|_| ()).map_err(|e| e.to_string())
    }
}

/// Existing file or folder of the project (not a symlink, not .git, not the root).
fn existing(root: &str, path: &str) -> Result<PathBuf, String> {
    not_in_git_dir(path)?;
    let real = full_path(root, path)?;
    let base = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
    if real == base {
        return Err("c’est le dossier du projet".into());
    }
    Ok(real)
}

/// Rename or move inside the project. Never over an existing name.
#[tauri::command(async)]
pub fn file_rename(root: String, from: String, to: String) -> Result<(), String> {
    let src = existing(&root, &from)?;
    let dst = new_target(&root, &to)?;
    if dst == src {
        return Ok(());
    }
    if same_file(&src, &dst) {
        // Case-only rename on a case-insensitive disk (APFS): Foo.ts → foo.ts
        // "exists" already. Go through a temporary name.
        let tmp = src.with_file_name(format!(".hd-rename-{}", std::process::id()));
        taken(&tmp)?;
        std::fs::rename(&src, &tmp).map_err(|e| e.to_string())?;
        return std::fs::rename(&tmp, &dst).map_err(|e| {
            let _ = std::fs::rename(&tmp, &src);
            e.to_string()
        });
    }
    taken(&dst)?;
    if dst.starts_with(&src) {
        return Err("un dossier ne peut pas aller dans lui-même".into());
    }
    std::fs::rename(&src, &dst).map_err(|e| e.to_string())
}

#[cfg(unix)]
fn same_file(a: &Path, b: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    match (std::fs::symlink_metadata(a), std::fs::symlink_metadata(b)) {
        (Ok(x), Ok(y)) => x.dev() == y.dev() && x.ino() == y.ino(),
        _ => false,
    }
}

#[cfg(not(unix))]
fn same_file(_: &Path, _: &Path) -> bool {
    false
}

/// To the macOS Trash (recoverable), never a permanent delete.
#[tauri::command(async)]
pub fn file_trash(root: String, path: String) -> Result<(), String> {
    let real = existing(&root, &path)?;
    #[allow(unused_mut)]
    let mut ctx = trash::TrashContext::default();
    // NSFileManager: no Finder automation prompt (the Finder method would ask
    // for permission to control the Finder the first time).
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        ctx.set_delete_method(DeleteMethod::NsFileManager);
    }
    ctx.delete(&real).map_err(|e| format!("mise à la Corbeille impossible : {e}"))
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
        assert!(acceptable_root(&home.join(".ssh")).is_err());
        assert!(acceptable_root(Path::new("/etc/x")).is_err());
        assert!(not_in_git_dir(".git/config").is_err());
        assert!(not_in_git_dir("a/.git/hooks/x").is_err());
        assert!(not_in_git_dir("src/.gitignore").is_ok());
    }

    #[test]
    fn writes_atomically_and_detects_changes() {
        let dir = std::env::temp_dir().join(format!("hd-files-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/a.txt"), "un\n").unwrap();
        let root = std::fs::canonicalize(&dir).unwrap().display().to_string();
        remember_root(&root);
        let t = file_read(root.clone(), "src/a.txt".into()).unwrap();
        assert_eq!(t.text, "un\n");
        let st = file_write(root.clone(), "src/a.txt".into(), "deux\n".into(), Some(t.hash.clone())).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("src/a.txt")).unwrap(), "deux\n");
        // Same size, right away: still seen through the fingerprint.
        std::fs::write(dir.join("src/a.txt"), "DEUX\n").unwrap();
        assert_eq!(file_write(root.clone(), "src/a.txt".into(), "moi\n".into(), st.hash.clone()).unwrap_err(), "changed_on_disk");
        // Deleted meanwhile: written back only when the editor knew it was gone.
        std::fs::remove_file(dir.join("src/a.txt")).unwrap();
        assert_eq!(file_stat(root.clone(), "src/a.txt".into()).unwrap().hash, None);
        assert!(file_write(root.clone(), "src/a.txt".into(), "x\n".into(), st.hash.clone()).is_err());
        file_write(root.clone(), "src/a.txt".into(), "x\n".into(), None).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("src/a.txt")).unwrap(), "x\n");
        assert!(file_write(root.clone(), "../x".into(), "".into(), None).is_err());
        assert!(file_write(root.clone(), ".git/config".into(), "".into(), None).is_err());
        assert_eq!(std::fs::read_dir(dir.join("src")).unwrap().count(), 1, "no temp file left");

        // Create, rename, refuse escapes and overwrites.
        file_create(root.clone(), "src/b.txt".into(), false).unwrap();
        file_create(root.clone(), "src/sub".into(), true).unwrap();
        assert!(file_create(root.clone(), "src/b.txt".into(), false).is_err());
        assert!(file_create(root.clone(), "../evil".into(), false).is_err());
        assert!(file_create(root.clone(), "nope/x.txt".into(), false).is_err());
        assert!(file_create(root.clone(), ".git/x".into(), false).is_err());
        file_rename(root.clone(), "src/b.txt".into(), "src/sub/c.txt".into()).unwrap();
        assert!(dir.join("src/sub/c.txt").exists());
        assert!(file_rename(root.clone(), "src/a.txt".into(), "src/sub/c.txt".into()).is_err());
        assert!(file_rename(root.clone(), "src".into(), "src/sub/src".into()).is_err());
        // A symlink to .git does not open a way in.
        std::fs::create_dir_all(dir.join(".git/hooks")).unwrap();
        std::os::unix::fs::symlink(dir.join(".git/hooks"), dir.join("hk")).unwrap();
        assert!(file_create(root.clone(), "hk/pre-commit".into(), false).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn parses_grep_output() {
        let r = parse_grep("src/a.ts\012\0const x = 1;\n./b.md\03:a:b:c\nd:1:e.txt\05\0x\nbad line\n", None);
        assert_eq!(r.hits.len(), 3);
        assert_eq!((r.hits[0].path.as_str(), r.hits[0].line, r.hits[0].text.as_str()), ("src/a.ts", 12, "const x = 1;"));
        assert_eq!((r.hits[1].path.as_str(), r.hits[1].text.as_str()), ("b.md", "a:b:c"));
        assert_eq!((r.hits[2].path.as_str(), r.hits[2].line), ("d:1:e.txt", 5));
    }
}
