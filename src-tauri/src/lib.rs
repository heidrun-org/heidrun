mod claude;
mod files;
mod git;
mod history;
mod herdr;
mod mobile;
mod project;
mod pty;
mod usage;

use serde_json::{json, Value};
use tauri::menu::{Menu, MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, State};

/// Generic socket call: the frontend passes the raw method and params.
#[tauri::command]
async fn herdr_request(method: String, params: Option<Value>) -> Result<Value, String> {
    herdr::request(&method, params.unwrap_or_else(|| json!({}))).await
}

/// Runs the herdr CLI (used for `pane run`, which handles bracketed paste for us).
#[tauri::command]
async fn herdr_cli(args: Vec<String>) -> Result<String, String> {
    let out = tokio::process::Command::new(herdr::herdr_bin())
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("herdr_cli_failed: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[tauri::command]
fn herdr_watch_panes(app: AppHandle, watcher: State<'_, herdr::StatusWatcher>, pane_ids: Vec<String>) {
    watcher.watch(app, pane_ids);
}

/// Starts the Herdr server in the background, without any terminal window.
/// It goes through the login shell so panes get the same PATH as in Terminal
/// (an app opened from the Finder only has a minimal one).
#[tauri::command]
async fn herdr_server_start() -> Result<String, String> {
    if herdr::request("ping", json!({})).await.is_ok() {
        return Ok("already_running".into());
    }
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let bin = herdr::herdr_bin();
    let mut cmd = std::process::Command::new(shell);
    cmd.arg("-lc")
        .arg(format!("exec '{}' server", bin.display().to_string().replace('\'', "'\\''")))
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    if let Some(home) = dirs::home_dir() {
        cmd.current_dir(home);
    }
    #[cfg(unix)]
    {
        // Own process group: the server outlives Herdr Desk, like `herdr` does.
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.spawn().map_err(|e| format!("herdr_start_failed: {e}"))?;
    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if herdr::request("ping", json!({})).await.is_ok() {
            return Ok("started".into());
        }
    }
    Err("herdr_start_timeout: le serveur Herdr n’a pas répondu en 5 s".into())
}

#[tauri::command]
fn herdr_paths() -> Value {
    let socket = herdr::socket_path();
    let bin = herdr::herdr_bin();
    json!({
        "socket": socket.display().to_string(),
        "socket_exists": socket.exists(),
        "bin": bin.display().to_string(),
        "bin_exists": bin.exists(),
    })
}

/// Custom menu: the default macOS menu binds ⌘W to "Close Window", which would
/// close the app instead of reaching our "close pane" shortcut.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let app_menu = SubmenuBuilder::new(app, "Herdr Desk")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let edit = SubmenuBuilder::new(app, "Édition")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, "Fenêtre")
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .build()?;
    MenuBuilder::new(app).items(&[&app_menu, &edit, &window]).build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(pty::PtyState::default())
        .manage(herdr::StatusWatcher::default())
        .manage(mobile::MobileState::default())
        .setup(|app| {
            app.set_menu(build_menu(app.handle())?)?;
            herdr::spawn_event_loop(app.handle().clone());
            mobile::start_if_enabled(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            herdr_request,
            herdr_cli,
            herdr_watch_panes,
            herdr_paths,
            herdr_server_start,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            usage::codex_usage,
            project::project_load,
            project::project_save,
            project::project_refs,
            git::git_status,
            git::forge_cli,
            git::forge_merge,
            git::git_diff,
            git::git_file,
            claude::claude_statusline_state,
            claude::claude_statusline_install,
            claude::claude_statusline_uninstall,
            claude::claude_statusline_set_hidden,
            claude::claude_rc_startup,
            claude::claude_set_rc_startup,
            claude::claude_commands,
            claude::claude_agents,
            claude::claude_session_agents,
            history::history_append,
            history::history_read,
            history::history_export,
            files::files_list,
            files::files_resolve,
            files::file_image,
            files::file_open_external,
            files::file_full_path,
            mobile::mobile_reply,
            mobile::mobile_status,
            mobile::mobile_enable,
            mobile::mobile_disable,
            mobile::mobile_revoke,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Herdr Desk");
}
