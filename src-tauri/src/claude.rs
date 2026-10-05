//! Plugs Herdr Desk into Claude Code's status line, without losing the user's own.
//!
//! Claude Code gives its status line command the context window and the account
//! rate limits on stdin. Our script (embedded below) reports them to Herdr as pane
//! tokens, then hands the same input to the user's previous status line command,
//! so what Claude Code displays does not change.

use serde::Serialize;
use serde_json::{json, Map, Value};
use std::path::PathBuf;

const SCRIPT: &str = include_str!("../../scripts/claude-statusline.sh");

fn claude_dir() -> PathBuf {
    if let Ok(d) = std::env::var("CLAUDE_CONFIG_DIR") {
        if !d.is_empty() {
            return PathBuf::from(d);
        }
    }
    dirs::home_dir().unwrap_or_default().join(".claude")
}

fn desk_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".config").join("herdr-desk")
}

fn settings_path() -> PathBuf {
    claude_dir().join("settings.json")
}

fn script_path() -> PathBuf {
    desk_dir().join("claude-statusline.sh")
}

fn next_path() -> PathBuf {
    desk_dir().join("claude-statusline-next")
}

fn hidden_path() -> PathBuf {
    desk_dir().join("claude-statusline-hidden")
}

#[derive(Serialize)]
pub struct StatuslineState {
    pub installed: bool,
    pub settings_path: String,
    /// The user's own status line, kept for display.
    pub chained: Option<String>,
    /// Nothing is printed in the terminal; the numbers only go to the app.
    pub hidden: bool,
}

fn read_settings() -> Result<Map<String, Value>, String> {
    match std::fs::read_to_string(settings_path()) {
        Ok(text) if !text.trim().is_empty() => match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(m)) => Ok(m),
            Ok(_) => Err("settings.json n’est pas un objet JSON".into()),
            Err(e) => Err(format!("settings.json illisible : {e}")),
        },
        _ => Ok(Map::new()),
    }
}

fn write_settings(m: &Map<String, Value>) -> Result<(), String> {
    let path = settings_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut text = serde_json::to_string_pretty(&Value::Object(m.clone())).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| format!("écriture de {} impossible : {e}", path.display()))
}

fn current_command(m: &Map<String, Value>) -> Option<String> {
    m.get("statusLine")?.get("command")?.as_str().map(String::from)
}

fn is_ours(cmd: &str) -> bool {
    cmd.contains("herdr-desk/claude-statusline.sh") || cmd.contains("HerdrDesk/scripts/claude-statusline.sh")
}

#[tauri::command]
pub fn claude_statusline_state() -> Result<StatuslineState, String> {
    let m = read_settings()?;
    let installed = current_command(&m).map(|c| is_ours(&c)).unwrap_or(false);
    // Keep the installed copy in step with this version of the app.
    if installed && std::fs::read_to_string(script_path()).ok().as_deref() != Some(SCRIPT) {
        let _ = std::fs::write(script_path(), SCRIPT);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(script_path(), std::fs::Permissions::from_mode(0o755));
        }
    }
    let chained = std::fs::read_to_string(next_path()).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    Ok(StatuslineState {
        installed,
        settings_path: settings_path().display().to_string(),
        chained,
        hidden: hidden_path().exists(),
    })
}

#[tauri::command]
pub fn claude_statusline_install() -> Result<StatuslineState, String> {
    let mut m = read_settings()?;
    std::fs::create_dir_all(desk_dir()).map_err(|e| e.to_string())?;

    // Always (re)write the script so updates of Herdr Desk reach it.
    std::fs::write(script_path(), SCRIPT).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(script_path(), std::fs::Permissions::from_mode(0o755));
    }

    match current_command(&m) {
        Some(cmd) if is_ours(&cmd) => {} // already installed: keep the saved chain as is
        Some(cmd) => {
            std::fs::write(next_path(), format!("{cmd}\n")).map_err(|e| e.to_string())?;
        }
        None => {
            let _ = std::fs::remove_file(next_path());
        }
    }

    // Backup once, before the first change.
    let backup = claude_dir().join("settings.json.herdr-desk-backup");
    if settings_path().exists() && !backup.exists() {
        let _ = std::fs::copy(settings_path(), &backup);
    }

    let mut line = match m.get("statusLine") {
        Some(Value::Object(o)) => o.clone(),
        _ => Map::new(),
    };
    line.insert("type".into(), json!("command"));
    line.insert("command".into(), json!(script_path().display().to_string()));
    m.insert("statusLine".into(), Value::Object(line));
    write_settings(&m)?;
    claude_statusline_state()
}

/// `remoteControlAtStartup` in the user settings: true / false, or absent (default).
#[tauri::command]
pub fn claude_rc_startup() -> Result<Option<bool>, String> {
    Ok(read_settings()?.get("remoteControlAtStartup").and_then(Value::as_bool))
}

#[tauri::command]
pub fn claude_set_rc_startup(enabled: bool) -> Result<Option<bool>, String> {
    let mut m = read_settings()?;
    let backup = claude_dir().join("settings.json.herdr-desk-backup");
    if settings_path().exists() && !backup.exists() {
        let _ = std::fs::copy(settings_path(), &backup);
    }
    if enabled {
        m.insert("remoteControlAtStartup".into(), json!(true));
    } else {
        // Back to Claude Code's default rather than forcing "false".
        m.remove("remoteControlAtStartup");
    }
    write_settings(&m)?;
    claude_rc_startup()
}

/// Hides (or shows again) the status line row in Claude Code; reporting continues.
#[tauri::command]
pub fn claude_statusline_set_hidden(hidden: bool) -> Result<StatuslineState, String> {
    std::fs::create_dir_all(desk_dir()).map_err(|e| e.to_string())?;
    if hidden {
        std::fs::write(hidden_path(), "1\n").map_err(|e| e.to_string())?;
    } else {
        let _ = std::fs::remove_file(hidden_path());
    }
    claude_statusline_state()
}

/// Puts the user's own status line back (or removes ours if there was none).
#[tauri::command]
pub fn claude_statusline_uninstall() -> Result<StatuslineState, String> {
    let mut m = read_settings()?;
    let chained = std::fs::read_to_string(next_path()).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    match chained {
        Some(cmd) => {
            if let Some(Value::Object(line)) = m.get_mut("statusLine") {
                line.insert("command".into(), json!(cmd));
            }
        }
        None => {
            m.remove("statusLine");
        }
    }
    write_settings(&m)?;
    let _ = std::fs::remove_file(next_path());
    let _ = std::fs::remove_file(hidden_path());
    claude_statusline_state()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_chains_and_uninstall_restores() {
        let home = std::env::temp_dir().join(format!("hd-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join(".claude")).unwrap();
        std::env::set_var("HOME", &home);
        std::env::remove_var("CLAUDE_CONFIG_DIR");
        std::fs::write(
            home.join(".claude/settings.json"),
            r#"{"model":"opus","statusLine":{"type":"command","command":"~/.claude/mine.sh","padding":1}}"#,
        )
        .unwrap();

        let st = claude_statusline_install().unwrap();
        assert!(st.installed);
        assert_eq!(st.chained.as_deref(), Some("~/.claude/mine.sh"));
        let m = read_settings().unwrap();
        assert_eq!(m["statusLine"]["padding"], 1);
        assert_eq!(m.keys().next().unwrap(), "model"); // order preserved
        assert!(script_path().exists());

        // Installing twice keeps the original chain.
        let st = claude_statusline_install().unwrap();
        assert_eq!(st.chained.as_deref(), Some("~/.claude/mine.sh"));

        let st = claude_statusline_uninstall().unwrap();
        assert!(!st.installed);
        assert_eq!(read_settings().unwrap()["statusLine"]["command"], "~/.claude/mine.sh");
        let _ = std::fs::remove_dir_all(&home);
    }
}

// ---- Slash commands -------------------------------------------------------

/// Built-in Claude Code commands, recognized in the agent's output.
const BUILTIN_COMMANDS: &[&str] = &[
    "add-dir", "agents", "bashes", "bug", "clear", "compact", "config", "context", "cost", "doctor",
    "export", "help", "hooks", "ide", "init", "install-github-app", "login", "logout", "mcp", "memory",
    "model", "output-style", "permissions", "plugin", "pr-comments", "privacy-settings", "release-notes",
    "remote-control", "resume", "review", "rewind", "sandbox", "security-review", "status", "statusline",
    "terminal-setup", "todos", "upgrade", "usage", "vim",
];

/// `commands/**/*.md` → "name" or "sub:name"; `skills/<name>/SKILL.md` → "name".
fn collect(dir: &std::path::Path, out: &mut Vec<String>, prefix: Option<&str>) {
    fn walk(base: &std::path::Path, dir: &std::path::Path, out: &mut Vec<String>, prefix: Option<&str>, depth: u8) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() && depth < 4 {
                walk(base, &p, out, prefix, depth + 1);
            } else if p.extension().is_some_and(|x| x == "md") {
                let rel = p.strip_prefix(base).unwrap_or(&p).with_extension("");
                let name = rel.to_string_lossy().replace(['/', '\\'], ":");
                push(out, prefix, name);
            }
        }
    }
    fn push(out: &mut Vec<String>, prefix: Option<&str>, name: String) {
        if let Some(pre) = prefix {
            out.push(format!("{pre}:{name}"));
        }
        out.push(name);
    }
    walk(&dir.join("commands"), &dir.join("commands"), out, prefix, 0);
    if let Ok(entries) = std::fs::read_dir(dir.join("skills")) {
        for e in entries.flatten() {
            if e.path().join("SKILL.md").exists() {
                push(out, prefix, e.file_name().to_string_lossy().into_owned());
            }
        }
    }
}

/// Plugins: any folder holding `.claude-plugin/` under ~/.claude/plugins.
fn collect_plugins(dir: &std::path::Path, out: &mut Vec<String>, depth: u8) {
    if dir.join(".claude-plugin").is_dir() {
        let name = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        collect(dir, out, Some(&name));
        return;
    }
    if depth >= 5 {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() && !e.file_name().to_string_lossy().starts_with('.') {
                collect_plugins(&p, out, depth + 1);
            }
        }
    }
}

/// The slash commands Claude Code knows in this folder: built-ins, user and
/// project commands and skills, plugins. Lets the terminal offer "run /fin-tache"
/// only for real commands, not for paths like /tmp.
#[tauri::command]
pub fn claude_commands(cwd: Option<String>) -> Vec<String> {
    let mut out: Vec<String> = BUILTIN_COMMANDS.iter().map(|s| s.to_string()).collect();
    let home = dirs::home_dir().unwrap_or_default();
    collect(&claude_dir(), &mut out, None);
    collect_plugins(&claude_dir().join("plugins"), &mut out, 0);
    if let Some(cwd) = cwd {
        let mut dir = Some(std::path::Path::new(&cwd));
        while let Some(d) = dir {
            if d == home {
                break;
            }
            collect(&d.join(".claude"), &mut out, None);
            dir = d.parent();
        }
    }
    out.sort();
    out.dedup();
    out
}
