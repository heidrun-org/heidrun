//! The data shapes that the files of the package share: the user activity record, the two modes of the synchronization, and
//! the rows of a query.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// One active period of the developer in front of Heidrun, in one workspace, as the database stores it in the column `data`
/// of the table `user_activity_records`. The file `schemas/user_activity_record.schema.json` describes the same shape. The
/// three times are in UTC in the database. In the file `user_activity.jsonl`, they carry the offset of the time zone of the
/// computer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserActivityRecord {
    /// The folder of the workspace: its worktree path, or the working directory of one of its panes.
    pub workspace_folder: String,
    /// The time of the first action, in the format ISO 8601.
    pub started_at: String,
    /// The time of the last action, in the format ISO 8601.
    pub last_action_at: String,
    /// The end of the active period, in the format ISO 8601.
    pub ended_at: String,
    /// The number of keyboard actions in the active period.
    pub keyboard_action_count: i64,
    /// The number of mouse actions in the active period.
    pub mouse_action_count: i64,
    /// The reason why the active period ended: `cool_down`, `window_behind`, `workspace_changed`, or `app_closed`. The
    /// JSON schema file is the only place that lists these four values.
    pub end_reason: String,
}

/// The two modes of the synchronization.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SynchronizationMode {
    /// Reads every line of the file, and writes all the rows.
    Initialize,
    /// Reads only the records that ended after the latest end that the database holds.
    Update,
}

impl SynchronizationMode {
    /// The name of the mode, as the command line writes it.
    pub fn name(self) -> &'static str {
        match self {
            SynchronizationMode::Initialize => "initialize",
            SynchronizationMode::Update => "update",
        }
    }
}

/// What one synchronization did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SynchronizationReport {
    /// The mode of the synchronization.
    pub mode: SynchronizationMode,
    /// False when the file of the user activity records does not exist. Then nothing is read.
    pub is_file_found: bool,
    /// The number of records that the synchronization wrote.
    pub record_count: usize,
    /// The number of valid records that the synchronization did not write, because the mode update had already read them.
    /// It is 0 for the mode initialize, which writes every record.
    pub already_read_record_count: usize,
    /// The number of lines of the file that are not a user activity record that follows the JSON schema. An empty line is
    /// not counted.
    pub skipped_line_count: usize,
}

/// One row of the answer to a query: the name of each column and its value, in the order of the columns.
pub type QueryRow = Map<String, Value>;
