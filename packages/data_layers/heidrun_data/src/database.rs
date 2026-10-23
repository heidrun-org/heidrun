//! The SQLite file of the four data layers, open read only: one query, and the number of rows of each source.
//!
//! The file is never written and never created here. Only the four data layer packages create and write their tables.

use crate::output::QueryRow;
use crate::sources::{Source, TableKind};
use rusqlite::types::ValueRef;
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// The SQLite file of the four data layers, open read only.
pub struct HeidrunDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// The open connection to the SQLite file. It is read only, so a statement that writes fails.
    connection: Connection,
}

/// The tables of one source, their number of rows, and the date of the last update of the source.
#[derive(Debug, Clone, PartialEq)]
pub struct SourceSummary {
    /// The source.
    pub source: Source,
    /// Each table of the source with its number of rows. A table that the file does not have yet has 0 rows.
    pub tables: Vec<(String, i64)>,
    /// The largest date of the tables of the source, in the column that the mode update uses, or `None` when the source has
    /// no row.
    pub last_updated_at: Option<String>,
}

impl SourceSummary {
    /// The summary as one row: `source`, `tables` (an object with the number of rows of each table), and `lastUpdatedAt`.
    pub fn to_row(&self) -> QueryRow {
        let tables: serde_json::Map<String, Value> =
            self.tables.iter().map(|(table, count)| (table.clone(), Value::from(*count))).collect();
        let row = json!({
            "source": self.source.name(),
            "tables": tables,
            "lastUpdatedAt": self.last_updated_at,
        });
        match row {
            Value::Object(row) => row,
            _ => unreachable!("The summary is an object"),
        }
    }

    /// The summary as one row for each table, for a text table: `source`, `table`, `rowCount`, and `lastUpdatedAt`.
    pub fn to_table_rows(&self) -> Vec<QueryRow> {
        self.tables
            .iter()
            .map(|(table, count)| {
                let mut row = QueryRow::new();
                row.insert("source".to_string(), Value::from(self.source.name()));
                row.insert("table".to_string(), Value::from(table.clone()));
                row.insert("rowCount".to_string(), Value::from(*count));
                row.insert("lastUpdatedAt".to_string(), json!(self.last_updated_at));
                row
            })
            .collect()
    }

    /// The summary of a source that has no row.
    fn empty(source: Source) -> SourceSummary {
        SourceSummary {
            source,
            tables: source.tables().iter().filter(|table| table.kind != TableKind::View).map(|table| (table.name.to_string(), 0)).collect(),
            last_updated_at: None,
        }
    }
}

impl HeidrunDatabase {
    /// Opens the SQLite file read only. The file must exist.
    ///
    /// # Errors
    /// An error when the file does not exist, or cannot be opened.
    pub fn open_read_only(database_path: &Path) -> Result<Self, String> {
        if !database_path.exists() {
            return Err(format!(
                "The database file does not exist: {}. Run the command update first.",
                database_path.display()
            ));
        }
        let connection = Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|error| format!("The database file {} cannot be opened: {error}", database_path.display()))?;
        Ok(HeidrunDatabase { database_path: database_path.to_path_buf(), connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Runs one SQL statement and gives its rows. A value that is a blob becomes the text `<blob, N bytes>`.
    ///
    /// # Errors
    /// An error when the statement is wrong. A statement that writes is wrong, because the file is read only.
    pub fn query(&self, sql: &str) -> Result<Vec<QueryRow>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "query", OperationKind::Query).sql(sql).database(&self.database_path);
        record(spec, || self.query_inside(sql), |rows| Summary::count(rows.len()))
    }

    /// The work of `query`, between the start event and the completion event of its operation.
    fn query_inside(&self, sql: &str) -> Result<Vec<QueryRow>, String> {
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

    /// The summary of each of the four sources, in the fixed order. When the file does not exist, every source has 0 rows,
    /// and the file is not created.
    ///
    /// # Errors
    /// An error when the file exists and cannot be read.
    pub fn summarize_file(database_path: &Path) -> Result<Vec<SourceSummary>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "summarize_sources", OperationKind::Query).database(database_path);
        record(spec, || HeidrunDatabase::summarize_file_inside(database_path), |summaries| Summary::count(summaries.len()))
    }

    /// The work of `summarize_file`, between the start event and the completion event of its operation.
    fn summarize_file_inside(database_path: &Path) -> Result<Vec<SourceSummary>, String> {
        if !database_path.exists() {
            return Ok(Source::ALL.into_iter().map(SourceSummary::empty).collect());
        }
        let database = HeidrunDatabase::open_read_only(database_path)?;
        Source::ALL.into_iter().map(|source| database.summarize(source)).collect()
    }

    /// The summary of one source.
    fn summarize(&self, source: Source) -> Result<SourceSummary, String> {
        let mut summary = SourceSummary::empty(source);
        for (index, table) in source.tables().iter().filter(|table| table.kind != TableKind::View).enumerate() {
            let date_column = table.date_column;
            let table = table.name;
            if !self.has_table(table)? {
                continue;
            }
            summary.tables[index].1 = self
                .connection
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get::<_, i64>(0))
                .map_err(|error| format!("The rows of the table {table} cannot be counted: {error}"))?;
            let Some(date_column) = date_column else {
                continue;
            };
            let date: Option<String> = self
                .connection
                .query_row(&format!("SELECT MAX({date_column}) FROM {table}"), [], |row| row.get(0))
                .map_err(|error| format!("The last date of the table {table} cannot be read: {error}"))?;
            if date > summary.last_updated_at {
                summary.last_updated_at = date;
            }
        }
        Ok(summary)
    }

    /// True when the file has the table.
    fn has_table(&self, table: &str) -> Result<bool, String> {
        self.connection
            .query_row("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1", [table], |_| Ok(()))
            .optional()
            .map(|found| found.is_some())
            .map_err(|error| format!("The tables of the database cannot be read: {error}"))
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

    /// A new folder for one test.
    fn temp_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_data_database_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    /// A SQLite file with two commits and one issue, and no table of chat sessions or of user activity.
    fn sample_file(name: &str) -> PathBuf {
        let path = temp_folder(name).join("data_layer.sqlite");
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE commits (repository TEXT, hash TEXT, committedAt TEXT, data TEXT);
                 INSERT INTO commits VALUES ('o/n', 'a', '2026-10-01T10:00:00Z', '{}'), ('o/n', 'b', '2026-10-03T10:00:00Z', '{}');
                 CREATE TABLE issues (repository TEXT, number INTEGER, updatedAt TEXT, data TEXT);
                 INSERT INTO issues VALUES ('o/n', 1, '2026-10-02T10:00:00Z', '{}');
                 CREATE TABLE pull_requests (repository TEXT, number INTEGER, updatedAt TEXT, data TEXT);",
            )
            .unwrap();
        path
    }

    #[test]
    fn gives_the_rows_of_a_query_in_the_order_of_the_columns() {
        let database = HeidrunDatabase::open_read_only(&sample_file("query")).unwrap();
        let rows = database.query("SELECT hash, committedAt FROM commits ORDER BY hash").unwrap();
        assert_eq!(Value::Array(rows.into_iter().map(Value::Object).collect()), json!([
            { "hash": "a", "committedAt": "2026-10-01T10:00:00Z" },
            { "hash": "b", "committedAt": "2026-10-03T10:00:00Z" },
        ]));
    }

    #[test]
    fn refuses_a_statement_that_writes() {
        let path = sample_file("write");
        let database = HeidrunDatabase::open_read_only(&path).unwrap();
        assert!(database.query("DELETE FROM commits").unwrap_err().contains("readonly"));
        assert_eq!(database.query("SELECT COUNT(*) AS count FROM commits").unwrap()[0]["count"], json!(2));
    }

    #[test]
    fn refuses_a_file_that_does_not_exist_and_does_not_create_it() {
        let path = temp_folder("missing").join("data_layer.sqlite");
        assert!(HeidrunDatabase::open_read_only(&path).is_err_and(|error| error.contains("does not exist")));
        assert!(!path.exists());
    }

    #[test]
    fn counts_the_rows_and_finds_the_last_date_of_each_source() {
        let summaries = HeidrunDatabase::summarize_file(&sample_file("summary")).unwrap();
        assert_eq!(summaries.iter().map(|summary| summary.source).collect::<Vec<_>>(), Source::ALL.to_vec());
        assert_eq!(summaries[0].tables, vec![("commits".to_string(), 2)]);
        assert_eq!(summaries[0].last_updated_at.as_deref(), Some("2026-10-03T10:00:00Z"));
        assert_eq!(summaries[1].tables, vec![("issues".to_string(), 1), ("pull_requests".to_string(), 0)]);
        assert_eq!(summaries[1].last_updated_at.as_deref(), Some("2026-10-02T10:00:00Z"));
        assert_eq!(summaries[2].tables.len(), 12);
        assert_eq!(summaries[2].last_updated_at, None);
    }

    #[test]
    fn gives_empty_summaries_for_a_file_that_does_not_exist_and_does_not_create_it() {
        let path = temp_folder("summary_missing").join("data_layer.sqlite");
        let summaries = HeidrunDatabase::summarize_file(&path).unwrap();
        assert!(summaries.iter().all(|summary| summary.last_updated_at.is_none()));
        assert!(summaries.iter().flat_map(|summary| &summary.tables).all(|(_, count)| *count == 0));
        assert!(!path.exists());
    }

    #[test]
    fn writes_a_summary_as_one_row_or_as_one_row_for_each_table() {
        let summary = SourceSummary {
            source: Source::CodeHosting,
            tables: vec![("issues".to_string(), 1), ("pull_requests".to_string(), 0)],
            last_updated_at: Some("2026-10-02T10:00:00Z".to_string()),
        };
        assert_eq!(
            Value::Object(summary.to_row()),
            json!({ "source": "code_hosting", "tables": { "issues": 1, "pull_requests": 0 }, "lastUpdatedAt": "2026-10-02T10:00:00Z" })
        );
        let table_rows = summary.to_table_rows();
        assert_eq!(table_rows.len(), 2);
        assert_eq!(
            Value::Object(table_rows[1].clone()),
            json!({ "source": "code_hosting", "table": "pull_requests", "rowCount": 0, "lastUpdatedAt": "2026-10-02T10:00:00Z" })
        );
    }
}
