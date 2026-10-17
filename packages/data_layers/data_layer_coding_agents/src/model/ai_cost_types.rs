//! The data shapes of the AI cost that the Statistics window shows: the state of each workspace, the hours, and the answer. The
//! JSON of these shapes is the JSON that the tab "Work of one person" reads.

use serde::Serialize;

/// What the SQLite file knows about the token usage of one workspace.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostWorkspace {
    /// The root of the Git repository of the workspace.
    pub folder: String,
    /// The repository in the format `owner/name`, or `None` when it cannot be found.
    pub repository: Option<String>,
    /// When the token usage of the workspace was read the last time, in the format ISO 8601, or `None` when the history of the
    /// workspace was never imported.
    pub synchronized_at: Option<String>,
    /// The message of the error when the workspace cannot be read, or `None`.
    pub error: Option<String>,
}

/// What a refresh of the AI cost did.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostSynchronization {
    /// The state of each workspace after the refresh.
    pub workspaces: Vec<AiCostWorkspace>,
    /// The message of the error when the prices of the models could not be refreshed, or `None`. The latest known prices stay
    /// in use.
    pub price_warning: Option<String>,
}

/// The tokens and the cost of one coding agent in one hour: a slot of one hour of a day of the time zone.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostHour {
    /// The start of the hour, in UTC, in the format ISO 8601. It is the start of the day in the time zone plus a whole number of
    /// hours, so in a time zone with a half hour offset it is at a half hour of UTC.
    pub started_at: String,
    /// The date, in the time zone, of the day that holds the hour, in the format `YYYY-MM-DD`.
    pub day: String,
    /// The identifier of the coding agent: `claude` or `codex`.
    pub coding_agent: String,
    /// The tokens of the hour: the input tokens (with the ones read from the cache and written to it) and the output tokens.
    pub tokens: u64,
    /// The estimated cost in US dollars of the tokens that have a known price, or `None` when no token of the hour has one.
    pub cost_usd: Option<f64>,
    /// The tokens of the hour whose model has no known price. They are in `tokens` and not in `cost_usd`.
    pub unpriced_tokens: u64,
}

/// What the AI cost query gives.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostAnswer {
    /// The state of each workspace. A workspace that was never imported gives no day.
    pub workspaces: Vec<AiCostWorkspace>,
    /// The tokens and the cost of each coding agent in each hour that had tokens, the oldest hour first.
    pub hours: Vec<AiCostHour>,
    /// The number of the version of the prices that the costs use, or `None` when no price is stored.
    pub price_version: Option<i64>,
    /// When the price list was checked the last time, in the format ISO 8601, or `None` when no price is stored.
    pub prices_checked_at: Option<String>,
}
