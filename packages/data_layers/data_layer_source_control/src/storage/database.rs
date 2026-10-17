//! The SQLite file with the table `commits`.
//!
//! The table has these four columns: `repository` (the text `owner/name`), `hash`, `committedAt`, and `data`. The primary key
//! is `repository` and `hash`. The column `data` holds the JSON text of the commit, so the facts are never split into more
//! columns. A merge is a row whose `data` has two or more parents.

use crate::model::schemas::commit_to_checked_value;
use crate::model::types::{Commit, QueryRow};
use crate::model::utc_time::to_whole_second_text;
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// How long a read waits when another program ends a write of the file. A write holds the file for a moment only.
const READ_WAITING_TIME: std::time::Duration = std::time::Duration::from_secs(5);

/// The SQLite file of the source control data layer.
pub struct SourceControlDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// True when the file is open read only. Only then the method `query` works.
    is_read_only: bool,
    /// The open connection to the SQLite file.
    connection: Connection,
}

impl SourceControlDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, and the table `commits` when they do
    /// not exist.
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
                "CREATE TABLE IF NOT EXISTS commits (
                    repository TEXT NOT NULL,
                    hash TEXT NOT NULL,
                    committedAt TEXT NOT NULL,
                    data TEXT NOT NULL CHECK (json_valid(data)),
                    PRIMARY KEY (repository, hash)
                );
                CREATE INDEX IF NOT EXISTS commits_committed_at ON commits (repository, committedAt);",
            )
            .map_err(|error| format!("The table commits cannot be created: {error}"))?;
        Ok(SourceControlDatabase { database_path: database_path.to_path_buf(), is_read_only: false, connection })
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
        Ok(SourceControlDatabase { database_path: database_path.to_path_buf(), is_read_only: true, connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Writes commits. A row of a commit that is already in the table is replaced. Every commit is checked against the JSON
    /// schema before the first row is written, so a wrong commit writes nothing.
    ///
    /// # Errors
    /// An error when one commit does not follow the JSON schema, or when the file is open read only.
    pub fn upsert_commits(&mut self, repository: &str, commits: &[Commit]) -> Result<(), String> {
        if self.is_read_only {
            return Err("A write needs a database that is not open read only.".to_string());
        }
        let mut rows = Vec::with_capacity(commits.len());
        for commit in commits {
            let value = commit_to_checked_value(commit)?;
            rows.push((commit.hash.clone(), commit.committed_at.clone(), value.to_string()));
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        {
            let mut statement = transaction
                .prepare(
                    "INSERT INTO commits (repository, hash, committedAt, data) VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT (repository, hash) DO UPDATE SET committedAt = excluded.committedAt, data = excluded.data",
                )
                .map_err(|error| format!("The write cannot be prepared: {error}"))?;
            for (hash, committed_at, data) in &rows {
                statement
                    .execute(params![repository, hash, committed_at, data])
                    .map_err(|error| format!("The row {hash} cannot be written: {error}"))?;
            }
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))
    }

    /// Lists the hashes of the commits that the table holds for a repository.
    pub fn find_known_hashes(&self, repository: &str) -> Result<HashSet<String>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT hash FROM commits WHERE repository = ?1")
            .map_err(|error| format!("The hashes cannot be read: {error}"))?;
        let hashes = statement
            .query_map(params![repository], |row| row.get::<_, String>(0))
            .map_err(|error| format!("The hashes cannot be read: {error}"))?
            .collect::<Result<HashSet<String>, _>>()
            .map_err(|error| format!("The hashes cannot be read: {error}"))?;
        Ok(hashes)
    }

    /// Counts the rows of the table for a repository.
    pub fn count_commits(&self, repository: &str) -> Result<i64, String> {
        self.connection
            .query_row("SELECT COUNT(*) FROM commits WHERE repository = ?1", params![repository], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|error| format!("The rows cannot be counted: {error}"))
    }

    /// Reads one commit. Returns `None` when the table has no such row.
    pub fn find_commit(&self, repository: &str, hash: &str) -> Result<Option<Commit>, String> {
        let data = self
            .connection
            .query_row(
                "SELECT data FROM commits WHERE repository = ?1 AND hash = ?2",
                params![repository, hash],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("The row {hash} cannot be read: {error}"))?;
        match data {
            None => Ok(None),
            Some(data) => serde_json::from_str(&data)
                .map(Some)
                .map_err(|error| format!("The row {hash} is not a commit: {error}")),
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

    /// Reads the commits of a repository made in the time range from `since` (included) to `until` (excluded), the oldest
    /// first. Both times are texts in the format ISO 8601 with an offset or in UTC. A merge brings in commits that count
    /// already, so it is left out unless `include_merges` is true. The index on `repository` and `committedAt` answers the
    /// range.
    ///
    /// # Errors
    /// An error when a time is not a time with an offset, or when a row is not a commit.
    pub fn find_commits_between(
        &self,
        repository: &str,
        since: &str,
        until: &str,
        include_merges: bool,
    ) -> Result<Vec<Commit>, String> {
        let since = to_whole_second_text(since)?;
        let until = to_whole_second_text(until)?;
        if self.has_table("commits")? == false {
            return Ok(Vec::new());
        }
        let mut statement = self
            .connection
            .prepare(
                "SELECT data FROM commits WHERE repository = ?1 AND committedAt >= ?2 AND committedAt < ?3
                 ORDER BY committedAt, hash",
            )
            .map_err(|error| format!("The commits cannot be read: {error}"))?;
        let rows = statement
            .query_map(params![repository, since, until], |row| row.get::<_, String>(0))
            .map_err(|error| format!("The commits cannot be read: {error}"))?;
        let mut commits = Vec::new();
        for row in rows {
            let data = row.map_err(|error| format!("The commits cannot be read: {error}"))?;
            let commit = serde_json::from_str::<Commit>(&data).map_err(|error| format!("A row is not a commit: {error}"))?;
            if include_merges || !commit.is_merge() {
                commits.push(commit);
            }
        }
        Ok(commits)
    }

    /// Runs one SQL statement and gives its rows. The SQLite functions on JSON work on the column `data`, for example
    /// `json_extract(data, '$.subject')`. A value that is a blob becomes the text `<blob, N bytes>`.
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
    use crate::test_samples::{commit, date, hash, merge_commit, temp_folder};

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// A database in a new folder that does not exist yet.
    fn new_database(name: &str) -> (PathBuf, SourceControlDatabase) {
        let folder = temp_folder(name);
        let path = folder.join("a_folder_that_does_not_exist_yet").join("data_layer.sqlite");
        let database = SourceControlDatabase::open(&path).unwrap();
        (path, database)
    }

    /// A commit that was made on the day `day` at 10:00:00 in UTC.
    fn commit_on(number: u32, day: u32) -> Commit {
        Commit { committed_at: date(day), ..commit(number) }
    }

    #[test]
    fn finds_the_commits_of_a_time_range_without_the_merges_in_the_order_of_their_date() {
        let (_, mut database) = new_database("between");
        let merge = Commit { committed_at: date(4), ..merge_commit(4, 1, 2) };
        database
            .upsert_commits(REPOSITORY, &[commit_on(3, 3), commit_on(1, 1), merge.clone(), commit_on(2, 2)])
            .unwrap();
        let found = database.find_commits_between(REPOSITORY, &date(1), &date(9), false).unwrap();
        assert_eq!(found.iter().map(|commit| commit.hash.clone()).collect::<Vec<_>>(), vec![hash(1), hash(2), hash(3)]);
        let with_merges = database.find_commits_between(REPOSITORY, &date(1), &date(9), true).unwrap();
        assert_eq!(with_merges.len(), 4);
        assert!(with_merges.contains(&merge));
    }

    #[test]
    fn includes_the_start_of_the_range_and_excludes_its_end() {
        let (_, mut database) = new_database("between_edges");
        database.upsert_commits(REPOSITORY, &[commit_on(1, 1), commit_on(2, 2), commit_on(3, 3)]).unwrap();
        let found = database.find_commits_between(REPOSITORY, &date(2), &date(3), false).unwrap();
        assert_eq!(found.iter().map(|commit| commit.hash.clone()).collect::<Vec<_>>(), vec![hash(2)]);
    }

    #[test]
    fn reads_a_range_written_with_an_offset_and_with_milliseconds() {
        let (_, mut database) = new_database("between_offset");
        database.upsert_commits(REPOSITORY, &[commit_on(2, 2)]).unwrap();
        // The commit is at 10:00:00 in UTC on the day 2, which is 12:00:00 at +02:00. A start at 12:00:00.500 is after it.
        let found =
            database.find_commits_between(REPOSITORY, "2026-10-02T12:00:00+02:00", "2026-10-02T12:00:01+02:00", false);
        assert_eq!(found.unwrap().len(), 1);
        let found = database.find_commits_between(
            REPOSITORY,
            "2026-10-02T12:00:00.500+02:00",
            "2026-10-03T00:00:00+02:00",
            false,
        );
        assert_eq!(found.unwrap().len(), 0);
    }

    #[test]
    fn reads_only_the_commits_of_the_repository_that_is_asked_for() {
        let (_, mut database) = new_database("between_repository");
        database.upsert_commits(REPOSITORY, &[commit_on(1, 1)]).unwrap();
        database.upsert_commits("other-org/other", &[commit_on(2, 2)]).unwrap();
        let found = database.find_commits_between(REPOSITORY, &date(1), &date(9), false).unwrap();
        assert_eq!(found.len(), 1);
    }

    #[test]
    fn has_an_index_on_the_repository_and_the_date_that_the_range_query_uses() {
        let (path, _) = new_database("between_plan");
        let read_only_database = SourceControlDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database
            .query(
                "EXPLAIN QUERY PLAN SELECT data FROM commits WHERE repository = 'a/b' AND committedAt >= '2026-10-01T00:00:00Z'
                 AND committedAt < '2026-10-09T00:00:00Z'",
            )
            .unwrap();
        let plan: Vec<String> = rows.iter().map(|row| row["detail"].as_str().unwrap().to_string()).collect();
        assert!(plan.iter().any(|detail| detail.contains("commits_committed_at")), "{plan:?}");
    }

    #[test]
    fn creates_the_file_its_folder_and_an_empty_table() {
        let (path, database) = new_database("creates");
        assert!(path.exists());
        assert_eq!(database.count_commits(REPOSITORY), Ok(0));
        assert_eq!(database.find_known_hashes(REPOSITORY), Ok(HashSet::new()));
    }

    #[test]
    fn writes_a_commit_and_reads_back_the_same_commit() {
        let (_, mut database) = new_database("round_trip");
        let mut sample = commit(7);
        sample.body = "A body\n\nwith two paragraphs.".into();
        database.upsert_commits(REPOSITORY, std::slice::from_ref(&sample)).unwrap();
        assert_eq!(database.find_commit(REPOSITORY, &hash(7)), Ok(Some(sample)));
        assert_eq!(database.find_commit(REPOSITORY, &hash(8)), Ok(None));
    }

    #[test]
    fn has_the_four_columns_and_the_column_data_holds_the_json_text() {
        let (path, mut database) = new_database("columns");
        let sample = commit(7);
        database.upsert_commits(REPOSITORY, std::slice::from_ref(&sample)).unwrap();
        let connection = Connection::open(&path).unwrap();
        let mut statement = connection.prepare("PRAGMA table_info(commits)").unwrap();
        let column_names: Vec<String> =
            statement.query_map([], |row| row.get::<_, String>(1)).unwrap().map(|name| name.unwrap()).collect();
        assert_eq!(column_names, ["repository", "hash", "committedAt", "data"]);
        let (repository, stored_hash, committed_at, data): (String, String, String, String) = connection
            .query_row("SELECT * FROM commits", [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
            .unwrap();
        assert_eq!(
            (repository.as_str(), stored_hash.as_str(), committed_at.as_str()),
            (REPOSITORY, hash(7).as_str(), sample.committed_at.as_str())
        );
        assert_eq!(serde_json::from_str::<Commit>(&data).unwrap(), sample);
    }

    #[test]
    fn replaces_a_row_that_has_the_same_repository_and_hash_and_never_adds_a_second_row() {
        let (_, mut database) = new_database("replaces");
        database.upsert_commits(REPOSITORY, &[commit(7)]).unwrap();
        let mut changed = commit(7);
        changed.subject = "Another subject".into();
        database.upsert_commits(REPOSITORY, &[changed]).unwrap();
        assert_eq!(database.count_commits(REPOSITORY), Ok(1));
        assert_eq!(database.find_commit(REPOSITORY, &hash(7)).unwrap().unwrap().subject, "Another subject");
    }

    #[test]
    fn lists_the_known_hashes_of_one_repository() {
        let (_, mut database) = new_database("known_hashes");
        database.upsert_commits(REPOSITORY, &[commit(1), commit(2)]).unwrap();
        database.upsert_commits("owner-b/repository-b", &[commit(3)]).unwrap();
        assert_eq!(database.find_known_hashes(REPOSITORY), Ok(HashSet::from([hash(1), hash(2)])));
        assert_eq!(database.find_known_hashes("owner-b/repository-b"), Ok(HashSet::from([hash(3)])));
    }

    #[test]
    fn keeps_the_rows_of_two_repositories_apart() {
        let (_, mut database) = new_database("two_repositories");
        let mut in_a = commit(1);
        in_a.subject = "In A".into();
        let mut in_b = commit(1);
        in_b.subject = "In B".into();
        database.upsert_commits("owner-a/repository-a", &[in_a]).unwrap();
        database.upsert_commits("owner-b/repository-b", &[in_b]).unwrap();
        assert_eq!(database.count_commits("owner-a/repository-a"), Ok(1));
        assert_eq!(database.find_commit("owner-a/repository-a", &hash(1)).unwrap().unwrap().subject, "In A");
        assert_eq!(database.find_commit("owner-b/repository-b", &hash(1)).unwrap().unwrap().subject, "In B");
    }

    #[test]
    fn writes_nothing_when_one_commit_of_the_list_is_wrong() {
        let (_, mut database) = new_database("wrong_commit");
        let mut wrong_commit = commit(2);
        wrong_commit.committed_at = "yesterday".into();
        let error = database.upsert_commits(REPOSITORY, &[commit(1), wrong_commit]).unwrap_err();
        assert!(error.contains("committedAt"));
        assert_eq!(database.count_commits(REPOSITORY), Ok(0));
    }

    #[test]
    fn keeps_the_rows_after_the_file_is_closed_and_opened_again() {
        let (path, mut database) = new_database("reopen");
        database.upsert_commits(REPOSITORY, &[commit(4)]).unwrap();
        drop(database);
        let database = SourceControlDatabase::open(&path).unwrap();
        assert_eq!(database.find_commit(REPOSITORY, &hash(4)).unwrap().unwrap().hash, hash(4));
    }

    #[test]
    fn answers_a_query_with_the_rows_and_the_json_functions_of_sqlite_read_the_column_data() {
        let (path, mut database) = new_database("query");
        let mut second = commit(2);
        second.subject = "Second".into();
        database.upsert_commits(REPOSITORY, &[commit(1), second, merge_commit(3, 1, 2)]).unwrap();
        let read_only_database = SourceControlDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database
            .query(
                "SELECT hash, json_extract(data, '$.subject') AS subject FROM commits
                 WHERE json_array_length(data, '$.parents') > 1",
            )
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["hash"], hash(3));
        assert_eq!(rows[0].keys().collect::<Vec<_>>(), ["hash", "subject"]);
    }

    #[test]
    fn refuses_a_statement_that_writes_when_the_file_is_open_read_only() {
        let (path, mut database) = new_database("read_only_refuses");
        database.upsert_commits(REPOSITORY, &[commit(1)]).unwrap();
        let read_only_database = SourceControlDatabase::open_read_only(&path).unwrap();
        assert!(read_only_database.query("DELETE FROM commits").unwrap_err().contains("readonly"));
        assert!(read_only_database.query("DROP TABLE commits").unwrap_err().contains("readonly"));
        assert_eq!(database.count_commits(REPOSITORY), Ok(1));
    }

    #[test]
    fn refuses_a_query_when_the_file_is_not_open_read_only() {
        let (_, database) = new_database("query_refused");
        assert!(database.query("SELECT 1").unwrap_err().contains("read only"));
    }

    #[test]
    fn refuses_to_write_when_the_file_is_open_read_only() {
        let (path, _) = new_database("write_refused");
        let mut read_only_database = SourceControlDatabase::open_read_only(&path).unwrap();
        assert!(read_only_database.upsert_commits(REPOSITORY, &[commit(1)]).unwrap_err().contains("read only"));
    }

    #[test]
    fn does_not_create_the_file_when_it_opens_a_file_that_does_not_exist_read_only() {
        let missing_path = temp_folder("missing").join("missing.sqlite");
        let error = SourceControlDatabase::open_read_only(&missing_path).err().unwrap();
        assert!(error.contains("does not exist"));
        assert!(!missing_path.exists());
    }

    #[test]
    fn gives_a_null_a_number_a_real_number_and_a_blob_in_a_row() {
        let (path, _) = new_database("value_kinds");
        let read_only_database = SourceControlDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database.query("SELECT NULL AS a, 3 AS b, 1.5 AS c, x'0102' AS d").unwrap();
        assert_eq!(rows[0]["a"], Value::Null);
        assert_eq!(rows[0]["b"], 3);
        assert_eq!(rows[0]["c"], 1.5);
        assert_eq!(rows[0]["d"], "<blob, 2 bytes>");
    }

    #[test]
    fn shares_a_file_with_a_table_that_another_data_layer_package_wrote() {
        let (path, database) = new_database("shared_file");
        database.connection.execute_batch("CREATE TABLE issues (data TEXT)").unwrap();
        drop(database);
        let database = SourceControlDatabase::open(&path).unwrap();
        assert_eq!(database.count_commits(REPOSITORY), Ok(0));
        let read_only_database = SourceControlDatabase::open_read_only(&path).unwrap();
        assert_eq!(read_only_database.query("SELECT count(*) AS count FROM issues").unwrap()[0]["count"], 0);
    }
}
