//! Checks an issue and a pull request against their JSON schema. The two files of the folder `schemas` are the only place that
//! says which fields the database stores. The program holds them inside, so it needs no file at run time.

use crate::model::types::{Issue, PullRequest};
use jsonschema::Validator;
use serde_json::Value;
use std::sync::OnceLock;

/// The text of the file `schemas/issue.schema.json`.
const ISSUE_SCHEMA: &str = include_str!("../../schemas/issue.schema.json");

/// The text of the file `schemas/pull_request.schema.json`.
const PULL_REQUEST_SCHEMA: &str = include_str!("../../schemas/pull_request.schema.json");

/// The compiled check of an issue. It is built at the first use.
static ISSUE_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// The compiled check of a pull request. It is built at the first use.
static PULL_REQUEST_VALIDATOR: OnceLock<Validator> = OnceLock::new();

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

/// Checks that a JSON value is an issue that follows the file `schemas/issue.schema.json`.
///
/// # Errors
/// An error that lists each problem when the value does not follow the JSON schema.
pub fn validate_issue_value(value: &Value) -> Result<(), String> {
    check(ISSUE_VALIDATOR.get_or_init(|| compile(ISSUE_SCHEMA)), value, "issue")
}

/// Checks that a JSON value is a pull request that follows the file `schemas/pull_request.schema.json`.
///
/// # Errors
/// An error that lists each problem when the value does not follow the JSON schema.
pub fn validate_pull_request_value(value: &Value) -> Result<(), String> {
    check(PULL_REQUEST_VALIDATOR.get_or_init(|| compile(PULL_REQUEST_SCHEMA)), value, "pull request")
}

/// Checks an issue against the file `schemas/issue.schema.json`, and gives its JSON value.
///
/// # Errors
/// An error that lists each problem when the issue does not follow the JSON schema, for example a date that is not a date.
pub fn issue_to_checked_value(issue: &Issue) -> Result<Value, String> {
    let value = serde_json::to_value(issue).map_err(|error| format!("The issue cannot become JSON: {error}"))?;
    validate_issue_value(&value)?;
    Ok(value)
}

/// Checks a pull request against the file `schemas/pull_request.schema.json`, and gives its JSON value.
///
/// # Errors
/// An error that lists each problem when the pull request does not follow the JSON schema.
pub fn pull_request_to_checked_value(pull_request: &PullRequest) -> Result<Value, String> {
    let value =
        serde_json::to_value(pull_request).map_err(|error| format!("The pull request cannot become JSON: {error}"))?;
    validate_pull_request_value(&value)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{issue, pull_request};
    use serde_json::json;

    /// The JSON value of a sample issue.
    fn issue_value() -> Value {
        serde_json::to_value(issue(1)).unwrap()
    }

    /// The JSON value of a sample pull request.
    fn pull_request_value() -> Value {
        serde_json::to_value(pull_request(1)).unwrap()
    }

    #[test]
    fn accepts_an_issue_that_follows_the_json_schema() {
        assert_eq!(validate_issue_value(&issue_value()), Ok(()));
    }

    #[test]
    fn accepts_an_open_issue_with_no_close_date_no_reason_and_no_author() {
        let mut value = issue_value();
        value["state"] = json!("OPEN");
        value["stateReason"] = Value::Null;
        value["closedAt"] = Value::Null;
        value["author"] = Value::Null;
        assert_eq!(validate_issue_value(&value), Ok(()));
    }

    #[test]
    fn rejects_an_issue_with_a_missing_field() {
        let mut value = issue_value();
        value.as_object_mut().unwrap().remove("body");
        assert!(validate_issue_value(&value).unwrap_err().contains("body"));
    }

    #[test]
    fn rejects_an_issue_with_a_field_that_the_json_schema_does_not_know() {
        let mut value = issue_value();
        value["milestone"] = json!("v1");
        assert!(validate_issue_value(&value).unwrap_err().contains("milestone"));
    }

    #[test]
    fn rejects_an_issue_with_a_wrong_state() {
        let mut value = issue_value();
        value["state"] = json!("MERGED");
        assert!(validate_issue_value(&value).unwrap_err().contains("/state"));
    }

    #[test]
    fn rejects_an_issue_with_a_date_that_is_not_a_date() {
        let mut value = issue_value();
        value["createdAt"] = json!("yesterday");
        assert!(validate_issue_value(&value).unwrap_err().contains("/createdAt"));
    }

    #[test]
    fn rejects_an_issue_with_the_number_0_and_a_negative_number_of_comments() {
        let mut value = issue_value();
        value["number"] = json!(0);
        value["commentCount"] = json!(-1);
        let message = validate_issue_value(&value).unwrap_err();
        assert!(message.contains("/number"));
        assert!(message.contains("/commentCount"));
    }

    #[test]
    fn accepts_a_pull_request_that_follows_the_json_schema() {
        assert_eq!(validate_pull_request_value(&pull_request_value()), Ok(()));
    }

    #[test]
    fn accepts_an_open_pull_request_that_is_not_merged() {
        let mut value = pull_request_value();
        value["state"] = json!("OPEN");
        value["isDraft"] = json!(true);
        for field in ["mergedBy", "mergeCommit", "closedAt", "mergedAt"] {
            value[field] = Value::Null;
        }
        assert_eq!(validate_pull_request_value(&value), Ok(()));
    }

    #[test]
    fn rejects_a_pull_request_with_a_missing_field() {
        let mut value = pull_request_value();
        value.as_object_mut().unwrap().remove("commitCount");
        assert!(validate_pull_request_value(&value).unwrap_err().contains("commitCount"));
    }

    #[test]
    fn rejects_a_pull_request_with_a_wrong_state() {
        let mut value = pull_request_value();
        value["state"] = json!("CLOSING");
        assert!(validate_pull_request_value(&value).unwrap_err().contains("/state"));
    }

    #[test]
    fn rejects_a_pull_request_with_a_labels_field_that_is_not_a_list_of_names() {
        let mut value = pull_request_value();
        value["labels"] = json!([{ "name": "bug" }]);
        assert!(validate_pull_request_value(&value).unwrap_err().contains("/labels"));
    }
}
