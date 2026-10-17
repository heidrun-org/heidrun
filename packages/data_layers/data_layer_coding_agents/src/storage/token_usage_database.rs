//! The tokens of each minute in the SQLite file: the tables `token_usage_minutes` and `token_usage_synchronizations`, and the
//! questions about a workspace and a time range.
//!
//! A write replaces the rows of each chat session that it carries, and nothing else:
//!
//! - A row that exists with the same tokens is left alone, so a second write of the same files changes nothing and counts
//!   nothing twice.
//! - A row that exists with other tokens is updated. A row that the files do not hold any more is deleted. So a chat session
//!   file that was replaced, shortened, or corrected gives the rows of what it holds now.
//! - The rows of a chat session that a write does not carry stay as they are. A chat session whose files were deleted by the
//!   coding agent keeps its rows: the file of the database keeps the history longer than the files do.
//!
//! The rows and the row of the synchronization of the workspace are written in one transaction, so a reader never sees a part
//! of a synchronization.

use crate::model::token_usage_types::{
    ChatTokenUsage, TokenUsageSynchronization, TokenUsageWriteCount, UsageQuery, UsageRow, UNDATED_MINUTE,
};
use crate::model::types::CodingAgent;
use crate::storage::minute_text::{minute_text, time_text};
use crate::storage::token_usage_schema::{create_all, SYNCHRONIZATIONS_TABLE, UNDATED_MINUTE_TEXT};
use crate::storage::usage_grouping::{group_minutes, MinuteUsage};
use rusqlite::{params, params_from_iter, Connection, OpenFlags, OptionalExtension, Transaction};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use crate::REQUEST_PACKAGE;
use request_log::{record, RequestKind, RequestSpec, Summary};
use crate::request_parameters::usage_query_spec;

/// The tokens of each minute in the SQLite file.
pub struct TokenUsageDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// True when the file is open read only. Only then nothing writes.
    is_read_only: bool,
    /// The open connection to the SQLite file.
    connection: Connection,
}

/// What a row holds besides its key (the chat session, the model, and the minute).
#[derive(Debug, Clone, PartialEq, Eq)]
struct StoredRow {
    /// The name of the coding agent in the file.
    coding_agent: String,
    /// The folder where the chat session started.
    folder: String,
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    fresh_input: i64,
    /// The input tokens that the provider read from its cache.
    cached_input: i64,
    /// The input tokens that the provider wrote to its cache.
    cache_write_input: i64,
    /// The output tokens.
    output: i64,
}

/// One row of the answer of the statement of `find_usage`, before the coding agent is checked.
struct RawUsageRow {
    /// The minute, in UTC, in the format ISO 8601.
    minute_at: String,
    /// The chat session, or `None` when the chat sessions are added together.
    chat_session_id: Option<String>,
    /// The name of the coding agent in the file.
    coding_agent: String,
    /// The name of the model.
    model: String,
    /// The tokens: fresh input, cached input, cache write input, and output.
    counts: [i64; 4],
    /// The estimated cost in US dollars, or `None` when it is not known.
    cost_usd: Option<f64>,
}

impl TokenUsageDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, and the tables when they do not exist.
    ///
    /// # Errors
    /// An error when the folder or the file cannot be created or opened.
    pub fn open(database_path: &Path) -> Result<Self, String> {
        if let Some(folder) = database_path.parent() {
            std::fs::create_dir_all(folder)
                .map_err(|error| format!("The folder {} cannot be created: {error}", folder.display()))?;
        }
        let connection = Connection::open(database_path)
            .map_err(|error| format!("The database file {} cannot be opened: {error}", database_path.display()))?;
        create_all(&connection)?;
        Ok(TokenUsageDatabase { database_path: database_path.to_path_buf(), is_read_only: false, connection })
    }

    /// Opens the SQLite file read only. The file must exist.
    ///
    /// # Errors
    /// An error when the file does not exist, or cannot be opened.
    pub fn open_read_only(database_path: &Path) -> Result<Self, String> {
        if !database_path.exists() {
            return Err(format!(
                "The database file does not exist: {}. Run the command initialize first.",
                database_path.display()
            ));
        }
        let connection = Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|error| format!("The database file {} cannot be opened: {error}", database_path.display()))?;
        Ok(TokenUsageDatabase { database_path: database_path.to_path_buf(), is_read_only: true, connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Writes the token usage of the chat sessions of `usages` and the row of the synchronization of the workspace, in one
    /// transaction. Gives how many rows were inserted, updated, deleted, and left as they were.
    ///
    /// # Errors
    /// An error when the file is open read only, when a minute is out of the range of dates, or when a row cannot be written.
    /// Nothing is written then.
    pub fn write_token_usage(
        &mut self,
        repository: &str,
        usages: &[ChatTokenUsage],
        synchronization: &TokenUsageSynchronization,
    ) -> Result<TokenUsageWriteCount, String> {
        let spec = RequestSpec::new(REQUEST_PACKAGE, "write_token_usage", RequestKind::Write)
            .parameter("repository", repository)
            .parameter("folder", synchronization.folder.clone())
            .parameter("chatCount", usages.len())
            .database(&self.database_path);
        record(spec, || self.write_token_usage_inside(repository, usages, synchronization), |count| {
            Summary::count(count.written_count())
                .detail("rowsInserted", count.inserted_count)
                .detail("rowsUpdated", count.updated_count)
                .detail("rowsDeleted", count.deleted_count)
                .detail("rowsUnchanged", count.unchanged_count)
        })
    }

    /// The work of `write_token_usage`, between the start event and the completion event of its request.
    fn write_token_usage_inside(
        &mut self,
        repository: &str,
        usages: &[ChatTokenUsage],
        synchronization: &TokenUsageSynchronization,
    ) -> Result<TokenUsageWriteCount, String> {
        if self.is_read_only {
            return Err("A write needs a database that is not open read only.".to_string());
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        let mut count = TokenUsageWriteCount::default();
        for usage in usages {
            let chat_count = write_chat(&transaction, repository, usage)
                .map_err(|error| format!("The token usage of the chat session {} cannot be written: {error}", usage.id))?;
            count.add(&chat_count);
        }
        transaction
            .execute(
                "INSERT INTO token_usage_synchronizations (repository, folder, synchronizedAt, readUpTo, mode)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT (repository, folder) DO UPDATE SET synchronizedAt = excluded.synchronizedAt,
                     readUpTo = excluded.readUpTo, mode = excluded.mode",
                params![
                    repository,
                    synchronization.folder,
                    synchronization.synchronized_at,
                    synchronization.read_up_to,
                    synchronization.mode
                ],
            )
            .map_err(|error| format!("The synchronization cannot be written: {error}"))?;
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))?;
        Ok(count)
    }

    /// The last synchronization of a workspace, or `None` when its token usage was never read.
    pub fn find_synchronization(&self, repository: &str, folder: &str) -> Result<Option<TokenUsageSynchronization>, String> {
        let spec = RequestSpec::new(REQUEST_PACKAGE, "find_synchronization", RequestKind::Query)
            .parameter("repository", repository)
            .parameter("folder", folder)
            .database(&self.database_path);
        record(spec, || self.find_synchronization_inside(repository, folder), |found| Summary::count(usize::from(found.is_some())))
    }

    /// The work of `find_synchronization`, between the start event and the completion event of its request.
    fn find_synchronization_inside(&self, repository: &str, folder: &str) -> Result<Option<TokenUsageSynchronization>, String> {
        self.connection
            .query_row(
                "SELECT repository, folder, synchronizedAt, readUpTo, mode FROM token_usage_synchronizations
                 WHERE repository = ?1 AND folder = ?2",
                params![repository, folder],
                |row| {
                    Ok(TokenUsageSynchronization {
                        repository: row.get(0)?,
                        folder: row.get(1)?,
                        synchronized_at: row.get(2)?,
                        read_up_to: row.get(3)?,
                        mode: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(|error| format!("The synchronization cannot be read: {error}"))
    }

    /// The last synchronization of each workspace of a repository, the newest first. Empty when the token usage of the
    /// repository was never read, and when the file was made before the tables of the token usage existed.
    pub fn find_synchronizations(&self, repository: &str) -> Result<Vec<TokenUsageSynchronization>, String> {
        let spec = RequestSpec::new(REQUEST_PACKAGE, "find_synchronizations", RequestKind::Query)
            .parameter("repository", repository)
            .database(&self.database_path);
        record(spec, || self.find_synchronizations_inside(repository), |found| Summary::count(found.len()))
    }

    /// The work of `find_synchronizations`, between the start event and the completion event of its request.
    fn find_synchronizations_inside(&self, repository: &str) -> Result<Vec<TokenUsageSynchronization>, String> {
        if !self.has_table(SYNCHRONIZATIONS_TABLE)? {
            return Ok(Vec::new());
        }
        let mut statement = self
            .connection
            .prepare(
                "SELECT repository, folder, synchronizedAt, readUpTo, mode FROM token_usage_synchronizations
                 WHERE repository = ?1 ORDER BY synchronizedAt DESC, folder",
            )
            .map_err(|error| format!("The synchronizations cannot be read: {error}"))?;
        let rows = statement
            .query_map(params![repository], |row| {
                Ok(TokenUsageSynchronization {
                    repository: row.get(0)?,
                    folder: row.get(1)?,
                    synchronized_at: row.get(2)?,
                    read_up_to: row.get(3)?,
                    mode: row.get(4)?,
                })
            })
            .map_err(|error| format!("The synchronizations cannot be read: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|error| format!("The synchronizations cannot be read: {error}"))
    }

    /// True when the file has the table `name`.
    fn has_table(&self, name: &str) -> Result<bool, String> {
        self.connection
            .query_row("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1", params![name], |_| Ok(()))
            .optional()
            .map(|found| found.is_some())
            .map_err(|error| format!("The tables of the database cannot be read: {error}"))
    }

    /// The number of rows of the table `token_usage_minutes` for a repository.
    pub fn count_rows(&self, repository: &str) -> Result<i64, String> {
        let spec = RequestSpec::new(REQUEST_PACKAGE, "count_rows", RequestKind::Query)
            .parameter("repository", repository)
            .database(&self.database_path);
        record(spec, || self.count_rows_inside(repository), |count| Summary::count(*count as usize))
    }

    /// The work of `count_rows`, between the start event and the completion event of its request.
    fn count_rows_inside(&self, repository: &str) -> Result<i64, String> {
        self.connection
            .query_row("SELECT COUNT(*) FROM token_usage_minutes WHERE repository = ?1", params![repository], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|error| format!("The rows cannot be counted: {error}"))
    }

    /// The token usage and the estimated cost of the query, cut in periods. The cost is at the prices of the latest version.
    /// A minute counts when its start is at or after `since` and before `until`.
    ///
    /// # Errors
    /// An error when the query holds a time zone that is not known, or when the rows cannot be read.
    pub fn find_usage(&self, query: &UsageQuery) -> Result<Vec<UsageRow>, String> {
        let spec = usage_query_spec("find_usage", query, &self.database_path);
        record(spec, || self.find_usage_inside(query), |rows| Summary::count(rows.len()))
    }

    /// The work of `find_usage`, between the start event and the completion event of its request.
    fn find_usage_inside(&self, query: &UsageQuery) -> Result<Vec<UsageRow>, String> {
        let (statement_text, parameters) = usage_statement(query)?;
        let mut statement =
            self.connection.prepare(&statement_text).map_err(|error| format!("The token usage cannot be read: {error}"))?;
        let rows = statement
            .query_map(params_from_iter(parameters.iter()), |row| {
                let cost_count: i64 = row.get(9)?;
                let row_count: i64 = row.get(10)?;
                Ok(RawUsageRow {
                    minute_at: row.get(0)?,
                    chat_session_id: row.get(1)?,
                    coding_agent: row.get(2)?,
                    model: row.get(3)?,
                    counts: [row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?],
                    cost_usd: if cost_count == row_count { row.get::<_, Option<f64>>(8)? } else { None },
                })
            })
            .map_err(|error| format!("The token usage cannot be read: {error}"))?;
        let mut minutes = Vec::new();
        for row in rows {
            let raw = row.map_err(|error| format!("The token usage cannot be read: {error}"))?;
            let coding_agent = CodingAgent::from_text(&raw.coding_agent)
                .ok_or_else(|| format!("The coding agent {} is not known.", raw.coding_agent))?;
            minutes.push(MinuteUsage {
                minute_at: raw.minute_at,
                chat_session_id: raw.chat_session_id,
                coding_agent,
                model: raw.model,
                fresh_input: raw.counts[0] as u64,
                cached_input: raw.counts[1] as u64,
                cache_write_input: raw.counts[2] as u64,
                output: raw.counts[3] as u64,
                cost_usd: raw.cost_usd,
            });
        }
        group_minutes(minutes, &query.grouping)
    }

    /// The plan of SQLite for the statement of `find_usage`: one line for each step. It shows which index a time range uses.
    ///
    /// # Errors
    /// An error when the plan cannot be read.
    pub fn explain_usage_query(&self, query: &UsageQuery) -> Result<Vec<String>, String> {
        let spec = usage_query_spec("explain_usage_query", query, &self.database_path);
        record(spec, || self.explain_usage_query_inside(query), |lines| Summary::count(lines.len()))
    }

    /// The work of `explain_usage_query`, between the start event and the completion event of its request.
    fn explain_usage_query_inside(&self, query: &UsageQuery) -> Result<Vec<String>, String> {
        let (statement_text, parameters) = usage_statement(query)?;
        let mut statement = self
            .connection
            .prepare(&format!("EXPLAIN QUERY PLAN {statement_text}"))
            .map_err(|error| format!("The plan cannot be read: {error}"))?;
        let details = statement
            .query_map(params_from_iter(parameters.iter()), |row| row.get::<_, String>(3))
            .map_err(|error| format!("The plan cannot be read: {error}"))?;
        details.collect::<rusqlite::Result<Vec<String>>>().map_err(|error| format!("The plan cannot be read: {error}"))
    }
}

/// The statement that reads the token usage of a query, and its parameters. The statement groups the rows of the same minute,
/// coding agent, and model (and chat session, when the query asks for it), so the rows are fewer when the chat sessions are
/// added together.
fn usage_statement(query: &UsageQuery) -> Result<(String, Vec<String>), String> {
    let mut parameters = vec![query.repository.clone(), time_text(query.since)?, time_text(query.until)?];
    let mut folder_filter = String::new();
    if !query.folders.is_empty() {
        let mut tests = Vec::new();
        for folder in &query.folders {
            let folder = folder.trim_end_matches('/');
            let first = parameters.len() + 1;
            parameters.push(folder.to_string());
            parameters.push(format!("{folder}/"));
            parameters.push(format!("{folder}0"));
            tests.push(format!("(folder = ?{first} OR (folder >= ?{} AND folder < ?{}))", first + 1, first + 2));
        }
        folder_filter = format!(" AND ({})", tests.join(" OR "));
    }
    let (chat_column, chat_group) = if query.is_by_chat { ("chatSessionId", "chatSessionId, ") } else { ("NULL", "") };
    let statement = format!(
        "SELECT minuteAt, {chat_column}, codingAgent, model, SUM(freshInputTokens), SUM(cachedInputTokens),
                SUM(cacheWriteInputTokens), SUM(outputTokens), SUM(costUsd), COUNT(costUsd), COUNT(*)
         FROM token_usage_with_cost
         WHERE repository = ?1 AND minuteAt >= ?2 AND minuteAt < ?3{folder_filter}
         GROUP BY minuteAt, {chat_group}codingAgent, model"
    );
    Ok((statement, parameters))
}

/// Writes the rows of one chat session: inserts the new rows, updates the rows whose tokens changed, and deletes the rows that
/// the files do not hold any more.
fn write_chat(transaction: &Transaction, repository: &str, usage: &ChatTokenUsage) -> Result<TokenUsageWriteCount, String> {
    let mut existing = read_rows(transaction, repository, &usage.id)?;
    let mut count = TokenUsageWriteCount::default();
    let mut kept: HashSet<(String, String)> = HashSet::new();
    let mut write = transaction
        .prepare(
            "INSERT INTO token_usage_minutes (repository, chatSessionId, model, minuteAt, codingAgent, folder,
                 freshInputTokens, cachedInputTokens, cacheWriteInputTokens, outputTokens)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT (repository, chatSessionId, model, minuteAt) DO UPDATE SET codingAgent = excluded.codingAgent,
                 folder = excluded.folder, freshInputTokens = excluded.freshInputTokens,
                 cachedInputTokens = excluded.cachedInputTokens, cacheWriteInputTokens = excluded.cacheWriteInputTokens,
                 outputTokens = excluded.outputTokens",
        )
        .map_err(|error| error.to_string())?;
    for minute in &usage.minutes {
        let minute_at = if minute.minute == UNDATED_MINUTE { UNDATED_MINUTE_TEXT.to_string() } else { minute_text(minute.minute)? };
        let stored = StoredRow {
            coding_agent: usage.coding_agent.text().to_string(),
            folder: usage.folder.clone(),
            fresh_input: to_integer(minute.fresh_input),
            cached_input: to_integer(minute.cached_input),
            cache_write_input: to_integer(minute.cache_write_input),
            output: to_integer(minute.output),
        };
        let key = (minute.model.clone(), minute_at);
        match existing.remove(&key) {
            Some(old) if old == stored => count.unchanged_count += 1,
            old => {
                write
                    .execute(params![
                        repository,
                        usage.id,
                        key.0,
                        key.1,
                        stored.coding_agent,
                        stored.folder,
                        stored.fresh_input,
                        stored.cached_input,
                        stored.cache_write_input,
                        stored.output
                    ])
                    .map_err(|error| error.to_string())?;
                if old.is_some() {
                    count.updated_count += 1;
                } else {
                    count.inserted_count += 1;
                }
            }
        }
        kept.insert(key);
    }
    let mut delete = transaction
        .prepare("DELETE FROM token_usage_minutes WHERE repository = ?1 AND chatSessionId = ?2 AND model = ?3 AND minuteAt = ?4")
        .map_err(|error| error.to_string())?;
    for (model, minute_at) in existing.keys() {
        delete.execute(params![repository, usage.id, model, minute_at]).map_err(|error| error.to_string())?;
        count.deleted_count += 1;
    }
    Ok(count)
}

/// The rows that a chat session has in the file, by model and minute.
fn read_rows(
    transaction: &Transaction,
    repository: &str,
    chat_session_id: &str,
) -> Result<HashMap<(String, String), StoredRow>, String> {
    let mut statement = transaction
        .prepare(
            "SELECT model, minuteAt, codingAgent, folder, freshInputTokens, cachedInputTokens, cacheWriteInputTokens, outputTokens
             FROM token_usage_minutes WHERE repository = ?1 AND chatSessionId = ?2",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![repository, chat_session_id], |row| {
            Ok((
                (row.get::<_, String>(0)?, row.get::<_, String>(1)?),
                StoredRow {
                    coding_agent: row.get(2)?,
                    folder: row.get(3)?,
                    fresh_input: row.get(4)?,
                    cached_input: row.get(5)?,
                    cache_write_input: row.get(6)?,
                    output: row.get(7)?,
                },
            ))
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<rusqlite::Result<HashMap<_, _>>>().map_err(|error| error.to_string())
}

/// A count of tokens as the integer of SQLite. A count above the largest integer becomes the largest integer.
fn to_integer(count: u64) -> i64 {
    i64::try_from(count).unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::price_types::PriceRefresh;
    use crate::model::token_usage_types::{MinuteTokens, UsageGrouping};
    use crate::pricing::price_list_source::PriceListSource;
    use crate::storage::model_price_database::ModelPriceDatabase;
    use crate::test_samples::temp_folder;

    const REPOSITORY: &str = "heidrun-org/heidrun";
    const FOLDER: &str = "/work/app";
    const MINUTE_10_00: i64 = 29_866_200;
    const SINCE: i64 = MINUTE_10_00 * 60_000;

    fn tokens(minute: i64, model: &str, output: u64) -> MinuteTokens {
        MinuteTokens { minute, model: model.to_string(), fresh_input: 1_000_000, cached_input: 0, cache_write_input: 0, output }
    }

    fn usage(id: &str, folder: &str, minutes: Vec<MinuteTokens>) -> ChatTokenUsage {
        ChatTokenUsage {
            id: id.to_string(),
            coding_agent: CodingAgent::ClaudeCode,
            folder: folder.to_string(),
            updated_at: "2026-10-14T10:00:00.000Z".to_string(),
            minutes,
        }
    }

    fn synchronization() -> TokenUsageSynchronization {
        TokenUsageSynchronization {
            repository: REPOSITORY.to_string(),
            folder: FOLDER.to_string(),
            synchronized_at: "2026-10-14T12:00:00.000Z".to_string(),
            read_up_to: Some("2026-10-14T10:00:00.000Z".to_string()),
            mode: "initialize".to_string(),
        }
    }

    fn query(folders: &[&str], grouping: UsageGrouping, is_by_chat: bool) -> UsageQuery {
        UsageQuery {
            repository: REPOSITORY.to_string(),
            folders: folders.iter().map(|folder| folder.to_string()).collect(),
            since: SINCE,
            until: SINCE + 24 * 60 * 60_000,
            grouping,
            is_by_chat,
        }
    }

    struct PricesSource;

    impl PriceListSource for PricesSource {
        fn address(&self) -> String {
            "fake://prices".to_string()
        }

        fn read(&self) -> Result<String, String> {
            Ok(r#"{"claude-opus-5": {"litellm_provider": "anthropic", "input_cost_per_token": 5e-06,
                "output_cost_per_token": 2.5e-05, "cache_read_input_token_cost": 5e-07}}"#
                .to_string())
        }
    }

    fn new_database(name: &str) -> (PathBuf, TokenUsageDatabase) {
        let path = temp_folder(name).join("data_layer.sqlite");
        let database = TokenUsageDatabase::open(&path).unwrap();
        (path, database)
    }

    fn with_prices(path: &Path) {
        let mut prices = ModelPriceDatabase::open(path).unwrap();
        assert!(matches!(prices.refresh(&PricesSource, SINCE, false), Ok(PriceRefresh::NewVersion { .. })));
    }

    #[test]
    fn writes_the_rows_and_gives_them_back_by_minute_with_their_cost() {
        let (path, mut database) = new_database("usage_round_trip");
        with_prices(&path);
        let chat = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 1_000_000), tokens(MINUTE_10_00 + 1, "claude-opus-5", 0)]);
        let count = database.write_token_usage(REPOSITORY, &[chat], &synchronization()).unwrap();
        assert_eq!(count, TokenUsageWriteCount { inserted_count: 2, updated_count: 0, deleted_count: 0, unchanged_count: 0 });
        let rows = database.find_usage(&query(&[], UsageGrouping::Minute, false)).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].period_start, "2026-10-14T10:00:00.000Z");
        // 1 000 000 fresh input tokens at 5 dollars, and 1 000 000 output tokens at 25 dollars
        assert!((rows[0].cost_usd.unwrap() - 30.0).abs() < 1e-9, "{:?}", rows[0].cost_usd);
        assert!((rows[1].cost_usd.unwrap() - 5.0).abs() < 1e-9);
    }

    #[test]
    fn counts_nothing_twice_when_the_same_files_are_written_again() {
        let (_, mut database) = new_database("usage_twice");
        let chat = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 7)]);
        database.write_token_usage(REPOSITORY, std::slice::from_ref(&chat), &synchronization()).unwrap();
        let count = database.write_token_usage(REPOSITORY, std::slice::from_ref(&chat), &synchronization()).unwrap();
        assert_eq!(count, TokenUsageWriteCount { inserted_count: 0, updated_count: 0, deleted_count: 0, unchanged_count: 1 });
        assert_eq!(database.count_rows(REPOSITORY), Ok(1));
    }

    #[test]
    fn writes_only_the_rows_that_changed_when_a_chat_session_grows() {
        let (_, mut database) = new_database("usage_append");
        let first = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 7), tokens(MINUTE_10_00 + 1, "claude-opus-5", 8)]);
        database.write_token_usage(REPOSITORY, &[first], &synchronization()).unwrap();
        let grown = usage(
            "a",
            FOLDER,
            vec![tokens(MINUTE_10_00, "claude-opus-5", 7), tokens(MINUTE_10_00 + 1, "claude-opus-5", 9), tokens(MINUTE_10_00 + 2, "claude-opus-5", 1)],
        );
        let count = database.write_token_usage(REPOSITORY, &[grown], &synchronization()).unwrap();
        assert_eq!(count, TokenUsageWriteCount { inserted_count: 1, updated_count: 1, deleted_count: 0, unchanged_count: 1 });
        assert_eq!(count.written_count(), 2);
    }

    #[test]
    fn deletes_the_rows_that_a_shortened_file_does_not_hold_any_more_and_leaves_the_other_chat_sessions() {
        let (_, mut database) = new_database("usage_shorter");
        let first = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 7), tokens(MINUTE_10_00 + 1, "claude-opus-5", 8)]);
        let other = usage("b", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 1)]);
        database.write_token_usage(REPOSITORY, &[first, other], &synchronization()).unwrap();
        let shorter = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 7)]);
        let count = database.write_token_usage(REPOSITORY, &[shorter], &synchronization()).unwrap();
        assert_eq!((count.deleted_count, count.unchanged_count), (1, 1));
        assert_eq!(database.count_rows(REPOSITORY), Ok(2));
        let empty = usage("a", FOLDER, vec![]);
        database.write_token_usage(REPOSITORY, &[empty], &synchronization()).unwrap();
        assert_eq!(database.count_rows(REPOSITORY), Ok(1));
    }

    #[test]
    fn keeps_the_rows_of_a_chat_session_that_a_write_does_not_carry() {
        let (_, mut database) = new_database("usage_kept");
        database
            .write_token_usage(REPOSITORY, &[usage("a", FOLDER, vec![tokens(MINUTE_10_00, "m", 1)])], &synchronization())
            .unwrap();
        database
            .write_token_usage(REPOSITORY, &[usage("b", FOLDER, vec![tokens(MINUTE_10_00, "m", 1)])], &synchronization())
            .unwrap();
        assert_eq!(database.count_rows(REPOSITORY), Ok(2));
    }

    #[test]
    fn gives_a_cost_of_none_and_never_zero_to_a_model_without_a_price() {
        let (path, mut database) = new_database("usage_unpriced");
        with_prices(&path);
        let chat = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 1), tokens(MINUTE_10_00 + 1, "codex-auto-review", 1), tokens(MINUTE_10_00 + 2, "", 1)]);
        database.write_token_usage(REPOSITORY, &[chat], &synchronization()).unwrap();
        let rows = database.find_usage(&query(&[], UsageGrouping::Minute, false)).unwrap();
        let costs: Vec<bool> = rows.iter().map(|row| row.cost_usd.is_some()).collect();
        assert_eq!(costs, [true, false, false]);
    }

    #[test]
    fn gives_the_same_cost_as_the_price_table_for_the_four_kinds_of_tokens() {
        let (path, mut database) = new_database("usage_same_cost");
        with_prices(&path);
        let all_kinds = MinuteTokens {
            minute: MINUTE_10_00,
            model: "claude-opus-5".to_string(),
            fresh_input: 123_456,
            cached_input: 7_890_123,
            cache_write_input: 45_678,
            output: 9_012,
        };
        database.write_token_usage(REPOSITORY, &[usage("a", FOLDER, vec![all_kinds])], &synchronization()).unwrap();
        let from_sql = database.find_usage(&query(&[], UsageGrouping::Minute, false)).unwrap()[0].cost_usd.unwrap();
        let table = ModelPriceDatabase::open_read_only(&path).unwrap().load_latest_table().unwrap();
        let from_table = table.cost_of("claude-opus-5", 123_456, 7_890_123, 45_678, 9_012).unwrap();
        assert!((from_sql - from_table).abs() < 1e-9, "{from_sql} {from_table}");
        // The list gives no price for the tokens written to the cache: the input price is used, as before.
        assert_eq!(table.price_of("claude-opus-5").unwrap().cache_write_input, 5.0);
    }

    #[test]
    fn finds_the_price_of_a_model_whose_name_ends_with_a_date() {
        let (path, mut database) = new_database("usage_dated_model");
        with_prices(&path);
        let chat = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5-20261001", 0)]);
        database.write_token_usage(REPOSITORY, &[chat], &synchronization()).unwrap();
        let rows = database.find_usage(&query(&[], UsageGrouping::Minute, false)).unwrap();
        assert!((rows[0].cost_usd.unwrap() - 5.0).abs() < 1e-9);
    }

    #[test]
    fn keeps_the_tokens_without_a_date_out_of_every_time_range() {
        let (_, mut database) = new_database("usage_undated");
        let chat = usage("a", FOLDER, vec![tokens(UNDATED_MINUTE, "m", 5), tokens(MINUTE_10_00, "m", 7)]);
        database.write_token_usage(REPOSITORY, &[chat], &synchronization()).unwrap();
        assert_eq!(database.count_rows(REPOSITORY), Ok(2));
        let rows = database.find_usage(&query(&[], UsageGrouping::Hour, false)).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].output, 7);
    }

    #[test]
    fn counts_the_chat_sessions_of_a_folder_and_of_the_folders_below_it_once() {
        let (_, mut database) = new_database("usage_folders");
        let chats = [
            usage("root", FOLDER, vec![tokens(MINUTE_10_00, "m", 1)]),
            usage("worktree", "/work/app/.claude/worktrees/fix", vec![tokens(MINUTE_10_00, "m", 10)]),
            usage("below", "/work/app/docs", vec![tokens(MINUTE_10_00, "m", 100)]),
            usage("next", "/work/app-site", vec![tokens(MINUTE_10_00, "m", 1000)]),
        ];
        database.write_token_usage(REPOSITORY, &chats, &synchronization()).unwrap();
        let output = |folders: &[&str]| -> u64 {
            database.find_usage(&query(folders, UsageGrouping::Hour, false)).unwrap().iter().map(|row| row.output).sum()
        };
        assert_eq!(output(&[FOLDER]), 111, "the folder, its worktree, and its sub-folder, but not the folder next to it");
        assert_eq!(output(&["/work/app/"]), 111, "a slash at the end does not count");
        assert_eq!(output(&["/work/app/docs"]), 100);
        assert_eq!(output(&[FOLDER, "/work/app/docs"]), 111, "two workspaces that overlap count a chat session once");
        assert_eq!(output(&[FOLDER, "/work/app-site"]), 1111);
        assert_eq!(output(&[]), 1111);
        assert_eq!(output(&["/work"]), 1111);
    }

    #[test]
    fn gives_one_row_for_each_chat_session_when_the_query_asks_for_it() {
        let (_, mut database) = new_database("usage_by_chat");
        let chats = [usage("a", FOLDER, vec![tokens(MINUTE_10_00, "m", 1)]), usage("b", FOLDER, vec![tokens(MINUTE_10_00, "m", 2)])];
        database.write_token_usage(REPOSITORY, &chats, &synchronization()).unwrap();
        let by_chat = database.find_usage(&query(&[], UsageGrouping::Day { time_zone: "UTC".to_string() }, true)).unwrap();
        assert_eq!(by_chat.iter().map(|row| row.chat_session_id.clone().unwrap()).collect::<Vec<_>>(), ["a", "b"]);
        let added = database.find_usage(&query(&[], UsageGrouping::Day { time_zone: "UTC".to_string() }, false)).unwrap();
        assert_eq!((added.len(), added[0].output, added[0].chat_session_id.clone()), (1, 3, None));
    }

    #[test]
    fn keeps_the_rows_of_two_repositories_apart_and_stores_the_synchronization_of_each_workspace() {
        let (_, mut database) = new_database("usage_repositories");
        database.write_token_usage(REPOSITORY, &[usage("a", FOLDER, vec![tokens(MINUTE_10_00, "m", 1)])], &synchronization()).unwrap();
        let mut other = synchronization();
        other.repository = "owner/other".to_string();
        database.write_token_usage("owner/other", &[usage("a", FOLDER, vec![tokens(MINUTE_10_00, "m", 5)])], &other).unwrap();
        assert_eq!(database.count_rows(REPOSITORY), Ok(1));
        assert_eq!(database.find_synchronization(REPOSITORY, FOLDER).unwrap().unwrap().mode, "initialize");
        assert_eq!(database.find_synchronization(REPOSITORY, "/elsewhere"), Ok(None));
        assert_eq!(database.find_synchronizations(REPOSITORY).unwrap().len(), 1);
        assert_eq!(database.find_synchronizations("owner/none"), Ok(vec![]));
        let rows = database.find_usage(&query(&[], UsageGrouping::Hour, false)).unwrap();
        assert_eq!(rows[0].output, 1);
    }

    #[test]
    fn uses_an_index_for_a_time_range_of_a_repository_and_of_a_folder() {
        let (_, mut database) = new_database("usage_plan");
        let chat = usage("a", FOLDER, vec![tokens(MINUTE_10_00, "m", 1)]);
        database.write_token_usage(REPOSITORY, &[chat], &synchronization()).unwrap();
        for folders in [vec![], vec![FOLDER]] {
            let plan = database.explain_usage_query(&query(&folders, UsageGrouping::Minute, false)).unwrap().join("\n");
            assert!(plan.contains("USING INDEX token_usage_minutes_by_minute"), "{plan}");
            assert!(!plan.contains("SCAN token_usage_minutes"), "{plan}");
        }
    }

    #[test]
    fn refuses_a_write_on_a_database_that_is_open_read_only() {
        let (path, _) = new_database("usage_read_only");
        let mut read_only = TokenUsageDatabase::open_read_only(&path).unwrap();
        let error = read_only.write_token_usage(REPOSITORY, &[], &synchronization()).unwrap_err();
        assert!(error.contains("read only"), "{error}");
    }

    #[test]
    fn keeps_the_other_tables_of_an_older_file_when_it_is_opened() {
        let path = temp_folder("usage_migration").join("data_layer.sqlite");
        {
            let connection = Connection::open(&path).unwrap();
            connection.execute_batch("CREATE TABLE chat_sessions (repository TEXT, id TEXT, updatedAt TEXT, data TEXT); INSERT INTO chat_sessions VALUES ('r', 'i', 'u', '{}')").unwrap();
        }
        TokenUsageDatabase::open(&path).unwrap();
        let connection = Connection::open(&path).unwrap();
        let count: i64 = connection.query_row("SELECT COUNT(*) FROM chat_sessions", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
        let tables: i64 = connection
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE name = 'token_usage_minutes'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(tables, 1);
    }

    #[test]
    fn a_usage_query_records_the_workload_that_decides_its_cost_and_the_result_count() {
        let (_, mut database) = new_database("usage_request_log");
        database
            .write_token_usage(REPOSITORY, &[usage("a", FOLDER, vec![tokens(MINUTE_10_00, "claude-opus-5", 7)])], &synchronization())
            .unwrap();
        let usage_query = query(&[FOLDER], UsageGrouping::Hour, true);
        let (rows, events) = request_log::testing::capture(|| database.find_usage(&usage_query).unwrap());
        assert_eq!(rows.len(), 1);
        let starts = request_log::testing::starts(&events);
        assert_eq!(starts.len(), 1);
        assert_eq!((starts[0].package.as_str(), starts[0].operation.as_str()), ("coding_agents", "find_usage"));
        assert_eq!(starts[0].parameters["repository"], REPOSITORY);
        assert_eq!(starts[0].parameters["folders"], serde_json::json!([FOLDER]));
        assert_eq!(starts[0].parameters["since"], usage_query.since);
        assert_eq!(starts[0].parameters["until"], usage_query.until);
        assert_eq!(starts[0].pattern, "grouping=hour | isByChat=true");
        assert_eq!(request_log::testing::completion_of(&events, &starts[0].request_id).unwrap().result_count, Some(1));
    }

    #[test]
    fn a_usage_query_that_fails_records_the_failure_and_gives_back_the_error() {
        let (path, database) = new_database("usage_request_log_failure");
        drop(database);
        let database = TokenUsageDatabase::open_read_only(&path).unwrap();
        let broken = rusqlite::Connection::open(&path).unwrap();
        broken.execute_batch("DROP VIEW IF EXISTS token_usage_with_cost; DROP TABLE token_usage_minutes;").unwrap();
        drop(broken);
        let usage_query = query(&[], UsageGrouping::Minute, false);
        let expected = database.find_usage(&usage_query).unwrap_err();
        let (error, events) = request_log::testing::capture(|| database.find_usage(&usage_query).unwrap_err());
        assert_eq!(error, expected);
        let starts = request_log::testing::starts(&events);
        let complete = request_log::testing::completion_of(&events, &starts[0].request_id).unwrap();
        assert_eq!(complete.outcome, request_log::Outcome::Failure);
        assert_eq!(complete.result_count, None);
    }
}
