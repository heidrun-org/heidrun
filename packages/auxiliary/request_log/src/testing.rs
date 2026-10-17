//! Reading back what a package wrote, for the tests of the packages and for the measures.
//!
//! The functions are public because the tests of every data layer package use them. They write in a temporary file, so a test
//! never touches the log of the developer, and they work on the thread of the caller only, so the tests of a package can run
//! in parallel.

use crate::event::{CompleteEvent, Event, StartEvent};
use crate::logger::{with_logger, Logger};
use crate::settings::LogSettings;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// The number of captures in this program, which makes the temporary files different.
static CAPTURE_COUNT: AtomicU64 = AtomicU64::new(0);

/// A new temporary folder, with a path that no other capture of this program uses.
pub fn new_temporary_folder(name: &str) -> PathBuf {
    let number = CAPTURE_COUNT.fetch_add(1, Ordering::Relaxed);
    let folder = std::env::temp_dir().join(format!("request-log-{}-{number}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&folder);
    folder
}

/// The start events of a list of events, in the order in which they were written.
pub fn starts(events: &[Event]) -> Vec<&StartEvent> {
    events
        .iter()
        .filter_map(|event| match event {
            Event::Start(start) => Some(start),
            Event::Complete(_) => None,
        })
        .collect()
}

/// The completion event of a request, or `None` when the request did not end.
pub fn completion_of<'a>(events: &'a [Event], request_id: &str) -> Option<&'a CompleteEvent> {
    events.iter().find_map(|event| match event {
        Event::Complete(complete) if complete.request_id == request_id => Some(complete),
        _ => None,
    })
}

/// The start events of a list of events as lines of the form `package.operation`, with two spaces of indentation for each
/// level of nesting, so a test compares the whole tree of the requests in one assertion.
pub fn tree(events: &[Event]) -> Vec<String> {
    let mut depths: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    let mut lines = Vec::new();
    for start in starts(events) {
        let depth = start.parent_request_id.as_deref().and_then(|parent| depths.get(parent)).map(|depth| depth + 1).unwrap_or(0);
        depths.insert(&start.request_id, depth);
        lines.push(format!("{}{}.{}", "  ".repeat(depth), start.package, start.operation));
    }
    lines
}

/// Runs a closure with a log that writes in a temporary file, then gives the result of the closure and the events that the
/// requests of the closure wrote, in the order in which they were written.
pub fn capture<T>(run: impl FnOnce() -> T) -> (T, Vec<Event>) {
    let folder = new_temporary_folder("capture");
    let file = folder.join("data_layer_requests.jsonl");
    let logger = Arc::new(Logger::new(LogSettings::for_file(&file)));
    let result = with_logger(logger, run);
    let events = std::fs::read_to_string(&file)
        .unwrap_or_default()
        .lines()
        .filter_map(|line| serde_json::from_str::<Event>(line).ok())
        .collect();
    let _ = std::fs::remove_dir_all(&folder);
    (result, events)
}
