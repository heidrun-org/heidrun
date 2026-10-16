//! The shape of the SQLite file: every table, its columns, its primary key, the JSON schema of its column `data`, and the
//! joins of the link tables.
//!
//! The columns and the `CREATE TABLE` statements come from the four data layer packages themselves: the catalog opens each
//! package database once on a temporary file, which creates its tables, then reads them back. The JSON schemas come from
//! the libraries, which hold them with `include_str!`. So this package copies no column and no field.

use crate::output::QueryRow;
use crate::sources::{all_tables, find_table, Source, Table};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// One column of a table.
#[derive(Debug, Clone, PartialEq)]
pub struct Column {
    /// The name of the column.
    pub name: String,
    /// The type of the column in SQLite, for example `TEXT`.
    pub column_type: String,
    /// True when the column cannot hold `NULL`.
    pub is_not_null: bool,
}

/// The shape of one table.
#[derive(Debug, Clone, PartialEq)]
pub struct TableShape {
    /// The source of the table.
    pub source: Source,
    /// The table, with its JSON schema and its joins.
    pub table: &'static Table,
    /// The columns, in their order in the table.
    pub columns: Vec<Column>,
    /// The columns of the primary key, in their order in the key.
    pub primary_key: Vec<String>,
    /// The `CREATE TABLE` statement of the table.
    pub create_statement: String,
}

impl TableShape {
    /// The joins as texts, for example `chat_session_issues.issueNumber = issues.number`, one text per joined table.
    fn join_texts(&self) -> Vec<String> {
        self.table
            .joins
            .iter()
            .map(|join| {
                join.columns
                    .iter()
                    .map(|(own, other)| format!("{}.{own} = {}.{other}", self.table.name, join.table))
                    .collect::<Vec<_>>()
                    .join(" AND ")
            })
            .collect()
    }

    /// The shape as one row: `table`, `source`, `columns`, `primaryKey`, `dataSchema`, and `joins`.
    pub fn to_row(&self) -> QueryRow {
        let columns: Vec<Value> = self
            .columns
            .iter()
            .map(|column| json!({ "name": column.name, "type": column.column_type, "notNull": column.is_not_null }))
            .collect();
        let joins: Vec<Value> = self
            .table
            .joins
            .iter()
            .zip(self.join_texts())
            .map(|(join, on)| json!({ "table": join.table, "on": on }))
            .collect();
        let row = json!({
            "table": self.table.name,
            "source": self.source.name(),
            "columns": columns,
            "primaryKey": self.primary_key,
            "dataSchema": self.table.data_schema.map(|schema| schema.file_name),
            "joins": joins,
        });
        match row {
            Value::Object(row) => row,
            _ => unreachable!("The shape is an object"),
        }
    }

    /// The shape as one row of a text table, with the lists written as texts.
    pub fn to_table_row(&self) -> QueryRow {
        let mut row = QueryRow::new();
        row.insert("table".to_string(), Value::from(self.table.name));
        row.insert("source".to_string(), Value::from(self.source.name()));
        let columns: Vec<&str> = self.columns.iter().map(|column| column.name.as_str()).collect();
        row.insert("columns".to_string(), Value::from(columns.join(", ")));
        row.insert("primaryKey".to_string(), Value::from(self.primary_key.join(", ")));
        row.insert("dataSchema".to_string(), json!(self.table.data_schema.map(|schema| schema.file_name)));
        row.insert("joins".to_string(), Value::from(self.join_texts().join("; ")));
        row
    }
}

/// The shape of every table of the four sources, in the fixed order.
///
/// # Errors
/// An error when the temporary SQLite file cannot be written or read.
pub fn read_catalog() -> Result<Vec<TableShape>, String> {
    let path = temporary_path();
    let result = read_catalog_at(&path);
    let _ = std::fs::remove_file(&path);
    result
}

/// The JSON schema of the column `data` of a table, as the text of its file.
///
/// # Errors
/// An error when no source has the table, or when the table is a link table, which has no column `data`.
pub fn data_schema_text(table_name: &str) -> Result<&'static str, String> {
    let Some((_, table)) = find_table(table_name) else {
        let names: Vec<&str> = all_tables().iter().map(|(_, table)| table.name).collect();
        return Err(format!("The table {table_name} is not known. The tables: {}.", names.join(", ")));
    };
    match table.data_schema {
        Some(schema) => Ok(schema.text),
        None => Err(format!(
            "The table {table_name} is a link table and has no column data. Run \"heidrun_data schema\" to see its columns."
        )),
    }
}

/// A path for the temporary SQLite file of the catalog, which no other run uses.
fn temporary_path() -> PathBuf {
    let nanoseconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!("heidrun_data_schema_{}_{nanoseconds}.sqlite", std::process::id()))
}

/// Creates the tables of the four packages in the file at `path`, and reads their shapes.
fn read_catalog_at(path: &Path) -> Result<Vec<TableShape>, String> {
    drop(data_layer_source_control::SourceControlDatabase::open(path)?);
    drop(data_layer_code_hosting::CodeHostingDatabase::open(path)?);
    drop(data_layer_chat_sessions::ChatSessionsDatabase::open(path)?);
    drop(data_layer_user_activity::UserActivityDatabase::open(path)?);
    let connection = Connection::open(path).map_err(|error| format!("The schema cannot be read: {error}"))?;
    all_tables().into_iter().map(|(source, table)| read_table_shape(&connection, source, table)).collect()
}

/// Reads the shape of one table.
fn read_table_shape(connection: &Connection, source: Source, table: &'static Table) -> Result<TableShape, String> {
    let error_of = |error: rusqlite::Error| format!("The table {} cannot be read: {error}", table.name);
    let create_statement: String = connection
        .query_row("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1", [table.name], |row| row.get(0))
        .map_err(error_of)?;
    let mut statement =
        connection.prepare(&format!("PRAGMA table_info({})", table.name)).map_err(error_of)?;
    let rows: Vec<(String, String, bool, i64)> = statement
        .query_map([], |row| Ok((row.get(1)?, row.get(2)?, row.get::<_, i64>(3)? != 0, row.get(5)?)))
        .map_err(error_of)?
        .collect::<Result<_, _>>()
        .map_err(error_of)?;
    let mut key_columns: Vec<(i64, String)> =
        rows.iter().filter(|(_, _, _, key)| *key > 0).map(|(name, _, _, key)| (*key, name.clone())).collect();
    key_columns.sort();
    Ok(TableShape {
        source,
        table,
        columns: rows
            .into_iter()
            .map(|(name, column_type, is_not_null, _)| Column { name, column_type, is_not_null })
            .collect(),
        primary_key: key_columns.into_iter().map(|(_, name)| name).collect(),
        create_statement: format!("{};", normalize_spaces(&create_statement)),
    })
}

/// The statement with each line trimmed and indented by four spaces after the first one, so that the statements of the
/// four packages look the same.
fn normalize_spaces(statement: &str) -> String {
    let lines: Vec<&str> = statement.lines().map(str::trim).filter(|line| !line.is_empty()).collect();
    let mut text = String::new();
    for (index, line) in lines.iter().enumerate() {
        if index > 0 {
            text.push('\n');
            if !line.starts_with(')') {
                text.push_str("    ");
            }
        }
        text.push_str(line);
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_every_table_of_the_four_sources_with_its_columns_and_its_key() {
        let catalog = read_catalog().unwrap();
        assert_eq!(catalog.len(), 9);
        let commits = &catalog[0];
        assert_eq!(commits.table.name, "commits");
        let names: Vec<&str> = commits.columns.iter().map(|column| column.name.as_str()).collect();
        assert_eq!(names, ["repository", "hash", "committedAt", "data"]);
        assert_eq!(commits.primary_key, ["repository", "hash"]);
        assert!(commits.create_statement.starts_with("CREATE TABLE commits (\n    repository TEXT NOT NULL,"));
        let link = catalog.iter().find(|shape| shape.table.name == "chat_session_issues").unwrap();
        assert_eq!(link.primary_key, ["repository", "chatSessionId", "issueNumber"]);
    }

    #[test]
    fn writes_the_joins_of_a_link_table() {
        let catalog = read_catalog().unwrap();
        let link = catalog.iter().find(|shape| shape.table.name == "chat_session_issues").unwrap();
        assert_eq!(
            Value::Object(link.to_row())["joins"],
            json!([
                { "table": "chat_sessions", "on": "chat_session_issues.repository = chat_sessions.repository AND chat_session_issues.chatSessionId = chat_sessions.id" },
                { "table": "issues", "on": "chat_session_issues.repository = issues.repository AND chat_session_issues.issueNumber = issues.number" },
            ])
        );
        assert_eq!(Value::Object(link.to_row())["dataSchema"], Value::Null);
    }

    #[test]
    fn gives_the_json_schema_of_a_table_or_an_error() {
        assert_eq!(data_schema_text("commits"), Ok(data_layer_source_control::COMMIT_SCHEMA));
        assert!(data_schema_text("chat_session_files").unwrap_err().contains("link table"));
        assert!(data_schema_text("commit").unwrap_err().contains("The tables: commits, issues"));
    }

}
