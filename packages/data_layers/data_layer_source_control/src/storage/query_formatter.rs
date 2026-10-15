//! Writes the rows of a query as a table for a person, or as JSON for another program. It only turns data into text.

use crate::model::types::QueryRow;
use serde_json::Value;

/// The text of a table with no row.
pub const NO_ROW_TEXT: &str = "(no row)";

/// Writes the rows as a JSON list, with one object for each row.
pub fn to_json(rows: &[QueryRow]) -> String {
    serde_json::to_string_pretty(rows).expect("A row of a query always becomes JSON")
}

/// Writes the rows as a text table: one line with the column names, one line of dashes, one line for each row, and one last
/// line with the number of rows. A null value is written `NULL`, and a new line inside a value is written as a space.
/// Returns `(no row)` when there is no row.
pub fn to_table(rows: &[QueryRow]) -> String {
    let Some(first_row) = rows.first() else {
        return NO_ROW_TEXT.to_string();
    };
    let column_names: Vec<&String> = first_row.keys().collect();
    let cell_rows: Vec<Vec<String>> = rows
        .iter()
        .map(|row| column_names.iter().map(|column_name| format_cell(row.get(*column_name))).collect())
        .collect();
    let widths: Vec<usize> = column_names
        .iter()
        .enumerate()
        .map(|(column_index, column_name)| {
            cell_rows
                .iter()
                .map(|cell_row| cell_row[column_index].chars().count())
                .fold(column_name.chars().count(), usize::max)
        })
        .collect();
    let mut lines = vec![
        join_line(&column_names.iter().map(|name| name.to_string()).collect::<Vec<_>>(), &widths),
        join_line(&widths.iter().map(|width| "-".repeat(*width)).collect::<Vec<_>>(), &widths),
    ];
    for cell_row in &cell_rows {
        lines.push(join_line(cell_row, &widths));
    }
    lines.push(format!("row count: {}", rows.len()));
    lines.join("\n")
}

/// Writes one value of a row as text, on one line.
fn format_cell(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => "NULL".to_string(),
        Some(Value::String(text)) => text.replace("\r\n", " ").replace('\n', " "),
        Some(Value::Number(number)) if number.is_f64() => number.as_f64().unwrap_or_default().to_string(),
        Some(other) => other.to_string(),
    }
}

/// Joins the cells of one line, each cell padded to the width of its column, without spaces at the end of the line.
fn join_line(cells: &[String], widths: &[usize]) -> String {
    let padded_cells: Vec<String> =
        cells.iter().zip(widths).map(|(cell, width)| format!("{cell:<width$}", width = *width)).collect();
    padded_cells.join("  ").trim_end().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A row built from a JSON object.
    fn row(value: Value) -> QueryRow {
        value.as_object().unwrap().clone()
    }

    #[test]
    fn writes_the_column_names_a_line_of_dashes_one_line_for_each_row_and_the_row_count() {
        let text = to_table(&[row(json!({ "number": 2, "title": "Second" })), row(json!({ "number": 10, "title": "Tenth" }))]);
        assert_eq!(
            text,
            ["number  title", "------  ------", "2       Second", "10      Tenth", "row count: 2"].join("\n")
        );
    }

    #[test]
    fn writes_null_for_a_null_value_and_a_space_for_a_new_line_inside_a_value() {
        let text = to_table(&[row(json!({ "a": null, "b": "one\ntwo\r\nthree" }))]);
        assert!(text.contains("NULL"));
        assert!(text.contains("one two three"));
        assert_eq!(text.lines().count(), 4);
    }

    #[test]
    fn writes_a_number_that_has_no_decimal_part_without_the_decimal_part() {
        let text = to_table(&[row(json!({ "hours": 99.0, "count": 3 }))]);
        assert!(text.contains("99  "), "{text}");
        assert!(!text.contains("99.0"));
    }

    #[test]
    fn writes_no_row_when_there_is_no_row() {
        assert_eq!(to_table(&[]), "(no row)");
    }

    #[test]
    fn writes_a_json_list_with_one_object_for_each_row_in_the_order_of_the_columns() {
        let rows = [row(json!({ "number": 1, "title": "First", "closedAt": null }))];
        let text = to_json(&rows);
        assert_eq!(serde_json::from_str::<Value>(&text).unwrap(), json!([{ "number": 1, "title": "First", "closedAt": null }]));
        assert!(text.find("number").unwrap() < text.find("title").unwrap());
        assert!(text.find("title").unwrap() < text.find("closedAt").unwrap());
    }

    #[test]
    fn writes_an_empty_json_list_when_there_is_no_row() {
        assert_eq!(serde_json::from_str::<Value>(&to_json(&[])).unwrap(), json!([]));
    }
}
