//! One lock for the SQLite file of the data layer, for the threads of one program and for the programs of one computer.
//!
//! The data layer packages set no waiting time on the file, so two writes at the same time fail with the error "database
//! is locked". The desktop application and the command `heidrun_code_data update` both take this lock before each write. It has
//! two parts: a lock in the memory of the program, for its threads, and a lock of the file `<database>.lock` with the lock
//! of the operating system, for the other programs. The operating system frees the lock of the file when the program
//! ends, even when it crashes.

use std::fs::{File, TryLockError};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, TryLockError as ThreadTryLockError};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// The lock of the threads of this program.
static THREAD_LOCK: Mutex<()> = Mutex::new(());

/// The held lock of the SQLite file. The lock is free again when the value is dropped.
pub struct DatabaseLock {
    /// The open file `<database>.lock`, locked by the operating system while it is open.
    _file: File,
    /// The guard of the lock of the threads of this program.
    _thread_guard: MutexGuard<'static, ()>,
}

/// The path of the lock file of a SQLite file: the same path with `.lock` at the end.
pub fn lock_file_path(database_path: &Path) -> PathBuf {
    let mut name = database_path.as_os_str().to_owned();
    name.push(".lock");
    PathBuf::from(name)
}

/// Waits until no other thread and no other program holds the lock of the SQLite file, and takes it. A thread that
/// panicked while it held the lock does not block the next one.
///
/// # Errors
/// An error when the folder or the lock file cannot be created, or when the operating system refuses the lock.
pub fn lock_database(database_path: &Path) -> Result<DatabaseLock, String> {
    lock_database_and_report_wait(database_path, &|_| {})
}

/// Takes the lock of the SQLite file like `lock_database`, and gives the line `waiting for the lock file <path>` to `log`
/// when another thread or another program holds the lock, before it waits.
///
/// # Errors
/// An error when the folder or the lock file cannot be created, or when the operating system refuses the lock.
pub fn lock_database_and_report_wait(database_path: &Path, log: &dyn Fn(&str)) -> Result<DatabaseLock, String> {
    let has_waited = std::cell::Cell::new(false);
    let spec = OperationSpec::new(OPERATION_PACKAGE, "lock_database", OperationKind::Lock).parameter("databasePath", database_path.display().to_string());
    let log_the_wait = |message: &str| {
        has_waited.set(true);
        log(message);
    };
    record(spec, || lock_database_and_report_wait_inside(database_path, &log_the_wait), |_| {
        Summary::none().detail("hasWaited", has_waited.get())
    })
}

/// The work of `lock_database_and_report_wait`, between the start event and the completion event of its operation.
fn lock_database_and_report_wait_inside(database_path: &Path, log: &dyn Fn(&str)) -> Result<DatabaseLock, String> {
    let path = lock_file_path(database_path);
    let wait_message = format!("waiting for the lock file {}", path.display());
    let thread_guard = match THREAD_LOCK.try_lock() {
        Ok(guard) => guard,
        Err(ThreadTryLockError::Poisoned(poisoned)) => poisoned.into_inner(),
        Err(ThreadTryLockError::WouldBlock) => {
            log(&wait_message);
            THREAD_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
        }
    };
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder)
            .map_err(|error| format!("The folder {} cannot be created: {error}", folder.display()))?;
    }
    let file = File::options()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&path)
        .map_err(|error| format!("The lock file {} cannot be opened: {error}", path.display()))?;
    let lock_error = |error: std::io::Error| format!("The lock file {} cannot be locked: {error}", path.display());
    match file.try_lock() {
        Ok(()) => {}
        Err(TryLockError::WouldBlock) => {
            log(&wait_message);
            file.lock().map_err(lock_error)?;
        }
        Err(TryLockError::Error(error)) => return Err(lock_error(error)),
    }
    Ok(DatabaseLock { _file: file, _thread_guard: thread_guard })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    /// The path of a SQLite file in a new folder that does not exist yet.
    fn database_path(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_code_data_lock_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder.join("a_folder").join("data_layer.sqlite")
    }

    #[test]
    fn puts_the_lock_file_next_to_the_sqlite_file() {
        assert_eq!(lock_file_path(Path::new("/a/data_layer.sqlite")), PathBuf::from("/a/data_layer.sqlite.lock"));
    }

    #[test]
    fn creates_the_folder_and_the_lock_file_and_frees_the_lock_when_dropped() {
        let path = database_path("free");
        drop(lock_database(&path).unwrap());
        assert!(lock_file_path(&path).exists());
        assert!(!path.exists());
        drop(lock_database(&path).unwrap());
    }

    #[test]
    fn a_second_thread_waits_until_the_first_one_frees_the_lock() {
        let path = database_path("threads");
        let guard = lock_database(&path).unwrap();
        let is_taken = Arc::new(AtomicBool::new(false));
        let thread = {
            let path = path.clone();
            let is_taken = Arc::clone(&is_taken);
            std::thread::spawn(move || {
                let _guard = lock_database(&path).unwrap();
                is_taken.store(true, Ordering::SeqCst);
            })
        };
        std::thread::sleep(Duration::from_millis(200));
        assert!(!is_taken.load(Ordering::SeqCst));
        drop(guard);
        thread.join().unwrap();
        assert!(is_taken.load(Ordering::SeqCst));
    }

    #[test]
    fn reports_the_wait_when_another_program_holds_the_lock_file() {
        let path = database_path("report");
        drop(lock_database(&path).unwrap());
        let other_program = File::options().write(true).open(lock_file_path(&path)).unwrap();
        other_program.lock().unwrap();
        let lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let thread = {
            let path = path.clone();
            let lines = Arc::clone(&lines);
            std::thread::spawn(move || {
                let log = |line: &str| lines.lock().unwrap().push(line.to_string());
                drop(lock_database_and_report_wait(&path, &log).unwrap());
            })
        };
        std::thread::sleep(Duration::from_millis(200));
        drop(other_program);
        thread.join().unwrap();
        let expected = format!("waiting for the lock file {}", lock_file_path(&path).display());
        assert!(lines.lock().unwrap().contains(&expected));
    }
}
