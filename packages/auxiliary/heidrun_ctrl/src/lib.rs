//! `heidrun_ctrl`: the command line that controls the Heidrun application, for a coding agent.
//!
//! The first step is the macros: list, add, update, and delete. The library holds what the command line and the desktop
//! application share, so that the format of each file has one place: the hard-coded macros, the file of the personal
//! macros, the key `prompts` of the file `.heidrun/config.json`, the four orders, and the output. The package knows
//! nothing about Tauri.

mod hard_coded_macros;
mod macro_orders;
mod macro_types;
mod output;
mod personal_macros;
mod project_macros;

pub use hard_coded_macros::hard_coded_macros;
pub use macro_orders::{add_macro, delete_macro, list_macros, update_macro, MacroChanges, MacroPlaces, NewMacro};
pub use macro_types::{ListedMacro, Macro, MacroKind};
pub use output::{changed_text, deleted_text, error_text, list_text, Format};
pub use personal_macros::{data_folder, personal_macros_path, read_personal_macros, write_personal_macros};
pub use project_macros::{find_project_root, project_config_path, read_project_macros};
