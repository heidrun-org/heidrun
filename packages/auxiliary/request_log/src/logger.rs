//! The log of a program: it appends the events to the log file, replaces the file when it is too large, and never fails.
//!
//! A log never changes the result of an operation and never hides its error. A write that fails is counted, and the next
//! event that is written holds the count in the field `droppedEvents`, so the loss is visible in the file itself.
//!
//! Each event is one line, written with one call to `write` on a file open in the mode append, so two programs that write
//! at the same time do not mix their lines. The log never takes a lock, and never touches the SQLite file of the data
//! layer, so it cannot add to the waits that it measures.

use crate::event::Event;
use crate::settings::{rotated_file, LogSettings};
use std::cell::RefCell;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};

/// The name of the caller that a program sets for itself, used when the environment gives none.
static DEFAULT_CALLER: OnceLock<String> = OnceLock::new();

/// The log of the program, made from the environment at the first request.
static PROGRAM_LOGGER: OnceLock<Arc<Logger>> = OnceLock::new();

thread_local! {
    /// The log that a test or a measure uses in place of the log of the program, on this thread.
    static THREAD_LOGGER: RefCell<Option<Arc<Logger>>> = const { RefCell::new(None) };
}

/// The log of a program.
pub struct Logger {
    /// The configuration of the log.
    settings: LogSettings,
    /// The number of requests that started and did not end yet, in this program.
    in_flight: AtomicU32,
    /// The number of requests that started in this program, which makes the identifiers different.
    sequence: AtomicU64,
    /// The number of events that could not be written and that no later event reported yet.
    dropped: AtomicU64,
}

impl Logger {
    /// A log with a configuration.
    pub fn new(settings: LogSettings) -> Self {
        Logger { settings, in_flight: AtomicU32::new(0), sequence: AtomicU64::new(0), dropped: AtomicU64::new(0) }
    }

    /// The configuration of the log.
    pub fn settings(&self) -> &LogSettings {
        &self.settings
    }

    /// False when the log is off. A request on a log that is off writes nothing and costs almost nothing.
    pub fn is_enabled(&self) -> bool {
        self.settings.file.is_some()
    }

    /// The name of the caller: the name that the environment gives, else the name that the program set with
    /// `set_default_caller`, else the name of the executable.
    pub fn caller(&self) -> String {
        if let Some(caller) = &self.settings.caller {
            return caller.clone();
        }
        if let Some(caller) = DEFAULT_CALLER.get() {
            return caller.clone();
        }
        std::env::current_exe()
            .ok()
            .and_then(|path| path.file_stem().map(|name| name.to_string_lossy().into_owned()))
            .unwrap_or_else(|| "unknown".to_string())
    }

    /// The number of events that could not be written and that no later event reported yet.
    pub fn dropped_events(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }

    /// The identifier of a new request: the time of the start, the process, and the number of the request, in hexadecimal.
    pub fn next_request_id(&self, started_at_milliseconds: i64) -> String {
        let sequence = self.sequence.fetch_add(1, Ordering::Relaxed);
        format!("{:x}-{:x}-{:x}", started_at_milliseconds, std::process::id(), sequence)
    }

    /// Counts a request that starts, and gives the number of requests that were already running.
    pub fn enter(&self) -> u32 {
        self.in_flight.fetch_add(1, Ordering::Relaxed)
    }

    /// Counts a request that ends.
    pub fn leave(&self) {
        self.in_flight.fetch_sub(1, Ordering::Relaxed);
    }

    /// Writes one event. The count of the events that were lost before goes into the event. Returns false when the event
    /// could not be written. It never panics and never returns an error to the operation.
    pub fn write(&self, event: &mut Event) -> bool {
        let Some(file) = &self.settings.file else {
            return false;
        };
        let lost = self.dropped.swap(0, Ordering::Relaxed);
        if lost > 0 {
            match event {
                Event::Start(start) => start.dropped_events = Some(lost),
                Event::Complete(complete) => complete.dropped_events = Some(lost),
            }
        }
        let result = serde_json::to_string(event)
            .map_err(|error| error.to_string())
            .and_then(|line| self.append(file, &line));
        if result.is_err() {
            self.dropped.fetch_add(lost + 1, Ordering::Relaxed);
            return false;
        }
        true
    }

    /// Appends one line to the file, and replaces the file by a new one first when it is larger than the maximum size.
    fn append(&self, file: &Path, line: &str) -> Result<(), String> {
        if let Some(folder) = file.parent() {
            if folder.as_os_str().is_empty() == false && folder.exists() == false {
                std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
            }
        }
        let mut text = String::with_capacity(line.len() + 1);
        text.push_str(line);
        text.push('\n');
        let mut handle = OpenOptions::new().create(true).append(true).open(file).map_err(|error| error.to_string())?;
        let size = handle.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        if size > self.settings.max_bytes {
            // The size is read again just before the rename, so a program that replaced the file a moment ago is not replaced
            // a second time. The window that remains is a few microseconds, and a loss there costs one old file.
            let is_still_large =
                std::fs::metadata(file).map(|metadata| metadata.len() > self.settings.max_bytes).unwrap_or(false);
            if is_still_large && std::fs::rename(file, rotated_file(file)).is_ok() {
                handle = OpenOptions::new().create(true).append(true).open(file).map_err(|error| error.to_string())?;
            }
        }
        handle.write_all(text.as_bytes()).map_err(|error| error.to_string())
    }
}

/// Sets the name of the caller for this program, for example `heidrun`. The environment variable
/// `HEIDRUN_REQUEST_LOG_CALLER` is stronger. The first call counts, a later one changes nothing.
pub fn set_default_caller(name: &str) {
    let _ = DEFAULT_CALLER.set(name.to_string());
}

/// The log that a request uses now: the log of the thread when a test or a measure set one, else the log of the program.
pub fn current_logger() -> Arc<Logger> {
    let on_thread = THREAD_LOGGER.with(|logger| logger.borrow().clone());
    match on_thread {
        Some(logger) => logger,
        None => PROGRAM_LOGGER.get_or_init(|| Arc::new(Logger::new(LogSettings::from_environment()))).clone(),
    }
}

/// Runs a closure with another log on this thread, then puts the previous log back, also after a panic. A test uses it to
/// read what a package wrote, and a measure uses it to write in a temporary file.
pub fn with_logger<T>(logger: Arc<Logger>, run: impl FnOnce() -> T) -> T {
    struct Restore(Option<Arc<Logger>>);
    impl Drop for Restore {
        fn drop(&mut self) {
            let previous = self.0.take();
            THREAD_LOGGER.with(|logger| *logger.borrow_mut() = previous);
        }
    }
    let previous = THREAD_LOGGER.with(|current| current.borrow_mut().replace(logger));
    let _restore = Restore(previous);
    run()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::{empty_object, RequestKind, StartEvent, FORMAT_VERSION, ORIGIN_APPLICATION};

    fn temp_file(name: &str) -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!("request-log-logger-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder.join("data_layer_requests.jsonl")
    }

    fn sample_event(request_id: &str) -> Event {
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
            started_at: "2026-10-17T12:34:56.789Z".to_string(),
            process_id: 1,
            software_version: "0.2.7".to_string(),
            concurrent_requests: 0,
            state: empty_object(),
            dropped_events: None,
        })
    }

    #[test]
    fn an_event_is_one_line_and_the_folder_is_created() {
        let file = temp_file("one_line");
        let logger = Logger::new(LogSettings::for_file(&file));
        assert!(logger.write(&mut sample_event("a")));
        assert!(logger.write(&mut sample_event("b")));
        let text = std::fs::read_to_string(&file).unwrap();
        assert_eq!(text.lines().count(), 2);
        assert!(text.lines().all(|line| serde_json::from_str::<Event>(line).is_ok()));
    }

    #[test]
    fn a_log_that_is_off_writes_nothing() {
        let logger = Logger::new(LogSettings::off());
        assert_eq!(logger.is_enabled(), false);
        assert_eq!(logger.write(&mut sample_event("a")), false);
        assert_eq!(logger.dropped_events(), 0);
    }

    #[test]
    fn a_file_that_is_too_large_is_replaced_and_the_old_file_stays() {
        let file = temp_file("rotation");
        let mut settings = LogSettings::for_file(&file);
        settings.max_bytes = 1000;
        let logger = Logger::new(settings);
        for number in 0..40 {
            assert!(logger.write(&mut sample_event(&format!("r{number}"))));
        }
        let old_file = rotated_file(&file);
        assert!(old_file.exists());
        let size = |path: &Path| std::fs::metadata(path).unwrap().len();
        assert!(size(&file) <= 1000 + 600, "the new file holds {} bytes", size(&file));
        assert!(size(&old_file) <= 1000 + 600, "the old file holds {} bytes", size(&old_file));
    }

    #[test]
    fn two_threads_do_not_mix_their_lines() {
        let file = temp_file("threads");
        let logger = Arc::new(Logger::new(LogSettings::for_file(&file)));
        let handles: Vec<_> = (0..4)
            .map(|thread_number| {
                let logger = logger.clone();
                std::thread::spawn(move || {
                    for number in 0..200 {
                        logger.write(&mut sample_event(&format!("t{thread_number}-{number}")));
                    }
                })
            })
            .collect();
        for handle in handles {
            handle.join().unwrap();
        }
        let text = std::fs::read_to_string(&file).unwrap();
        assert_eq!(text.lines().count(), 800);
        assert!(text.lines().all(|line| serde_json::from_str::<Event>(line).is_ok()));
    }

    #[test]
    fn a_write_that_fails_is_counted_and_the_next_event_reports_the_loss() {
        let folder = temp_file("failure").parent().unwrap().to_path_buf();
        std::fs::create_dir_all(&folder).unwrap();
        // A file where the folder of the log should be: the folder cannot be created.
        let blocker = folder.join("blocker");
        std::fs::write(&blocker, "x").unwrap();
        let broken = Logger::new(LogSettings::for_file(&blocker.join("inside").join("log.jsonl")));
        assert_eq!(broken.write(&mut sample_event("a")), false);
        assert_eq!(broken.write(&mut sample_event("b")), false);
        assert_eq!(broken.dropped_events(), 2);

        let file = folder.join("log.jsonl");
        let logger = Logger::new(LogSettings::for_file(&file));
        logger.dropped.store(3, Ordering::Relaxed);
        assert!(logger.write(&mut sample_event("c")));
        let text = std::fs::read_to_string(&file).unwrap();
        assert!(text.contains("\"droppedEvents\":3"), "{text}");
        assert_eq!(logger.dropped_events(), 0);
    }

    #[test]
    fn the_identifiers_of_two_requests_differ() {
        let logger = Logger::new(LogSettings::off());
        assert_ne!(logger.next_request_id(1), logger.next_request_id(1));
    }

    #[test]
    fn a_log_on_a_thread_is_put_back_after_the_closure() {
        let file = temp_file("thread_log");
        let logger = Arc::new(Logger::new(LogSettings::for_file(&file)));
        let inside = with_logger(logger.clone(), || current_logger().settings().file.clone());
        assert_eq!(inside, Some(file));
        assert!(THREAD_LOGGER.with(|current| current.borrow().is_none()));
    }
}
