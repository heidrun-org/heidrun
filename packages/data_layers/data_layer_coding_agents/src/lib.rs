//! The coding agents source of the data layer of Heidrun: reads the chat sessions that Claude Code and Codex saved for a
//! repository, and the configuration of the coding agent (the memory files, the subagents, and the skills), and writes the
//! facts of each one in a SQLite file.
//!
//! The library has six parts:
//! - `scan`, `tokens`, and `ScanCache` read one chat session file without a model: the title, the dates, the messages, the
//!   folders, the issues, the pull requests, the files that the coding agent wrote, and the tokens of each model.
//! - `find_claude_session_files`, `find_codex_session_files`, and `read_codex_titles` find the chat session files of one
//!   folder, and of the folders below it when the `FolderScope` says so, including the compressed files of Codex, and the
//!   titles of the chat sessions of Codex. `find_claude_agent_files` finds the files of the subagents and of the workflows of a chat session of Claude Code.
//! - `ChatSessionsDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query. `synchronize`
//!   fills it, in the mode initialize or update.
//! - `read_configuration`, `ConfigurationDatabase`, and `synchronize_configuration` read the configuration of the coding
//!   agent, the memory files, the subagents, and the skills, and write it in the tables `memory_files`, `subagents`, and
//!   `skills`.
//! - `to_table` and `to_json` write the rows of a query as text.
//! - `refresh_chat_sessions`, `refresh_ai_cost`, and `refresh_public_model_prices_when_due` copy the sources into the SQLite
//!   file. `find_chat_list` and `find_ai_cost` read the SQLite file only and give typed rows. These five functions are
//!   what the desktop application calls: it never reads a chat session file or runs SQL itself.
//!
//! The calls are blocking. A caller in an async program runs them in a blocking task.

mod coding_agents;
mod model;
mod pricing;
mod query;
mod refresh;
mod repository_finder;
mod request_parameters;
mod storage;
mod synchronization;
#[cfg(test)]
mod ai_cost_tests;
#[cfg(test)]
mod test_samples;

pub use coding_agents::agent_homes::{agents_home, claude_dir, codex_home};
pub use coding_agents::configuration_reader::{read_configuration, read_header, ConfigurationFolders};
pub use coding_agents::scan::{feed_claude_line, feed_codex_line, read_lines_from, shorten, ChatMeta, Scan};
pub use coding_agents::scan_cache::{ScanCache, CACHE_FILE_NAME};
pub use coding_agents::session_files::{
    claude_folder_name, find_claude_agent_files, find_claude_session_files, find_codex_session_files, is_in_folder,
    read_codex_titles, title_of_scan, FolderScope, SessionFile,
};
pub use coding_agents::session_reader::{format_date, parse_date, read_chat_session_files, read_chat_sessions, ChatSessionRead};
pub use coding_agents::token_usage_reader::{minutes_of, read_token_usage, TokenUsageFiles};
pub use coding_agents::tokens::{model_tokens_of, TokenCounts, TokenScan, TokensByMinute, TokensByModel, UNKNOWN_MODEL};
pub use model::ai_cost_types::{AiCostAnswer, AiCostHour, AiCostSynchronization, AiCostWorkspace};
pub use model::chat_list_types::{AgentChats, Chat, ChatList, ChatUsage, SortKey, SortOrder, Sorting, MAX_LIMIT};
pub use model::configuration_types::{
    ConfigurationItem, ConfigurationKind, ConfigurationRead, ConfigurationScope, ConfigurationWriteCount,
};
pub use model::price_types::{ListedModelPrice, ModelPrice, PriceRefresh, PriceVersion, PRICE_TOKEN_COUNT, PRICE_UNIT};
pub use model::token_usage_types::{
    ChatTokenUsage, MinuteTokens, TokenUsageReport, TokenUsageSynchronization, TokenUsageWriteCount, UsageGrouping, UsageQuery,
    UsageRow, UsageTotals, MINUTE_MILLISECONDS, UNDATED_MINUTE,
};
pub use model::schemas::{
    configuration_schema, validate_chat_session_value, validate_configuration_value, CHAT_SESSION_SCHEMA, MEMORY_FILE_SCHEMA,
    SKILL_SCHEMA, SUBAGENT_SCHEMA,
};
pub use model::types::{
    ChatSession, ChatSessionRecord, ChatSessionRelations, ChatSessionTable, CodingAgent, ModelTokens, QueryRow,
    SynchronizationMode, SynchronizationReport,
};
pub use pricing::price_list_parser::{content_hash, parse_price_list, PRICE_LIST_ADDRESS};
pub use pricing::price_list_source::{
    price_list_source_of, FilePriceListSource, PriceListSource, WebPriceListSource,
};
pub use pricing::price_table::{without_date, PriceTable};
pub use query::{find_ai_cost, find_chat_list};
pub use refresh::{
    refresh_ai_cost, refresh_chat_sessions, refresh_model_prices, refresh_model_prices_when_due,
    refresh_public_model_prices_when_due,
};
pub use repository_finder::{find_main_root, find_repository, find_repository_key, find_root, parse_repository};
pub use request_parameters::{sorting_from_parameters, usage_query_from_parameters};
pub use storage::configuration_database::ConfigurationDatabase;
pub use storage::database::ChatSessionsDatabase;
pub use storage::minute_text::{minute_text, parse_time_text, time_text};
pub use storage::model_price_database::{ModelPriceDatabase, PRICE_FRESH_MILLISECONDS};
pub use storage::token_usage_database::TokenUsageDatabase;
pub use storage::token_usage_schema::{
    COST_VIEW, LATEST_PRICES_VIEW, MINUTES_TABLE, MINUTE_INDEX, PRICES_TABLE, PRICE_VERSIONS_TABLE,
    SYNCHRONIZATIONS_TABLE, UNDATED_MINUTE_TEXT,
};
pub use storage::usage_grouping::{
    find_time_zone, group_minutes, local_time_zone_name, parse_range_bound, summarize_periods, MinuteUsage, PeriodUsage,
};
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::{
    describe_since, run as synchronize, run_configuration as synchronize_configuration, run_token_usage as synchronize_token_usage,
};

use std::path::PathBuf;

/// The name of this package in the log of the requests of the data layer, without the prefix `data_layer_`.
pub(crate) const REQUEST_PACKAGE: &str = "coding_agents";

/// A function that ignores the lines of progress.
pub fn ignore_log(_message: &str) {}

/// The path of the SQLite file in `HEIDRUN_DIR`, or, when the variable is unset or empty, `~/.config/heidrun/data_layer.sqlite`. It is the same file as
/// the one of `data_layer_code_hosting`.
pub fn default_database_path() -> PathBuf {
    std::env::var("HEIDRUN_DIR")
        .ok()
        .filter(|value| value.is_empty() == false)
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join(".config").join("heidrun"))
        .join("data_layer.sqlite")
}
