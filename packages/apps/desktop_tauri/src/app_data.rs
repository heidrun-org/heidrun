//! The folder of the data of Heidrun, and the paths of the files in it. This file reads the environment and opens no file.

use std::path::PathBuf;
use std::sync::Mutex;

/// The folder of the data of Heidrun: `HEIDRUN_DIR`, else `~/.config/heidrun`.
pub(crate) fn data_dir() -> PathBuf {
    std::env::var("HEIDRUN_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_default().join(".config").join("heidrun"))
}

/// The file where the web page appends the records of the activity of the user: `user_activity.jsonl` in the folder of the data
/// of Heidrun.
pub(crate) fn user_activity_file_path() -> PathBuf {
    data_dir().join("user_activity.jsonl")
}

/// An append to the file of the records of the activity of the user and a read of the whole file never run at the same time, so
/// that a reader never sees half a line.
pub(crate) static USER_ACTIVITY_FILE_LOCK: Mutex<()> = Mutex::new(());
