mod claude;
mod clipboard;
mod files;
mod git;
mod history;
mod legacy;
mod herdr;
mod mobile;
mod project;
mod pty;
mod skills;
mod usage;

/// Tests that read or change the environment variable `HOME` take this lock, because the variable belongs to the whole process.
#[cfg(test)]
pub(crate) static HOME_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

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
        // Own process group: the server outlives Heidrun, like `herdr` does.
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

/// True when the first preferred language of the Mac is French.
fn is_system_language_french() -> bool {
    let output = std::process::Command::new("defaults").args(["read", "-g", "AppleLanguages"]).output();
    let Ok(output) = output else {
        return false;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let first_language = text.lines().find(|line| line.contains('"') || line.trim().starts_with(|c: char| c.is_alphabetic()));
    match first_language {
        Some(line) => line.trim().trim_start_matches('"').starts_with("fr"),
        None => false,
    }
}

/// Custom menu: the default macOS menu binds ⌘W to "Close Window", which would
/// close the app instead of reaching our "close pane" shortcut.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let is_french = is_system_language_french();
    let about_label = if is_french { "À propos de Heidrun" } else { "About Heidrun" };
    let quit_label = if is_french { "Quitter Heidrun" } else { "Quit Heidrun" };
    let edit_label = if is_french { "Édition" } else { "Edit" };
    let window_label = if is_french { "Fenêtre" } else { "Window" };
    let app_menu = SubmenuBuilder::new(app, "Heidrun")
        // Our own item: the About window is drawn by the web frontend, with an image.
        .item(&tauri::menu::MenuItemBuilder::with_id("hd-about", about_label).build(app)?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        // Our own item: with unsaved files, ⌘Q shows them instead of quitting.
        .item(&tauri::menu::MenuItemBuilder::with_id("hd-quit", quit_label).accelerator("CmdOrCtrl+Q").build(app)?)
        .build()?;
    let edit = SubmenuBuilder::new(app, edit_label)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, window_label)
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .build()?;
    MenuBuilder::new(app).items(&[&app_menu, &edit, &window]).build()
}

/// Files edited and not saved: quitting or closing the window asks first.
static UNSAVED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn set_unsaved(on: bool) {
    UNSAVED.store(on, std::sync::atomic::Ordering::Relaxed);
}

/// "Quitter sans enregistrer": the user chose, the app leaves.
#[tauri::command]
fn quit_now(app: AppHandle) {
    UNSAVED.store(false, std::sync::atomic::Ordering::Relaxed);
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(pty::PtyState::default())
        .manage(herdr::StatusWatcher::default())
        .manage(mobile::MobileState::default())
        .setup(|app| {
            legacy::migrate_config_dir();
            claude::migrate_legacy();
            app.set_menu(build_menu(app.handle())?)?;
            herdr::spawn_event_loop(app.handle().clone());
            mobile::start_if_enabled(app.handle());
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "hd-about" {
                use tauri::Emitter;
                let _ = app.emit("show-about", ());
            }
            if event.id().as_ref() == "hd-quit" {
                if UNSAVED.load(std::sync::atomic::Ordering::Relaxed) {
                    use tauri::Emitter;
                    let _ = app.emit("quit-blocked", ());
                } else {
                    app.exit(0);
                }
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if UNSAVED.load(std::sync::atomic::Ordering::Relaxed) {
                    api.prevent_close();
                    use tauri::Emitter;
                    let _ = window.emit("quit-blocked", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_unsaved,
            quit_now,
            herdr_request,
            herdr_cli,
            herdr_watch_panes,
            herdr_paths,
            herdr_server_start,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            clipboard::clipboard_set_image,
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
            files::file_read,
            files::file_stat,
            files::file_write,
            files::files_grep,
            files::file_create,
            files::file_rename,
            files::file_trash,
            mobile::mobile_reply,
            mobile::mobile_status,
            mobile::mobile_enable,
            mobile::mobile_disable,
            mobile::mobile_revoke,
            skills::skills_list,
            skills::skills_read,
            skills::skills_delete,
            skills::skills_search,
            skills::skills_preview,
            skills::skills_install,
            skills::skills_link_agent,
        ])
        .build(tauri::generate_context!())
        .expect("error while running Heidrun")
        .run(|app, event| {
            // ⌘Q with unsaved files: the app stays and shows them.
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() && UNSAVED.load(std::sync::atomic::Ordering::Relaxed) {
                    api.prevent_exit();
                    use tauri::Emitter;
                    let _ = app.emit("quit-blocked", ());
                }
            }
        });
}
