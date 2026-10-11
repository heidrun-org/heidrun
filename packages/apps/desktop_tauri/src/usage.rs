//! Codex usage, read from its own session logs.
//!
//! Codex writes every session to `~/.codex/sessions/YYYY/MM/DD/rollout-<date>-<session id>.jsonl`.
//! `token_count` events carry the context usage and the account rate limits
//! (`primary` = 5-hour window, `secondary` = weekly window).
//! This is not a public API: every field is optional and unknown shapes are skipped.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// Only the end of each log is read: the latest `token_count` event is what matters.
const TAIL_BYTES: u64 = 512 * 1024;
const MAX_AGE: Duration = Duration::from_secs(8 * 24 * 3600);

#[derive(Serialize, Clone, Default)]
pub struct LimitWindow {
    pub used_percent: f64,
    pub window_minutes: Option<u64>,
    /// Unix epoch seconds.
    pub resets_at: Option<i64>,
}

#[derive(Serialize, Clone, Default)]
pub struct SessionUsage {
    pub context_used: Option<u64>,
    pub context_window: Option<u64>,
    pub updated_at: Option<i64>,
}

#[derive(Serialize, Default)]
pub struct CodexUsage {
    pub available: bool,
    pub primary: Option<LimitWindow>,
    pub secondary: Option<LimitWindow>,
    pub plan: Option<String>,
    pub updated_at: Option<i64>,
    pub sessions: HashMap<String, SessionUsage>,
}

#[derive(Default)]
struct Parsed {
    primary: Option<LimitWindow>,
    secondary: Option<LimitWindow>,
    plan: Option<String>,
    limits_at: Option<i64>,
    session: SessionUsage,
}

fn codex_home() -> PathBuf {
    if let Ok(p) = std::env::var("CODEX_HOME") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    dirs::home_dir().unwrap_or_default().join(".codex")
}

fn collect_logs(dir: &Path, depth: u8, out: &mut Vec<(SystemTime, PathBuf)>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            if depth < 4 {
                collect_logs(&path, depth + 1, out);
            }
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !(name.starts_with("rollout-") && name.ends_with(".jsonl")) {
            continue;
        }
        let Ok(modified) = meta.modified() else { continue };
        if now.duration_since(modified).unwrap_or_default() <= MAX_AGE {
            out.push((modified, path));
        }
    }
}

fn read_tail(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(TAIL_BYTES);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    // Drop the partial first line when we started mid-file.
    Some(if start > 0 { text.split_once('\n').map(|(_, r)| r.to_string()).unwrap_or_default() } else { text })
}

fn parse_time(v: &Value) -> Option<i64> {
    let s = v.get("timestamp")?.as_str()?;
    chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.timestamp())
}

fn parse_window(w: &Value, event_time: Option<i64>) -> Option<LimitWindow> {
    let used = w.get("used_percent").or_else(|| w.get("usedPercent"))?.as_f64()?;
    let resets_at = w
        .get("resets_at")
        .and_then(Value::as_i64)
        .or_else(|| {
            let secs = w.get("resets_in_seconds").and_then(Value::as_i64)?;
            Some(event_time.unwrap_or_else(|| chrono::Utc::now().timestamp()) + secs)
        });
    Some(LimitWindow {
        used_percent: used,
        window_minutes: w.get("window_minutes").and_then(Value::as_u64),
        resets_at,
    })
}

fn parse_log(text: &str) -> Parsed {
    let mut out = Parsed::default();
    for line in text.lines().rev() {
        let Ok(v) = serde_json::from_str::<Value>(line) else { continue };
        let payload = v.get("payload").unwrap_or(&v);
        if payload.get("type").and_then(Value::as_str) != Some("token_count") {
            continue;
        }
        let at = parse_time(&v);
        if out.limits_at.is_none() {
            if let Some(rl) = payload.get("rate_limits").filter(|r| r.is_object()) {
                out.primary = rl.get("primary").and_then(|w| parse_window(w, at));
                out.secondary = rl.get("secondary").and_then(|w| parse_window(w, at));
                out.plan = rl.get("plan_type").and_then(Value::as_str).map(String::from);
                if out.primary.is_some() || out.secondary.is_some() {
                    out.limits_at = at.or(Some(0));
                }
            }
        }
        if out.session.updated_at.is_none() {
            if let Some(info) = payload.get("info").filter(|i| i.is_object()) {
                let last = info.get("last_token_usage");
                let used = last
                    .and_then(|l| l.get("total_tokens"))
                    .and_then(Value::as_u64)
                    .or_else(|| last.and_then(|l| l.get("input_tokens")).and_then(Value::as_u64));
                out.session = SessionUsage {
                    context_used: used,
                    context_window: info.get("model_context_window").and_then(Value::as_u64),
                    updated_at: at.or(Some(0)),
                };
            }
        }
        if out.limits_at.is_some() && out.session.updated_at.is_some() {
            break;
        }
    }
    out
}

/// `session_ids`: native Codex session ids reported to Herdr by its Codex integration.
#[tauri::command]
pub fn codex_usage(session_ids: Vec<String>) -> CodexUsage {
    let root = codex_home().join("sessions");
    let mut logs = Vec::new();
    collect_logs(&root, 0, &mut logs);
    logs.sort_by(|a, b| b.0.cmp(&a.0));

    let mut usage = CodexUsage { available: root.exists(), ..Default::default() };

    // Account limits: the newest log that carries them.
    for (_, path) in logs.iter().take(12) {
        let Some(text) = read_tail(path) else { continue };
        let parsed = parse_log(&text);
        if parsed.limits_at.is_some() {
            usage.primary = parsed.primary;
            usage.secondary = parsed.secondary;
            usage.plan = parsed.plan;
            usage.updated_at = parsed.limits_at;
            break;
        }
    }

    // Per-session context, matched by the session id in the file name.
    for id in session_ids.iter().filter(|s| !s.is_empty()) {
        let Some((_, path)) = logs.iter().find(|(_, p)| {
            p.file_name().and_then(|n| n.to_str()).map(|n| n.contains(id.as_str())).unwrap_or(false)
        }) else {
            continue;
        };
        if let Some(text) = read_tail(path) {
            usage.sessions.insert(id.clone(), parse_log(&text).session);
        }
    }
    usage
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_latest_token_count() {
        let log = r#"{"timestamp":"2026-10-05T04:00:00Z","type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":{"primary":{"used_percent":10.0,"window_minutes":300,"resets_in_seconds":600}}}}
{"timestamp":"2026-10-05T04:10:00Z","type":"event_msg","payload":{"type":"agent_message","message":"hi"}}
{"timestamp":"2026-10-05T04:20:00Z","type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":50000,"total_tokens":52000},"model_context_window":272000},"rate_limits":{"primary":{"used_percent":42.5,"window_minutes":300,"resets_in_seconds":3600},"secondary":{"used_percent":12.0,"window_minutes":10080,"resets_at":1791800000},"plan_type":"plus"}}}"#;
        let p = parse_log(log);
        let primary = p.primary.unwrap();
        assert_eq!(primary.used_percent, 42.5);
        let t = chrono::DateTime::parse_from_rfc3339("2026-10-05T04:20:00Z").unwrap().timestamp();
        assert_eq!(primary.resets_at, Some(t + 3600));
        assert_eq!(p.secondary.unwrap().resets_at, Some(1791800000));
        assert_eq!(p.plan.as_deref(), Some("plus"));
        assert_eq!(p.session.context_used, Some(52000));
        assert_eq!(p.session.context_window, Some(272000));
    }
}

#[cfg(test)]
mod parse_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_a_time_stamp() {
        assert_eq!(parse_time(&json!({ "timestamp": "2026-01-01T00:00:00Z" })), Some(1_767_225_600));
        assert_eq!(parse_time(&json!({ "timestamp": "yesterday" })), None);
        assert_eq!(parse_time(&json!({})), None);
    }

    #[test]
    fn reads_a_limit_window_with_an_absolute_reset() {
        let w = parse_window(&json!({ "used_percent": 42.5, "window_minutes": 300, "resets_at": 1000 }), None).unwrap();
        assert_eq!(w.used_percent, 42.5);
        assert_eq!(w.window_minutes, Some(300));
        assert_eq!(w.resets_at, Some(1000));
    }

    #[test]
    fn computes_the_reset_from_a_delay() {
        let w = parse_window(&json!({ "used_percent": 10.0, "resets_in_seconds": 60 }), Some(1000)).unwrap();
        assert_eq!(w.resets_at, Some(1060));
    }

    #[test]
    fn accepts_the_camel_case_name_of_the_percentage() {
        assert!(parse_window(&json!({ "usedPercent": 5.0 }), None).is_some());
    }

    #[test]
    fn refuses_a_window_without_percentage() {
        assert!(parse_window(&json!({ "window_minutes": 300 }), None).is_none());
    }

    #[test]
    fn ignores_lines_that_are_not_json_or_not_token_counts() {
        let parsed = parse_log("not json\n{\"type\":\"message\"}\n");
        assert!(parsed.primary.is_none());
        assert!(parsed.secondary.is_none());
    }
}
