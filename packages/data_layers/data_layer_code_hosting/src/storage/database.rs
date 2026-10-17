//! The SQLite file with the tables `issues` and `pull_requests`.
//!
//! Each table has these four columns: `repository` (the text `owner/name`), `number`, `updatedAt`, and `data`. The primary key
//! is `repository` and `number`. The column `data` holds the JSON text of the issue or of the pull request, so the facts are
//! never split into more columns.

use crate::model::schemas::{issue_to_checked_value, pull_request_to_checked_value};
use crate::model::types::{CodeHostingTable, Issue, PullRequest, QueryRow};
use crate::model::utc_time::to_whole_second_text;
use rusqlite::types::ValueRef;
use rusqlite::{params, params_from_iter, Connection, OpenFlags, OptionalExtension};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::path::{Path, PathBuf};

/// How long a read waits when another program ends a write of the file. A write holds the file for a moment only.
const READ_WAITING_TIME: std::time::Duration = std::time::Duration::from_secs(5);

/// The SQLite file of the code hosting data layer.
pub struct CodeHostingDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// True when the file is open read only. Only then the method `query` works.
    is_read_only: bool,
    /// The open connection to the SQLite file.
    connection: Connection,
}

impl CodeHostingDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, and the two tables when they do not
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
        for table in CodeHostingTable::ALL {
            connection
                .execute_batch(&format!(
                    "CREATE TABLE IF NOT EXISTS {} (
                        repository TEXT NOT NULL,
                        number INTEGER NOT NULL,
                        updatedAt TEXT NOT NULL,
                        data TEXT NOT NULL CHECK (json_valid(data)),
                        PRIMARY KEY (repository, number)
                    )",
                    table.name()
                ))
                .map_err(|error| format!("The table {} cannot be created: {error}", table.name()))?;
        }
        Ok(CodeHostingDatabase { database_path: database_path.to_path_buf(), is_read_only: false, connection })
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
        Ok(CodeHostingDatabase { database_path: database_path.to_path_buf(), is_read_only: true, connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Writes issues. A row of an issue that is already in the table is replaced. Every issue is checked against the JSON
    /// schema before the first row is written, so a wrong issue writes nothing.
    ///
    /// # Errors
    /// An error when one issue does not follow the JSON schema, or when the file is open read only.
    pub fn upsert_issues(&mut self, repository: &str, issues: &[Issue]) -> Result<(), String> {
        let mut rows = Vec::with_capacity(issues.len());
        for issue in issues {
            let value = issue_to_checked_value(issue)?;
            rows.push((issue.number, issue.updated_at.clone(), value.to_string()));
        }
        self.upsert_rows(CodeHostingTable::Issues, repository, &rows)
    }

    /// Writes pull requests. A row of a pull request that is already in the table is replaced. Every pull request is checked
    /// against the JSON schema before the first row is written, so a wrong pull request writes nothing.
    ///
    /// # Errors
    /// An error when one pull request does not follow the JSON schema, or when the file is open read only.
    pub fn upsert_pull_requests(&mut self, repository: &str, pull_requests: &[PullRequest]) -> Result<(), String> {
        let mut rows = Vec::with_capacity(pull_requests.len());
        for pull_request in pull_requests {
            let value = pull_request_to_checked_value(pull_request)?;
            rows.push((pull_request.number, pull_request.updated_at.clone(), value.to_string()));
        }
        self.upsert_rows(CodeHostingTable::PullRequests, repository, &rows)
    }

    /// Finds the date of the last read of a table: the largest value of the column `updatedAt` for the repository.
    ///
    /// Returns `None` when the table has no row for the repository.
    pub fn find_last_updated_at(&self, table: CodeHostingTable, repository: &str) -> Result<Option<String>, String> {
        self.connection
            .query_row(
                &format!("SELECT MAX(updatedAt) FROM {} WHERE repository = ?1", table.name()),
                params![repository],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|error| format!("The last date of change cannot be read: {error}"))
    }

    /// Counts the rows of a table for a repository.
    pub fn count_rows(&self, table: CodeHostingTable, repository: &str) -> Result<i64, String> {
        self.connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {} WHERE repository = ?1", table.name()),
                params![repository],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("The rows cannot be counted: {error}"))
    }

    /// Reads one issue. Returns `None` when the table has no such row.
    pub fn find_issue(&self, repository: &str, number: i64) -> Result<Option<Issue>, String> {
        match self.find_data(CodeHostingTable::Issues, repository, number)? {
            None => Ok(None),
            Some(data) => serde_json::from_str(&data)
                .map(Some)
                .map_err(|error| format!("The row of the issue {number} is not an issue: {error}")),
        }
    }

    /// Reads one pull request. Returns `None` when the table has no such row.
    pub fn find_pull_request(&self, repository: &str, number: i64) -> Result<Option<PullRequest>, String> {
        match self.find_data(CodeHostingTable::PullRequests, repository, number)? {
            None => Ok(None),
            Some(data) => serde_json::from_str(&data)
                .map(Some)
                .map_err(|error| format!("The row of the pull request {number} is not a pull request: {error}")),
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

    /// Reads the issues of a repository that were opened in the time range from `since` (included) to `until` (excluded),
    /// the oldest first. Both times are texts in the format ISO 8601 with an offset or in UTC.
    ///
    /// # Errors
    /// An error when a time is not a time with an offset, or when a row is not an issue.
    pub fn find_issues_opened_between(&self, repository: &str, since: &str, until: &str) -> Result<Vec<Issue>, String> {
        self.find_items_opened_between(CodeHostingTable::Issues, repository, since, until)
    }

    /// Reads the pull requests of a repository that were opened in the time range from `since` (included) to `until`
    /// (excluded), the oldest first. Both times are texts in the format ISO 8601 with an offset or in UTC.
    ///
    /// # Errors
    /// An error when a time is not a time with an offset, or when a row is not a pull request.
    pub fn find_pull_requests_opened_between(
        &self,
        repository: &str,
        since: &str,
        until: &str,
    ) -> Result<Vec<PullRequest>, String> {
        self.find_items_opened_between(CodeHostingTable::PullRequests, repository, since, until)
    }

    /// Reads the issues of a repository whose numbers are in `numbers`, in the order of their numbers. A number that has no
    /// row gives no issue.
    ///
    /// # Errors
    /// An error when a row is not an issue.
    pub fn find_issues_by_numbers(&self, repository: &str, numbers: &[i64]) -> Result<Vec<Issue>, String> {
        self.find_items_by_numbers(CodeHostingTable::Issues, repository, numbers)
    }

    /// Reads the pull requests of a repository whose numbers are in `numbers`, in the order of their numbers. A number that has
    /// no row gives no pull request.
    ///
    /// # Errors
    /// An error when a row is not a pull request.
    pub fn find_pull_requests_by_numbers(&self, repository: &str, numbers: &[i64]) -> Result<Vec<PullRequest>, String> {
        self.find_items_by_numbers(CodeHostingTable::PullRequests, repository, numbers)
    }

    /// Counts the rows of a table for a repository that have no field `labelColors`. An earlier version of the package wrote
    /// these rows, and a new read of the repository gives them their colors.
    pub fn count_rows_without_label_colors(&self, table: CodeHostingTable, repository: &str) -> Result<i64, String> {
        self.connection
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM {} WHERE repository = ?1 AND json_type(data, '$.labelColors') IS NULL",
                    table.name()
                ),
                params![repository],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("The rows without label colors cannot be counted: {error}"))
    }

    /// Runs one SQL statement and gives its rows. The SQLite functions on JSON work on the column `data`, for example
    /// `json_extract(data, '$.state')`. A value that is a blob becomes the text `<blob, N bytes>`.
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

    /// Reads the items of a table that were opened in a time range, the oldest first.
    fn find_items_opened_between<T: DeserializeOwned>(
        &self,
        table: CodeHostingTable,
        repository: &str,
        since: &str,
        until: &str,
    ) -> Result<Vec<T>, String> {
        let since = to_whole_second_text(since)?;
        let until = to_whole_second_text(until)?;
        if self.has_table(table.name())? == false {
            return Ok(Vec::new());
        }
        let mut statement = self
            .connection
            .prepare(&format!(
                "SELECT data FROM {} WHERE repository = ?1 AND json_extract(data, '$.createdAt') >= ?2
                 AND json_extract(data, '$.createdAt') < ?3 ORDER BY json_extract(data, '$.createdAt'), number",
                table.name()
            ))
            .map_err(|error| format!("The items of {} cannot be read: {error}", table.name()))?;
        let rows = statement
            .query_map(params![repository, since, until], |row| row.get::<_, String>(0))
            .map_err(|error| format!("The items of {} cannot be read: {error}", table.name()))?;
        let mut items = Vec::new();
        for row in rows {
            let data = row.map_err(|error| format!("The items of {} cannot be read: {error}", table.name()))?;
            items.push(
                serde_json::from_str::<T>(&data)
                    .map_err(|error| format!("A row of {} is not what the table holds: {error}", table.name()))?,
            );
        }
        Ok(items)
    }

    /// Reads the items of a table whose numbers are in `numbers`, in the order of their numbers.
    fn find_items_by_numbers<T: DeserializeOwned>(
        &self,
        table: CodeHostingTable,
        repository: &str,
        numbers: &[i64],
    ) -> Result<Vec<T>, String> {
        if numbers.is_empty() || self.has_table(table.name())? == false {
            return Ok(Vec::new());
        }
        let marks = vec!["?"; numbers.len()].join(", ");
        let mut statement = self
            .connection
            .prepare(&format!(
                "SELECT data FROM {} WHERE repository = ? AND number IN ({marks}) ORDER BY number",
                table.name()
            ))
            .map_err(|error| format!("The items of {} cannot be read: {error}", table.name()))?;
        let values: Vec<rusqlite::types::Value> = std::iter::once(rusqlite::types::Value::Text(repository.to_string()))
            .chain(numbers.iter().map(|number| rusqlite::types::Value::Integer(*number)))
            .collect();
        let rows = statement
            .query_map(params_from_iter(values), |row| row.get::<_, String>(0))
            .map_err(|error| format!("The items of {} cannot be read: {error}", table.name()))?;
        let mut items = Vec::new();
        for row in rows {
            let data = row.map_err(|error| format!("The items of {} cannot be read: {error}", table.name()))?;
            items.push(
                serde_json::from_str::<T>(&data)
                    .map_err(|error| format!("A row of {} is not what the table holds: {error}", table.name()))?,
            );
        }
        Ok(items)
    }

    /// Writes rows in one transaction. A row is the number, the date of the last change, and the JSON text.
    fn upsert_rows(
        &mut self,
        table: CodeHostingTable,
        repository: &str,
        rows: &[(i64, String, String)],
    ) -> Result<(), String> {
        if self.is_read_only {
            return Err("A write needs a database that is not open read only.".to_string());
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        {
            let mut statement = transaction
                .prepare(&format!(
                    "INSERT INTO {} (repository, number, updatedAt, data) VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT (repository, number) DO UPDATE SET updatedAt = excluded.updatedAt, data = excluded.data",
                    table.name()
                ))
                .map_err(|error| format!("The write cannot be prepared: {error}"))?;
            for (number, updated_at, data) in rows {
                statement
                    .execute(params![repository, number, updated_at, data])
                    .map_err(|error| format!("The row {number} cannot be written: {error}"))?;
            }
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))
    }

    /// Reads the JSON text of one row. Returns `None` when the table has no such row.
    fn find_data(&self, table: CodeHostingTable, repository: &str, number: i64) -> Result<Option<String>, String> {
        self.connection
            .query_row(
                &format!("SELECT data FROM {} WHERE repository = ?1 AND number = ?2", table.name()),
                params![repository, number],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("The row {number} cannot be read: {error}"))
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
    use crate::model::types::{IssueState, PullRequestState};
    use crate::test_samples::{date, issue, pull_request, temp_folder};

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// A database in a new folder that does not exist yet.
    fn new_database(name: &str) -> (PathBuf, CodeHostingDatabase) {
        let folder = temp_folder(name);
        let path = folder.join("a_folder_that_does_not_exist_yet").join("data_layer.sqlite");
        let database = CodeHostingDatabase::open(&path).unwrap();
        (path, database)
    }

    #[test]
    fn creates_the_file_its_folder_and_two_empty_tables() {
        let (path, database) = new_database("creates");
        assert!(path.exists());
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(0));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(0));
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(None));
        assert_eq!(database.find_last_updated_at(CodeHostingTable::PullRequests, REPOSITORY), Ok(None));
    }

    /// An issue opened on the day `day`.
    fn issue_opened_on(number: i64, day: u32) -> Issue {
        Issue { created_at: date(day), ..issue(number) }
    }

    #[test]
    fn finds_the_issues_and_the_pull_requests_opened_in_a_time_range_in_the_order_of_their_creation() {
        let (_, mut database) = new_database("opened_between");
        database.upsert_issues(REPOSITORY, &[issue_opened_on(3, 6), issue_opened_on(1, 2), issue_opened_on(2, 9)]).unwrap();
        database
            .upsert_pull_requests(REPOSITORY, &[PullRequest { created_at: date(4), ..pull_request(10) }])
            .unwrap();
        let issues = database.find_issues_opened_between(REPOSITORY, &date(2), &date(9)).unwrap();
        assert_eq!(issues.iter().map(|issue| issue.number).collect::<Vec<_>>(), vec![1, 3]);
        let pull_requests = database.find_pull_requests_opened_between(REPOSITORY, &date(1), &date(28)).unwrap();
        assert_eq!(pull_requests.iter().map(|pull_request| pull_request.number).collect::<Vec<_>>(), vec![10]);
        assert!(database.find_issues_opened_between("other-org/other", &date(1), &date(28)).unwrap().is_empty());
    }

    #[test]
    fn reads_a_range_written_with_an_offset_and_refuses_a_text_that_is_not_a_time() {
        let (_, mut database) = new_database("opened_between_offset");
        database.upsert_issues(REPOSITORY, &[issue_opened_on(1, 2)]).unwrap();
        // The issue was opened on the day 2 at 10:00:00 in UTC, which is 12:00:00 at +02:00.
        assert_eq!(database.find_issues_opened_between(REPOSITORY, "2026-10-02T12:00:00+02:00", &date(3)).unwrap().len(), 1);
        assert_eq!(database.find_issues_opened_between(REPOSITORY, "2026-10-02T12:00:00.500+02:00", &date(3)).unwrap().len(), 0);
        assert!(database.find_issues_opened_between(REPOSITORY, "' OR '1'='1", &date(3)).is_err());
    }

    #[test]
    fn finds_the_items_by_their_numbers_in_the_order_of_the_numbers() {
        let (_, mut database) = new_database("by_numbers");
        database.upsert_issues(REPOSITORY, &[issue(5), issue(2), issue(9)]).unwrap();
        database.upsert_pull_requests(REPOSITORY, &[pull_request(7), pull_request(3)]).unwrap();
        let issues = database.find_issues_by_numbers(REPOSITORY, &[9, 2, 100]).unwrap();
        assert_eq!(issues.iter().map(|issue| issue.number).collect::<Vec<_>>(), vec![2, 9]);
        let pull_requests = database.find_pull_requests_by_numbers(REPOSITORY, &[7, 3]).unwrap();
        assert_eq!(pull_requests.iter().map(|pull_request| pull_request.number).collect::<Vec<_>>(), vec![3, 7]);
        assert!(database.find_issues_by_numbers(REPOSITORY, &[]).unwrap().is_empty());
    }

    #[test]
    fn counts_the_rows_that_an_earlier_version_wrote_without_label_colors() {
        let (path, mut database) = new_database("without_colors");
        database.upsert_issues(REPOSITORY, &[issue(1), issue(2)]).unwrap();
        assert_eq!(database.count_rows_without_label_colors(CodeHostingTable::Issues, REPOSITORY), Ok(0));
        let connection = Connection::open(&path).unwrap();
        connection
            .execute("UPDATE issues SET data = json_remove(data, '$.labelColors') WHERE number = 2", [])
            .unwrap();
        assert_eq!(database.count_rows_without_label_colors(CodeHostingTable::Issues, REPOSITORY), Ok(1));
    }

    #[test]
    fn writes_an_issue_and_reads_back_the_same_issue() {
        let (_, mut database) = new_database("issue_round_trip");
        let mut sample = issue(7);
        sample.labels = vec!["bug".into(), "idea".into()];
        sample.assignees = vec!["jeromeetienne".into()];
        database.upsert_issues(REPOSITORY, std::slice::from_ref(&sample)).unwrap();
        assert_eq!(database.find_issue(REPOSITORY, 7), Ok(Some(sample)));
        assert_eq!(database.find_issue(REPOSITORY, 8), Ok(None));
    }

    #[test]
    fn writes_a_pull_request_and_reads_back_the_same_pull_request() {
        let (_, mut database) = new_database("pull_request_round_trip");
        let mut sample = pull_request(9);
        sample.body = "Fixes #7. Part of #3.".into();
        database.upsert_pull_requests(REPOSITORY, &[sample.clone()]).unwrap();
        assert_eq!(database.find_pull_request(REPOSITORY, 9), Ok(Some(sample)));
        assert_eq!(database.find_pull_request(REPOSITORY, 10), Ok(None));
    }

    #[test]
    fn has_the_four_columns_and_the_column_data_holds_the_json_text() {
        let (path, mut database) = new_database("columns");
        let sample = issue(7);
        database.upsert_issues(REPOSITORY, std::slice::from_ref(&sample)).unwrap();
        let connection = Connection::open(&path).unwrap();
        let mut statement = connection.prepare("PRAGMA table_info(issues)").unwrap();
        let column_names: Vec<String> =
            statement.query_map([], |row| row.get::<_, String>(1)).unwrap().map(|name| name.unwrap()).collect();
        assert_eq!(column_names, ["repository", "number", "updatedAt", "data"]);
        let (repository, number, updated_at, data): (String, i64, String, String) = connection
            .query_row("SELECT * FROM issues", [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
            .unwrap();
        assert_eq!((repository.as_str(), number, updated_at.as_str()), (REPOSITORY, 7, sample.updated_at.as_str()));
        assert_eq!(serde_json::from_str::<Issue>(&data).unwrap(), sample);
    }

    #[test]
    fn replaces_a_row_that_has_the_same_repository_and_number_and_never_adds_a_second_row() {
        let (_, mut database) = new_database("replaces");
        let mut open_issue = issue(7);
        open_issue.state = IssueState::Open;
        open_issue.state_reason = None;
        open_issue.closed_at = None;
        database.upsert_issues(REPOSITORY, &[open_issue]).unwrap();
        let mut closed_issue = issue(7);
        closed_issue.updated_at = date(5);
        database.upsert_issues(REPOSITORY, &[closed_issue]).unwrap();
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(1));
        assert_eq!(database.find_issue(REPOSITORY, 7).unwrap().unwrap().state, IssueState::Closed);
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(Some(date(5))));
    }

    #[test]
    fn finds_the_largest_date_of_change_of_a_table() {
        let (_, mut database) = new_database("largest_date");
        let pull_requests: Vec<PullRequest> = [(1, 3), (2, 9), (3, 5)]
            .iter()
            .map(|(number, day)| {
                let mut sample = pull_request(*number);
                sample.updated_at = date(*day);
                sample
            })
            .collect();
        database.upsert_pull_requests(REPOSITORY, &pull_requests).unwrap();
        assert_eq!(database.find_last_updated_at(CodeHostingTable::PullRequests, REPOSITORY), Ok(Some(date(9))));
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(None));
    }

    #[test]
    fn keeps_the_rows_of_two_repositories_apart() {
        let (_, mut database) = new_database("two_repositories");
        let mut in_a = issue(1);
        in_a.title = "In A".into();
        let mut in_b = issue(1);
        in_b.title = "In B".into();
        in_b.updated_at = date(20);
        database.upsert_issues("owner-a/repository-a", &[in_a]).unwrap();
        database.upsert_issues("owner-b/repository-b", &[in_b]).unwrap();
        assert_eq!(database.count_rows(CodeHostingTable::Issues, "owner-a/repository-a"), Ok(1));
        assert_eq!(database.find_issue("owner-a/repository-a", 1).unwrap().unwrap().title, "In A");
        assert_eq!(database.find_issue("owner-b/repository-b", 1).unwrap().unwrap().title, "In B");
        assert_eq!(
            database.find_last_updated_at(CodeHostingTable::Issues, "owner-a/repository-a"),
            Ok(Some(date(2)))
        );
    }

    #[test]
    fn writes_nothing_when_one_issue_of_the_list_is_wrong() {
        let (_, mut database) = new_database("wrong_issue");
        let mut wrong_issue = issue(2);
        wrong_issue.created_at = "yesterday".into();
        let error = database.upsert_issues(REPOSITORY, &[issue(1), wrong_issue]).unwrap_err();
        assert!(error.contains("createdAt"));
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(0));
    }

    #[test]
    fn keeps_the_rows_after_the_file_is_closed_and_opened_again() {
        let (path, mut database) = new_database("reopen");
        database.upsert_issues(REPOSITORY, &[issue(4)]).unwrap();
        drop(database);
        let database = CodeHostingDatabase::open(&path).unwrap();
        assert_eq!(database.find_issue(REPOSITORY, 4).unwrap().unwrap().number, 4);
    }

    #[test]
    fn answers_a_query_with_the_rows_and_the_json_functions_of_sqlite_read_the_column_data() {
        let (path, mut database) = new_database("query");
        let mut open_issue = issue(2);
        open_issue.title = "Second".into();
        open_issue.state = IssueState::Open;
        open_issue.state_reason = None;
        open_issue.closed_at = None;
        database.upsert_issues(REPOSITORY, &[issue(1), open_issue]).unwrap();
        let read_only_database = CodeHostingDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database
            .query(
                "SELECT number, json_extract(data, '$.title') AS title FROM issues
                 WHERE json_extract(data, '$.state') = 'OPEN'",
            )
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["number"], 2);
        assert_eq!(rows[0]["title"], "Second");
        assert_eq!(rows[0].keys().collect::<Vec<_>>(), ["number", "title"]);
    }

    #[test]
    fn refuses_a_statement_that_writes_when_the_file_is_open_read_only() {
        let (path, mut database) = new_database("read_only_refuses");
        database.upsert_issues(REPOSITORY, &[issue(1)]).unwrap();
        let read_only_database = CodeHostingDatabase::open_read_only(&path).unwrap();
        assert!(read_only_database.query("DELETE FROM issues").unwrap_err().contains("readonly"));
        assert!(read_only_database.query("DROP TABLE issues").unwrap_err().contains("readonly"));
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(1));
    }

    #[test]
    fn refuses_a_query_when_the_file_is_not_open_read_only() {
        let (_, database) = new_database("query_refused");
        assert!(database.query("SELECT 1").unwrap_err().contains("read only"));
    }

    #[test]
    fn refuses_to_write_when_the_file_is_open_read_only() {
        let (path, _) = new_database("write_refused");
        let mut read_only_database = CodeHostingDatabase::open_read_only(&path).unwrap();
        assert!(read_only_database.upsert_issues(REPOSITORY, &[issue(1)]).unwrap_err().contains("read only"));
    }

    #[test]
    fn does_not_create_the_file_when_it_opens_a_file_that_does_not_exist_read_only() {
        let missing_path = temp_folder("missing").join("missing.sqlite");
        let error = CodeHostingDatabase::open_read_only(&missing_path).err().unwrap();
        assert!(error.contains("does not exist"));
        assert!(!missing_path.exists());
    }

    #[test]
    fn gives_a_null_a_number_a_real_number_and_a_blob_in_a_row() {
        let (path, _) = new_database("value_kinds");
        let read_only_database = CodeHostingDatabase::open_read_only(&path).unwrap();
        let rows = read_only_database.query("SELECT NULL AS a, 3 AS b, 1.5 AS c, x'0102' AS d").unwrap();
        assert_eq!(rows[0]["a"], Value::Null);
        assert_eq!(rows[0]["b"], 3);
        assert_eq!(rows[0]["c"], 1.5);
        assert_eq!(rows[0]["d"], "<blob, 2 bytes>");
    }

    #[test]
    fn keeps_the_state_of_a_merged_pull_request() {
        let (_, mut database) = new_database("merged");
        database.upsert_pull_requests(REPOSITORY, &[pull_request(3)]).unwrap();
        assert_eq!(database.find_pull_request(REPOSITORY, 3).unwrap().unwrap().state, PullRequestState::Merged);
    }
}
