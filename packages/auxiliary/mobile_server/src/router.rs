//! The three routes of the mobile server: the page, the manifest, and the calls of the phone.

use crate::access::AccessGuard;
use crate::handler::MobileCallHandler;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Instant;

const PAGE: &str = include_str!("../../mobile_website/index.html");

/// A closed list: nothing else than these few actions is reachable from the phone.
const METHODS: &[&str] = &["state", "read", "answer", "prompt", "keys"];

const MAX_BODY_BYTES: usize = 64 * 1024;

/// What every route needs.
#[derive(Clone)]
pub struct Shared {
    /// The pairing key and the count of the bad keys.
    pub guard: Arc<Mutex<AccessGuard>>,
    /// The desktop application.
    pub handler: Arc<dyn MobileCallHandler>,
    /// "100.x.y.z:port": requests for any other Host are refused (DNS rebinding).
    pub host: Arc<String>,
}

/// The routes of the server.
pub fn router(shared: Shared) -> Router {
    Router::new().route("/", get(page)).route("/manifest.json", get(manifest)).route("/api", post(api)).with_state(shared)
}

fn header_text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

fn authorized(shared: &Shared, headers: &HeaderMap) -> Result<(), Response> {
    let host = header_text(headers, "host");
    let origin = header_text(headers, "origin");
    let given = header_text(headers, "x-herdr-token");
    let result = shared.guard.lock().unwrap().authorize(&shared.host, host, origin, given, Instant::now());
    result.map_err(|denial| denial.status_and_text().into_response())
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

async fn api(State(shared): State<Shared>, headers: HeaderMap, body: Bytes) -> Response {
    if let Err(r) = authorized(&shared, &headers) {
        return r;
    }
    if body.len() > MAX_BODY_BYTES {
        return (StatusCode::PAYLOAD_TOO_LARGE, "trop long").into_response();
    }
    let Ok(call) = serde_json::from_slice::<ApiCall>(&body) else {
        return (StatusCode::BAD_REQUEST, "requête invalide").into_response();
    };
    if !METHODS.contains(&call.method.as_str()) {
        return (StatusCode::NOT_FOUND, "méthode inconnue").into_response();
    }
    match shared.handler.handle_call(call.method, call.params).await {
        Ok(v) => axum::Json(v).into_response(),
        Err(e) => (StatusCode::SERVICE_UNAVAILABLE, e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::CallFuture;
    use axum::body::Body;
    use axum::http::Request;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tower::ServiceExt;

    const HOST: &str = "100.64.0.1:47823";
    const TOKEN: &str = "0123456789abcdef";

    /// Answers every call with the name of the method, and counts the calls.
    struct FakeHandler {
        calls: AtomicUsize,
    }

    impl MobileCallHandler for FakeHandler {
        fn handle_call(&self, method: String, params: Value) -> CallFuture {
            self.calls.fetch_add(1, Ordering::Relaxed);
            Box::pin(async move {
                if method == "read" {
                    return Err("L’app Heidrun ne répond pas sur le Mac".to_string());
                }
                Ok(json!({ "method": method, "params": params }))
            })
        }
    }

    fn setup(token: Option<&str>) -> (Router, Arc<FakeHandler>) {
        let handler = Arc::new(FakeHandler { calls: AtomicUsize::new(0) });
        let mut guard = AccessGuard::default();
        guard.set_token(token.map(str::to_string));
        let shared = Shared { guard: Arc::new(Mutex::new(guard)), handler: handler.clone(), host: Arc::new(HOST.to_string()) };
        (router(shared), handler)
    }

    fn api_request(host: &str, origin: Option<&str>, token: Option<&str>, body: Vec<u8>) -> Request<Body> {
        let mut builder = Request::builder().method("POST").uri("/api").header("host", host).header("content-type", "application/json");
        if let Some(origin) = origin {
            builder = builder.header("origin", origin);
        }
        if let Some(token) = token {
            builder = builder.header("x-herdr-token", token);
        }
        builder.body(Body::from(body)).unwrap()
    }

    async fn status_of(router: Router, request: Request<Body>) -> StatusCode {
        router.oneshot(request).await.unwrap().status()
    }

    fn call_body(method: &str) -> Vec<u8> {
        serde_json::to_vec(&json!({ "method": method, "params": { "paneId": "p1" } })).unwrap()
    }

    #[tokio::test]
    async fn a_paired_call_reaches_the_handler_and_returns_its_answer() {
        let (router, handler) = setup(Some(TOKEN));
        let response = router.oneshot(api_request(HOST, Some("http://100.64.0.1:47823"), Some(TOKEN), call_body("state"))).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        let answer: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(answer, json!({ "method": "state", "params": { "paneId": "p1" } }));
        assert_eq!(handler.calls.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn an_error_of_the_handler_becomes_a_503_with_its_text() {
        let (router, _) = setup(Some(TOKEN));
        let response = router.oneshot(api_request(HOST, None, Some(TOKEN), call_body("read"))).await.unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let bytes = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        assert_eq!(String::from_utf8(bytes.to_vec()).unwrap(), "L’app Heidrun ne répond pas sur le Mac");
    }

    #[tokio::test]
    async fn a_method_outside_the_closed_list_never_reaches_the_handler() {
        let (router, handler) = setup(Some(TOKEN));
        for method in ["close", "delete_pane", "STATE", ""] {
            let status = status_of(router.clone(), api_request(HOST, None, Some(TOKEN), call_body(method))).await;
            assert_eq!(status, StatusCode::NOT_FOUND, "method {method:?}");
        }
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn every_method_of_the_closed_list_reaches_the_handler() {
        let (router, handler) = setup(Some(TOKEN));
        for method in ["state", "answer", "prompt", "keys"] {
            let status = status_of(router.clone(), api_request(HOST, None, Some(TOKEN), call_body(method))).await;
            assert_eq!(status, StatusCode::OK, "method {method:?}");
        }
        assert_eq!(handler.calls.load(Ordering::Relaxed), 4);
    }

    #[tokio::test]
    async fn a_wrong_host_is_refused() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router, api_request("evil.example:47823", None, Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_wrong_origin_is_refused() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router, api_request(HOST, Some("http://evil.example"), Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_missing_or_wrong_key_is_a_401() {
        let (router, handler) = setup(Some(TOKEN));
        assert_eq!(status_of(router.clone(), api_request(HOST, None, None, call_body("state"))).await, StatusCode::UNAUTHORIZED);
        assert_eq!(status_of(router, api_request(HOST, None, Some("wrong"), call_body("state"))).await, StatusCode::UNAUTHORIZED);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn ten_wrong_keys_lock_the_wrong_keys_but_not_the_right_key() {
        let (router, _) = setup(Some(TOKEN));
        for _ in 0..10 {
            assert_eq!(status_of(router.clone(), api_request(HOST, None, Some("wrong"), call_body("state"))).await, StatusCode::UNAUTHORIZED);
        }
        assert_eq!(status_of(router.clone(), api_request(HOST, None, Some("wrong"), call_body("state"))).await, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(status_of(router, api_request(HOST, None, Some(TOKEN), call_body("state"))).await, StatusCode::OK);
    }

    #[tokio::test]
    async fn the_access_off_answers_a_503_even_with_the_right_key() {
        let (router, handler) = setup(None);
        let status = status_of(router, api_request(HOST, None, Some(TOKEN), call_body("state"))).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_body_larger_than_64_kilobytes_is_refused() {
        let (router, handler) = setup(Some(TOKEN));
        let status = status_of(router.clone(), api_request(HOST, None, Some(TOKEN), vec![b' '; 64 * 1024 + 1])).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        let status = status_of(router, api_request(HOST, None, Some(TOKEN), b"not json".to_vec())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(handler.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn the_page_has_the_security_headers_and_needs_no_key() {
        let (router, _) = setup(Some(TOKEN));
        let request = Request::builder().uri("/").header("host", HOST).body(Body::empty()).unwrap();
        let response = router.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let headers = response.headers();
        assert_eq!(headers[header::CACHE_CONTROL], "no-store");
        assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
        assert!(headers[header::CONTENT_SECURITY_POLICY].to_str().unwrap().starts_with("default-src 'none'"));
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert!(String::from_utf8(bytes.to_vec()).unwrap().contains("<title>Heidrun</title>"));
    }

    #[tokio::test]
    async fn the_manifest_is_served() {
        let (router, _) = setup(Some(TOKEN));
        let request = Request::builder().uri("/manifest.json").header("host", HOST).body(Body::empty()).unwrap();
        let response = router.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_TYPE], "application/manifest+json");
    }
}
