//! The data shapes of the token usage: what one chat session used in each minute, how it is written in the database, and how
//! it is asked for and given back.
//!
//! The package stores the tokens that a chat session used for each minute, in UTC, with the four categories of tokens. A
//! minute is the minute of the record that reports the tokens of a request: the package does not measure the generation of
//! the tokens one by one.

use crate::model::types::{CodingAgent, SynchronizationMode};

/// The minute that a request whose record has no date has in `TokensByMinute`. No real minute has this number.
pub const UNDATED_MINUTE: i64 = i64::MIN;

/// The number of milliseconds in one minute.
pub const MINUTE_MILLISECONDS: i64 = 60_000;

/// The tokens that one chat session used with one model in one minute.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MinuteTokens {
    /// The minute, as the number of whole minutes since 1 January 1970 00:00 UTC.
    pub minute: i64,
    /// The name of the model. It is an empty text when the model is not known.
    pub model: String,
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    pub fresh_input: u64,
    /// The input tokens that the provider read from its cache.
    pub cached_input: u64,
    /// The input tokens that the provider wrote to its cache.
    pub cache_write_input: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output: u64,
}

/// The token usage of one chat session: where it started, when its files changed, and the tokens of each minute.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatTokenUsage {
    /// The name of the chat session file of Claude Code, or the identifier of the chat session of Codex.
    pub id: String,
    /// The coding agent that wrote the chat session.
    pub coding_agent: CodingAgent,
    /// The folder where the chat session started. A workspace owns the chat sessions that started in its folder or in a folder
    /// below it.
    pub folder: String,
    /// The date of the last change of the files of the chat session, in the format ISO 8601: its file, and the files of its
    /// subagents and of its workflows.
    pub updated_at: String,
    /// The tokens of each minute and each model, sorted by minute, then by model. A minute and a model are there once.
    pub minutes: Vec<MinuteTokens>,
}

/// How many rows of the table `token_usage_minutes` a write inserted, changed, deleted, and left as they were.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct TokenUsageWriteCount {
    /// The rows that did not exist.
    pub inserted_count: usize,
    /// The rows that existed with other tokens.
    pub updated_count: usize,
    /// The rows that the files of the chat session do not hold any more.
    pub deleted_count: usize,
    /// The rows that already held the same tokens.
    pub unchanged_count: usize,
}

impl TokenUsageWriteCount {
    /// The number of rows that the write changed in the database: the inserted rows and the updated rows.
    pub fn written_count(&self) -> usize {
        self.inserted_count + self.updated_count
    }

    /// Adds the counts of `other` to these counts.
    pub fn add(&mut self, other: &TokenUsageWriteCount) {
        self.inserted_count += other.inserted_count;
        self.updated_count += other.updated_count;
        self.deleted_count += other.deleted_count;
        self.unchanged_count += other.unchanged_count;
    }
}

/// What one synchronization of the token usage did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TokenUsageReport {
    /// The mode of the synchronization.
    pub mode: SynchronizationMode,
    /// The repository that was read, in the format `owner/name`.
    pub repository: String,
    /// The root folder of the workspace that was read.
    pub folder: String,
    /// The date of the last read of this workspace. A chat session whose files changed before this date was not read. `None`:
    /// no limit.
    pub since: Option<String>,
    /// The number of chat sessions that were read.
    pub chat_count: usize,
    /// What the write did to the rows of the table `token_usage_minutes`.
    pub row_count: TokenUsageWriteCount,
}

/// What the database knows about the last synchronization of one workspace.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TokenUsageSynchronization {
    /// The repository, in the format `owner/name`.
    pub repository: String,
    /// The root folder of the workspace.
    pub folder: String,
    /// When the last synchronization of this workspace ended, in the format ISO 8601. It tells how fresh the token usage is.
    pub synchronized_at: String,
    /// The date of the newest change of a chat session file that this workspace read, in the format ISO 8601. The next
    /// synchronization in the mode update starts from it. `None` when the workspace has no chat session file.
    pub read_up_to: Option<String>,
    /// The name of the mode of the last synchronization, `initialize` or `update`.
    pub mode: String,
}

/// How the rows of the token usage are cut in periods.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UsageGrouping {
    /// One period for each minute, in UTC.
    Minute,
    /// One period for each hour, in UTC.
    Hour,
    /// One period for each calendar day of a time zone. A day lasts 23 or 25 hours when the time zone changes its clock.
    Day {
        /// The name of the time zone in the IANA database, for example `Europe/Paris`.
        time_zone: String,
    },
    /// One period for each slot of a calendar day of a time zone: the first slot starts at the start of the day, and each slot
    /// lasts `hours` hours. A slot never crosses the end of its day, so the last slot of a day is shorter when `hours` does not
    /// divide the length of the day: the day of 23 hours has a last slot of 5 hours for slots of 6 hours, and the day of 25 hours
    /// has an extra last slot of 1 hour.
    Slot {
        /// The length of a slot in hours: from 1 to 23. A slot of 24 hours is a day, which is the grouping `Day`.
        hours: u32,
        /// The name of the time zone in the IANA database, for example `Europe/Paris`.
        time_zone: String,
    },
}

impl UsageGrouping {
    /// The grouping of a name: `minute`, `hour`, or `day`. A day needs the name of a time zone.
    ///
    /// # Errors
    /// An error when the name is not one of the three names.
    pub fn from_name(name: &str, time_zone: &str) -> Result<UsageGrouping, String> {
        match name {
            "minute" => Ok(UsageGrouping::Minute),
            "hour" => Ok(UsageGrouping::Hour),
            "day" => Ok(UsageGrouping::Day { time_zone: time_zone.to_string() }),
            _ => Err(format!("The grouping {name} is not known: use minute, hour, or day.")),
        }
    }

    /// The grouping by slots of `hours` hours in a time zone. A slot of 24 hours is a day, so it gives the grouping `Day`.
    pub fn by_hours(hours: u32, time_zone: &str) -> UsageGrouping {
        if hours == HOURS_IN_A_DAY {
            return UsageGrouping::Day { time_zone: time_zone.to_string() };
        }
        UsageGrouping::Slot { hours, time_zone: time_zone.to_string() }
    }

    /// The name of the grouping.
    pub fn name(&self) -> &'static str {
        match self {
            UsageGrouping::Minute => "minute",
            UsageGrouping::Hour => "hour",
            UsageGrouping::Day { .. } => "day",
            UsageGrouping::Slot { .. } => "slot",
        }
    }
}

/// The number of hours of a slot that is a whole day.
const HOURS_IN_A_DAY: u32 = 24;

/// A question about the token usage of a workspace in a time range.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UsageQuery {
    /// The repository, in the format `owner/name`.
    pub repository: String,
    /// The root folders of the workspaces. A chat session counts when it started in one of these folders or below one of them,
    /// and it counts once when two workspaces overlap. An empty list asks for every chat session of the repository.
    pub folders: Vec<String>,
    /// The start of the time range, in milliseconds since 1970. A minute counts when its start is at or after this time.
    pub since: i64,
    /// The end of the time range, in milliseconds since 1970. A minute counts when its start is before this time.
    pub until: i64,
    /// How the rows are cut in periods.
    pub grouping: UsageGrouping,
    /// True to give one row for each chat session. False to add the chat sessions together.
    pub is_by_chat: bool,
}

/// The tokens of one coding agent and one model in one period, with the chat session when the query asked for it, and their
/// estimated cost.
#[derive(Debug, Clone, PartialEq)]
pub struct UsageRow {
    /// The start of the period, in UTC, in the format ISO 8601. For a day, it is the start of the day in the time zone. For a
    /// slot, it is the start of the slot.
    pub period_start: String,
    /// For a day or a slot, the date of the day in the time zone, in the format `YYYY-MM-DD`. `None` for a minute and for an hour.
    pub local_day: Option<String>,
    /// The chat session, when the query asked for one row for each chat session.
    pub chat_session_id: Option<String>,
    /// The coding agent that wrote the chat sessions.
    pub coding_agent: CodingAgent,
    /// The name of the model. It is an empty text when the model is not known.
    pub model: String,
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    pub fresh_input: u64,
    /// The input tokens that the provider read from its cache.
    pub cached_input: u64,
    /// The input tokens that the provider wrote to its cache.
    pub cache_write_input: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output: u64,
    /// The estimated cost in US dollars, from the view `token_usage_with_cost`. `None` when the model has no known price: the
    /// cost is unknown, and it is never zero.
    pub cost_usd: Option<f64>,
}

impl UsageRow {
    /// Every token of the row: the input tokens of the three kinds, and the output tokens.
    pub fn token_count(&self) -> u64 {
        self.fresh_input + self.cached_input + self.cache_write_input + self.output
    }
}

/// The sum of the rows of a query. The cost is the sum of the rows that have a known cost, and the unknown costs are counted
/// apart, so a total never looks complete when it is not.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct UsageTotals {
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    pub fresh_input: u64,
    /// The input tokens that the provider read from its cache.
    pub cached_input: u64,
    /// The input tokens that the provider wrote to its cache.
    pub cache_write_input: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output: u64,
    /// The sum of the known costs, in US dollars. It is a lower bound of the cost when `unpriced_row_count` is not zero.
    pub known_cost_usd: f64,
    /// The number of rows whose cost is known.
    pub priced_row_count: usize,
    /// The number of rows whose cost is unknown, because their model has no known price.
    pub unpriced_row_count: usize,
    /// The tokens of the rows whose cost is unknown.
    pub unpriced_token_count: u64,
}

impl UsageTotals {
    /// The sum of `rows`.
    pub fn of(rows: &[UsageRow]) -> UsageTotals {
        let mut totals = UsageTotals::default();
        for row in rows {
            totals.fresh_input += row.fresh_input;
            totals.cached_input += row.cached_input;
            totals.cache_write_input += row.cache_write_input;
            totals.output += row.output;
            match row.cost_usd {
                Some(cost) => {
                    totals.known_cost_usd += cost;
                    totals.priced_row_count += 1;
                }
                None => {
                    totals.unpriced_row_count += 1;
                    totals.unpriced_token_count += row.token_count();
                }
            }
        }
        totals
    }

    /// Every token of the rows.
    pub fn token_count(&self) -> u64 {
        self.fresh_input + self.cached_input + self.cache_write_input + self.output
    }

    /// True when every row has a known cost, so `known_cost_usd` is the whole cost and not a part of it.
    pub fn is_complete(&self) -> bool {
        self.unpriced_row_count == 0
    }

    /// The known cost in US dollars, or `None` when no row has a known cost: an unknown cost is never shown as zero. It is a
    /// part of the cost when `is_complete` is false.
    pub fn cost_usd(&self) -> Option<f64> {
        (self.priced_row_count > 0).then_some(self.known_cost_usd)
    }
}
