//! The checks of every request: the header Host, the header Origin, the pairing key, and the lock after bad keys.

use axum::http::StatusCode;
use std::time::{Duration, Instant};

const MAX_FAILURES: u32 = 10;
const LOCK: Duration = Duration::from_secs(60);

/// Why a request is refused.
#[derive(Debug, PartialEq, Eq)]
pub enum Denial {
    /// The header Host is not the address of this server.
    UnexpectedHost,
    /// The header Origin is not the page of this server.
    UnexpectedOrigin,
    /// The mobile access is off.
    Off,
    /// Too many bad keys in a row: wait.
    TooManyAttempts,
    /// The pairing key is missing or wrong.
    Unpaired,
}

impl Denial {
    /// The status and the text that the phone receives.
    pub fn status_and_text(&self) -> (StatusCode, &'static str) {
        match self {
            Denial::UnexpectedHost => (StatusCode::FORBIDDEN, "hôte inattendu"),
            Denial::UnexpectedOrigin => (StatusCode::FORBIDDEN, "origine refusée"),
            Denial::Off => (StatusCode::SERVICE_UNAVAILABLE, "Accès mobile désactivé sur le Mac"),
            Denial::TooManyAttempts => (StatusCode::TOO_MANY_REQUESTS, "Trop d’essais : réessaie dans une minute"),
            Denial::Unpaired => (StatusCode::UNAUTHORIZED, "Appairage nécessaire : scanne le QR code dans Heidrun"),
        }
    }
}

/// The pairing key that is accepted right now, and the count of the bad keys.
#[derive(Default)]
pub struct AccessGuard {
    /// The key accepted right now: None once the access is turned off. Checked on every request, so revoking cuts off
    /// connections that are still open.
    token: Option<String>,
    failures: u32,
    locked_until: Option<Instant>,
}

impl AccessGuard {
    /// Accepts this pairing key from now on, and forgets the bad keys.
    pub fn set_token(&mut self, token: Option<String>) {
        self.token = token;
    }

    /// Checks one request. `expected_host` is "100.x.y.z:port"; the other arguments are the headers of the request.
    pub fn authorize(&mut self, expected_host: &str, host: Option<&str>, origin: Option<&str>, given: Option<&str>, now: Instant) -> Result<(), Denial> {
        // Only requests addressed to this server, from its own page: a web page elsewhere
        // (or a DNS-rebinding trick) cannot even get to the token check.
        if host.unwrap_or("") != expected_host {
            return Err(Denial::UnexpectedHost);
        }
        if let Some(origin) = origin {
            if origin != format!("http://{expected_host}") {
                return Err(Denial::UnexpectedOrigin);
            }
        }
        let Some(token) = self.token.as_deref() else {
            return Err(Denial::Off);
        };
        let given = given.unwrap_or("");
        // The right token always passes: bad attempts cannot lock the owner out.
        if !given.is_empty() && same(given, token) {
            return Ok(());
        }
        if let Some(until) = self.locked_until {
            if now < until {
                return Err(Denial::TooManyAttempts);
            }
            self.locked_until = None;
        }
        self.failures += 1;
        if self.failures >= MAX_FAILURES {
            self.failures = 0;
            self.locked_until = Some(now + LOCK);
        }
        Err(Denial::Unpaired)
    }
}

/// Constant-time comparison (the token must not leak through timing).
fn same(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOST: &str = "100.64.0.1:47823";
    const TOKEN: &str = "0123456789abcdef";

    fn guard() -> AccessGuard {
        let mut guard = AccessGuard::default();
        guard.set_token(Some(TOKEN.to_string()));
        guard
    }

    fn check(guard: &mut AccessGuard, given: Option<&str>, now: Instant) -> Result<(), Denial> {
        guard.authorize(HOST, Some(HOST), None, given, now)
    }

    #[test]
    fn compares_tokens_by_content() {
        assert!(same("abc", "abc"));
        assert!(!same("abc", "abd"));
        assert!(!same("abc", "abcd"));
        assert!(same("", ""));
    }

    #[test]
    fn the_right_key_passes() {
        assert_eq!(check(&mut guard(), Some(TOKEN), Instant::now()), Ok(()));
    }

    #[test]
    fn a_missing_or_wrong_key_is_unpaired() {
        let now = Instant::now();
        assert_eq!(check(&mut guard(), None, now), Err(Denial::Unpaired));
        assert_eq!(check(&mut guard(), Some(""), now), Err(Denial::Unpaired));
        assert_eq!(check(&mut guard(), Some("wrong"), now), Err(Denial::Unpaired));
    }

    #[test]
    fn a_wrong_host_is_refused_before_the_key_is_read() {
        let mut guard = guard();
        let now = Instant::now();
        assert_eq!(guard.authorize(HOST, Some("evil.example:47823"), None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
        assert_eq!(guard.authorize(HOST, None, None, Some(TOKEN), now), Err(Denial::UnexpectedHost));
    }

    #[test]
    fn a_wrong_origin_is_refused_and_the_right_origin_passes() {
        let mut guard = guard();
        let now = Instant::now();
        assert_eq!(guard.authorize(HOST, Some(HOST), Some("http://evil.example"), Some(TOKEN), now), Err(Denial::UnexpectedOrigin));
        assert_eq!(guard.authorize(HOST, Some(HOST), Some("https://100.64.0.1:47823"), Some(TOKEN), now), Err(Denial::UnexpectedOrigin));
        assert_eq!(guard.authorize(HOST, Some(HOST), Some("http://100.64.0.1:47823"), Some(TOKEN), now), Ok(()));
    }

    #[test]
    fn nothing_passes_when_the_access_is_off() {
        let mut guard = guard();
        guard.set_token(None);
        assert_eq!(check(&mut guard, Some(TOKEN), Instant::now()), Err(Denial::Off));
    }

    #[test]
    fn ten_bad_keys_lock_the_wrong_keys_for_one_minute_but_never_the_right_key() {
        let mut guard = guard();
        let start = Instant::now();
        for _ in 0..10 {
            assert_eq!(check(&mut guard, Some("wrong"), start), Err(Denial::Unpaired));
        }
        assert_eq!(check(&mut guard, Some("wrong"), start), Err(Denial::TooManyAttempts));
        assert_eq!(check(&mut guard, Some(TOKEN), start), Ok(()));
        assert_eq!(check(&mut guard, Some("wrong"), start + Duration::from_secs(59)), Err(Denial::TooManyAttempts));
        assert_eq!(check(&mut guard, Some("wrong"), start + Duration::from_secs(61)), Err(Denial::Unpaired));
    }

    #[test]
    fn a_new_key_replaces_the_old_key_at_once() {
        let mut guard = guard();
        guard.set_token(Some("fedcba9876543210".to_string()));
        let now = Instant::now();
        assert_eq!(check(&mut guard, Some(TOKEN), now), Err(Denial::Unpaired));
        assert_eq!(check(&mut guard, Some("fedcba9876543210"), now), Ok(()));
    }
}
