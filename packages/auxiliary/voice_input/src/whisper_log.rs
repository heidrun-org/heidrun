//! The logs of whisper.cpp and ggml. They are long (one line for each token of the speech), so they go to a file and never to the
//! terminal of the developer.

use std::ffi::{c_char, c_void, CStr};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, Once};
use std::time::{SystemTime, UNIX_EPOCH};
use whisper_rs::whisper_rs_sys::ggml_log_level;

/// A log file that is larger than this when the log opens is renamed to `<name>.old`, and a new file starts.
pub const MAXIMUM_FILE_BYTES: u64 = 4 * 1024 * 1024;

/// One run of the application writes at most this many bytes to the log file.
pub const MAXIMUM_RUN_BYTES: u64 = 16 * 1024 * 1024;

/// The hook is installed once for the whole process.
static HOOK: Once = Once::new();

/// The log file, or nothing before `write_to_file` runs. Without a file, the text of the logs is dropped.
static FILE: Mutex<Option<File>> = Mutex::new(None);

/// The bytes written to the log file since the application started.
static WRITTEN_BYTES: AtomicU64 = AtomicU64::new(0);

/// Sends every log of whisper.cpp and ggml to the function `write_text`, so that they never reach the terminal. The call is safe to
/// repeat. `Transcriber::new` calls it, so the logs stay out of the terminal even when no file is set.
pub(crate) fn install_hook() {
    HOOK.call_once(|| unsafe {
        whisper_rs::whisper_rs_sys::whisper_log_set(Some(trampoline), std::ptr::null_mut());
        whisper_rs::whisper_rs_sys::ggml_log_set(Some(trampoline), std::ptr::null_mut());
    });
}

/// Writes the logs of whisper.cpp and ggml to the file `path`. The folder of the file is created. A file that is larger than
/// `MAXIMUM_FILE_BYTES` is renamed to `<name>.old` first, and replaces the older `.old` file. The hook is installed even when the
/// file cannot open: the logs are then dropped, and the error says why.
pub fn write_to_file(path: &Path) -> std::io::Result<()> {
    install_hook();
    let mut file = open_log_file(path)?;
    let seconds = SystemTime::now().duration_since(UNIX_EPOCH).map(|duration| duration.as_secs()).unwrap_or(0);
    file.write_all(format!("\n--- The Whisper log opened at {seconds} seconds since 1970 ---\n").as_bytes())?;
    WRITTEN_BYTES.store(0, Ordering::Relaxed);
    let mut guard = FILE.lock().map_err(|_| std::io::Error::other("the log file lock is broken"))?;
    *guard = Some(file);
    Ok(())
}

/// Opens the log file for appending, after the rotation of a file that is too large.
fn open_log_file(path: &Path) -> std::io::Result<File> {
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder)?;
    }
    if fs::metadata(path).map(|metadata| metadata.len() > MAXIMUM_FILE_BYTES).unwrap_or(false) {
        fs::rename(path, old_path(path))?;
    }
    OpenOptions::new().create(true).append(true).open(path)
}

/// The path that a log file that is too large is renamed to.
fn old_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".old");
    PathBuf::from(name)
}

/// Appends a text to the log file. It does nothing without a file, after the limit of one run, or when the write fails. It never
/// panics, because it runs inside a callback of C code.
fn write_text(text: &str) {
    if WRITTEN_BYTES.load(Ordering::Relaxed) > MAXIMUM_RUN_BYTES {
        return;
    }
    let Ok(mut guard) = FILE.lock() else {
        return;
    };
    let Some(file) = guard.as_mut() else {
        return;
    };
    if file.write_all(text.as_bytes()).is_ok() {
        WRITTEN_BYTES.fetch_add(text.len() as u64, Ordering::Relaxed);
    }
}

/// The callback of whisper.cpp and ggml. The level is not written: a line that continues another line has its own level, and the
/// text already holds its line breaks.
unsafe extern "C" fn trampoline(_level: ggml_log_level, text: *const c_char, _user_data: *mut c_void) {
    if text.is_null() {
        return;
    }
    let text = unsafe { CStr::from_ptr(text) }.to_string_lossy();
    write_text(&text);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;

    /// A new empty folder for one test.
    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("voice_input_log_{name}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn the_log_file_and_its_folder_are_created() {
        let folder = temporary_folder("created");
        let path = folder.join("logs").join("whisper.log");
        let file = open_log_file(&path).unwrap();
        drop(file);
        assert!(path.is_file());
    }

    #[test]
    fn the_log_file_is_appended_to_and_never_emptied() {
        let folder = temporary_folder("appended");
        let path = folder.join("whisper.log");
        open_log_file(&path).unwrap().write_all(b"first\n").unwrap();
        open_log_file(&path).unwrap().write_all(b"second\n").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "first\nsecond\n");
    }

    #[test]
    fn a_log_file_that_is_too_large_is_renamed_and_a_new_file_starts() {
        let folder = temporary_folder("rotated");
        let path = folder.join("whisper.log");
        fs::write(&path, vec![b'x'; MAXIMUM_FILE_BYTES as usize + 1]).unwrap();
        fs::write(old_path(&path), b"older").unwrap();
        open_log_file(&path).unwrap().write_all(b"new\n").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new\n");
        assert_eq!(fs::metadata(old_path(&path)).unwrap().len(), MAXIMUM_FILE_BYTES + 1);
    }

    #[test]
    fn a_log_file_of_the_maximum_size_is_kept() {
        let folder = temporary_folder("kept");
        let path = folder.join("whisper.log");
        fs::write(&path, vec![b'x'; MAXIMUM_FILE_BYTES as usize]).unwrap();
        open_log_file(&path).unwrap().write_all(b"more").unwrap();
        assert!(old_path(&path).exists() == false);
        assert_eq!(fs::metadata(&path).unwrap().len(), MAXIMUM_FILE_BYTES + 4);
    }

    #[test]
    fn the_old_path_adds_old_to_the_file_name() {
        assert_eq!(old_path(Path::new("/data/logs/whisper.log")), PathBuf::from("/data/logs/whisper.log.old"));
    }

    #[test]
    fn a_log_file_that_cannot_open_gives_an_error() {
        let folder = temporary_folder("error");
        let blocker = folder.join("blocker");
        fs::write(&blocker, b"a file, not a folder").unwrap();
        assert!(write_to_file(&blocker.join("whisper.log")).is_err());
    }

    /// The only test that sets the log file of the process, because the file is global.
    #[test]
    fn the_text_of_the_callback_goes_to_the_log_file() {
        let folder = temporary_folder("callback");
        let path = folder.join("logs").join("whisper.log");
        write_to_file(&path).unwrap();
        let text = CString::new("whisper_full_with_state: id = 3, token = 286\n").unwrap();
        unsafe { trampoline(0, text.as_ptr(), std::ptr::null_mut()) };
        unsafe { trampoline(0, std::ptr::null(), std::ptr::null_mut()) };
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("--- The Whisper log opened at "));
        assert!(content.contains("whisper_full_with_state: id = 3, token = 286\n"));
    }
}
