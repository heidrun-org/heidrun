mod herdr;
mod pty;
mod usage;

use serde_json::{json, Value};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(pty::PtyState::default())
        .manage(herdr::StatusWatcher::default())
        .setup(|app| {
            herdr::spawn_event_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            herdr_request,
            herdr_cli,
            herdr_watch_panes,
            herdr_paths,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            usage::codex_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Herdr Desk");
}
