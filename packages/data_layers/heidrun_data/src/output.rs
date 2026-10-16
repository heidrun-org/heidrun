//! Writes the rows of a command, and its errors, in one of the three formats. It only turns data into text.

use serde_json::{Map, Value};

/// One row of the output: the column names and their values, in the order of the columns.
pub type QueryRow = Map<String, Value>;

/// The format of the output.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    /// One JSON object per line. The default when the standard output is not a terminal.
    Jsonl,
    /// One JSON list.
    Json,
    /// A text table, for a person. The default when the standard output is a terminal.
    Table,
}

impl Format {
    /// The format of a name of the option `--format`, or `None` when the name is not known.
    pub fn from_name(name: &str) -> Option<Format> {
        match name {
            "jsonl" => Some(Format::Jsonl),
            "json" => Some(Format::Json),
            "table" => Some(Format::Table),
            _ => None,
        }
    }

    /// The format when the option `--format` is not given: `table` when the standard output is a terminal, and `jsonl`
    /// when it is not.
    pub fn default_for(is_terminal: bool) -> Format {
        if is_terminal {
            Format::Table
        } else {
            Format::Jsonl
        }
    }

    /// True for the two JSON formats.
    pub fn is_json(self) -> bool {
        self != Format::Table
    }
}

/// Writes rows in a format, without a new line at the end. With `jsonl`, no row gives an empty text. With `table`, no row
/// gives `(no row)`.
pub fn write_rows(rows: &[QueryRow], format: Format) -> String {
    match format {
        Format::Jsonl => rows
            .iter()
            .map(|row| serde_json::to_string(row).expect("A row always becomes JSON"))
            .collect::<Vec<_>>()
            .join("\n"),
        Format::Json => serde_json::to_string_pretty(rows).expect("A row always becomes JSON"),
        Format::Table => data_layer_source_control::to_table(rows),
    }
}

/// Writes one error, without a new line at the end. With a JSON format, it is one JSON object on one line, with the fields
/// `error`, and `source` when one source failed. With `table`, it is the plain text `Error: ...`.
pub fn format_error(message: &str, source: Option<&str>, format: Format) -> String {
    if !format.is_json() {
        return match source {
            Some(source) => format!("Error: {source}: {message}"),
            None => format!("Error: {message}"),
        };
    }
    let mut object = Map::new();
    object.insert("error".to_string(), Value::from(message));
    if let Some(source) = source {
        object.insert("source".to_string(), Value::from(source));
    }
    Value::Object(object).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Two rows with two columns.
    fn rows() -> Vec<QueryRow> {
        [json!({ "b": 1, "a": "x" }), json!({ "b": 2, "a": null })]
            .into_iter()
            .map(|value| match value {
                Value::Object(row) => row,
                _ => unreachable!(),
            })
            .collect()
    }

    #[test]
    fn writes_one_json_object_per_line_in_the_order_of_the_columns() {
        assert_eq!(write_rows(&rows(), Format::Jsonl), "{\"b\":1,\"a\":\"x\"}\n{\"b\":2,\"a\":null}");
        assert_eq!(write_rows(&[], Format::Jsonl), "");
    }

    #[test]
    fn writes_one_json_list() {
        let text = write_rows(&rows(), Format::Json);
        assert_eq!(serde_json::from_str::<Value>(&text).unwrap(), json!([{ "b": 1, "a": "x" }, { "b": 2, "a": null }]));
        assert_eq!(write_rows(&[], Format::Json), "[]");
    }

    #[test]
    fn writes_a_text_table() {
        assert_eq!(write_rows(&rows(), Format::Table), "b  a\n-  ----\n1  x\n2  NULL\nrow count: 2");
        assert_eq!(write_rows(&[], Format::Table), "(no row)");
    }

    #[test]
    fn reads_the_names_of_the_formats_and_picks_the_default_from_the_terminal() {
        assert_eq!(Format::from_name("jsonl"), Some(Format::Jsonl));
        assert_eq!(Format::from_name("json"), Some(Format::Json));
        assert_eq!(Format::from_name("table"), Some(Format::Table));
        assert_eq!(Format::from_name("csv"), None);
        assert_eq!(Format::default_for(true), Format::Table);
        assert_eq!(Format::default_for(false), Format::Jsonl);
    }

    #[test]
    fn writes_an_error_as_one_json_object_or_as_plain_text() {
        assert_eq!(format_error("no file", None, Format::Jsonl), "{\"error\":\"no file\"}");
        assert_eq!(format_error("no gh", Some("code_hosting"), Format::Json), "{\"error\":\"no gh\",\"source\":\"code_hosting\"}");
        assert_eq!(format_error("no file", None, Format::Table), "Error: no file");
        assert_eq!(format_error("no gh", Some("code_hosting"), Format::Table), "Error: code_hosting: no gh");
    }
}
