//! The command `usage`: the tokens and the estimated cost of a workspace in a time range, by minute, by hour, or by day.
//!
//! The command reads the SQLite file only. It never opens a chat session file, so it is as fast as a query. The tokens come from
//! the table `token_usage_minutes`, written by `update` and `initialize` for the source `coding_agents`, and the cost comes from
//! the view `token_usage_with_cost`, at the prices of the latest version. A period whose model has no known price has no cost:
//! `costUsd` is null when no row of the period has a price, and `isCostComplete` is false when some rows have none.

use crate::output::QueryRow;
use data_layer_coding_agents::{
    local_time_zone_name, parse_range_bound, summarize_periods, PeriodUsage, TokenUsageDatabase, UsageGrouping, UsageQuery,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// The length of the default time range, in milliseconds: 30 days.
const DEFAULT_RANGE_MILLISECONDS: i64 = 30 * 24 * 60 * 60 * 1000;

/// What the command `usage` asks for.
#[derive(Debug, Clone)]
pub struct UsageRequest {
    /// The SQLite file.
    pub database_path: PathBuf,
    /// The repository, in the format `owner/name`.
    pub repository: String,
    /// The folder of the workspace. A chat session counts when it started in this folder or below it.
    pub folder: String,
    /// The start of the time range: a date `YYYY-MM-DD` or a time in ISO 8601. `None`: 30 days before the end.
    pub since: Option<String>,
    /// The end of the time range, not included. `None`: now.
    pub until: Option<String>,
    /// The name of the grouping: `minute`, `hour`, or `day`.
    pub grouping: String,
    /// The name of the time zone that cuts the days and reads the dates, or `None` for the time zone of the computer.
    pub time_zone: Option<String>,
    /// True to give one row for each chat session and each period.
    pub is_by_chat: bool,
    /// The time of now in milliseconds since 1970.
    pub now: i64,
}

/// The answer of the command `usage`.
#[derive(Debug, Clone, PartialEq)]
pub struct UsageAnswer {
    /// The grouping of the rows.
    pub grouping: UsageGrouping,
    /// The totals of each period, sorted by the start of the period.
    pub periods: Vec<PeriodUsage>,
    /// When the token usage of the repository was read the last time, in the format ISO 8601.
    pub synchronized_at: String,
}

impl UsageAnswer {
    /// The periods as rows: `periodStart` (UTC), `day` for a grouping by day (the date in the time zone), `chatSessionId` for
    /// one row for each chat session, `freshInputTokens`, `cachedInputTokens`, `cacheWriteInputTokens`, `outputTokens`,
    /// `totalTokens`, `costUsd`, `unpricedTokens`, and `isCostComplete`.
    pub fn to_rows(&self) -> Vec<QueryRow> {
        self.periods
            .iter()
            .map(|period| {
                let totals = &period.totals;
                let mut row = QueryRow::new();
                row.insert("periodStart".to_string(), json!(period.period_start));
                if matches!(self.grouping, UsageGrouping::Day { .. }) {
                    row.insert("day".to_string(), json!(period.local_day));
                }
                if let Some(chat_session_id) = &period.chat_session_id {
                    row.insert("chatSessionId".to_string(), json!(chat_session_id));
                }
                row.insert("freshInputTokens".to_string(), Value::from(totals.fresh_input));
                row.insert("cachedInputTokens".to_string(), Value::from(totals.cached_input));
                row.insert("cacheWriteInputTokens".to_string(), Value::from(totals.cache_write_input));
                row.insert("outputTokens".to_string(), Value::from(totals.output));
                row.insert("totalTokens".to_string(), Value::from(totals.token_count()));
                row.insert("costUsd".to_string(), json!(totals.cost_usd()));
                row.insert("unpricedTokens".to_string(), Value::from(totals.unpriced_token_count));
                row.insert("isCostComplete".to_string(), Value::from(totals.is_complete()));
                row
            })
            .collect()
    }
}

/// Reads the token usage of a workspace in a time range.
///
/// # Errors
/// An error when the token usage of the repository was never read, when a date or the time zone is wrong, or when the file
/// cannot be read.
pub fn read_usage(request: &UsageRequest) -> Result<UsageAnswer, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "read_usage", OperationKind::Query)
        .parameter("repository", request.repository.clone())
        .parameter("folder", request.folder.clone())
        .parameter("since", request.since.clone())
        .parameter("until", request.until.clone())
        .choice("grouping", request.grouping.clone())
        .parameter("timeZone", request.time_zone.clone())
        .choice("isByChat", request.is_by_chat)
        .parameter("now", request.now)
        .database(&request.database_path);
    record(spec, || read_usage_inside(request), |answer| Summary::count(answer.periods.len()))
}

/// The work of `read_usage`, between the start event and the completion event of its request.
fn read_usage_inside(request: &UsageRequest) -> Result<UsageAnswer, String> {
    let time_zone = request.time_zone.clone().unwrap_or_else(local_time_zone_name);
    let grouping = UsageGrouping::from_name(&request.grouping, &time_zone)?;
    let until = match &request.until {
        Some(text) => parse_range_bound(text, &time_zone)?,
        None => request.now,
    };
    let since = match &request.since {
        Some(text) => parse_range_bound(text, &time_zone)?,
        None => until - DEFAULT_RANGE_MILLISECONDS,
    };
    if since >= until {
        return Err(format!("The start of the time range ({}) must be before its end ({}).", display_bound(&request.since), display_bound(&request.until)));
    }
    let database = TokenUsageDatabase::open_read_only(&request.database_path)?;
    let synchronizations = database.find_synchronizations(&request.repository)?;
    let Some(synchronization) = synchronizations.first() else {
        return Err(format!(
            "The token usage of the repository {} was never read. Run \"heidrun_data initialize coding_agents\" first: the command usage reads the SQLite file only, and never the chat session files.",
            request.repository
        ));
    };
    let query = UsageQuery {
        repository: request.repository.clone(),
        folders: vec![request.folder.clone()],
        since,
        until,
        grouping: grouping.clone(),
        is_by_chat: request.is_by_chat,
    };
    let rows = database.find_usage(&query)?;
    Ok(UsageAnswer { grouping, periods: summarize_periods(&rows), synchronized_at: synchronization.synchronized_at.clone() })
}

/// A bound of the time range as the person wrote it, or its default.
fn display_bound(bound: &Option<String>) -> String {
    bound.clone().unwrap_or_else(|| "the default".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use data_layer_coding_agents::{
        ChatTokenUsage, CodingAgent, MinuteTokens, ModelPriceDatabase, PriceListSource, TokenUsageSynchronization,
    };

    const REPOSITORY: &str = "owner/name";
    /// 2026-10-14T10:00:00Z in milliseconds since 1970 and in minutes.
    const NOON: i64 = 1_791_972_000_000;
    const MINUTE: i64 = NOON / 60_000;

    struct Prices;

    impl PriceListSource for Prices {
        fn address(&self) -> String {
            "fake://prices".to_string()
        }

        fn read(&self) -> Result<String, String> {
            Ok(r#"{"claude-opus-5": {"litellm_provider": "anthropic", "input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05}}"#.to_string())
        }
    }

    fn temp_database(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_data_usage_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder.join("data_layer.sqlite")
    }

    fn tokens(minute: i64, model: &str, output: u64) -> MinuteTokens {
        MinuteTokens { minute, model: model.to_string(), fresh_input: 0, cached_input: 0, cache_write_input: 0, output }
    }

    fn fill(path: &Path) {
        ModelPriceDatabase::open(path).unwrap().refresh(&Prices, NOON, false).unwrap();
        let mut database = TokenUsageDatabase::open(path).unwrap();
        let chat = ChatTokenUsage {
            id: "a".to_string(),
            coding_agent: CodingAgent::ClaudeCode,
            folder: "/work/app".to_string(),
            updated_at: "2026-10-14T10:00:00.000Z".to_string(),
            minutes: vec![tokens(MINUTE, "claude-opus-5", 1_000_000), tokens(MINUTE + 1, "unknown-model", 7)],
        };
        let synchronization = TokenUsageSynchronization {
            repository: REPOSITORY.to_string(),
            folder: "/work/app".to_string(),
            synchronized_at: "2026-10-14T12:00:00.000Z".to_string(),
            read_up_to: None,
            mode: "initialize".to_string(),
        };
        database.write_token_usage(REPOSITORY, &[chat], &synchronization).unwrap();
    }

    fn request(path: &Path, grouping: &str) -> UsageRequest {
        UsageRequest {
            database_path: path.to_path_buf(),
            repository: REPOSITORY.to_string(),
            folder: "/work/app".to_string(),
            since: Some("2026-10-14".to_string()),
            until: Some("2026-10-15".to_string()),
            grouping: grouping.to_string(),
            time_zone: Some("UTC".to_string()),
            is_by_chat: false,
            now: NOON,
        }
    }

    #[test]
    fn gives_the_tokens_and_the_known_cost_of_a_day_and_says_that_the_cost_is_not_complete() {
        let path = temp_database("day");
        fill(&path);
        let rows = read_usage(&request(&path, "day")).unwrap().to_rows();
        assert_eq!(rows.len(), 1);
        let row = Value::Object(rows[0].clone());
        assert_eq!(row["day"], json!("2026-10-14"));
        assert_eq!(row["outputTokens"], json!(1_000_007));
        assert_eq!(row["costUsd"], json!(25.0));
        assert_eq!(row["unpricedTokens"], json!(7));
        assert_eq!(row["isCostComplete"], json!(false));
    }

    #[test]
    fn gives_a_null_cost_and_never_zero_for_a_period_without_any_price() {
        let path = temp_database("null_cost");
        fill(&path);
        let rows = read_usage(&request(&path, "minute")).unwrap().to_rows();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[1]["costUsd"], Value::Null);
        assert_eq!(rows[1]["isCostComplete"], json!(false));
        assert_eq!(rows[0]["isCostComplete"], json!(true));
        assert!(!rows[0].contains_key("day"));
    }

    #[test]
    fn gives_one_row_for_each_chat_session_when_asked() {
        let path = temp_database("by_chat");
        fill(&path);
        let mut by_chat = request(&path, "hour");
        by_chat.is_by_chat = true;
        let rows = read_usage(&by_chat).unwrap().to_rows();
        assert_eq!(rows[0]["chatSessionId"], json!("a"));
    }

    #[test]
    fn uses_the_thirty_days_before_the_end_when_no_start_is_given() {
        let path = temp_database("default_range");
        fill(&path);
        let mut default_range = request(&path, "day");
        default_range.since = None;
        default_range.until = None;
        default_range.now = NOON + 3_600_000;
        assert_eq!(read_usage(&default_range).unwrap().to_rows().len(), 1);
        default_range.now = NOON + 31 * 24 * 3_600_000;
        assert_eq!(read_usage(&default_range).unwrap().to_rows().len(), 0);
    }

    #[test]
    fn refuses_a_token_usage_that_was_never_read_a_range_upside_down_and_a_wrong_grouping() {
        let path = temp_database("refusals");
        TokenUsageDatabase::open(&path).unwrap();
        assert!(read_usage(&request(&path, "day")).unwrap_err().contains("never read"));
        fill(&path);
        let mut upside_down = request(&path, "day");
        upside_down.since = Some("2026-10-16".to_string());
        assert!(read_usage(&upside_down).unwrap_err().contains("must be before"));
        assert!(read_usage(&request(&path, "week")).unwrap_err().contains("minute, hour, or day"));
    }

    #[test]
    fn says_that_a_file_made_before_the_token_usage_was_never_read() {
        let path = temp_database("old_file");
        rusqlite::Connection::open(&path).unwrap().execute_batch("CREATE TABLE chat_sessions (repository TEXT)").unwrap();
        assert!(read_usage(&request(&path, "day")).unwrap_err().contains("never read"));
    }
}
