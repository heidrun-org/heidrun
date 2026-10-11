//! Moves the data written under the former name "Herdr Desk" to the places named "Heidrun".

use std::path::PathBuf;

/// Renames `~/.config/herdr-desk`, the former configuration folder, to `~/.config/heidrun`.
/// Does nothing when the new folder exists already.
pub fn migrate_config_dir() {
    let config = dirs::home_dir().unwrap_or_default().join(".config");
    let legacy: PathBuf = config.join("herdr-desk");
    let current: PathBuf = config.join("heidrun");
    if legacy.is_dir() && !current.exists() {
        let _ = std::fs::rename(legacy, current);
    }
}
