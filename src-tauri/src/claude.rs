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
