//! The life of the server: it listens on the Tailscale address, follows the address when it changes, and stops on demand.

use crate::access::AccessGuard;
use crate::config::MobileConfig;
use crate::handler::MobileCallHandler;
use crate::router::{router, Shared};
use crate::tailscale::tailscale_ip;
use serde::Serialize;
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{oneshot, watch};

/// What the settings window shows about the mobile access.
#[derive(Serialize)]
pub struct MobileStatus {
    /// True when the developer turned the mobile access on.
    pub enabled: bool,
    /// True when the server listens.
    pub running: bool,
    /// The address of the page.
    pub url: Option<String>,
    /// The URL with the pairing token, as a QR code (SVG).
    pub qr: Option<String>,
    /// Why the server does not listen, in words for the developer.
    pub error: Option<String>,
}

/// Where the server finds the address to listen on. The real source is the Tailscale address of the Mac.
type AddressSource = fn() -> Option<Ipv4Addr>;

#[derive(Default)]
struct Inner {
    /// Stops the current server (and its open connections).
    stop: Option<watch::Sender<bool>>,
    addr: Option<SocketAddr>,
    error: Option<String>,
}

/// The mobile server. One value lives as long as the application. It is cheap to share: every method takes `&self`.
#[derive(Default)]
pub struct MobileServer {
    inner: Arc<Mutex<Inner>>,
    guard: Arc<Mutex<AccessGuard>>,
}

impl MobileServer {
    /// A server that does not listen yet.
    pub fn new() -> Self {
        Self::default()
    }

    /// Prepares a new run, and returns the future that runs it. The caller must spawn the future on its async runtime:
    /// nothing listens before that. A run that is already going stops, and the new pairing key applies at once, even to
    /// connections that are still open.
    pub fn start(&self, handler: Arc<dyn MobileCallHandler>, config: &MobileConfig) -> impl Future<Output = ()> + Send + 'static {
        self.start_with(handler, config, tailscale_ip)
    }

    /// Turns the access off: the server stops, and no key is accepted.
    pub fn stop(&self) {
        let mut inner = self.inner.lock().unwrap();
        if let Some(stop) = inner.stop.take() {
            let _ = stop.send(true);
        }
        self.guard.lock().unwrap().set_token(None);
        inner.addr = None;
        inner.error = None;
    }

    /// What the settings window shows. `config` gives the pairing key that the QR code carries.
    pub fn status(&self, config: &MobileConfig) -> MobileStatus {
        let inner = self.inner.lock().unwrap();
        let url = inner.addr.map(|a| format!("http://{a}/"));
        // The token goes after "#": browsers never send that part to a server.
        let qr = url.as_ref().filter(|_| config.enabled).and_then(|u| {
            let full = format!("{u}#t={}", config.token);
            qrcode::QrCode::new(full.as_bytes()).ok().map(|code| {
                code.render::<qrcode::render::svg::Color>()
                    .min_dimensions(220, 220)
                    .dark_color(qrcode::render::svg::Color("#0b0c0e"))
                    .light_color(qrcode::render::svg::Color("#ffffff"))
                    .build()
            })
        });
        MobileStatus { enabled: config.enabled, running: inner.addr.is_some() && inner.error.is_none(), url, qr, error: inner.error.clone() }
    }

    fn start_with(&self, handler: Arc<dyn MobileCallHandler>, config: &MobileConfig, address_source: AddressSource) -> impl Future<Output = ()> + Send + 'static {
        let mut inner = self.inner.lock().unwrap();
        if let Some(stop) = inner.stop.take() {
            let _ = stop.send(true);
        }
        let (tx, rx) = watch::channel(false);
        inner.stop = Some(tx);
        self.guard.lock().unwrap().set_token(Some(config.token.clone()));
        inner.addr = None;
        inner.error = None;
        supervise(self.inner.clone(), self.guard.clone(), handler, config.port, rx, address_source)
    }
}

fn set_status(inner: &Mutex<Inner>, addr: Option<SocketAddr>, error: Option<String>) {
    let mut inner = inner.lock().unwrap();
    inner.addr = addr;
    inner.error = error;
}

/// Keeps the server on the Tailscale address: waits for Tailscale when it is not
/// connected yet, and moves when the address changes.
async fn supervise(
    inner: Arc<Mutex<Inner>>,
    guard: Arc<Mutex<AccessGuard>>,
    handler: Arc<dyn MobileCallHandler>,
    port: u16,
    mut stop: watch::Receiver<bool>,
    address_source: AddressSource,
) {
    let wait = |stop: &mut watch::Receiver<bool>, secs| {
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
        let Some(ip) = address_source() else {
            set_status(&inner, None, Some("Tailscale n’est pas connecté sur ce Mac (aucune adresse 100.x) : nouvel essai dans quelques secondes.".into()));
            if wait(&mut stop, 5).await {
                return;
            }
            continue;
        };
        let requested = SocketAddr::new(IpAddr::V4(ip), port);
        let listener = match tokio::net::TcpListener::bind(requested).await {
            Ok(l) => l,
            Err(e) => {
                set_status(&inner, None, Some(format!("Impossible d’écouter sur {requested} : {e}")));
                // Often the previous server still closing (revoke, restart): retry soon.
                if wait(&mut stop, 2).await {
                    return;
                }
                continue;
            }
        };
        let addr = listener.local_addr().unwrap_or(requested);
        set_status(&inner, Some(addr), None);
        let shared = Shared { guard: guard.clone(), handler: handler.clone(), host: Arc::new(addr.to_string()) };
        let (down_tx, down_rx) = oneshot::channel::<()>();
        let server = tokio::spawn(async move {
            let _ = axum::serve(listener, router(shared))
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
            if address_source() != Some(ip) {
                break false;
            }
        };
        let _ = down_tx.send(());
        // Open connections get a moment to finish, then the old server is gone.
        let _ = tokio::time::timeout(Duration::from_secs(3), server).await;
        set_status(&inner, None, None);
        if stopped {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::CallFuture;
    use serde_json::{json, Value};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    struct EchoHandler;

    impl MobileCallHandler for EchoHandler {
        fn handle_call(&self, method: String, _params: Value) -> CallFuture {
            Box::pin(async move { Ok(json!({ "method": method })) })
        }
    }

    fn loopback() -> Option<Ipv4Addr> {
        Some(Ipv4Addr::LOCALHOST)
    }

    fn no_address() -> Option<Ipv4Addr> {
        None
    }

    fn config(enabled: bool, token: &str) -> MobileConfig {
        MobileConfig { enabled, token: token.to_string(), port: 0 }
    }

    async fn wait_until_listening(server: &MobileServer, config: &MobileConfig) -> MobileStatus {
        for _ in 0..100 {
            let status = server.status(config);
            if status.running {
                return status;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("the server never listened: {:?}", server.status(config).error);
    }

    /// Sends one raw HTTP request, and returns the status code (0 when the connection is refused or closed).
    async fn post_state(addr: &str, token: &str) -> u16 {
        let Ok(mut stream) = tokio::net::TcpStream::connect(addr).await else {
            return 0;
        };
        let body = r#"{"method":"state"}"#;
        let request = format!("POST /api HTTP/1.1\r\nHost: {addr}\r\nx-herdr-token: {token}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
        if stream.write_all(request.as_bytes()).await.is_err() {
            return 0;
        }
        let mut answer = String::new();
        let _ = stream.read_to_string(&mut answer).await;
        answer.split_whitespace().nth(1).and_then(|code| code.parse().ok()).unwrap_or(0)
    }

    #[tokio::test]
    async fn listens_on_the_given_address_and_answers_a_paired_call() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, loopback));
        let status = wait_until_listening(&server, &config).await;
        let url = status.url.unwrap();
        let addr = url.trim_start_matches("http://").trim_end_matches('/').to_string();
        assert!(addr.starts_with("127.0.0.1:"));
        assert_eq!(post_state(&addr, "secret").await, 200);
        assert_eq!(post_state(&addr, "wrong").await, 401);
        server.stop();
    }

    #[tokio::test]
    async fn the_qr_code_carries_the_key_only_when_the_access_is_on() {
        let server = MobileServer::new();
        let on = config(true, "secret");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &on, loopback));
        let status = wait_until_listening(&server, &on).await;
        assert!(status.qr.unwrap().contains("<svg"));
        assert!(server.status(&config(false, "secret")).qr.is_none());
        server.stop();
    }

    #[tokio::test]
    async fn a_new_key_cuts_off_the_old_key_at_once() {
        let server = MobileServer::new();
        let first = config(true, "first");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &first, loopback));
        let addr = wait_until_listening(&server, &first).await.url.unwrap().trim_start_matches("http://").trim_end_matches('/').to_string();
        assert_eq!(post_state(&addr, "first").await, 200);
        // The same port again: the new run waits for the old listener to close.
        let second = MobileConfig { enabled: true, token: "second".to_string(), port: addr.rsplit(':').next().unwrap().parse().unwrap() };
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &second, loopback));
        for _ in 0..200 {
            if post_state(&addr, "second").await == 200 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        assert_eq!(post_state(&addr, "second").await, 200);
        assert_eq!(post_state(&addr, "first").await, 401);
        server.stop();
    }

    #[tokio::test]
    async fn stop_closes_the_server_and_forgets_the_key() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, loopback));
        let addr = wait_until_listening(&server, &config).await.url.unwrap().trim_start_matches("http://").trim_end_matches('/').to_string();
        server.stop();
        let status = server.status(&config);
        assert!(!status.running);
        assert!(status.url.is_none());
        for _ in 0..100 {
            if post_state(&addr, "secret").await != 200 {
                return;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("the server still answers after stop");
    }

    #[tokio::test]
    async fn without_a_tailscale_address_the_status_says_so() {
        let server = MobileServer::new();
        let config = config(true, "secret");
        tokio::spawn(server.start_with(Arc::new(EchoHandler), &config, no_address));
        for _ in 0..100 {
            if server.status(&config).error.is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let status = server.status(&config);
        assert!(!status.running);
        assert!(status.url.is_none());
        assert!(status.error.unwrap().starts_with("Tailscale n’est pas connecté"));
        server.stop();
    }
}
