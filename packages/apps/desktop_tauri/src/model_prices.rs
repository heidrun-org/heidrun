//! Model prices for the Past chats sidebar section: what one token of each model of Claude Code and of Codex costs, to turn the
//! tokens of a chat into money.
//!
//! The prices, their versions, the fetch of the public price list, and the calculation of a cost are in the package
//! `data_layer_coding_agents`, and the prices are stored in the SQLite file of the data layer. This file only keeps the latest
//! `PriceTable` in memory for the sidebar, and asks the package for a refresh in the background when the latest version was
//! checked a day ago or more, at most once an hour. A refresh that fails changes nothing: Heidrun never loses its prices.

use data_layer_coding_agents::{
    default_database_path, price_list_source_of, ModelPriceDatabase, PriceListSource, PriceRefresh, PriceTable,
    PRICE_FRESH_MILLISECONDS, PRICE_LIST_ADDRESS,
};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};

/// The shortest time between two refreshes, in milliseconds: one hour. A refresh that failed is not tried again at once.
const RETRY_AFTER_MILLISECONDS: i64 = 3_600_000;

/// The name of the file where an earlier version of Heidrun kept its prices, in the folder of the data of Heidrun. The SQLite
/// file replaces it.
const OLD_PRICES_FILE: &str = "model_prices.json";

/// The latest table of the application. It is read from the SQLite file on the first call of `current`.
static TABLE: Mutex<Option<Arc<PriceTable>>> = Mutex::new(None);

/// True while a refresh of the prices runs.
static IS_REFRESHING: AtomicBool = AtomicBool::new(false);

/// When the last refresh started, in milliseconds since 1970. Zero before the first refresh.
static LAST_REFRESH_AT: AtomicI64 = AtomicI64::new(0);

/// The table that the application uses now. It is empty while Heidrun has no price: the tokens of a chat then show without a
/// cost. When the latest version is missing or checked a day ago or more, the call starts a refresh in the background: the
/// next call gets the new table.
pub fn current() -> Arc<PriceTable> {
    let table = {
        let mut guard = TABLE.lock().unwrap_or_else(|e| e.into_inner());
        guard.get_or_insert_with(|| Arc::new(read_table())).clone()
    };
    let now = now_milliseconds();
    if is_old(&table, now) && now - LAST_REFRESH_AT.load(Ordering::SeqCst) > RETRY_AFTER_MILLISECONDS {
        refresh_in_background();
    }
    table
}

/// Fetches the price list from `source` when the latest version in the SQLite file at `database_path` is a day old, or when
/// `is_forced` is true, and keeps it there. The caller holds the lock of the SQLite file. The table of the application is read
/// again when the prices changed.
///
/// # Errors
/// An error when the SQLite file or the price list cannot be read. The prices that the file holds are not changed then.
pub fn refresh_locked(database_path: &Path, source: &dyn PriceListSource, is_forced: bool) -> Result<PriceRefresh, String> {
    let result = ModelPriceDatabase::open(database_path)?.refresh(source, now_milliseconds(), is_forced)?;
    if !matches!(result, PriceRefresh::Fresh { .. }) && database_path == default_database_path() {
        *TABLE.lock().unwrap_or_else(|e| e.into_inner()) = Some(Arc::new(read_table()));
        let _ = std::fs::remove_file(crate::chats::data_dir().join(OLD_PRICES_FILE));
    }
    Ok(result)
}

/// Like `refresh_locked` without force, but it tries at most once an hour, whatever the outcome: a computer without a network
/// does not wait for a fetch each time it is asked. Returns `Ok(None)` when the last try is less than an hour old.
///
/// # Errors
/// The same as `refresh_locked`.
pub fn refresh_when_due_locked(database_path: &Path, source: &dyn PriceListSource) -> Result<Option<PriceRefresh>, String> {
    let now = now_milliseconds();
    if now - LAST_REFRESH_AT.load(Ordering::SeqCst) <= RETRY_AFTER_MILLISECONDS {
        return Ok(None);
    }
    LAST_REFRESH_AT.store(now, Ordering::SeqCst);
    refresh_locked(database_path, source, false).map(Some)
}

/// The public price list of the project LiteLLM.
pub fn public_price_list() -> Box<dyn PriceListSource> {
    price_list_source_of(PRICE_LIST_ADDRESS)
}

/// The latest prices of the SQLite file, or an empty table when the file does not exist or holds no price.
fn read_table() -> PriceTable {
    ModelPriceDatabase::open_read_only(&default_database_path()).and_then(|database| database.load_latest_table()).unwrap_or_default()
}

/// True when `table` has no version, or when its version was checked a day ago or more.
fn is_old(table: &PriceTable, now: i64) -> bool {
    let Some(version) = table.version.as_ref() else {
        return true;
    };
    match data_layer_coding_agents::parse_time_text(&version.checked_at) {
        Ok(checked_at) => now - checked_at >= PRICE_FRESH_MILLISECONDS,
        Err(_) => true,
    }
}

fn now_milliseconds() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Starts a refresh of the prices, unless one runs. A refresh that fails changes nothing.
fn refresh_in_background() {
    if IS_REFRESHING.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn_blocking(|| {
        // Two programs that write the SQLite file at the same time would fail with "database is locked".
        let database_path = default_database_path();
        if let Ok(_guard) = heidrun_data::lock_database(&database_path) {
            let _ = refresh_when_due_locked(&database_path, public_price_list().as_ref());
        }
        IS_REFRESHING.store(false, Ordering::SeqCst);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_layer_coding_agents::PriceVersion;

    fn table_checked_at(checked_at: &str) -> PriceTable {
        PriceTable {
            version: Some(PriceVersion {
                version: 1,
                retrieved_at: checked_at.to_string(),
                checked_at: checked_at.to_string(),
                source: "test".to_string(),
                unit: "US dollars for one million tokens".to_string(),
                content_hash: "0".to_string(),
                model_count: 0,
            }),
            prices: Default::default(),
        }
    }

    #[test]
    fn a_table_without_a_version_is_old() {
        assert!(is_old(&PriceTable::default(), 0));
    }

    #[test]
    fn a_table_is_old_a_day_after_its_last_check_and_not_before() {
        let table = table_checked_at("2026-10-14T12:00:00.000Z");
        let checked_at = 1_791_979_200_000;
        assert!(!is_old(&table, checked_at + PRICE_FRESH_MILLISECONDS - 1));
        assert!(is_old(&table, checked_at + PRICE_FRESH_MILLISECONDS));
    }

    #[test]
    fn a_table_whose_date_cannot_be_read_is_old() {
        assert!(is_old(&table_checked_at("not a date"), 0));
    }
}
