//! The prices of the models in the SQLite file: the tables `model_price_versions` and `model_prices`.
//!
//! The price list changes now and then. Each change of the prices makes a new version, and the old versions stay in the file, so
//! a price always has its provenance: the source, the time of the fetch, the unit, and a hash of its content. The view
//! `token_usage_with_cost` uses the latest version only, so one result never mixes two versions. A version is never changed
//! after it is written, except its column `checkedAt`, which says when the price list was fetched the last time and still gave
//! the same prices.
//!
//! Refresh policy: `refresh` fetches the price list when the latest version was checked a day ago or more, or when it is forced.
//! A fetch that fails changes nothing, so the prices of the latest version stay in use.

use crate::model::price_types::{ListedModelPrice, ModelPrice, PriceRefresh, PriceVersion, PRICE_UNIT};
use crate::pricing::price_list_parser::{content_hash, parse_price_list};
use crate::pricing::price_list_source::PriceListSource;
use crate::pricing::price_table::PriceTable;
use crate::storage::minute_text::{parse_time_text, time_text};
use crate::storage::token_usage_schema::create_all;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// How long a version of the prices stays fresh after a check, in milliseconds: one day.
pub const PRICE_FRESH_MILLISECONDS: i64 = 24 * 60 * 60 * 1000;

/// The prices of the models in the SQLite file.
pub struct ModelPriceDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// True when the file is open read only. Only then nothing writes.
    is_read_only: bool,
    /// The open connection to the SQLite file.
    connection: Connection,
}

impl ModelPriceDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, and the tables when they do not
    /// exist.
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
        Ok(ModelPriceDatabase { database_path: database_path.to_path_buf(), is_read_only: false, connection })
    }

    /// Opens the SQLite file read only. The file must exist.
    ///
    /// # Errors
    /// An error when the file does not exist, or cannot be opened.
    pub fn open_read_only(database_path: &Path) -> Result<Self, String> {
        if !database_path.exists() {
            return Err(format!("The database file does not exist: {}.", database_path.display()));
        }
        let connection = Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|error| format!("The database file {} cannot be opened: {error}", database_path.display()))?;
        Ok(ModelPriceDatabase { database_path: database_path.to_path_buf(), is_read_only: true, connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// The latest version of the prices, or `None` when the file holds no price. The file is shared by the packages of the data
    /// layer, so it can exist before the package wrote its price tables: it then holds no price.
    pub fn find_latest_version(&self) -> Result<Option<PriceVersion>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_latest_price_version", OperationKind::Query).database(&self.database_path);
        record(spec, || self.find_latest_version_inside(), |found| Summary::count(usize::from(found.is_some())))
    }

    /// The work of `find_latest_version`, between the start event and the completion event of its operation.
    fn find_latest_version_inside(&self) -> Result<Option<PriceVersion>, String> {
        let has_versions_table = self
            .connection
            .query_row("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'model_price_versions'", [], |_| Ok(()))
            .optional()
            .map_err(|error| format!("The tables of the database cannot be read: {error}"))?
            .is_some();
        if has_versions_table == false {
            return Ok(None);
        }
        self.connection
            .query_row(
                "SELECT version, retrievedAt, checkedAt, source, unit, contentHash, modelCount
                 FROM model_price_versions ORDER BY version DESC LIMIT 1",
                [],
                |row| {
                    Ok(PriceVersion {
                        version: row.get(0)?,
                        retrieved_at: row.get(1)?,
                        checked_at: row.get(2)?,
                        source: row.get(3)?,
                        unit: row.get(4)?,
                        content_hash: row.get(5)?,
                        model_count: row.get::<_, i64>(6)? as usize,
                    })
                },
            )
            .optional()
            .map_err(|error| format!("The latest version of the prices cannot be read: {error}"))
    }

    /// The prices of the latest version. The table has no price and no version when the file holds no price.
    pub fn load_latest_table(&self) -> Result<PriceTable, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "load_latest_price_table", OperationKind::Query).database(&self.database_path);
        record(spec, || self.load_latest_table_inside(), |_| Summary::none())
    }

    /// The work of `load_latest_table`, between the start event and the completion event of its operation.
    fn load_latest_table_inside(&self) -> Result<PriceTable, String> {
        let Some(version) = self.find_latest_version()? else { return Ok(PriceTable::default()) };
        let mut statement = self
            .connection
            .prepare(
                "SELECT model, freshInputUsdPerMillion, cachedInputUsdPerMillion, cacheWriteInputUsdPerMillion, outputUsdPerMillion
                 FROM model_prices WHERE version = ?1",
            )
            .map_err(|error| format!("The prices cannot be read: {error}"))?;
        let rows = statement
            .query_map(params![version.version], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    ModelPrice {
                        fresh_input: row.get(1)?,
                        cached_input: row.get(2)?,
                        cache_write_input: row.get(3)?,
                        output: row.get(4)?,
                    },
                ))
            })
            .map_err(|error| format!("The prices cannot be read: {error}"))?;
        let mut prices = BTreeMap::new();
        for row in rows {
            let (model, price) = row.map_err(|error| format!("The prices cannot be read: {error}"))?;
            prices.insert(model, price);
        }
        Ok(PriceTable { version: Some(version), prices })
    }

    /// Fetches the price list when the latest version was checked a day ago or more, or when `is_forced` is true, and keeps
    /// it. `now` is the time of now in milliseconds since 1970.
    ///
    /// - A latest version checked less than a day ago, without force: nothing is fetched (`PriceRefresh::Fresh`).
    /// - The same prices as the latest version: only its column `checkedAt` changes (`PriceRefresh::Unchanged`).
    /// - Other prices, or no version yet: a new version is written (`PriceRefresh::NewVersion`).
    ///
    /// # Errors
    /// An error when the file is open read only, when the source does not answer, when the text is not a price list, or when
    /// the file cannot be written. The prices that the file holds are not changed in these cases.
    pub fn refresh(&mut self, source: &dyn PriceListSource, now: i64, is_forced: bool) -> Result<PriceRefresh, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_prices", OperationKind::Synchronization)
            .choice("isForced", is_forced)
            .parameter("now", now)
            .database(&self.database_path);
        record(spec, || self.refresh_inside(source, now, is_forced), |_| Summary::none())
    }

    /// The work of `refresh`, between the start event and the completion event of its operation.
    fn refresh_inside(&mut self, source: &dyn PriceListSource, now: i64, is_forced: bool) -> Result<PriceRefresh, String> {
        if self.is_read_only {
            return Err("A refresh of the prices needs a database that is not open read only.".to_string());
        }
        let latest = self.find_latest_version()?;
        if let Some(version) = latest.as_ref().filter(|_| !is_forced) {
            let checked = parse_time_text(&version.checked_at)?;
            if now.saturating_sub(checked) < PRICE_FRESH_MILLISECONDS && checked <= now {
                return Ok(PriceRefresh::Fresh { version: version.version });
            }
        }
        let text = source.read()?;
        let prices = parse_price_list(&text)
            .ok_or_else(|| format!("{} is not a price list: it holds no model of Claude Code or of Codex.", source.address()))?;
        self.keep_prices(&prices, &source.address(), &time_text(now)?, latest)
    }

    /// Keeps `prices` as the latest version, or only marks the latest version as checked when it holds the same prices.
    fn keep_prices(
        &mut self,
        prices: &[ListedModelPrice],
        source: &str,
        now: &str,
        latest: Option<PriceVersion>,
    ) -> Result<PriceRefresh, String> {
        let hash = content_hash(prices);
        let transaction = self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        if let Some(version) = latest.filter(|version| version.content_hash == hash) {
            transaction
                .execute("UPDATE model_price_versions SET checkedAt = ?2 WHERE version = ?1", params![version.version, now])
                .map_err(|error| format!("The version of the prices cannot be updated: {error}"))?;
            transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))?;
            return Ok(PriceRefresh::Unchanged { version: version.version });
        }
        let version: i64 = transaction
            .query_row("SELECT COALESCE(MAX(version), 0) + 1 FROM model_price_versions", [], |row| row.get(0))
            .map_err(|error| format!("The number of the version cannot be read: {error}"))?;
        transaction
            .execute(
                "INSERT INTO model_price_versions (version, retrievedAt, checkedAt, source, unit, contentHash, modelCount)
                 VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6)",
                params![version, now, source, PRICE_UNIT, hash, prices.len() as i64],
            )
            .map_err(|error| format!("The version of the prices cannot be written: {error}"))?;
        {
            let mut statement = transaction
                .prepare(
                    "INSERT INTO model_prices (version, model, provider, freshInputUsdPerMillion, cachedInputUsdPerMillion,
                                              cacheWriteInputUsdPerMillion, outputUsdPerMillion)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                )
                .map_err(|error| format!("The prices cannot be written: {error}"))?;
            for listed in prices {
                statement
                    .execute(params![
                        version,
                        listed.model,
                        listed.provider,
                        listed.price.fresh_input,
                        listed.price.cached_input,
                        listed.price.cache_write_input,
                        listed.price.output
                    ])
                    .map_err(|error| format!("The price of {} cannot be written: {error}", listed.model))?;
            }
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))?;
        Ok(PriceRefresh::NewVersion { version, model_count: prices.len() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::temp_folder;

    /// A price list that is a fake source.
    struct FakeSource {
        /// The text that the source gives, or the error.
        text: Result<String, String>,
    }

    impl PriceListSource for FakeSource {
        fn address(&self) -> String {
            "fake://prices".to_string()
        }

        fn read(&self) -> Result<String, String> {
            self.text.clone()
        }
    }

    fn list(output: &str) -> FakeSource {
        FakeSource {
            text: Ok(format!(
                r#"{{"claude-opus-5": {{"litellm_provider": "anthropic", "input_cost_per_token": 5e-06,
                    "output_cost_per_token": {output}, "cache_read_input_token_cost": 5e-07}}}}"#
            )),
        }
    }

    const DAY: i64 = PRICE_FRESH_MILLISECONDS;
    const NOW: i64 = 1_791_712_800_000;

    fn database(name: &str) -> ModelPriceDatabase {
        ModelPriceDatabase::open(&temp_folder(name).join("data_layer.sqlite")).unwrap()
    }

    #[test]
    fn has_no_price_and_no_version_before_the_first_refresh() {
        let database = database("prices_empty");
        assert_eq!(database.find_latest_version(), Ok(None));
        assert_eq!(database.load_latest_table(), Ok(PriceTable::default()));
    }

    #[test]
    fn writes_the_first_version_with_its_provenance_and_reads_back_the_prices() {
        let mut database = database("prices_first");
        let refresh = database.refresh(&list("2.5e-05"), NOW, false).unwrap();
        assert_eq!(refresh, PriceRefresh::NewVersion { version: 1, model_count: 1 });
        let version = database.find_latest_version().unwrap().unwrap();
        assert_eq!(version.source, "fake://prices");
        assert_eq!(version.unit, PRICE_UNIT);
        assert_eq!((version.retrieved_at.as_str(), version.checked_at.as_str()), ("2026-10-11T10:00:00.000Z", "2026-10-11T10:00:00.000Z"));
        assert_eq!(version.content_hash.len(), 16);
        let table = database.load_latest_table().unwrap();
        assert_eq!(table.price_of("claude-opus-5"), Some(&ModelPrice { fresh_input: 5.0, cached_input: 0.5, cache_write_input: 5.0, output: 25.0 }));
    }

    #[test]
    fn does_not_fetch_again_in_the_day_after_a_check_unless_it_is_forced() {
        let mut database = database("prices_fresh");
        database.refresh(&list("2.5e-05"), NOW, false).unwrap();
        let failing = FakeSource { text: Err("no network".to_string()) };
        assert_eq!(database.refresh(&failing, NOW + DAY - 1, false), Ok(PriceRefresh::Fresh { version: 1 }));
        assert!(database.refresh(&failing, NOW + DAY - 1, true).is_err());
        assert!(database.refresh(&failing, NOW + DAY, false).is_err());
    }

    #[test]
    fn moves_the_check_date_when_the_prices_are_the_same_and_keeps_the_retrieval_date() {
        let mut database = database("prices_unchanged");
        database.refresh(&list("2.5e-05"), NOW, false).unwrap();
        assert_eq!(database.refresh(&list("2.5e-05"), NOW + DAY, false), Ok(PriceRefresh::Unchanged { version: 1 }));
        let version = database.find_latest_version().unwrap().unwrap();
        assert_eq!(version.retrieved_at, "2026-10-11T10:00:00.000Z");
        assert_eq!(version.checked_at, "2026-10-12T10:00:00.000Z");
    }

    #[test]
    fn writes_a_new_version_when_a_price_changes_and_keeps_the_old_version() {
        let mut database = database("prices_new_version");
        database.refresh(&list("2.5e-05"), NOW, false).unwrap();
        let refresh = database.refresh(&list("3e-05"), NOW + DAY, false).unwrap();
        assert_eq!(refresh, PriceRefresh::NewVersion { version: 2, model_count: 1 });
        assert_eq!(database.load_latest_table().unwrap().price_of("claude-opus-5").unwrap().output, 30.0);
        let old: f64 = database
            .connection
            .query_row("SELECT outputUsdPerMillion FROM model_prices WHERE version = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(old, 25.0);
    }

    #[test]
    fn keeps_the_prices_when_the_source_fails_or_gives_a_text_that_is_not_a_price_list() {
        let mut database = database("prices_failure");
        database.refresh(&list("2.5e-05"), NOW, false).unwrap();
        let failing = FakeSource { text: Err("no network".to_string()) };
        assert!(database.refresh(&failing, NOW + DAY, false).unwrap_err().contains("no network"));
        let nonsense = FakeSource { text: Ok("<html>".to_string()) };
        assert!(database.refresh(&nonsense, NOW + DAY, false).unwrap_err().contains("not a price list"));
        assert_eq!(database.find_latest_version().unwrap().unwrap().version, 1);
        assert_eq!(database.load_latest_table().unwrap().prices.len(), 1);
    }

    #[test]
    fn refuses_a_refresh_on_a_database_that_is_open_read_only() {
        let folder = temp_folder("prices_read_only");
        let path = folder.join("data_layer.sqlite");
        ModelPriceDatabase::open(&path).unwrap();
        let mut read_only = ModelPriceDatabase::open_read_only(&path).unwrap();
        assert!(read_only.refresh(&list("2.5e-05"), NOW, false).unwrap_err().contains("read only"));
    }
}
