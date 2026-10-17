//! Reading the log file: the events are paired by request identifier, and a request without a completion is classified.
//!
//! A request with a start event and no completion event never looks like a success. It is `running` when its process still
//! lives and the request is younger than one hour. It is `interrupted` in every other case: the process was killed, the
//! computer stopped, or the process lives on and the request is older than one hour, which is a request that hangs.

use crate::clock::parse_utc_text;
use crate::event::{CompleteEvent, Event, Outcome, StartEvent, FORMAT_VERSION};
use crate::settings::rotated_file;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// The age after which a request without a completion is interrupted, even when its process lives, in milliseconds.
pub const STALE_AFTER_MILLISECONDS: i64 = 3_600_000;

/// What a request is, from the events that the log holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RequestState {
    /// The completion event says success.
    Succeeded,
    /// The completion event says failure.
    Failed,
    /// There is no completion event, and the process still lives, and the request is young.
    Running,
    /// There is no completion event, and the process is gone or the request is old.
    Interrupted,
}

impl RequestState {
    /// The word for the state, as the commands print it.
    pub fn name(self) -> &'static str {
        match self {
            RequestState::Succeeded => "succeeded",
            RequestState::Failed => "failed",
            RequestState::Running => "running",
            RequestState::Interrupted => "interrupted",
        }
    }

    /// The state of a word of `name`, or `None` when the word is not one of the four.
    pub fn from_name(name: &str) -> Option<RequestState> {
        [RequestState::Succeeded, RequestState::Failed, RequestState::Running, RequestState::Interrupted]
            .into_iter()
            .find(|state| state.name() == name)
    }

    /// True for a request that has no completion event.
    pub fn is_unfinished(self) -> bool {
        matches!(self, RequestState::Running | RequestState::Interrupted)
    }
}

/// A start event with its completion event.
#[derive(Debug, Clone, PartialEq)]
pub struct PairedRequest {
    /// The start event.
    pub start: StartEvent,
    /// The completion event, or `None` when the request did not end in the log.
    pub complete: Option<CompleteEvent>,
    /// What the request is.
    pub state: RequestState,
}

impl PairedRequest {
    /// The duration in microseconds, or `None` when the request did not end.
    pub fn duration_microseconds(&self) -> Option<u64> {
        self.complete.as_ref().map(|complete| complete.duration_microseconds)
    }

    /// The duration in milliseconds, or `None` when the request did not end.
    pub fn duration_milliseconds(&self) -> Option<f64> {
        self.duration_microseconds().map(|microseconds| microseconds as f64 / 1000.0)
    }

    /// The start event, the completion event, and the state, as one JSON value.
    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "state": self.state.name(),
            "start": self.start,
            "complete": self.complete,
        })
    }
}

/// What the reading of the log gave.
#[derive(Debug, Clone, PartialEq)]
pub struct LogReading {
    /// The requests, the oldest first.
    pub requests: Vec<PairedRequest>,
    /// The number of completion events whose start event is not in the files, for example after a replacement of the file.
    pub orphan_completions: usize,
    /// The number of lines that are not an event.
    pub malformed_lines: usize,
    /// The number of lines with a version of the format that this package does not know.
    pub unsupported_version_lines: usize,
    /// The number of events that the programs report as lost, because they could not write them.
    pub dropped_events: u64,
    /// The files that were read, the old file first.
    pub files: Vec<PathBuf>,
    /// The size of the files that were read, in bytes.
    pub bytes: u64,
}

/// Reads the old file and the file of the log, and pairs the events. A missing file is an empty log.
///
/// # Errors
/// An error when a file exists and cannot be read.
pub fn read_log(file: &Path, now_milliseconds: i64) -> Result<LogReading, String> {
    read_log_with(file, now_milliseconds, &process_is_alive)
}

/// The same as `read_log`, with the test of the life of a process given by the caller, so a test needs no real process.
///
/// # Errors
/// An error when a file exists and cannot be read.
pub fn read_log_with(file: &Path, now_milliseconds: i64, is_alive: &dyn Fn(u32) -> bool) -> Result<LogReading, String> {
    let mut reading = LogReading {
        requests: Vec::new(),
        orphan_completions: 0,
        malformed_lines: 0,
        unsupported_version_lines: 0,
        dropped_events: 0,
        files: Vec::new(),
        bytes: 0,
    };
    let mut positions: HashMap<String, usize> = HashMap::new();
    for path in [rotated_file(file), file.to_path_buf()] {
        if path.exists() == false {
            continue;
        }
        let bytes = std::fs::read(&path).map_err(|error| format!("The file {} cannot be read: {error}", path.display()))?;
        reading.bytes += bytes.len() as u64;
        reading.files.push(path);
        for line in String::from_utf8_lossy(&bytes).lines().filter(|line| line.trim().is_empty() == false) {
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                reading.malformed_lines += 1;
                continue;
            };
            if value.get("v").and_then(Value::as_u64) != Some(FORMAT_VERSION as u64) {
                reading.unsupported_version_lines += 1;
                continue;
            }
            let Ok(event) = serde_json::from_value::<Event>(value) else {
                reading.malformed_lines += 1;
                continue;
            };
            match event {
                Event::Start(start) => {
                    reading.dropped_events += start.dropped_events.unwrap_or(0);
                    positions.insert(start.request_id.clone(), reading.requests.len());
                    reading.requests.push(PairedRequest { start, complete: None, state: RequestState::Interrupted });
                }
                Event::Complete(complete) => {
                    reading.dropped_events += complete.dropped_events.unwrap_or(0);
                    match positions.get(&complete.request_id) {
                        Some(position) => reading.requests[*position].complete = Some(complete),
                        None => reading.orphan_completions += 1,
                    }
                }
            }
        }
    }
    for request in &mut reading.requests {
        request.state = state_of(request, now_milliseconds, is_alive);
    }
    reading.requests.sort_by(|left, right| {
        (&left.start.started_at, &left.start.request_id).cmp(&(&right.start.started_at, &right.start.request_id))
    });
    Ok(reading)
}

/// The state of a request from its events, the time, and the life of its process.
fn state_of(request: &PairedRequest, now_milliseconds: i64, is_alive: &dyn Fn(u32) -> bool) -> RequestState {
    if let Some(complete) = &request.complete {
        return match complete.outcome {
            Outcome::Success => RequestState::Succeeded,
            Outcome::Failure => RequestState::Failed,
        };
    }
    let age = parse_utc_text(&request.start.started_at).map(|started| now_milliseconds - started).unwrap_or(i64::MAX);
    if age < STALE_AFTER_MILLISECONDS && is_alive(request.start.process_id) {
        RequestState::Running
    } else {
        RequestState::Interrupted
    }
}

/// True when the operating system process with this identifier exists.
#[cfg(unix)]
pub fn process_is_alive(process_id: u32) -> bool {
    if process_id > i32::MAX as u32 {
        return false;
    }
    // SAFETY: the signal 0 only tests that the process exists, it sends nothing.
    let result = unsafe { libc::kill(process_id as libc::pid_t, 0) };
    result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

/// True when the operating system process with this identifier exists. A system without signals cannot tell, so every
/// process counts as gone, and an unfinished request is interrupted.
#[cfg(not(unix))]
pub fn process_is_alive(_process_id: u32) -> bool {
    false
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_state_is_found_by_its_name() {
        for state in [RequestState::Succeeded, RequestState::Failed, RequestState::Running, RequestState::Interrupted] {
            assert_eq!(RequestState::from_name(state.name()), Some(state));
        }
        assert_eq!(RequestState::from_name("sleeping"), None);
        assert!(RequestState::Running.is_unfinished() && RequestState::Interrupted.is_unfinished());
        assert!(RequestState::Succeeded.is_unfinished() == false && RequestState::Failed.is_unfinished() == false);
    }

    use super::*;
    use crate::event::{empty_object, ErrorCategory, RequestKind, ORIGIN_APPLICATION};

    fn start(request_id: &str, started_at: &str, process_id: u32) -> Event {
        Event::Start(StartEvent {
            v: FORMAT_VERSION,
            request_id: request_id.to_string(),
            parent_request_id: None,
            caller: "test".to_string(),
            origin: ORIGIN_APPLICATION.to_string(),
            replay_of: None,
            package: "source_control".to_string(),
            operation: "query".to_string(),
            kind: RequestKind::Query,
            parameters: empty_object(),
            pattern: String::new(),
            started_at: started_at.to_string(),
            process_id,
            software_version: "0.2.7".to_string(),
            concurrent_requests: 0,
            state: empty_object(),
            dropped_events: None,
        })
    }

    fn complete(request_id: &str, outcome: Outcome, microseconds: u64) -> Event {
        Event::Complete(CompleteEvent {
            v: FORMAT_VERSION,
            request_id: request_id.to_string(),
            package: "source_control".to_string(),
            operation: "query".to_string(),
            ended_at: "2026-10-17T12:00:01.000Z".to_string(),
            duration_microseconds: microseconds,
            outcome,
            error_category: if outcome == Outcome::Failure { Some(ErrorCategory::OTHER.to_string()) } else { None },
            result_count: None,
            details: empty_object(),
            dropped_events: None,
        })
    }

    fn write_log(name: &str, lines: &[String]) -> PathBuf {
        let folder = crate::testing::new_temporary_folder(name);
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("data_layer_requests.jsonl");
        std::fs::write(&file, lines.join("\n") + "\n").unwrap();
        file
    }

    fn line(event: &Event) -> String {
        serde_json::to_string(event).unwrap()
    }

    const NOW: i64 = 1_792_240_496_789;

    #[test]
    fn events_are_paired_by_identifier_even_when_two_requests_overlap() {
        let file = write_log(
            "pairing",
            &[
                line(&start("a", "2026-10-17T12:34:56.000Z", 1)),
                line(&start("b", "2026-10-17T12:34:56.100Z", 2)),
                line(&complete("b", Outcome::Success, 500)),
                line(&complete("a", Outcome::Failure, 900)),
            ],
        );
        let reading = read_log_with(&file, NOW, &|_| false).unwrap();
        assert_eq!(reading.requests.len(), 2);
        assert_eq!(reading.requests[0].start.request_id, "a");
        assert_eq!(reading.requests[0].state, RequestState::Failed);
        assert_eq!(reading.requests[0].duration_microseconds(), Some(900));
        assert_eq!(reading.requests[1].state, RequestState::Succeeded);
        assert_eq!(reading.requests[1].duration_microseconds(), Some(500));
    }

    #[test]
    fn a_start_without_a_completion_is_interrupted_when_the_process_is_gone() {
        let file = write_log("interrupted", &[line(&start("a", "2026-10-17T12:34:56.000Z", 99))]);
        let reading = read_log_with(&file, NOW, &|_| false).unwrap();
        assert_eq!(reading.requests[0].state, RequestState::Interrupted);
        assert!(reading.requests[0].state.is_unfinished());
        assert_eq!(reading.requests[0].duration_microseconds(), None);
    }

    #[test]
    fn a_start_without_a_completion_is_running_when_the_process_lives_and_the_request_is_young() {
        let file = write_log("running", &[line(&start("a", "2026-10-17T12:34:56.000Z", 99))]);
        assert_eq!(read_log_with(&file, NOW, &|_| true).unwrap().requests[0].state, RequestState::Running);
        let later = NOW + STALE_AFTER_MILLISECONDS;
        assert_eq!(read_log_with(&file, later, &|_| true).unwrap().requests[0].state, RequestState::Interrupted);
    }

    #[test]
    fn the_lines_that_are_not_events_are_counted_and_skipped() {
        let file = write_log(
            "malformed",
            &[
                "not json at all".to_string(),
                "{\"v\":2,\"event\":\"start\"}".to_string(),
                "{\"v\":1,\"event\":\"start\"}".to_string(),
                line(&complete("zzz", Outcome::Success, 1)),
                line(&start("a", "2026-10-17T12:34:56.000Z", 1)),
            ],
        );
        let reading = read_log_with(&file, NOW, &|_| false).unwrap();
        assert_eq!(reading.malformed_lines, 2);
        assert_eq!(reading.unsupported_version_lines, 1);
        assert_eq!(reading.orphan_completions, 1);
        assert_eq!(reading.requests.len(), 1);
    }

    #[test]
    fn the_old_file_is_read_before_the_file() {
        let file = write_log("two_files", &[line(&start("new", "2026-10-17T12:34:56.000Z", 1))]);
        std::fs::write(rotated_file(&file), line(&start("old", "2026-10-16T12:34:56.000Z", 1)) + "\n").unwrap();
        let reading = read_log_with(&file, NOW, &|_| false).unwrap();
        assert_eq!(reading.files.len(), 2);
        assert_eq!(reading.requests[0].start.request_id, "old");
        assert_eq!(reading.requests[1].start.request_id, "new");
    }

    #[test]
    fn a_missing_log_is_an_empty_log() {
        let folder = crate::testing::new_temporary_folder("missing");
        let reading = read_log(&folder.join("none.jsonl"), NOW).unwrap();
        assert!(reading.requests.is_empty());
        assert!(reading.files.is_empty());
    }

    #[test]
    fn the_process_of_this_program_lives_and_a_huge_identifier_does_not() {
        assert!(process_is_alive(std::process::id()));
        assert_eq!(process_is_alive(4_000_000_000), false);
    }
}
