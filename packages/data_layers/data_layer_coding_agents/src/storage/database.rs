//! The SQLite file with the table `chat_sessions` and its four link tables.
//!
//! The table `chat_sessions` has these four columns: `repository` (the text `owner/name`), `id`, `updatedAt`, and `data`. The
//! primary key is `repository` and `id`. The column `data` holds the JSON text of the chat session, so the facts are never
//! split into more columns.
//!
//! Each link table holds one kind of relation of a chat session, one row for each value: `chat_session_folders`,
//! `chat_session_issues`, `chat_session_pull_requests`, and `chat_session_files`. A link table has
//! the columns `repository`, `chatSessionId`, and one column for the value. The columns `repository` and `issueNumber` of
//! `chat_session_issues` join the columns `repository` and `number` of the table `issues` of `data_layer_code_hosting`.

use crate::model::schemas::chat_session_to_checked_value;
use crate::model::types::{ChatSession, ChatSessionRecord, ChatSessionRelations, ChatSessionTable, QueryRow};
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// How long a read waits when another program ends a write of the file. A write holds the file for a moment only.
const READ_WAITING_TIME: std::time::Duration = std::time::Duration::from_secs(5);

/// The statement that creates the index of the folder: the list of the chat sessions of a workspace reads the rows of one
/// folder, whatever the repository key of the rows is.
const FOLDER_INDEX_STATEMENT: &str = "CREATE INDEX IF NOT EXISTS chat_sessions_folder
    ON chat_sessions (json_extract(data, '$.folder'))";

/// The SQLite file of the chat sessions data layer.
pub struct ChatSessionsDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// True when the file is open read only. Only then the method `query` works.
    is_read_only: bool,
    /// The open connection to the SQLite file.
    connection: Connection,
}

impl ChatSessionsDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, and the five tables when they do not
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
        for table in ChatSessionTable::ALL {
            connection
                .execute_batch(&create_table_statement(table))
                .map_err(|error| format!("The table {} cannot be created: {error}", table.name()))?;
        }
        connection
            .execute_batch(FOLDER_INDEX_STATEMENT)
            .map_err(|error| format!("The index of the folders cannot be created: {error}"))?;
        Ok(ChatSessionsDatabase { database_path: database_path.to_path_buf(), is_read_only: false, connection })
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
        Ok(ChatSessionsDatabase { database_path: database_path.to_path_buf(), is_read_only: true, connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Writes chat sessions with their relations. A chat session that is already in the table is replaced, and its link rows
    /// are replaced with it, so a link that is not true any more disappears. Every chat session is checked against the JSON
    /// schema before the first row is written, so a wrong chat session writes nothing.
    ///
    /// # Errors
    /// An error when one chat session does not follow the JSON schema, or when the file is open read only.
    pub fn upsert_chat_sessions(&mut self, repository: &str, records: &[ChatSessionRecord]) -> Result<(), String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "upsert_chat_sessions", OperationKind::Write)
            .parameter("repository", repository)
            .parameter("chatSessionCount", records.len())
            .database(&self.database_path);
        record(spec, || self.upsert_chat_sessions_inside(repository, records), |_| Summary::count(records.len()))
    }

    /// The work of `upsert_chat_sessions`, between the start event and the completion event of its operation.
    fn upsert_chat_sessions_inside(&mut self, repository: &str, records: &[ChatSessionRecord]) -> Result<(), String> {
        if self.is_read_only {
            return Err("A write needs a database that is not open read only.".to_string());
        }
        let mut checked = Vec::with_capacity(records.len());
        for record in records {
            checked.push((record, chat_session_to_checked_value(&record.chat_session)?.to_string()));
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        for (record, data) in checked {
            write_record(&transaction, repository, record, &data)
                .map_err(|error| format!("The chat session {} cannot be written: {error}", record.chat_session.id))?;
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))
    }

    /// Finds the date of the last read: the largest value of the column `updatedAt` for the repository.
    ///
    /// Returns `None` when the table has no row for the repository.
    pub fn find_last_updated_at(&self, repository: &str) -> Result<Option<String>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_last_updated_at", OperationKind::Query)
            .parameter("repository", repository)
            .database(&self.database_path);
        record(spec, || self.find_last_updated_at_inside(repository), |date| Summary::count(usize::from(date.is_some())))
    }

    /// The work of `find_last_updated_at`, between the start event and the completion event of its operation.
    fn find_last_updated_at_inside(&self, repository: &str) -> Result<Option<String>, String> {
        self.connection
            .query_row(
                "SELECT MAX(updatedAt) FROM chat_sessions WHERE repository = ?1",
                params![repository],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|error| format!("The last date of change cannot be read: {error}"))
    }

    /// Finds the date of the last read of one folder: the largest value of the column `updatedAt` among the chat sessions of the
    /// repository whose folder is `folder`. Returns `None` when the folder has no chat session in the table.
    pub fn find_last_updated_at_in_folder(&self, repository: &str, folder: &str) -> Result<Option<String>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_last_updated_at_in_folder", OperationKind::Query)
            .parameter("repository", repository)
            .parameter("folder", folder)
            .database(&self.database_path);
        record(spec, || self.find_last_updated_at_in_folder_inside(repository, folder), |date| {
            Summary::count(usize::from(date.is_some()))
        })
    }

    /// The work of `find_last_updated_at_in_folder`, between the start event and the completion event of its operation.
    fn find_last_updated_at_in_folder_inside(&self, repository: &str, folder: &str) -> Result<Option<String>, String> {
        self.connection
            .query_row(
                "SELECT MAX(updatedAt) FROM chat_sessions WHERE repository = ?1 AND json_extract(data, '$.folder') = ?2",
                params![repository, folder],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|error| format!("The last date of change of the folder cannot be read: {error}"))
    }

    /// True when the file holds the table `chat_sessions`. A file that another data layer created has none until the first
    /// refresh of the chat sessions.
    pub fn has_chat_sessions_table(&self) -> Result<bool, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "has_chat_sessions_table", OperationKind::Query).database(&self.database_path);
        record(spec, || self.has_chat_sessions_table_inside(), |is_found| Summary::count(usize::from(*is_found)))
    }

    /// The work of `has_chat_sessions_table`, between the start event and the completion event of its operation.
    fn has_chat_sessions_table_inside(&self) -> Result<bool, String> {
        self.connection
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'chat_sessions'", [], |row| {
                row.get::<_, i64>(0)
            })
            .map(|count| count > 0)
            .map_err(|error| format!("The tables of the file cannot be listed: {error}"))
    }

    /// Reads the chat sessions whose folder is `folder`, sorted by identifier. The repository key of the rows does not matter: a
    /// folder is one workspace, and the refresh of the workspace deletes the rows that an earlier key left.
    ///
    /// # Errors
    /// An error when a row is not a chat session.
    pub fn find_chat_sessions_in_folder(&self, folder: &str) -> Result<Vec<ChatSession>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_chat_sessions_in_folder", OperationKind::Query)
            .parameter("folder", folder)
            .database(&self.database_path);
        record(spec, || self.find_chat_sessions_in_folder_inside(folder), |sessions| Summary::count(sessions.len()))
    }

    /// The work of `find_chat_sessions_in_folder`, between the start event and the completion event of its operation.
    fn find_chat_sessions_in_folder_inside(&self, folder: &str) -> Result<Vec<ChatSession>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT data FROM chat_sessions WHERE json_extract(data, '$.folder') = ?1 ORDER BY id")
            .map_err(|error| format!("The chat sessions of the folder cannot be read: {error}"))?;
        let rows = statement
            .query_map(params![folder], |row| row.get::<_, String>(0))
            .map_err(|error| format!("The chat sessions of the folder cannot be read: {error}"))?;
        let mut chat_sessions = Vec::new();
        for row in rows {
            let data = row.map_err(|error| format!("The chat sessions of the folder cannot be read: {error}"))?;
            chat_sessions.push(
                serde_json::from_str::<ChatSession>(&data)
                    .map_err(|error| format!("A row of chat_sessions is not a chat session: {error}"))?,
            );
        }
        Ok(chat_sessions)
    }

    /// Reads the relations of every chat session whose folder is `folder`, from the four link tables, with the identifier of the
    /// chat session as the key. A chat session without a relation has no entry.
    pub fn find_relations_in_folder(&self, folder: &str) -> Result<HashMap<String, ChatSessionRelations>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_relations_in_folder", OperationKind::Query)
            .parameter("folder", folder)
            .database(&self.database_path);
        record(spec, || self.find_relations_in_folder_inside(folder), |relations| Summary::count(relations.len()))
    }

    /// The work of `find_relations_in_folder`, between the start event and the completion event of its operation.
    fn find_relations_in_folder_inside(&self, folder: &str) -> Result<HashMap<String, ChatSessionRelations>, String> {
        let mut relations: HashMap<String, ChatSessionRelations> = HashMap::new();
        for table in ChatSessionTable::LINKS {
            let column = table.value_column().ok_or("The table chat_sessions is not a link table.")?;
            let mut statement = self
                .connection
                .prepare(&format!(
                    "SELECT link.chatSessionId, link.{column} FROM {} link
                     JOIN chat_sessions session ON session.repository = link.repository AND session.id = link.chatSessionId
                     WHERE json_extract(session.data, '$.folder') = ?1
                     ORDER BY link.chatSessionId, link.{column}",
                    table.name()
                ))
                .map_err(|error| format!("The links of the folder cannot be read: {error}"))?;
            let mut rows = statement
                .query(params![folder])
                .map_err(|error| format!("The links of the folder cannot be read: {error}"))?;
            while let Some(row) = rows.next().map_err(|error| format!("The links of the folder cannot be read: {error}"))? {
                let read_error = |error: rusqlite::Error| format!("The links of the folder cannot be read: {error}");
                let id: String = row.get(0).map_err(read_error)?;
                let entry = relations.entry(id).or_default();
                match table {
                    ChatSessionTable::Folders => entry.folders.push(row.get(1).map_err(read_error)?),
                    ChatSessionTable::Issues => entry.issues.push(row.get(1).map_err(read_error)?),
                    ChatSessionTable::PullRequests => entry.pull_requests.push(row.get(1).map_err(read_error)?),
                    ChatSessionTable::FilesWritten => entry.files_written.push(row.get(1).map_err(read_error)?),
                    ChatSessionTable::ChatSessions => {}
                }
            }
        }
        Ok(relations)
    }

    /// Deletes the chat sessions whose folder is `folder` and that are not the chat sessions `kept_ids` of the repository, with
    /// their link rows. A row that an earlier repository key of the folder left is deleted too. Returns the number of chat
    /// sessions deleted.
    ///
    /// # Errors
    /// An error when the file is open read only, or when a row cannot be deleted.
    pub fn delete_chat_sessions_not_in(
        &mut self,
        repository: &str,
        folder: &str,
        kept_ids: &HashSet<String>,
    ) -> Result<usize, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "delete_chat_sessions_not_in", OperationKind::Write)
            .parameter("repository", repository)
            .parameter("folder", folder)
            .parameter("keptCount", kept_ids.len())
            .database(&self.database_path);
        record(spec, || self.delete_chat_sessions_not_in_inside(repository, folder, kept_ids), |count| {
            Summary::count(*count)
        })
    }

    /// The work of `delete_chat_sessions_not_in`, between the start event and the completion event of its operation.
    fn delete_chat_sessions_not_in_inside(
        &mut self,
        repository: &str,
        folder: &str,
        kept_ids: &HashSet<String>,
    ) -> Result<usize, String> {
        if self.is_read_only {
            return Err("A write needs a database that is not open read only.".to_string());
        }
        let stored: Vec<(String, String)> = {
            let mut statement = self
                .connection
                .prepare("SELECT repository, id FROM chat_sessions WHERE json_extract(data, '$.folder') = ?1")
                .map_err(|error| format!("The chat sessions of the folder cannot be listed: {error}"))?;
            let rows = statement
                .query_map(params![folder], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .map_err(|error| format!("The chat sessions of the folder cannot be listed: {error}"))?;
            rows.collect::<rusqlite::Result<Vec<(String, String)>>>()
                .map_err(|error| format!("The chat sessions of the folder cannot be listed: {error}"))?
        };
        let removed: Vec<&(String, String)> =
            stored.iter().filter(|(stored_repository, id)| stored_repository != repository || !kept_ids.contains(id)).collect();
        if removed.is_empty() {
            return Ok(0);
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        for (stored_repository, id) in &removed {
            for table in ChatSessionTable::LINKS {
                transaction
                    .execute(
                        &format!("DELETE FROM {} WHERE repository = ?1 AND chatSessionId = ?2", table.name()),
                        params![stored_repository, id],
                    )
                    .map_err(|error| format!("The links of the chat session {id} cannot be deleted: {error}"))?;
            }
            transaction
                .execute("DELETE FROM chat_sessions WHERE repository = ?1 AND id = ?2", params![stored_repository, id])
                .map_err(|error| format!("The chat session {id} cannot be deleted: {error}"))?;
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))?;
        Ok(removed.len())
    }

    /// Counts the rows of a table for a repository.
    pub fn count_rows(&self, table: ChatSessionTable, repository: &str) -> Result<i64, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "count_rows", OperationKind::Query)
            .choice("table", table.name())
            .parameter("repository", repository)
            .database(&self.database_path);
        record(spec, || self.count_rows_inside(table, repository), |count| Summary::count(*count as usize))
    }

    /// The work of `count_rows`, between the start event and the completion event of its operation.
    fn count_rows_inside(&self, table: ChatSessionTable, repository: &str) -> Result<i64, String> {
        self.connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {} WHERE repository = ?1", table.name()),
                params![repository],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("The rows cannot be counted: {error}"))
    }

    /// Reads one chat session. Returns `None` when the table has no such row.
    pub fn find_chat_session(&self, repository: &str, id: &str) -> Result<Option<ChatSession>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_chat_session", OperationKind::Query)
            .parameter("repository", repository)
            .parameter("id", id)
            .database(&self.database_path);
        record(spec, || self.find_chat_session_inside(repository, id), |found| Summary::count(usize::from(found.is_some())))
    }

    /// The work of `find_chat_session`, between the start event and the completion event of its operation.
    fn find_chat_session_inside(&self, repository: &str, id: &str) -> Result<Option<ChatSession>, String> {
        let data = self
            .connection
            .query_row(
                "SELECT data FROM chat_sessions WHERE repository = ?1 AND id = ?2",
                params![repository, id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("The row of the chat session {id} cannot be read: {error}"))?;
        match data {
            None => Ok(None),
            Some(data) => serde_json::from_str(&data)
                .map(Some)
                .map_err(|error| format!("The row of the chat session {id} is not a chat session: {error}")),
        }
    }

    /// Reads the relations of one chat session from the four link tables, each list sorted by value.
    pub fn find_relations(&self, repository: &str, id: &str) -> Result<ChatSessionRelations, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_relations", OperationKind::Query)
            .parameter("repository", repository)
            .parameter("id", id)
            .database(&self.database_path);
        record(spec, || self.find_relations_inside(repository, id), |relations| {
            Summary::count(relations.folders.len() + relations.issues.len() + relations.pull_requests.len())
        })
    }

    /// The work of `find_relations`, between the start event and the completion event of its operation.
    fn find_relations_inside(&self, repository: &str, id: &str) -> Result<ChatSessionRelations, String> {
        Ok(ChatSessionRelations {
            folders: self.find_link_texts(ChatSessionTable::Folders, repository, id)?,
            issues: self.find_link_numbers(ChatSessionTable::Issues, repository, id)?,
            pull_requests: self.find_link_numbers(ChatSessionTable::PullRequests, repository, id)?,
            files_written: self.find_link_texts(ChatSessionTable::FilesWritten, repository, id)?,
        })
    }

    /// Runs one SQL statement and gives its rows. The SQLite functions on JSON work on the column `data`, for example
    /// `json_extract(data, '$.title')`. A value that is a blob becomes the text `<blob, N bytes>`.
    ///
    /// # Errors
    /// An error when the file is not open read only, or when the statement is wrong. A statement that writes is wrong,
    /// because the file is read only.
    pub fn query(&self, sql: &str) -> Result<Vec<QueryRow>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "query", OperationKind::Query).sql(sql).database(&self.database_path);
        record(spec, || self.query_inside(sql), |rows| Summary::count(rows.len()))
    }

    /// The work of `query`, between the start event and the completion event of its operation.
    fn query_inside(&self, sql: &str) -> Result<Vec<QueryRow>, String> {
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

    /// Reads the text values of one link table for one chat session, sorted.
    fn find_link_texts(&self, table: ChatSessionTable, repository: &str, id: &str) -> Result<Vec<String>, String> {
        self.find_link_values(table, repository, id, |row| row.get::<_, String>(0))
    }

    /// Reads the integer values of one link table for one chat session, sorted.
    fn find_link_numbers(&self, table: ChatSessionTable, repository: &str, id: &str) -> Result<Vec<i64>, String> {
        self.find_link_values(table, repository, id, |row| row.get::<_, i64>(0))
    }

    /// Reads the values of one link table for one chat session, sorted by value.
    fn find_link_values<T>(
        &self,
        table: ChatSessionTable,
        repository: &str,
        id: &str,
        read: impl Fn(&rusqlite::Row) -> rusqlite::Result<T>,
    ) -> Result<Vec<T>, String> {
        let column = table.value_column().ok_or("The table chat_sessions is not a link table.")?;
        let mut statement = self
            .connection
            .prepare(&format!(
                "SELECT {column} FROM {} WHERE repository = ?1 AND chatSessionId = ?2 ORDER BY {column}",
                table.name()
            ))
            .map_err(|error| format!("The links cannot be read: {error}"))?;
        let values = statement
            .query_map(params![repository, id], read)
            .map_err(|error| format!("The links cannot be read: {error}"))?
            .collect::<rusqlite::Result<Vec<T>>>()
            .map_err(|error| format!("The links cannot be read: {error}"))?;
        Ok(values)
    }
}

/// The statement that creates one table when it does not exist.
fn create_table_statement(table: ChatSessionTable) -> String {
    match (table.value_column(), table.value_type()) {
        (Some(column), Some(column_type)) => format!(
            "CREATE TABLE IF NOT EXISTS {} (
                repository TEXT NOT NULL,
                chatSessionId TEXT NOT NULL,
                {column} {column_type} NOT NULL,
                PRIMARY KEY (repository, chatSessionId, {column})
            )",
            table.name()
        ),
        _ => format!(
            "CREATE TABLE IF NOT EXISTS {} (
                repository TEXT NOT NULL,
                id TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                data TEXT NOT NULL CHECK (json_valid(data)),
                PRIMARY KEY (repository, id)
            )",
            table.name()
        ),
    }
}

/// Writes the row of one chat session, then replaces its rows in the four link tables.
fn write_record(
    transaction: &Transaction,
    repository: &str,
    record: &ChatSessionRecord,
    data: &str,
) -> rusqlite::Result<()> {
    let chat_session = &record.chat_session;
    transaction.execute(
        "INSERT INTO chat_sessions (repository, id, updatedAt, data) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (repository, id) DO UPDATE SET updatedAt = excluded.updatedAt, data = excluded.data",
        params![repository, chat_session.id, chat_session.updated_at, data],
    )?;
    for table in ChatSessionTable::LINKS {
        transaction.execute(
            &format!("DELETE FROM {} WHERE repository = ?1 AND chatSessionId = ?2", table.name()),
            params![repository, chat_session.id],
        )?;
    }
    let relations = &record.relations;
    write_links(transaction, ChatSessionTable::Folders, repository, &chat_session.id, &relations.folders)?;
    write_links(transaction, ChatSessionTable::Issues, repository, &chat_session.id, &relations.issues)?;
    write_links(transaction, ChatSessionTable::PullRequests, repository, &chat_session.id, &relations.pull_requests)?;
    write_links(transaction, ChatSessionTable::FilesWritten, repository, &chat_session.id, &relations.files_written)
}

/// Writes the values of one link table for one chat session. A value that is there two times is written once.
fn write_links<T: rusqlite::ToSql>(
    transaction: &Transaction,
    table: ChatSessionTable,
    repository: &str,
    id: &str,
    values: &[T],
) -> rusqlite::Result<()> {
    let column = table.value_column().unwrap_or("value");
    let mut statement = transaction.prepare(&format!(
        "INSERT OR IGNORE INTO {} (repository, chatSessionId, {column}) VALUES (?1, ?2, ?3)",
        table.name()
    ))?;
    for value in values {
        statement.execute(params![repository, id, value])?;
    }
    Ok(())
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
    use crate::test_samples::{chat_session_record, date, temp_folder};

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// A database in a new folder that does not exist yet.
    fn new_database(name: &str) -> (PathBuf, ChatSessionsDatabase) {
        let folder = temp_folder(name);
        let path = folder.join("a_folder_that_does_not_exist_yet").join("data_layer.sqlite");
        let database = ChatSessionsDatabase::open(&path).unwrap();
        (path, database)
    }

    #[test]
    fn creates_the_file_its_folder_and_five_empty_tables() {
        let (path, database) = new_database("creates");
        assert!(path.exists());
        for table in ChatSessionTable::ALL {
            assert_eq!(database.count_rows(table, REPOSITORY), Ok(0), "{}", table.name());
        }
        assert_eq!(database.find_last_updated_at(REPOSITORY), Ok(None));
    }

    #[test]
    fn writes_a_chat_session_and_reads_back_the_same_facts_and_the_same_relations() {
        let (_, mut database) = new_database("round_trip");
        let record = chat_session_record("abc");
        database.upsert_chat_sessions(REPOSITORY, std::slice::from_ref(&record)).unwrap();
        assert_eq!(database.find_chat_session(REPOSITORY, "abc"), Ok(Some(record.chat_session.clone())));
        assert_eq!(database.find_relations(REPOSITORY, "abc"), Ok(record.relations.clone()));
        assert_eq!(database.find_chat_session(REPOSITORY, "other"), Ok(None));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(2));
        assert_eq!(database.count_rows(ChatSessionTable::FilesWritten, REPOSITORY), Ok(2));
    }

    #[test]
    fn has_the_four_columns_and_the_column_data_holds_the_json_text() {
        let (path, mut database) = new_database("columns");
        let record = chat_session_record("abc");
        database.upsert_chat_sessions(REPOSITORY, std::slice::from_ref(&record)).unwrap();
        let connection = Connection::open(&path).unwrap();
        let columns = |table: &str| -> Vec<String> {
            let mut statement = connection.prepare(&format!("PRAGMA table_info({table})")).unwrap();
            let names = statement.query_map([], |row| row.get::<_, String>(1)).unwrap().map(|name| name.unwrap());
            names.collect()
        };
        assert_eq!(columns("chat_sessions"), ["repository", "id", "updatedAt", "data"]);
        assert_eq!(columns("chat_session_folders"), ["repository", "chatSessionId", "folder"]);
        assert_eq!(columns("chat_session_issues"), ["repository", "chatSessionId", "issueNumber"]);
        assert_eq!(columns("chat_session_pull_requests"), ["repository", "chatSessionId", "pullRequestNumber"]);
        assert_eq!(columns("chat_session_files"), ["repository", "chatSessionId", "path"]);
        let (repository, id, updated_at, data): (String, String, String, String) = connection
            .query_row("SELECT * FROM chat_sessions", [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
            .unwrap();
        assert_eq!((repository.as_str(), id.as_str(), updated_at.as_str()), (REPOSITORY, "abc", date(2).as_str()));
        assert_eq!(serde_json::from_str::<ChatSession>(&data).unwrap(), record.chat_session);
        let data: Value = serde_json::from_str(&data).unwrap();
        assert!(data.get("folders").is_none() && data.get("issues").is_none(), "the relations are in the link tables only");
    }

    #[test]
    fn replaces_a_chat_session_with_its_relations_and_never_adds_a_second_row() {
        let (_, mut database) = new_database("replaces");
        database.upsert_chat_sessions(REPOSITORY, &[chat_session_record("abc")]).unwrap();
        let mut changed = chat_session_record("abc");
        changed.chat_session.title = "A new title".into();
        changed.chat_session.updated_at = date(5);
        changed.relations.issues = vec![251, 300];
        changed.relations.folders = vec![];
        database.upsert_chat_sessions(REPOSITORY, std::slice::from_ref(&changed)).unwrap();
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(1));
        assert_eq!(database.find_chat_session(REPOSITORY, "abc").unwrap().unwrap().title, "A new title");
        assert_eq!(database.find_relations(REPOSITORY, "abc"), Ok(changed.relations));
        assert_eq!(database.find_last_updated_at(REPOSITORY), Ok(Some(date(5))));
    }

    #[test]
    fn writes_a_value_that_is_there_two_times_once() {
        let (_, mut database) = new_database("duplicates");
        let mut record = chat_session_record("abc");
        record.relations.issues = vec![7, 7, 8];
        database.upsert_chat_sessions(REPOSITORY, &[record]).unwrap();
        assert_eq!(database.find_relations(REPOSITORY, "abc").unwrap().issues, vec![7, 8]);
    }

    #[test]
    fn finds_the_largest_date_of_change() {
        let (_, mut database) = new_database("largest_date");
        let records: Vec<ChatSessionRecord> = [("a", 3), ("b", 9), ("c", 5)]
            .iter()
            .map(|(id, day)| {
                let mut record = chat_session_record(id);
                record.chat_session.updated_at = date(*day);
                record
            })
            .collect();
        database.upsert_chat_sessions(REPOSITORY, &records).unwrap();
        assert_eq!(database.find_last_updated_at(REPOSITORY), Ok(Some(date(9))));
        assert_eq!(database.find_last_updated_at("other/repository"), Ok(None));
    }

    /// A record of the chat session `id` that belongs to the folder `folder`.
    fn record_in(id: &str, folder: &str, updated_day: u32) -> ChatSessionRecord {
        let mut record = chat_session_record(id);
        record.chat_session.folder = folder.to_string();
        record.chat_session.updated_at = date(updated_day);
        record
    }

    #[test]
    fn reads_the_chat_sessions_and_the_relations_of_one_folder_only() {
        let (_, mut database) = new_database("folder_read");
        let mut other = record_in("other", "/work/other", 3);
        other.relations.issues = vec![1];
        database
            .upsert_chat_sessions(REPOSITORY, &[record_in("b", "/work/app", 2), record_in("a", "/work/app", 4), other])
            .unwrap();
        let sessions = database.find_chat_sessions_in_folder("/work/app").unwrap();
        assert_eq!(sessions.iter().map(|session| session.id.as_str()).collect::<Vec<_>>(), vec!["a", "b"]);
        let relations = database.find_relations_in_folder("/work/app").unwrap();
        assert_eq!(relations.len(), 2);
        assert_eq!(relations["a"].issues, vec![250, 251]);
        assert_eq!(relations["a"].files_written, vec!["/work/app/a.ts", "/work/app/b.ts"]);
        assert!(database.find_chat_sessions_in_folder("/work/nothing").unwrap().is_empty());
    }

    #[test]
    fn finds_the_date_of_the_last_read_of_each_folder() {
        let (_, mut database) = new_database("folder_date");
        database
            .upsert_chat_sessions(REPOSITORY, &[record_in("a", "/work/app", 4), record_in("b", "/work/app", 2), record_in("c", "/work/doc", 9)])
            .unwrap();
        assert_eq!(database.find_last_updated_at_in_folder(REPOSITORY, "/work/app"), Ok(Some(date(4))));
        assert_eq!(database.find_last_updated_at_in_folder(REPOSITORY, "/work/doc"), Ok(Some(date(9))));
        assert_eq!(database.find_last_updated_at_in_folder(REPOSITORY, "/work/none"), Ok(None));
    }

    #[test]
    fn deletes_the_chat_sessions_of_a_folder_that_are_not_kept_with_their_links_and_touches_nothing_else() {
        let (_, mut database) = new_database("folder_delete");
        database
            .upsert_chat_sessions(
                REPOSITORY,
                &[record_in("keep", "/work/app", 2), record_in("gone", "/work/app", 3), record_in("elsewhere", "/work/doc", 3)],
            )
            .unwrap();
        let kept: HashSet<String> = ["keep".to_string()].into();
        assert_eq!(database.delete_chat_sessions_not_in(REPOSITORY, "/work/app", &kept), Ok(1));
        assert_eq!(database.find_chat_session(REPOSITORY, "gone"), Ok(None));
        assert!(database.find_chat_session(REPOSITORY, "keep").unwrap().is_some());
        assert!(database.find_chat_session(REPOSITORY, "elsewhere").unwrap().is_some());
        assert_eq!(database.find_relations(REPOSITORY, "gone"), Ok(ChatSessionRelations::default()));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(4));
        assert_eq!(database.delete_chat_sessions_not_in(REPOSITORY, "/work/app", &kept), Ok(0));
    }

    #[test]
    fn deletes_the_rows_that_an_earlier_repository_key_of_the_folder_left() {
        let (_, mut database) = new_database("folder_old_key");
        database.upsert_chat_sessions("old-owner/old-name", &[record_in("a", "/work/app", 2)]).unwrap();
        database.upsert_chat_sessions(REPOSITORY, &[record_in("a", "/work/app", 2)]).unwrap();
        assert_eq!(database.find_chat_sessions_in_folder("/work/app").unwrap().len(), 2);
        let kept: HashSet<String> = ["a".to_string()].into();
        assert_eq!(database.delete_chat_sessions_not_in(REPOSITORY, "/work/app", &kept), Ok(1));
        assert_eq!(database.find_chat_sessions_in_folder("/work/app").unwrap().len(), 1);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "old-owner/old-name"), Ok(0));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, "old-owner/old-name"), Ok(0));
    }

    #[test]
    fn reads_a_row_that_an_earlier_version_wrote_without_a_folder_and_without_first_messages() {
        let (path, database) = new_database("old_row");
        Connection::open(&path)
            .unwrap()
            .execute(
                "INSERT INTO chat_sessions (repository, id, updatedAt, data) VALUES (?1, 'old', ?2, ?3)",
                params![
                    REPOSITORY,
                    date(2),
                    r#"{"id":"old","codingAgent":"CODEX","title":"Old","firstRecordAt":null,"lastRecordAt":null,"updatedAt":"2026-10-02T10:00:00Z","userMessageCount":0,"tokens":[]}"#
                ],
            )
            .unwrap();
        let session = database.find_chat_session(REPOSITORY, "old").unwrap().unwrap();
        assert_eq!((session.folder.as_str(), session.first_messages.len()), ("", 0));
        assert!(database.find_chat_sessions_in_folder("/work/app").unwrap().is_empty());
        assert_eq!(database.has_chat_sessions_table(), Ok(true));
    }

    #[test]
    fn tells_that_a_file_of_another_data_layer_has_no_table_of_chat_sessions() {
        let folder = temp_folder("no_table");
        let path = folder.join("other.sqlite");
        Connection::open(&path).unwrap().execute_batch("CREATE TABLE other (a TEXT)").unwrap();
        assert_eq!(ChatSessionsDatabase::open_read_only(&path).unwrap().has_chat_sessions_table(), Ok(false));
    }

    #[test]
    fn uses_the_index_of_the_folder_to_read_the_chat_sessions_of_a_folder() {
        let (path, _) = new_database("folder_index");
        let connection = Connection::open(&path).unwrap();
        let mut statement = connection
            .prepare(
                "EXPLAIN QUERY PLAN SELECT data FROM chat_sessions WHERE json_extract(data, '$.folder') = 'b'",
            )
            .unwrap();
        let plan: Vec<String> =
            statement.query_map([], |row| row.get::<_, String>(3)).unwrap().map(|detail| detail.unwrap()).collect();
        assert!(plan.iter().any(|detail| detail.contains("chat_sessions_folder")), "{plan:?}");
    }

    #[test]
    fn keeps_the_rows_of_two_repositories_apart() {
        let (_, mut database) = new_database("two_repositories");
        let mut in_b = chat_session_record("abc");
        in_b.chat_session.title = "In B".into();
        in_b.relations.issues = vec![1];
        database.upsert_chat_sessions("owner-a/repository-a", &[chat_session_record("abc")]).unwrap();
        database.upsert_chat_sessions("owner-b/repository-b", &[in_b]).unwrap();
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "owner-a/repository-a"), Ok(1));
        assert_eq!(database.find_chat_session("owner-b/repository-b", "abc").unwrap().unwrap().title, "In B");
        assert_eq!(database.find_relations("owner-a/repository-a", "abc").unwrap().issues, vec![250, 251]);
        assert_eq!(database.find_relations("owner-b/repository-b", "abc").unwrap().issues, vec![1]);
    }

    #[test]
    fn writes_nothing_when_one_chat_session_does_not_follow_the_json_schema() {
        let (_, mut database) = new_database("wrong_item");
        let mut wrong = chat_session_record("wrong");
        wrong.chat_session.updated_at = "yesterday".into();
        let error = database.upsert_chat_sessions(REPOSITORY, &[chat_session_record("good"), wrong]).unwrap_err();
        assert!(error.contains("/updatedAt"), "{error}");
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(0));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(0));
    }

    #[test]
    fn refuses_a_write_on_a_database_that_is_open_read_only() {
        let (path, _) = new_database("read_only_write");
        let mut read_only = ChatSessionsDatabase::open_read_only(&path).unwrap();
        let error = read_only.upsert_chat_sessions(REPOSITORY, &[chat_session_record("abc")]).unwrap_err();
        assert!(error.contains("read only"), "{error}");
    }

    #[test]
    fn refuses_to_open_read_only_a_file_that_does_not_exist() {
        let error = ChatSessionsDatabase::open_read_only(&temp_folder("missing").join("none.sqlite")).err().unwrap();
        assert!(error.contains("does not exist") && error.contains("initialize"), "{error}");
    }

    #[test]
    fn runs_a_query_on_the_json_and_the_link_tables_and_keeps_the_order_of_the_columns() {
        let (path, mut database) = new_database("query");
        let mut second = chat_session_record("def");
        second.relations.issues = vec![250];
        database.upsert_chat_sessions(REPOSITORY, &[chat_session_record("abc"), second]).unwrap();
        let read_only = ChatSessionsDatabase::open_read_only(&path).unwrap();
        let rows = read_only
            .query(
                "SELECT s.id AS id, json_extract(s.data, '$.title') AS title, count(*) AS issue_count
                 FROM chat_sessions s JOIN chat_session_issues i ON i.repository = s.repository AND i.chatSessionId = s.id
                 GROUP BY s.id ORDER BY s.id",
            )
            .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].keys().collect::<Vec<_>>(), vec!["id", "title", "issue_count"]);
        assert_eq!(rows[0]["issue_count"], Value::from(2));
        assert_eq!(rows[1]["issue_count"], Value::from(1));
        assert_eq!(rows[0]["title"], Value::from("A chat session"));
    }

    #[test]
    fn refuses_a_query_on_a_database_that_is_not_open_read_only_and_a_statement_that_writes() {
        let (path, database) = new_database("query_refused");
        assert!(database.query("SELECT 1").unwrap_err().contains("read only"));
        let read_only = ChatSessionsDatabase::open_read_only(&path).unwrap();
        assert!(read_only.query("DELETE FROM chat_sessions").is_err());
        assert!(read_only.query("INSERT INTO chat_session_issues VALUES ('a', 'b', 1)").is_err());
        assert!(read_only.query("SELEC 1").is_err());
    }

    #[test]
    fn turns_a_null_a_real_and_a_blob_into_json() {
        let (path, _) = new_database("value_types");
        let read_only = ChatSessionsDatabase::open_read_only(&path).unwrap();
        let rows = read_only.query("SELECT NULL AS a, 1.5 AS b, x'0102' AS c, 'text' AS d, 7 AS e").unwrap();
        assert_eq!(
            Value::Object(rows[0].clone()),
            serde_json::json!({"a": null, "b": 1.5, "c": "<blob, 2 bytes>", "d": "text", "e": 7})
        );
    }
}
