//! The SQLite file with the table `user_activity_records`.
//!
//! The table has these four columns: `workspaceFolder`, `startedAt`, `endedAt`, and `data`. The primary key is
//! `workspaceFolder` and `startedAt`. An index on `endedAt` makes the query "which records overlap this time range" fast.
//! The column `data` holds the JSON text of the record, so the facts are never split into more columns. The times are in UTC,
//! with three digits of milliseconds, so two times compare as text.

use crate::model::schemas::record_to_checked_value;
use crate::model::types::{QueryRow, UserActivityRecord};
use crate::model::utc_time::to_utc_text;
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// How long a read waits when another program ends a write of the file. A write holds the file for a moment only.
const READ_WAITING_TIME: std::time::Duration = std::time::Duration::from_secs(5);

/// The SQLite file of the user activity data layer.
pub struct UserActivityDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// True when the file is open read only. Only then the method `query` works.
    is_read_only: bool,
    /// The open connection to the SQLite file.
    connection: Connection,
}

impl UserActivityDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, the table `user_activity_records`,
    /// and the index on its column `endedAt` when they do not exist.
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
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS user_activity_records (
                    workspaceFolder TEXT NOT NULL,
                    startedAt TEXT NOT NULL,
                    endedAt TEXT NOT NULL,
                    data TEXT NOT NULL CHECK (json_valid(data)),
                    PRIMARY KEY (workspaceFolder, startedAt)
                );
                CREATE INDEX IF NOT EXISTS user_activity_records_ended_at ON user_activity_records (endedAt);",
            )
            .map_err(|error| format!("The table user_activity_records cannot be created: {error}"))?;
        Ok(UserActivityDatabase { database_path: database_path.to_path_buf(), is_read_only: false, connection })
    }

    /// Opens the SQLite file read only. The file must exist, and nothing can write in it.
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
        connection
            .busy_timeout(READ_WAITING_TIME)
            .map_err(|error| format!("The waiting time of the database file cannot be set: {error}"))?;
        Ok(UserActivityDatabase { database_path: database_path.to_path_buf(), is_read_only: true, connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Writes records. A row of a record that has the same `workspaceFolder` and `startedAt` as a row of the table replaces
    /// that row. Every record is checked against the JSON schema before the first row is written, so a wrong record writes
    /// nothing. The times of a record must already be in UTC.
    ///
    /// # Errors
    /// An error when one record does not follow the JSON schema, or when the file is open read only.
    pub fn upsert_records(&mut self, records: &[UserActivityRecord]) -> Result<(), String> {
        if self.is_read_only {
            return Err("A write needs a database that is not open read only.".to_string());
        }
        let mut rows = Vec::with_capacity(records.len());
        for record in records {
            let value = record_to_checked_value(record)?;
            rows.push((record.workspace_folder.clone(), record.started_at.clone(), record.ended_at.clone(), value.to_string()));
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        {
            let mut statement = transaction
                .prepare(
                    "INSERT INTO user_activity_records (workspaceFolder, startedAt, endedAt, data)
                     VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT (workspaceFolder, startedAt) DO UPDATE SET endedAt = excluded.endedAt, data = excluded.data",
                )
                .map_err(|error| format!("The write cannot be prepared: {error}"))?;
            for (workspace_folder, started_at, ended_at, data) in &rows {
                statement
                    .execute(params![workspace_folder, started_at, ended_at, data])
                    .map_err(|error| format!("The row {workspace_folder} {started_at} cannot be written: {error}"))?;
            }
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))
    }

    /// The largest `endedAt` of the table, in UTC, or `None` when the table has no row.
    pub fn find_latest_ended_at(&self) -> Result<Option<String>, String> {
        self.connection
            .query_row("SELECT MAX(endedAt) FROM user_activity_records", [], |row| row.get::<_, Option<String>>(0))
            .map_err(|error| format!("The latest end cannot be read: {error}"))
    }

    /// Counts the rows of the table.
    pub fn count_records(&self) -> Result<i64, String> {
        self.connection
            .query_row("SELECT COUNT(*) FROM user_activity_records", [], |row| row.get::<_, i64>(0))
            .map_err(|error| format!("The rows cannot be counted: {error}"))
    }

    /// Reads one record. Returns `None` when the table has no such row.
    pub fn find_record(&self, workspace_folder: &str, started_at: &str) -> Result<Option<UserActivityRecord>, String> {
        let data = self
            .connection
            .query_row(
                "SELECT data FROM user_activity_records WHERE workspaceFolder = ?1 AND startedAt = ?2",
                params![workspace_folder, started_at],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("The row {workspace_folder} {started_at} cannot be read: {error}"))?;
        match data {
            None => Ok(None),
            Some(data) => serde_json::from_str(&data)
                .map(Some)
                .map_err(|error| format!("The row {workspace_folder} {started_at} is not a user activity record: {error}")),
        }
    }

    /// True when the table `table` exists in the SQLite file. The file is shared by the packages of the data layer, so it can exist
    /// before the package wrote its own table.
    ///
    /// # Errors
    /// An error when the tables of the file cannot be listed.
    pub fn has_table(&self, table: &str) -> Result<bool, String> {
        self.connection
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1", params![table], |row| {
                row.get::<_, i64>(0)
            })
            .map(|count| count > 0)
            .map_err(|error| format!("The tables of the file cannot be listed: {error}"))
    }

    /// Reads the records whose active period overlaps the time range from `since` to `until`, the oldest first. A record
    /// overlaps when it ended after `since` and started before `until`. Both times are texts in the format ISO 8601 with an
    /// offset or in UTC, and the method turns them into UTC. The index on `endedAt` answers the range.
    ///
    /// # Errors
    /// An error when a time is not a time with an offset, or when a row is not a user activity record.
    pub fn find_records_overlapping(&self, since: &str, until: &str) -> Result<Vec<UserActivityRecord>, String> {
        let since = to_utc_text(since)?;
        let until = to_utc_text(until)?;
        if self.has_table("user_activity_records")? == false {
            return Ok(Vec::new());
        }
        let mut statement = self
            .connection
            .prepare(
                "SELECT data FROM user_activity_records WHERE endedAt > ?1 AND startedAt < ?2 ORDER BY startedAt",
            )
            .map_err(|error| format!("The records cannot be read: {error}"))?;
        let rows = statement
            .query_map(params![since, until], |row| row.get::<_, String>(0))
            .map_err(|error| format!("The records cannot be read: {error}"))?;
        let mut records = Vec::new();
        for row in rows {
            let data = row.map_err(|error| format!("The records cannot be read: {error}"))?;
            records.push(
                serde_json::from_str::<UserActivityRecord>(&data)
                    .map_err(|error| format!("A row is not a user activity record: {error}"))?,
            );
        }
        Ok(records)
    }

    /// Runs one SQL statement and gives its rows. The SQLite functions on JSON work on the column `data`, for example
    /// `json_extract(data, '$.endReason')`. A value that is a blob becomes the text `<blob, N bytes>`.
    ///
    /// # Errors
    /// An error when the file is not open read only, or when the statement is wrong. A statement that writes is wrong,
    /// because the file is read only.
    pub fn query(&self, sql: &str) -> Result<Vec<QueryRow>, String> {
        if !self.is_read_only {
            return Err("A query needs a database that is open read only.".to_string());
        }
        let mut statement = self.connection.prepare(sql).map_err(|error| error.to_string())?;
        let column_names: Vec<String> = statement.column_names().iter().map(|name| name.to_string()).collect();
        let mut rows = statement.query([]).map_err(|error| error.to_string())?;
        let mut query_rows = Vec::new();
        while let Some(row) = rows.next().map_err(|error| error.to_string())? {
            let mut query_row = QueryRow::new();
            for (index, column_name) in column_names.iter().enumerate() {
                let value = row.get_ref(index).map_err(|error| error.to_string())?;
                query_row.insert(column_name.clone(), value_from_sqlite(value));
            }
            query_rows.push(query_row);
        }
        Ok(query_rows)
    }
}

/// Turns one value of SQLite into a JSON value.
fn value_from_sqlite(value: ValueRef) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(integer) => Value::from(integer),
        ValueRef::Real(real) => serde_json::Number::from_f64(real).map(Value::Number).unwrap_or(Value::Null),
        ValueRef::Text(bytes) => Value::String(String::from_utf8_lossy(bytes).into_owned()),
        ValueRef::Blob(bytes) => Value::String(format!("<blob, {} bytes>", bytes.len())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{record, temp_folder, time};

    /// A database in a new folder that does not exist yet.
    fn new_database(name: &str) -> (PathBuf, UserActivityDatabase) {
        let folder = temp_folder(name);
        let path = folder.join("a_folder_that_does_not_exist_yet").join("data_layer.sqlite");
        let database = UserActivityDatabase::open(&path).unwrap();
        (path, database)
    }

    #[test]
    fn creates_the_file_its_folder_and_an_empty_table() {
        let (path, database) = new_database("creates");
        assert!(path.exists());
        assert_eq!(database.count_records(), Ok(0));
        assert_eq!(database.find_latest_ended_at(), Ok(None));
    }

    #[test]
    fn writes_a_record_and_reads_back_the_same_record() {
        let (_, mut database) = new_database("round_trip");
        let sample = record(7);
        database.upsert_records(std::slice::from_ref(&sample)).unwrap();
        assert_eq!(database.find_record("/work/heidrun", &time(7, 0)), Ok(Some(sample)));
        assert_eq!(database.find_record("/work/heidrun", &time(8, 0)), Ok(None));
        assert_eq!(database.find_record("/work/another", &time(7, 0)), Ok(None));
    }

    #[test]
    fn has_the_four_columns_and_the_column_data_holds_the_json_text() {
        let (path, mut database) = new_database("columns");
        let sample = record(7);
        database.upsert_records(std::slice::from_ref(&sample)).unwrap();
        let connection = Connection::open(&path).unwrap();
        let mut statement = connection.prepare("PRAGMA table_info(user_activity_records)").unwrap();
        let column_names: Vec<String> =
            statement.query_map([], |row| row.get::<_, String>(1)).unwrap().map(|name| name.unwrap()).collect();
        assert_eq!(column_names, ["workspaceFolder", "startedAt", "endedAt", "data"]);
        let (workspace_folder, started_at, ended_at, data): (String, String, String, String) = connection
            .query_row("SELECT * FROM user_activity_records", [], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .unwrap();
        assert_eq!(
            (workspace_folder.as_str(), started_at.as_str(), ended_at.as_str()),
            ("/work/heidrun", sample.started_at.as_str(), sample.ended_at.as_str())
        );
        assert_eq!(serde_json::from_str::<UserActivityRecord>(&data).unwrap(), sample);
    }

    #[test]
    fn has_an_index_on_the_column_ended_at() {
        let (path, _) = new_database("index");
        let connection = Connection::open(&path).unwrap();
        let mut statement = connection.prepare("PRAGMA index_info(user_activity_records_ended_at)").unwrap();
        let column_names: Vec<String> =
            statement.query_map([], |row| row.get::<_, String>(2)).unwrap().map(|name| name.unwrap()).collect();
        assert_eq!(column_names, ["endedAt"]);
    }

    #[test]
    fn uses_the_index_for_the_query_of_the_records_that_overlap_a_time_range() {
        let (path, _) = new_database("overlap_plan");
        let read_only_database = UserActivityDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database
            .query(&format!(
                "EXPLAIN QUERY PLAN SELECT * FROM user_activity_records WHERE endedAt > '{}' AND startedAt < '{}'",
                time(8, 0),
                time(9, 0)
            ))
            .unwrap();
        let plan: Vec<String> = rows.iter().map(|row| row["detail"].as_str().unwrap().to_string()).collect();
        assert!(plan.iter().any(|detail| detail.contains("user_activity_records_ended_at")), "{plan:?}");
    }

    #[test]
    fn finds_the_records_that_overlap_a_time_range_in_the_order_of_their_start() {
        let (_, mut database) = new_database("overlap");
        database.upsert_records(&[record(9), record(3), record(5)]).unwrap();
        let found = database.find_records_overlapping(&time(4, 0), &time(10, 0)).unwrap();
        assert_eq!(found, vec![record(5), record(9)]);
        // A record that ends exactly at the start of the range, or starts exactly at its end, does not overlap it.
        assert_eq!(database.find_records_overlapping(&time(3, 11), &time(5, 0)).unwrap(), Vec::<UserActivityRecord>::new());
        assert_eq!(database.find_records_overlapping(&time(3, 10), &time(5, 0)).unwrap(), vec![record(3)]);
    }

    #[test]
    fn finds_the_records_of_a_range_written_with_a_time_zone_offset() {
        let (_, mut database) = new_database("overlap_offset");
        database.upsert_records(&[record(5)]).unwrap();
        // 07:00 at +02:00 is 05:00 in UTC.
        let found = database.find_records_overlapping("2026-10-14T07:00:00.000+02:00", "2026-10-14T07:30:00.000+02:00").unwrap();
        assert_eq!(found, vec![record(5)]);
    }

    #[test]
    fn refuses_a_range_that_is_not_a_time_and_never_puts_the_text_in_the_statement() {
        let (_, database) = new_database("overlap_wrong_time");
        let error = database.find_records_overlapping("yesterday", &time(10, 0)).unwrap_err();
        assert!(error.contains("yesterday"));
        let injection = "2026-10-14T00:00:00Z' OR '1'='1";
        assert!(database.find_records_overlapping(injection, &time(10, 0)).is_err());
    }

    #[test]
    fn replaces_a_row_that_has_the_same_workspace_folder_and_started_at_and_never_adds_a_second_row() {
        let (_, mut database) = new_database("replaces");
        database.upsert_records(&[record(7)]).unwrap();
        let mut changed = record(7);
        changed.ended_at = time(7, 30);
        changed.keyboard_action_count = 99;
        database.upsert_records(&[changed]).unwrap();
        assert_eq!(database.count_records(), Ok(1));
        let stored = database.find_record("/work/heidrun", &time(7, 0)).unwrap().unwrap();
        assert_eq!((stored.keyboard_action_count, stored.ended_at.as_str()), (99, time(7, 30).as_str()));
        assert_eq!(database.find_latest_ended_at(), Ok(Some(time(7, 30))));
    }

    #[test]
    fn keeps_two_records_that_start_at_the_same_time_in_two_workspaces() {
        let (_, mut database) = new_database("two_workspaces");
        let mut in_another_workspace = record(7);
        in_another_workspace.workspace_folder = "/work/another".into();
        database.upsert_records(&[record(7), in_another_workspace]).unwrap();
        assert_eq!(database.count_records(), Ok(2));
    }

    #[test]
    fn gives_the_largest_ended_at_of_the_table() {
        let (_, mut database) = new_database("latest");
        database.upsert_records(&[record(9), record(3), record(5)]).unwrap();
        assert_eq!(database.find_latest_ended_at(), Ok(Some(time(9, 11))));
    }

    #[test]
    fn writes_nothing_when_one_record_of_the_list_is_wrong() {
        let (_, mut database) = new_database("wrong_record");
        let mut wrong_record = record(2);
        wrong_record.ended_at = "yesterday".into();
        let error = database.upsert_records(&[record(1), wrong_record]).unwrap_err();
        assert!(error.contains("endedAt"));
        assert_eq!(database.count_records(), Ok(0));
    }

    #[test]
    fn keeps_the_rows_after_the_file_is_closed_and_opened_again() {
        let (path, mut database) = new_database("reopen");
        database.upsert_records(&[record(4)]).unwrap();
        drop(database);
        let database = UserActivityDatabase::open(&path).unwrap();
        assert_eq!(database.count_records(), Ok(1));
        assert_eq!(database.find_record("/work/heidrun", &time(4, 0)).unwrap().unwrap(), record(4));
    }

    #[test]
    fn answers_a_query_with_the_rows_and_the_json_functions_of_sqlite_read_the_column_data() {
        let (path, mut database) = new_database("query");
        let mut second = record(2);
        second.end_reason = "app_closed".into();
        database.upsert_records(&[record(1), second, record(3)]).unwrap();
        let read_only_database = UserActivityDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database
            .query(
                "SELECT startedAt, json_extract(data, '$.endReason') AS endReason FROM user_activity_records
                 WHERE json_extract(data, '$.endReason') = 'app_closed'",
            )
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["startedAt"], time(2, 0));
        assert_eq!(rows[0].keys().collect::<Vec<_>>(), ["startedAt", "endReason"]);
    }

    #[test]
    fn refuses_a_statement_that_writes_when_the_file_is_open_read_only() {
        let (path, mut database) = new_database("read_only_refuses");
        database.upsert_records(&[record(1)]).unwrap();
        let read_only_database = UserActivityDatabase::open_read_only(&path).unwrap();
        assert!(read_only_database.query("DELETE FROM user_activity_records").unwrap_err().contains("readonly"));
        assert!(read_only_database.query("DROP TABLE user_activity_records").unwrap_err().contains("readonly"));
        assert_eq!(database.count_records(), Ok(1));
    }

    #[test]
    fn refuses_a_query_when_the_file_is_not_open_read_only() {
        let (_, database) = new_database("query_refused");
        assert!(database.query("SELECT 1").unwrap_err().contains("read only"));
    }

    #[test]
    fn refuses_to_write_when_the_file_is_open_read_only() {
        let (path, _) = new_database("write_refused");
        let mut read_only_database = UserActivityDatabase::open_read_only(&path).unwrap();
        assert!(read_only_database.upsert_records(&[record(1)]).unwrap_err().contains("read only"));
    }

    #[test]
    fn does_not_create_the_file_when_it_opens_a_file_that_does_not_exist_read_only() {
        let missing_path = temp_folder("missing").join("missing.sqlite");
        let error = UserActivityDatabase::open_read_only(&missing_path).err().unwrap();
        assert!(error.contains("does not exist"));
        assert!(!missing_path.exists());
    }

    #[test]
    fn gives_a_null_a_number_a_real_number_and_a_blob_in_a_row() {
        let (path, _) = new_database("value_kinds");
        let read_only_database = UserActivityDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database.query("SELECT NULL AS a, 3 AS b, 1.5 AS c, x'0102' AS d").unwrap();
        assert_eq!(rows[0]["a"], Value::Null);
        assert_eq!(rows[0]["b"], 3);
        assert_eq!(rows[0]["c"], 1.5);
        assert_eq!(rows[0]["d"], "<blob, 2 bytes>");
    }

    #[test]
    fn shares_a_file_with_a_table_that_another_data_layer_package_wrote() {
        let (path, database) = new_database("shared_file");
        database.connection.execute_batch("CREATE TABLE commits (data TEXT)").unwrap();
        drop(database);
        let database = UserActivityDatabase::open(&path).unwrap();
        assert_eq!(database.count_records(), Ok(0));
        let read_only_database = UserActivityDatabase::open_read_only(&path).unwrap();
        assert_eq!(read_only_database.query("SELECT count(*) AS count FROM commits").unwrap()[0]["count"], 0);
    }
}
