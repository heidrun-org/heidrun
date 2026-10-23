//! The configuration of the log: where the file is, how large it grows, and who the caller is.

use std::path::{Path, PathBuf};

/// The environment variable that holds the path of the log file. The value `off` turns the log off.
pub const LOG_FILE_VARIABLE: &str = "HEIDRUN_CODE_OPERATION_LOG_FILE";

/// The environment variable that holds the name of the caller, for a program that wants another name than its own.
pub const CALLER_VARIABLE: &str = "HEIDRUN_CODE_OPERATION_LOG_CALLER";

/// The value of the variable `HEIDRUN_CODE_OPERATION_LOG_FILE` that turns the log off.
pub const OFF_VALUE: &str = "off";

/// The name of the log file in the folder of the data of Heidrun Code.
pub const LOG_FILE_NAME: &str = "data_layer_operations.jsonl";

/// The size at which the log file is replaced by a new one, in bytes: 8 MiB. The old file stays, so the log never holds more
/// than twice this size.
pub const DEFAULT_MAX_BYTES: u64 = 8 * 1024 * 1024;

/// The configuration of a log.
#[derive(Debug, Clone, PartialEq)]
pub struct LogSettings {
    /// The path of the log file, or `None` when the log is off.
    pub file: Option<PathBuf>,
    /// The size at which the file is replaced, in bytes.
    pub max_bytes: u64,
    /// The name of the caller that the environment sets, or `None` when the program chooses it.
    pub caller: Option<String>,
}

impl LogSettings {
    /// The configuration of the environment: the variable `HEIDRUN_CODE_OPERATION_LOG_FILE` gives the file, or else the file
    /// `data_layer_operations.jsonl` in the folder of the data of Heidrun Code, and the variable `HEIDRUN_CODE_OPERATION_LOG_CALLER` gives
    /// the caller. A test program of Cargo writes no log unless the variable gives a file, so the tests of the packages never
    /// fill the log of the developer.
    pub fn from_environment() -> Self {
        let file = match non_empty_variable(LOG_FILE_VARIABLE) {
            Some(value) if value == OFF_VALUE => None,
            Some(value) => Some(PathBuf::from(value)),
            None if is_cargo_test_program() => None,
            None => Some(default_log_file()),
        };
        LogSettings { file, max_bytes: DEFAULT_MAX_BYTES, caller: non_empty_variable(CALLER_VARIABLE) }
    }

    /// A configuration that writes in a file, with the default size.
    pub fn for_file(file: &Path) -> Self {
        LogSettings { file: Some(file.to_path_buf()), max_bytes: DEFAULT_MAX_BYTES, caller: None }
    }

    /// A configuration that writes nothing.
    pub fn off() -> Self {
        LogSettings { file: None, max_bytes: DEFAULT_MAX_BYTES, caller: None }
    }
}

/// The path of the log file when nobody gives another one: in the folder of the variable `HEIDRUN_CODE_DIR`, or else in
/// `~/.config/heidrun_code`, the folder of the SQLite file of the data layer.
pub fn default_log_file() -> PathBuf {
    let folder = match non_empty_variable("HEIDRUN_CODE_DIR").or_else(|| non_empty_variable("HEIDRUN_DIR")) {
        Some(folder) => PathBuf::from(folder),
        None => default_data_folder(&dirs::home_dir().unwrap_or_default()),
    };
    folder.join(LOG_FILE_NAME)
}

/// The path of the old file, the one that a log keeps after it replaced its file: the path of the log file and `.1`.
pub fn rotated_file(file: &Path) -> PathBuf {
    let mut name = file.as_os_str().to_os_string();
    name.push(".1");
    PathBuf::from(name)
}

/// True when the program is a test program of Cargo: an executable in a folder named `deps`, as Cargo builds them.
pub fn is_cargo_test_program() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().and_then(|folder| folder.file_name()).map(|name| name == "deps"))
        .unwrap_or(false)
}

/// The value of an environment variable, or `None` when it is not set or empty.
fn non_empty_variable(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| value.is_empty() == false)
}

/// `~/.config/heidrun_code`, or the former folder `~/.config/heidrun` when it exists and the new folder does not.
fn default_data_folder(home: &std::path::Path) -> PathBuf {
    let current = home.join(".config").join("heidrun_code");
    let former = home.join(".config").join("heidrun");
    if current.is_dir() == false && former.is_dir() {
        return former;
    }
    current
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_old_file_has_the_name_of_the_file_and_one() {
        assert_eq!(rotated_file(Path::new("/a/b.jsonl")), PathBuf::from("/a/b.jsonl.1"));
    }

    #[test]
    fn this_test_program_is_a_test_program_of_cargo_so_its_log_is_off_unless_a_file_is_given() {
        assert!(is_cargo_test_program());
        if std::env::var(LOG_FILE_VARIABLE).is_err() {
            assert_eq!(LogSettings::from_environment().file, None);
        }
    }

    #[test]
    fn the_default_file_is_in_a_folder_named_heidrun() {
        let file = default_log_file();
        assert_eq!(file.file_name().unwrap(), LOG_FILE_NAME);
    }

    #[test]
    fn a_configuration_for_a_file_has_the_default_size_and_no_caller() {
        let settings = LogSettings::for_file(Path::new("/a/b.jsonl"));
        assert_eq!(settings.max_bytes, DEFAULT_MAX_BYTES);
        assert_eq!(settings.caller, None);
        assert_eq!(LogSettings::off().file, None);
    }
}
