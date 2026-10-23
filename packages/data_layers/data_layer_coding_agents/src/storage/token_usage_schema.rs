//! The tables, the index, and the views of the token usage and of the model prices in the SQLite file.
//!
//! - `token_usage_minutes` holds the tokens that a chat session used with one model in one minute, in UTC. A row exists only for
//!   a minute where tokens were used. The column `folder` is the folder where the chat session started, so a workspace owns the
//!   rows whose folder is the folder of the workspace or a folder below it. The column `minuteAt` is an empty text for the tokens
//!   of a record that has no date: they are in the total of the chat session, and in no time range.
//! - `token_usage_minutes_by_minute` is the one index: it finds the rows of a repository in a time range. An index on the folder
//!   was measured on the Teamwright history (25 thousand rows): SQLite never chose it, even for a folder with one row, and the
//!   timings were the same, so the table does not carry its cost on each write.
//! - `token_usage_synchronizations` holds one row for each workspace: when its token usage was read the last time.
//! - `model_price_versions` and `model_prices` hold the prices of the models, one version for each change of the price list.
//! - `latest_model_prices` is the view of the prices of the latest version.
//! - `token_usage_with_cost` is the view of `token_usage_minutes` with the estimated cost of each row, at the prices of the
//!   latest version. A row whose model has no price has no cost (`NULL`), and never a cost of zero.

use rusqlite::Connection;

/// The name of the table of the tokens of each minute.
pub const MINUTES_TABLE: &str = "token_usage_minutes";

/// The name of the table of the last synchronization of each workspace.
pub const SYNCHRONIZATIONS_TABLE: &str = "token_usage_synchronizations";

/// The name of the table of the versions of the price list.
pub const PRICE_VERSIONS_TABLE: &str = "model_price_versions";

/// The name of the table of the prices of the models.
pub const PRICES_TABLE: &str = "model_prices";

/// The name of the view of the prices of the latest version.
pub const LATEST_PRICES_VIEW: &str = "latest_model_prices";

/// The name of the view of the tokens of each minute with their estimated cost.
pub const COST_VIEW: &str = "token_usage_with_cost";

/// The name of the index for a time range of a repository.
pub const MINUTE_INDEX: &str = "token_usage_minutes_by_minute";

/// The value of the column `minuteAt` for the tokens of a record that has no date.
pub const UNDATED_MINUTE_TEXT: &str = "";

/// The statements that create every table, index, and view when they do not exist. A file made by an older version of the
/// package gets the new tables and keeps all its other rows.
const CREATE_STATEMENTS: [&str; 7] = [
    "CREATE TABLE IF NOT EXISTS token_usage_minutes (
        repository TEXT NOT NULL,
        chatSessionId TEXT NOT NULL,
        model TEXT NOT NULL,
        minuteAt TEXT NOT NULL,
        codingAgent TEXT NOT NULL CHECK (codingAgent IN ('CLAUDE_CODE', 'CODEX')),
        folder TEXT NOT NULL,
        freshInputTokens INTEGER NOT NULL CHECK (freshInputTokens >= 0),
        cachedInputTokens INTEGER NOT NULL CHECK (cachedInputTokens >= 0),
        cacheWriteInputTokens INTEGER NOT NULL CHECK (cacheWriteInputTokens >= 0),
        outputTokens INTEGER NOT NULL CHECK (outputTokens >= 0),
        PRIMARY KEY (repository, chatSessionId, model, minuteAt)
    ) WITHOUT ROWID",
    "CREATE INDEX IF NOT EXISTS token_usage_minutes_by_minute ON token_usage_minutes (repository, minuteAt)",
    "CREATE TABLE IF NOT EXISTS token_usage_synchronizations (
        repository TEXT NOT NULL,
        folder TEXT NOT NULL,
        synchronizedAt TEXT NOT NULL,
        readUpTo TEXT,
        mode TEXT NOT NULL CHECK (mode IN ('initialize', 'update')),
        PRIMARY KEY (repository, folder)
    )",
    "CREATE TABLE IF NOT EXISTS model_price_versions (
        version INTEGER PRIMARY KEY,
        retrievedAt TEXT NOT NULL,
        checkedAt TEXT NOT NULL,
        source TEXT NOT NULL,
        unit TEXT NOT NULL,
        contentHash TEXT NOT NULL,
        modelCount INTEGER NOT NULL
    )",
    "CREATE TABLE IF NOT EXISTS model_prices (
        version INTEGER NOT NULL,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        freshInputUsdPerMillion REAL NOT NULL CHECK (freshInputUsdPerMillion >= 0),
        cachedInputUsdPerMillion REAL NOT NULL CHECK (cachedInputUsdPerMillion >= 0),
        cacheWriteInputUsdPerMillion REAL NOT NULL CHECK (cacheWriteInputUsdPerMillion >= 0),
        outputUsdPerMillion REAL NOT NULL CHECK (outputUsdPerMillion >= 0),
        PRIMARY KEY (version, model)
    ) WITHOUT ROWID",
    "CREATE VIEW IF NOT EXISTS latest_model_prices AS
        SELECT version, model, provider, freshInputUsdPerMillion, cachedInputUsdPerMillion, cacheWriteInputUsdPerMillion,
               outputUsdPerMillion
        FROM model_prices
        WHERE version = (SELECT MAX(version) FROM model_price_versions)",
    COST_VIEW_STATEMENT,
];

/// The statement of the view `token_usage_with_cost`. The price of a model is the price of the entry with the exact name of
/// the model, else the price of the entry without the date `-YYYYMMDD` that ends the name. Every token kind has its own price,
/// and the cost is in US dollars.
const COST_VIEW_STATEMENT: &str = "CREATE VIEW IF NOT EXISTS token_usage_with_cost AS
    SELECT u.repository AS repository,
           u.folder AS folder,
           u.chatSessionId AS chatSessionId,
           u.codingAgent AS codingAgent,
           u.minuteAt AS minuteAt,
           u.model AS model,
           u.freshInputTokens AS freshInputTokens,
           u.cachedInputTokens AS cachedInputTokens,
           u.cacheWriteInputTokens AS cacheWriteInputTokens,
           u.outputTokens AS outputTokens,
           COALESCE(exact.version, dated.version) AS priceVersion,
           COALESCE(exact.model, dated.model) AS priceModel,
           CASE WHEN COALESCE(exact.model, dated.model) IS NULL THEN NULL ELSE
               (u.freshInputTokens * COALESCE(exact.freshInputUsdPerMillion, dated.freshInputUsdPerMillion)
                + u.cachedInputTokens * COALESCE(exact.cachedInputUsdPerMillion, dated.cachedInputUsdPerMillion)
                + u.cacheWriteInputTokens * COALESCE(exact.cacheWriteInputUsdPerMillion, dated.cacheWriteInputUsdPerMillion)
                + u.outputTokens * COALESCE(exact.outputUsdPerMillion, dated.outputUsdPerMillion)) / 1000000.0
           END AS costUsd
    FROM token_usage_minutes u
    LEFT JOIN latest_model_prices exact ON exact.model = u.model
    LEFT JOIN latest_model_prices dated ON dated.model = CASE
        WHEN length(u.model) > 9 AND substr(u.model, -9, 1) = '-' AND substr(u.model, -8) NOT GLOB '*[^0-9]*'
        THEN substr(u.model, 1, length(u.model) - 9) END";

/// Creates every table, the index, and every view of the token usage and of the model prices when they do not exist.
///
/// # Errors
/// An error when a statement fails.
pub fn create_all(connection: &Connection) -> Result<(), String> {
    for statement in CREATE_STATEMENTS {
        connection.execute_batch(statement).map_err(|error| format!("The schema cannot be created: {error}. Statement: {statement}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(connection: &Connection, kind: &str) -> Vec<String> {
        let mut statement = connection.prepare("SELECT name FROM sqlite_master WHERE type = ?1 AND name NOT LIKE 'sqlite_%' ORDER BY name").unwrap();
        let rows = statement.query_map([kind], |row| row.get::<_, String>(0)).unwrap();
        rows.map(|name| name.unwrap()).collect()
    }

    #[test]
    fn creates_the_four_tables_the_two_views_and_the_index() {
        let connection = Connection::open_in_memory().unwrap();
        create_all(&connection).unwrap();
        assert_eq!(
            names(&connection, "table"),
            ["model_price_versions", "model_prices", "token_usage_minutes", "token_usage_synchronizations"]
        );
        assert_eq!(names(&connection, "view"), ["latest_model_prices", "token_usage_with_cost"]);
        assert_eq!(names(&connection, "index"), ["token_usage_minutes_by_minute"]);
    }

    #[test]
    fn can_run_two_times_and_keeps_the_rows() {
        let connection = Connection::open_in_memory().unwrap();
        create_all(&connection).unwrap();
        connection
            .execute("INSERT INTO token_usage_minutes VALUES ('r', 'c', 'm', '2026-10-14T10:00:00.000Z', 'CODEX', '/f', 1, 2, 3, 4)", [])
            .unwrap();
        create_all(&connection).unwrap();
        let count: i64 = connection.query_row("SELECT COUNT(*) FROM token_usage_minutes", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn refuses_a_negative_count_and_a_coding_agent_that_is_not_known() {
        let connection = Connection::open_in_memory().unwrap();
        create_all(&connection).unwrap();
        let insert = |agent: &str, fresh: i64| {
            connection.execute(
                "INSERT INTO token_usage_minutes VALUES ('r', 'c', 'm', 'x', ?1, '/f', ?2, 0, 0, 0)",
                rusqlite::params![agent, fresh],
            )
        };
        assert!(insert("CODEX", -1).is_err());
        assert!(insert("OTHER", 1).is_err());
        assert!(insert("CODEX", 1).is_ok());
    }
}
