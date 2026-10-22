//! `heidrun_ctrl`: the command line that controls the Heidrun application, for a coding agent.
//!
//! This library shares the macro and launcher file operations with the desktop application.
//! The binary also controls workspaces through Herdr; those operations stay outside this library.
//! The macros and launchers each have four orders. The orders are list, add, update, and
//! delete. The library holds what the command line and the desktop application share, so that the format of each file has
//! one place: the hard-coded macros, the file of the personal macros, the keys `prompts` and `launchers` of the file
//! `.heidrun/config.json`, the orders, and the output. The package knows nothing about Tauri.

mod hard_coded_macros;
mod ids;
mod launcher_orders;
mod launcher_output;
mod launcher_types;
mod macro_orders;
mod macro_types;
mod output;
mod personal_macros;
mod project_config_file;
mod project_launchers;
mod project_macros;

pub use hard_coded_macros::hard_coded_macros;
pub use launcher_orders::{
    add_launcher, delete_launcher, label_from_command, list_launchers, update_launcher, LauncherChanges, NewLauncher,
};
pub use launcher_output::{launcher_changed_text, launcher_deleted_text, launcher_list_text};
pub use launcher_types::Launcher;
pub use macro_orders::{add_macro, delete_macro, list_macros, update_macro, MacroChanges, MacroPlaces, NewMacro};
pub use macro_types::{ListedMacro, Macro, MacroKind};
pub use output::{changed_text, deleted_text, error_text, list_text, Format};
pub use personal_macros::{data_folder, personal_macros_path, read_personal_macros, write_personal_macros};
pub use project_config_file::{find_project_root, project_config_path};
pub use project_launchers::read_project_launchers;
pub use project_macros::read_project_macros;
