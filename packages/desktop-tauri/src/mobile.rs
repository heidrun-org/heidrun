//! Mobile access: a small web page for the iPhone / iPad, served by the app on
//! the Mac's Tailscale address only, and protected by a pairing token.
//!
//! The server knows nothing about agents: each API call is handed to the app's
//! window (event "mobile-call"), which answers with the same logic as the
//! desktop UI (labels, menus, guards) through `mobile_reply`.

use axum::body::Bytes;
use axum::extract::State as AxState;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

const PAGE: &str = include_str!("../mobile/index.html");
const DEFAULT_PORT: u16 = 47823;

#[derive(Serialize, Deserialize, Clone, Default)]
struct Config {
    enabled: bool,
    token: String,
    port: u16,
}

fn config_path() -> PathBuf {
    std::env::var("HERDR_DESK_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_default().join(".config").join("herdr-desk"))
        .join("mobile.json")
}

fn load() -> Config {
    let mut c: Config = std::fs::read_to_string(config_path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    if c.port == 0 {
        c.port = DEFAULT_PORT;
    }
    c
}

fn save(c: &Config) -> Result<(), String> {
    let p = config_path();
    if let Some(d) = p.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string_pretty(c).map_err(|e| e.to_string())?;
    // The token gives access to the agents: readable by this user only, from the start.
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    use std::io::Write;
    opts.open(&p).and_then(|mut f| f.write_all(body.as_bytes())).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// 32 random bytes as hex.
fn new_token() -> Result<String, String> {
    use std::io::Read;
    let mut buf = [0u8; 32];
    std::fs::File::open("/dev/urandom").and_then(|mut f| f.read_exact(&mut buf)).map_err(|e| format!("aléa indisponible : {e}"))?;
    Ok(buf.iter().map(|b| format!("{b:02x}")).collect())
}

/// The Mac's Tailscale address (100.64.0.0/10). Never another interface.
fn tailscale_ip() -> Option<Ipv4Addr> {
    // For tests on this Mac only: a Tailscale or loopback address, never 0.0.0.0.
    if let Ok(v) = std::env::var("HERDR_DESK_MOBILE_BIND") {
        return v.parse::<Ipv4Addr>().ok().filter(|ip| is_tailscale(*ip) || ip.is_loopback());
    }
    if_addrs::get_if_addrs().ok()?.into_iter().find_map(|i| match i.ip() {
        IpAddr::V4(v4) if is_tailscale(v4) => Some(v4),
        _ => None,
    })
}

fn is_tailscale(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    o[0] == 100 && (64..=127).contains(&o[1])
}

/// Constant-time comparison (the token must not leak through timing).
fn same(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

// ---- Bridge to the window ------------------------------------------------------

#[derive(Default)]
pub struct MobileState {
    inner: Mutex<Inner>,
    next: AtomicU64,
}

#[derive(Default)]
struct Inner {
    /// Stops the current server (and its open connections).
    stop: Option<tokio::sync::watch::Sender<bool>>,
    addr: Option<SocketAddr>,
    error: Option<String>,
    pending: HashMap<u64, oneshot::Sender<Value>>,
    /// The token accepted right now: None once the access is turned off. Checked on
    /// every request, so revoking cuts off connections that are still open.
    token: Option<String>,
    failures: u32,
    locked_until: Option<Instant>,
}

#[derive(Clone)]
struct Shared {
    app: AppHandle,
    /// "100.x.y.z:port": requests for any other Host are refused (DNS rebinding).
    host: Arc<String>,
}

#[tauri::command]
pub fn mobile_reply(state: State<'_, MobileState>, id: u64, result: Value) {
    if let Some(tx) = state.inner.lock().unwrap().pending.remove(&id) {
        let _ = tx.send(result);
    }
}

async fn call(app: &AppHandle, method: &str, params: Value) -> Result<Value, String> {
    use tauri::Manager;
    let state = app.state::<MobileState>();
    let id = state.next.fetch_add(1, Ordering::Relaxed) + 1;
    let (tx, rx) = oneshot::channel();
    state.inner.lock().unwrap().pending.insert(id, tx);
    if let Err(e) = app.emit("mobile-call", json!({ "id": id, "method": method, "params": params })) {
        state.inner.lock().unwrap().pending.remove(&id);
        return Err(e.to_string());
    }
    match tokio::time::timeout(Duration::from_secs(25), rx).await {
        Ok(Ok(v)) => Ok(v),
        _ => {
            state.inner.lock().unwrap().pending.remove(&id);
            Err("L’app Heidrun ne répond pas sur le Mac".into())
        }
    }
}

// ---- HTTP ------------------------------------------------------------------------

fn authorized(s: &Shared, headers: &HeaderMap) -> Result<(), Response> {
    use tauri::Manager;
    // Only requests addressed to this server, from its own page: a web page elsewhere
    // (or a DNS-rebinding trick) cannot even get to the token check.
    let host = headers.get(header::HOST).and_then(|v| v.to_str().ok()).unwrap_or("");
    if host != s.host.as_str() {
        return Err((StatusCode::FORBIDDEN, "hôte inattendu").into_response());
    }
    if let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
        if origin != format!("http://{}", s.host) {
            return Err((StatusCode::FORBIDDEN, "origine refusée").into_response());
        }
    }
    let state = s.app.state::<MobileState>();
    let mut inner = state.inner.lock().unwrap();
    let Some(token) = inner.token.clone() else {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Accès mobile désactivé sur le Mac").into_response());
    };
    let given = headers.get("x-herdr-token").and_then(|v| v.to_str().ok()).unwrap_or("");
    // The right token always passes: bad attempts cannot lock the owner out.
    if !given.is_empty() && same(given, &token) {
        return Ok(());
    }
    if let Some(until) = inner.locked_until {
        if Instant::now() < until {
            return Err((StatusCode::TOO_MANY_REQUESTS, "Trop d’essais : réessaie dans une minute").into_response());
        }
        inner.locked_until = None;
    }
    inner.failures += 1;
    if inner.failures >= 10 {
        inner.failures = 0;
        inner.locked_until = Some(Instant::now() + Duration::from_secs(60));
    }
    Err((StatusCode::UNAUTHORIZED, "Appairage nécessaire : scanne le QR code dans Heidrun").into_response())
}

async fn page() -> Response {
    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
            // Everything is in the page: nothing else may load or run.
            (
                header::CONTENT_SECURITY_POLICY,
                "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            ),
            (header::REFERRER_POLICY, "no-referrer"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        PAGE,
    )
        .into_response()
}

async fn manifest() -> Response {
    (
        [(header::CONTENT_TYPE, "application/manifest+json")],
        r##"{"name":"Heidrun","short_name":"Heidrun","start_url":"/","display":"standalone","background_color":"#0b0c0e","theme_color":"#0b0c0e"}"##,
    )
        .into_response()
}

#[derive(Deserialize)]
struct ApiCall {
    method: String,
    #[serde(default)]
    params: Value,
}

const METHODS: &[&str] = &["state", "read", "answer", "prompt", "keys"];

async fn api(AxState(s): AxState<Shared>, headers: HeaderMap, body: Bytes) -> Response {
    if let Err(r) = authorized(&s, &headers) {
        return r;
    }
    if body.len() > 64 * 1024 {
        return (StatusCode::PAYLOAD_TOO_LARGE, "trop long").into_response();
    }
    let Ok(c) = serde_json::from_slice::<ApiCall>(&body) else {
        return (StatusCode::BAD_REQUEST, "requête invalide").into_response();
    };
    // A closed list: nothing else than these few actions is reachable from the phone.
    if !METHODS.contains(&c.method.as_str()) {
        return (StatusCode::NOT_FOUND, "méthode inconnue").into_response();
    }
    match call(&s.app, &c.method, c.params).await {
        Ok(v) => axum::Json(v).into_response(),
        Err(e) => (StatusCode::SERVICE_UNAVAILABLE, e).into_response(),
    }
}

fn start(app: &AppHandle, state: &MobileState, cfg: &Config) {
    let mut inner = state.inner.lock().unwrap();
    if let Some(stop) = inner.stop.take() {
        let _ = stop.send(true);
    }
    let (tx, rx) = tokio::sync::watch::channel(false);
    inner.stop = Some(tx);
    inner.token = Some(cfg.token.clone());
    inner.addr = None;
    inner.error = None;
    tauri::async_runtime::spawn(supervise(app.clone(), cfg.port, rx));
}

fn set_status(app: &AppHandle, addr: Option<SocketAddr>, error: Option<String>) {
    use tauri::Manager;
    let st = app.state::<MobileState>();
    let mut inner = st.inner.lock().unwrap();
    inner.addr = addr;
    inner.error = error;
}

/// Keeps the server on the Tailscale address: waits for Tailscale when it is not
/// connected yet, and moves when the address changes.
async fn supervise(app: AppHandle, port: u16, mut stop: tokio::sync::watch::Receiver<bool>) {
    let wait = |stop: &mut tokio::sync::watch::Receiver<bool>, secs| {
        let mut stop = stop.clone();
        async move {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(secs)) => false,
                _ = stop.changed() => true,
            }
        }
    };
    loop {
        if *stop.borrow() {
            return;
        }
        let Some(ip) = tailscale_ip() else {
            set_status(&app, None, Some("Tailscale n’est pas connecté sur ce Mac (aucune adresse 100.x) : nouvel essai dans quelques secondes.".into()));
            if wait(&mut stop, 5).await {
                return;
            }
            continue;
        };
        let addr = SocketAddr::new(IpAddr::V4(ip), port);
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                set_status(&app, None, Some(format!("Impossible d’écouter sur {addr} : {e}")));
                // Often the previous server still closing (revoke, restart): retry soon.
                if wait(&mut stop, 2).await {
                    return;
                }
                continue;
            }
        };
        set_status(&app, Some(addr), None);
        let shared = Shared { app: app.clone(), host: Arc::new(addr.to_string()) };
        let router = Router::new()
            .route("/", get(page))
            .route("/manifest.json", get(manifest))
            .route("/api", post(api))
            .with_state(shared);
        let (down_tx, down_rx) = oneshot::channel::<()>();
        let server = tokio::spawn(async move {
            let _ = axum::serve(listener, router)
                .with_graceful_shutdown(async move {
                    let _ = down_rx.await;
                })
                .await;
        });
        // Watch for "turn off" and for a new Tailscale address.
        let stopped = loop {
            if wait(&mut stop, 10).await {
                break true;
            }
            if tailscale_ip() != Some(ip) {
                break false;
            }
        };
        let _ = down_tx.send(());
        // Open connections get a moment to finish, then the old server is gone.
        let _ = tokio::time::timeout(Duration::from_secs(3), server).await;
        set_status(&app, None, None);
        if stopped {
            return;
        }
    }
}

fn stop(state: &MobileState) {
    let mut inner = state.inner.lock().unwrap();
    if let Some(stop) = inner.stop.take() {
        let _ = stop.send(true);
    }
    inner.token = None;
    inner.addr = None;
    inner.error = None;
}

/// Called at launch: the access comes back if it was on.
pub fn start_if_enabled(app: &AppHandle) {
    use tauri::Manager;
    let cfg = load();
    if cfg.enabled && !cfg.token.is_empty() {
        start(app, &app.state::<MobileState>(), &cfg);
    }
}

#[derive(Serialize)]
pub struct MobileStatus {
    enabled: bool,
    running: bool,
    url: Option<String>,
    /// The URL with the pairing token, as a QR code (SVG).
    qr: Option<String>,
    error: Option<String>,
}

fn status_of(state: &MobileState) -> MobileStatus {
    let cfg = load();
    let inner = state.inner.lock().unwrap();
    let url = inner.addr.map(|a| format!("http://{a}/"));
    // The token goes after "#": browsers never send that part to a server.
    let qr = url.as_ref().filter(|_| cfg.enabled).and_then(|u| {
        let full = format!("{u}#t={}", cfg.token);
        qrcode::QrCode::new(full.as_bytes()).ok().map(|code| {
            code.render::<qrcode::render::svg::Color>()
                .min_dimensions(220, 220)
                .dark_color(qrcode::render::svg::Color("#0b0c0e"))
                .light_color(qrcode::render::svg::Color("#ffffff"))
                .build()
        })
    });
    MobileStatus { enabled: cfg.enabled, running: inner.addr.is_some() && inner.error.is_none(), url, qr, error: inner.error.clone() }
}

#[tauri::command]
pub fn mobile_status(state: State<'_, MobileState>) -> MobileStatus {
    status_of(&state)
}

#[tauri::command]
pub async fn mobile_enable(app: AppHandle, state: State<'_, MobileState>) -> Result<MobileStatus, String> {
    let mut cfg = load();
    if cfg.token.is_empty() {
        cfg.token = new_token()?;
    }
    cfg.enabled = true;
    save(&cfg)?;
    start(&app, &state, &cfg);
    // Let the listener bind (or fail) before answering.
    tokio::time::sleep(Duration::from_millis(400)).await;
    Ok(status_of(&state))
}

#[tauri::command]
pub fn mobile_disable(state: State<'_, MobileState>) -> Result<MobileStatus, String> {
    let mut cfg = load();
    cfg.enabled = false;
    save(&cfg)?;
    stop(&state);
    Ok(status_of(&state))
}

/// New token: every paired phone has to scan the QR code again.
#[tauri::command]
pub async fn mobile_revoke(app: AppHandle, state: State<'_, MobileState>) -> Result<MobileStatus, String> {
    let mut cfg = load();
    cfg.token = new_token()?;
    save(&cfg)?;
    if cfg.enabled {
        // The new token applies at once, even to connections still open.
        state.inner.lock().unwrap().token = Some(cfg.token.clone());
        start(&app, &state, &cfg);
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
    Ok(status_of(&state))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_tailscale_range() {
        assert!(is_tailscale("100.64.0.1".parse().unwrap()));
        assert!(is_tailscale("100.101.5.9".parse().unwrap()));
        assert!(!is_tailscale("100.128.0.1".parse().unwrap()));
        assert!(!is_tailscale("192.168.1.10".parse().unwrap()));
        assert!(same("abc", "abc") && !same("abc", "abd") && !same("abc", "ab"));
        assert_eq!(new_token().unwrap().len(), 64);
    }
}
