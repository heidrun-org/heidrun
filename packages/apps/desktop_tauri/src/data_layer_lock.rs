//! One lock for the SQLite file of the data layer. The Statistics window reads several kinds of data at the same time, and
//! each read first copies new facts into the SQLite file. The packages of the data layer set no waiting time on the file, so
//! two writes at the same time would fail with the error "database is locked". Every command that writes the file takes
//! this lock first.

use std::sync::{Mutex, MutexGuard};

/// The lock of the SQLite file of the data layer.
static LOCK: Mutex<()> = Mutex::new(());

/// Waits for the lock, and gives the guard. The lock is free again when the guard is dropped. A command that panicked
/// while it held the lock does not block the next command.
pub fn lock() -> MutexGuard<'static, ()> {
    LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}
