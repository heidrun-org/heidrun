//! Checks a commit against its JSON schema. The file `schemas/commit.schema.json` is the only place that says which fields the
//! database stores. The program holds it inside, so it needs no file at run time.

use crate::model::types::Commit;
use jsonschema::Validator;
use serde_json::Value;
use std::sync::OnceLock;

/// The text of the file `schemas/commit.schema.json`.
const COMMIT_SCHEMA: &str = include_str!("../../schemas/commit.schema.json");

/// The compiled check of a commit. It is built at the first use.
static COMMIT_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// Compiles the text of a JSON schema file into a check. The dates must follow the format `date-time`.
fn compile(schema_text: &str) -> Validator {
    let schema: Value = serde_json::from_str(schema_text).expect("A JSON schema file of the package is not valid JSON");
    jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .expect("A JSON schema file of the package is not a valid JSON schema")
}

/// Runs a compiled check, and lists each problem in the error.
fn check(validator: &Validator, value: &Value, label: &str) -> Result<(), String> {
    let problems: Vec<String> = validator
        .iter_errors(value)
        .map(|error| {
            let place = error.instance_path().to_string();
            let place = if place.is_empty() { "(root)".to_string() } else { place };
            format!("{place} {error}")
        })
        .collect();
    if problems.is_empty() {
        return Ok(());
    }
    Err(format!("The {label} does not follow its JSON schema: {}", problems.join("; ")))
}

/// Checks that a JSON value is a commit that follows the file `schemas/commit.schema.json`.
///
/// # Errors
/// An error that lists each problem when the value does not follow the JSON schema.
pub fn validate_commit_value(value: &Value) -> Result<(), String> {
    check(COMMIT_VALIDATOR.get_or_init(|| compile(COMMIT_SCHEMA)), value, "commit")
}

/// Checks a commit against the file `schemas/commit.schema.json`, and gives its JSON value.
///
/// # Errors
/// An error that lists each problem when the commit does not follow the JSON schema, for example a date that is not a date.
pub fn commit_to_checked_value(commit: &Commit) -> Result<Value, String> {
    let value = serde_json::to_value(commit).map_err(|error| format!("The commit cannot become JSON: {error}"))?;
    validate_commit_value(&value)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{commit, merge_commit};
    use serde_json::json;

    /// The JSON value of a sample commit.
    fn commit_value() -> Value {
        serde_json::to_value(commit(1)).unwrap()
    }

    #[test]
    fn accepts_a_commit_that_follows_the_json_schema() {
        assert_eq!(validate_commit_value(&commit_value()), Ok(()));
    }

    #[test]
    fn accepts_the_first_commit_with_no_parent_and_a_merge_with_two_parents() {
        let mut first_commit = commit_value();
        first_commit["parents"] = json!([]);
        assert_eq!(validate_commit_value(&first_commit), Ok(()));
        assert_eq!(validate_commit_value(&serde_json::to_value(merge_commit(3, 1, 2)).unwrap()), Ok(()));
    }

    #[test]
    fn accepts_a_commit_with_an_empty_body() {
        let mut value = commit_value();
        value["body"] = json!("");
        assert_eq!(validate_commit_value(&value), Ok(()));
    }

    #[test]
    fn rejects_a_commit_with_a_missing_field() {
        let mut value = commit_value();
        value.as_object_mut().unwrap().remove("body");
        assert!(validate_commit_value(&value).unwrap_err().contains("body"));
    }

    #[test]
    fn rejects_a_commit_with_a_field_that_the_json_schema_does_not_know() {
        let mut value = commit_value();
        value["branch"] = json!("main");
        assert!(validate_commit_value(&value).unwrap_err().contains("branch"));
    }

    #[test]
    fn rejects_a_commit_with_a_hash_that_is_not_a_hash() {
        let mut value = commit_value();
        value["hash"] = json!("not-a-hash");
        value["parents"] = json!(["1234"]);
        let message = validate_commit_value(&value).unwrap_err();
        assert!(message.contains("/hash"));
        assert!(message.contains("/parents/0"));
    }

    #[test]
    fn rejects_a_commit_with_a_date_that_is_not_a_date() {
        let mut value = commit_value();
        value["committedAt"] = json!("yesterday");
        assert!(validate_commit_value(&value).unwrap_err().contains("/committedAt"));
    }

    #[test]
    fn rejects_a_commit_with_a_negative_number_of_lines() {
        let mut value = commit_value();
        value["insertions"] = json!(-1);
        assert!(validate_commit_value(&value).unwrap_err().contains("/insertions"));
    }
}
