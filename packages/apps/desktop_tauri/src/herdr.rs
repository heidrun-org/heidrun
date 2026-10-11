//! Client for the Herdr local socket API.
//!
//! Protocol: newline-delimited JSON over a Unix domain socket.
//! Request  `{"id","method","params"}` → response `{"id","result"}` or `{"id","error"}`.
//! `events.subscribe` keeps the connection open and pushes one event per line.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// Lifecycle events. They need no pane id, so one long-lived subscription covers them.
const LIFECYCLE_EVENTS: &[&str] = &[
    "workspace.created",
    "workspace.updated",
    "workspace.metadata_updated",
    "workspace.renamed",
    "workspace.moved",
    "workspace.reordered",
    "workspace.closed",
    "workspace.focused",
    "tab.created",
    "tab.closed",
    "tab.focused",
    "tab.renamed",
    "tab.moved",
    "pane.created",
    "pane.closed",
    "pane.updated",
    "pane.focused",
    "pane.moved",
    "pane.exited",
    "pane.agent_detected",
    "layout.updated",
];

/// Same resolution as Herdr: `$XDG_CONFIG_HOME/herdr`, else `~/.config/herdr`.
pub fn config_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("XDG_CONFIG_HOME") {
        if !dir.is_empty() {
            return PathBuf::from(dir).join("herdr");
        }
    }
    dirs::home_dir().unwrap_or_default().join(".config").join("herdr")
}

/// The name of the Herdr session that Heidrun uses, unless the environment variable `HERDR_SOCKET_PATH` or
/// `HERDR_SESSION` chooses another one. Heidrun never uses the default session: that session belongs to the terminal.
pub const HEIDRUN_SESSION: &str = "heidrun";

/// The value of an environment variable, or `None` when the variable is not set or is empty.
fn non_empty_variable(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| value.is_empty() == false)
}

/// True when the environment variable `HERDR_SOCKET_PATH` or `HERDR_SESSION` chooses the session. Every Herdr command
/// line that Heidrun runs reads the same variables, so Heidrun adds no `--session` argument in this case.
fn is_session_chosen_by_environment() -> bool {
    non_empty_variable("HERDR_SOCKET_PATH").is_some() || non_empty_variable("HERDR_SESSION").is_some()
}

/// The socket of the session that Heidrun uses: the path in `HERDR_SOCKET_PATH`, else the socket of the session named
/// in `HERDR_SESSION`, else the socket of the session `heidrun`.
pub fn socket_path() -> PathBuf {
    if let Some(path) = non_empty_variable("HERDR_SOCKET_PATH") {
        return PathBuf::from(path);
    }
    let name = non_empty_variable("HERDR_SESSION").unwrap_or_else(|| HEIDRUN_SESSION.to_string());
    config_dir().join("sessions").join(name).join("herdr.sock")
}

/// The arguments of a Herdr command line: `--session heidrun` first, then `arguments`. When the environment chooses the
/// session, the arguments are `arguments` alone.
pub fn command_arguments(arguments: &[&str]) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    if is_session_chosen_by_environment() == false {
        result.push("--session".to_string());
        result.push(HEIDRUN_SESSION.to_string());
    }
    result.extend(arguments.iter().map(|argument| argument.to_string()));
    result
}

/// Like `command_arguments`, for the arguments that the web page sends.
pub fn command_arguments_from(arguments: &[String]) -> Vec<String> {
    let borrowed: Vec<&str> = arguments.iter().map(String::as_str).collect();
    command_arguments(&borrowed)
}

/// The shell command that starts the Herdr server of the session that Heidrun uses, for `shell -lc`.
pub fn server_shell_command(bin: &std::path::Path) -> String {
    let quoted_bin = bin.display().to_string().replace('\'', "'\\''");
    format!("exec '{quoted_bin}' {}", command_arguments(&["server"]).join(" "))
}

/// The arguments of the command that stops the session `heidrun` when the user quits Heidrun. `None` when the session
/// stays running: the user chose "Keep agents running after quit", or the environment chooses a session that is not
/// the session of Heidrun.
pub fn stop_session_arguments(is_keeping_agents_running: bool) -> Option<Vec<String>> {
    if is_keeping_agents_running || is_session_chosen_by_environment() {
        return None;
    }
    Some(vec!["session".to_string(), "stop".to_string(), HEIDRUN_SESSION.to_string()])
}

/// Stops the session `heidrun`, and waits for the end of the command. Does nothing when `stop_session_arguments` gives
/// `None`. The error of the command is ignored: the application quits anyway.
pub fn stop_session_on_quit(is_keeping_agents_running: bool) {
    let Some(arguments) = stop_session_arguments(is_keeping_agents_running) else {
        return;
    };
    let _ = std::process::Command::new(herdr_bin())
        .args(arguments)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// Apps launched from the Finder do not inherit the shell PATH, so look in the usual places.
pub fn herdr_bin() -> PathBuf {
    if let Ok(p) = std::env::var("HERDR_BIN_PATH") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    let home = dirs::home_dir().unwrap_or_default();
    let candidates = [
        home.join(".local/bin/herdr"),
        PathBuf::from("/opt/homebrew/bin/herdr"),
        PathBuf::from("/usr/local/bin/herdr"),
        home.join(".local/share/mise/shims/herdr"),
        home.join(".nix-profile/bin/herdr"),
        home.join(".cargo/bin/herdr"),
    ];
    candidates
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("herdr"))
}

fn next_id() -> String {
    format!("hd_{}", NEXT_ID.fetch_add(1, Ordering::Relaxed))
}

fn format_error(err: &Value) -> String {
    let code = err.get("code").and_then(Value::as_str).unwrap_or("error");
    let message = err.get("message").and_then(Value::as_str).unwrap_or("");
    format!("{code}: {message}")
}

async fn connect() -> Result<UnixStream, String> {
    let path = socket_path();
    UnixStream::connect(&path)
        .await
        .map_err(|e| format!("herdr_unreachable: {} ({e})", path.display()))
}

/// One request on a fresh connection. Waits for the matching response line.
pub async fn request(method: &str, params: Value) -> Result<Value, String> {
    let mut stream = connect().await?;
    let id = next_id();
    let mut line = serde_json::to_string(&json!({ "id": id, "method": method, "params": params }))
        .map_err(|e| e.to_string())?;
    line.push('\n');
    stream.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    loop {
        buf.clear();
        let n = reader.read_line(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("herdr_closed: connection closed without a response".into());
        }
        let Ok(v) = serde_json::from_str::<Value>(buf.trim()) else { continue };
        let rid = v.get("id").and_then(Value::as_str).unwrap_or("");
        if rid != id && !rid.is_empty() {
            continue;
        }
        if let Some(err) = v.get("error") {
            return Err(format_error(err));
        }
        return Ok(v.get("result").cloned().unwrap_or(Value::Null));
    }
}

/// Opens a subscription and forwards every pushed line to the frontend as `herdr://event`.
/// Returns when the server closes the stream or reports an error such as `events_lost`.
async fn run_subscription(app: &AppHandle, subscriptions: Value, alive: Option<&AtomicBool>) -> Result<(), String> {
    let mut stream = connect().await?;
    let id = next_id();
    let mut line = serde_json::to_string(&json!({
        "id": id,
        "method": "events.subscribe",
        "params": { "subscriptions": subscriptions }
    }))
    .map_err(|e| e.to_string())?;
    line.push('\n');
    stream.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    let mut started = false;
    loop {
        if let Some(flag) = alive {
            if !flag.load(Ordering::Relaxed) {
                return Ok(());
            }
        }
        buf.clear();
        let n = reader.read_line(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("herdr_closed".into());
        }
        let Ok(v) = serde_json::from_str::<Value>(buf.trim()) else { continue };
        if let Some(err) = v.get("error") {
            let msg = format_error(err);
            let _ = app.emit("herdr://resync", &msg);
            return Err(msg);
        }
        if !started {
            started = true;
            if v.pointer("/result/type").and_then(Value::as_str) == Some("subscription_started") {
                if alive.is_none() {
                    let _ = app.emit("herdr://connected", ());
                }
                continue;
            }
        }
        let _ = app.emit("herdr://event", &v);
    }
}

/// Background loop: keeps the lifecycle subscription alive and reconnects when Herdr restarts.
pub fn spawn_event_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let subs: Vec<Value> = LIFECYCLE_EVENTS.iter().map(|t| json!({ "type": t })).collect();
        let subs = Value::Array(subs);
        loop {
            if let Err(e) = run_subscription(&app, subs.clone(), None).await {
                let _ = app.emit("herdr://disconnected", e);
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });
}

/// Per-pane agent status subscription. `pane.agent_status_changed` requires a pane id,
/// so the set is rebuilt whenever the frontend sees the pane list change.
#[derive(Default)]
pub struct StatusWatcher {
    inner: Mutex<WatcherInner>,
}

#[derive(Default)]
struct WatcherInner {
    pane_ids: Vec<String>,
    alive: Option<Arc<AtomicBool>>,
}

impl StatusWatcher {
    pub fn watch(&self, app: AppHandle, mut pane_ids: Vec<String>) {
        pane_ids.sort();
        pane_ids.dedup();
        let mut inner = self.inner.lock().unwrap();
        let running = inner.alive.as_ref().map(|a| a.load(Ordering::Relaxed)).unwrap_or(false);
        if running && inner.pane_ids == pane_ids {
            return;
        }
        if let Some(old) = inner.alive.take() {
            old.store(false, Ordering::Relaxed);
        }
        inner.pane_ids = pane_ids.clone();
        if pane_ids.is_empty() {
            return;
        }
        let alive = Arc::new(AtomicBool::new(true));
        inner.alive = Some(alive.clone());
        drop(inner);

        tauri::async_runtime::spawn(async move {
            let subs: Vec<Value> = pane_ids
                .iter()
                .map(|p| json!({ "type": "pane.agent_status_changed", "pane_id": p }))
                .collect();
            // A closed pane makes the server reject the whole set: stop and let the
            // frontend rebuild it from the next snapshot.
            let _ = run_subscription(&app, Value::Array(subs), Some(&alive)).await;
            alive.store(false, Ordering::Relaxed);
        });
    }
}

/// The tests change environment variables of the whole process: they run one at a time, in every module.
#[cfg(test)]
pub(crate) static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Removes the environment variables that the functions of this file read.
#[cfg(test)]
pub(crate) fn clear_env() {
    for name in ["HERDR_SOCKET_PATH", "HERDR_SESSION", "XDG_CONFIG_HOME", "HERDR_BIN_PATH"] {
        std::env::remove_var(name);
    }
}

#[cfg(test)]
mod herdr_tests {
    use super::*;

    #[test]
    fn config_dir_follows_the_xdg_variable() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        assert_eq!(config_dir(), PathBuf::from("/xdg/herdr"));
        std::env::set_var("XDG_CONFIG_HOME", "");
        assert!(config_dir().ends_with(".config/herdr"));
        clear_env();
    }

    #[test]
    fn socket_path_prefers_the_explicit_path() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_SOCKET_PATH", "/run/herdr.sock");
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(socket_path(), PathBuf::from("/run/herdr.sock"));
        clear_env();
    }

    #[test]
    fn socket_path_uses_the_named_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(socket_path(), PathBuf::from("/xdg/herdr/sessions/work/herdr.sock"));
        clear_env();
    }

    #[test]
    fn socket_path_defaults_to_the_socket_of_the_heidrun_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        assert_eq!(socket_path(), PathBuf::from("/xdg/herdr/sessions/heidrun/herdr.sock"));
        clear_env();
    }

    #[test]
    fn socket_path_ignores_empty_environment_variables() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        std::env::set_var("HERDR_SOCKET_PATH", "");
        std::env::set_var("HERDR_SESSION", "");
        assert_eq!(socket_path(), PathBuf::from("/xdg/herdr/sessions/heidrun/herdr.sock"));
        clear_env();
    }

    #[test]
    fn a_command_line_uses_the_heidrun_session_when_no_environment_variable_is_set() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        assert_eq!(command_arguments(&["pane", "run", "w1:p1", "ls"]), vec!["--session", "heidrun", "pane", "run", "w1:p1", "ls"]);
        assert_eq!(
            command_arguments_from(&["workspace".to_string(), "list".to_string()]),
            vec!["--session", "heidrun", "workspace", "list"]
        );
        clear_env();
    }

    #[test]
    fn a_command_line_adds_no_session_when_an_environment_variable_chooses_it() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(command_arguments(&["workspace", "list"]), vec!["workspace", "list"]);
        clear_env();
        std::env::set_var("HERDR_SOCKET_PATH", "/run/herdr.sock");
        assert_eq!(command_arguments(&["workspace", "list"]), vec!["workspace", "list"]);
        clear_env();
    }

    #[test]
    fn the_server_starts_in_the_heidrun_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        assert_eq!(server_shell_command(std::path::Path::new("/opt/homebrew/bin/herdr")), "exec '/opt/homebrew/bin/herdr' --session heidrun server");
        assert_eq!(server_shell_command(std::path::Path::new("/it's/herdr")), "exec '/it'\\''s/herdr' --session heidrun server");
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(server_shell_command(std::path::Path::new("/opt/herdr")), "exec '/opt/herdr' server");
        clear_env();
    }

    #[test]
    fn the_quit_step_stops_only_the_heidrun_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        assert_eq!(stop_session_arguments(false), Some(vec!["session".to_string(), "stop".to_string(), "heidrun".to_string()]));
        clear_env();
    }

    #[test]
    fn the_quit_step_does_not_stop_the_session_when_the_setting_keeps_the_agents_running() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        assert_eq!(stop_session_arguments(true), None);
        clear_env();
    }

    #[test]
    fn the_quit_step_does_not_stop_a_session_chosen_by_the_environment() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(stop_session_arguments(false), None);
        clear_env();
        std::env::set_var("HERDR_SOCKET_PATH", "/run/herdr.sock");
        assert_eq!(stop_session_arguments(false), None);
        clear_env();
    }

    #[test]
    fn binary_path_follows_the_variable() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_BIN_PATH", "/opt/herdr");
        assert_eq!(herdr_bin(), PathBuf::from("/opt/herdr"));
        clear_env();
    }

    #[test]
    fn request_identifiers_are_unique_and_prefixed() {
        let a = next_id();
        let b = next_id();
        assert_ne!(a, b);
        assert!(a.starts_with("hd_"));
    }

    #[test]
    fn formats_an_error_with_its_code_and_message() {
        assert_eq!(format_error(&json!({ "code": "not_found", "message": "no pane" })), "not_found: no pane");
        assert_eq!(format_error(&json!({})), "error: ");
    }

    #[test]
    fn subscribes_to_the_lifecycle_events_without_duplicates() {
        let mut seen = std::collections::HashSet::new();
        for event in LIFECYCLE_EVENTS {
            assert!(seen.insert(*event), "duplicate {event}");
            assert!(event.contains('.'));
        }
    }
}
