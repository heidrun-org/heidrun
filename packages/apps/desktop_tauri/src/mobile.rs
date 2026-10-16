//! Mobile access, the Tauri side: the commands of the settings window, and the bridge that hands each call of the
//! phone to the app's window (event "mobile-call"), which answers with the same logic as the desktop UI (labels,
//! menus, guards) through `mobile_reply`.
//!
//! The server itself (the loopback address, the ngrok tunnel, the pairing key, the page) is the package `mobile_server`.

use mobile_server::{CallFuture, MobileCallHandler, MobileServer, MobileStatus};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

#[derive(Default)]
pub struct MobileState {
    server: MobileServer,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next: AtomicU64,
}

#[tauri::command]
pub fn mobile_reply(state: State<'_, MobileState>, id: u64, result: Value) {
    if let Some(tx) = state.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(result);
    }
}

/// Hands each call of the phone to the window of the app.
struct WindowBridge {
    app: AppHandle,
}

impl MobileCallHandler for WindowBridge {
    fn handle_call(&self, method: String, params: Value) -> CallFuture {
        let app = self.app.clone();
        Box::pin(async move { call(&app, &method, params).await })
    }
}

async fn call(app: &AppHandle, method: &str, params: Value) -> Result<Value, String> {
    let state = app.state::<MobileState>();
    let id = state.next.fetch_add(1, Ordering::Relaxed) + 1;
    let (tx, rx) = oneshot::channel();
    state.pending.lock().unwrap().insert(id, tx);
    if let Err(e) = app.emit("mobile-call", json!({ "id": id, "method": method, "params": params })) {
        state.pending.lock().unwrap().remove(&id);
        return Err(e.to_string());
    }
    match tokio::time::timeout(Duration::from_secs(25), rx).await {
        Ok(Ok(v)) => Ok(v),
        _ => {
            state.pending.lock().unwrap().remove(&id);
            Err("Heidrun does not answer on the computer".into())
        }
    }
}

fn start(app: &AppHandle, state: &MobileState, config: &mobile_server::MobileConfig) {
    let bridge = Arc::new(WindowBridge { app: app.clone() });
    tauri::async_runtime::spawn(state.server.start(bridge, config));
}

/// Called when Heidrun quits: the server stops and the program `ngrok` is killed, so no tunnel stays open.
pub fn stop_on_quit(app: &AppHandle) {
    app.state::<MobileState>().server.stop();
}

/// Called at launch: the access comes back if it was on.
pub fn start_if_enabled(app: &AppHandle) {
    let config = mobile_server::load_config();
    if config.enabled && !config.token.is_empty() {
        start(app, &app.state::<MobileState>(), &config);
    }
}

fn status_of(state: &MobileState) -> MobileStatus {
    state.server.status(&mobile_server::load_config())
}

#[tauri::command]
pub fn mobile_status(state: State<'_, MobileState>) -> MobileStatus {
    status_of(&state)
}

#[tauri::command]
pub async fn mobile_enable(app: AppHandle, state: State<'_, MobileState>) -> Result<MobileStatus, String> {
    let mut config = mobile_server::load_config();
    if config.token.is_empty() {
        config.token = mobile_server::new_token()?;
    }
    config.enabled = true;
    mobile_server::save_config(&config)?;
    start(&app, &state, &config);
    // Let the listener bind (or fail) before answering.
    tokio::time::sleep(Duration::from_millis(400)).await;
    Ok(status_of(&state))
}

#[tauri::command]
pub fn mobile_disable(state: State<'_, MobileState>) -> Result<MobileStatus, String> {
    let mut config = mobile_server::load_config();
    config.enabled = false;
    mobile_server::save_config(&config)?;
    state.server.stop();
    Ok(status_of(&state))
}

/// New token: every paired phone has to scan the QR code again. The tunnel stays open with the same address.
#[tauri::command]
pub fn mobile_revoke(state: State<'_, MobileState>) -> Result<MobileStatus, String> {
    let mut config = mobile_server::load_config();
    config.token = mobile_server::new_token()?;
    mobile_server::save_config(&config)?;
    if config.enabled {
        // The new token applies at once, even to connections still open.
        state.server.replace_token(&config.token);
    }
    Ok(status_of(&state))
}
