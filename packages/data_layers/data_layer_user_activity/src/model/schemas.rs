//! Checks a user activity record against its JSON schema. The file `schemas/user_activity_record.schema.json` is the only
//! place that says which fields the database stores. The program holds it inside, so it needs no file at run time.

use crate::model::types::UserActivityRecord;
use jsonschema::Validator;
use serde_json::Value;
use std::sync::OnceLock;

/// The text of the file `schemas/user_activity_record.schema.json`.
const USER_ACTIVITY_RECORD_SCHEMA: &str = include_str!("../../schemas/user_activity_record.schema.json");

/// The compiled check of a user activity record. It is built at the first use.
static USER_ACTIVITY_RECORD_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// Compiles the text of a JSON schema file into a check. The times must follow the format `date-time`.
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

/// Checks that a JSON value is a user activity record that follows the file `schemas/user_activity_record.schema.json`.
///
/// # Errors
/// An error that lists each problem when the value does not follow the JSON schema.
pub fn validate_user_activity_record_value(value: &Value) -> Result<(), String> {
    check(
        USER_ACTIVITY_RECORD_VALIDATOR.get_or_init(|| compile(USER_ACTIVITY_RECORD_SCHEMA)),
        value,
        "user activity record",
    )
}

/// Checks a user activity record against the file `schemas/user_activity_record.schema.json`, and gives its JSON value.
///
/// # Errors
/// An error that lists each problem when the record does not follow the JSON schema, for example a time that is not a time.
pub fn record_to_checked_value(record: &UserActivityRecord) -> Result<Value, String> {
    let value = serde_json::to_value(record)
        .map_err(|error| format!("The user activity record cannot become JSON: {error}"))?;
    validate_user_activity_record_value(&value)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::record;
    use serde_json::json;

    /// The JSON value of a sample record.
    fn record_value() -> Value {
        serde_json::to_value(record(1)).unwrap()
    }

    #[test]
    fn accepts_a_record_that_follows_the_json_schema() {
        assert_eq!(validate_user_activity_record_value(&record_value()), Ok(()));
    }

    #[test]
    fn accepts_each_of_the_four_end_reasons() {
        for end_reason in ["cool_down", "window_behind", "workspace_changed", "app_closed"] {
            let mut value = record_value();
            value["endReason"] = json!(end_reason);
            assert_eq!(validate_user_activity_record_value(&value), Ok(()), "{end_reason}");
        }
    }

    #[test]
    fn accepts_a_time_with_a_time_zone_offset_and_a_count_of_zero() {
        let mut value = record_value();
        value["startedAt"] = json!("2026-10-14T19:52:03.412+02:00");
        value["keyboardActionCount"] = json!(0);
        assert_eq!(validate_user_activity_record_value(&value), Ok(()));
    }

    #[test]
    fn rejects_a_record_with_a_missing_field() {
        let mut value = record_value();
        value.as_object_mut().unwrap().remove("endReason");
        assert!(validate_user_activity_record_value(&value).unwrap_err().contains("endReason"));
    }

    #[test]
    fn rejects_a_record_with_a_field_that_the_json_schema_does_not_know() {
        let mut value = record_value();
        value["typedText"] = json!("secret");
        assert!(validate_user_activity_record_value(&value).unwrap_err().contains("typedText"));
    }

    #[test]
    fn rejects_a_record_with_a_time_that_is_not_a_time() {
        let mut value = record_value();
        value["endedAt"] = json!("yesterday");
        assert!(validate_user_activity_record_value(&value).unwrap_err().contains("/endedAt"));
    }

    #[test]
    fn rejects_a_record_with_a_time_that_is_a_number() {
        let mut value = record_value();
        value["startedAt"] = json!(1_791_979_200_000_i64);
        assert!(validate_user_activity_record_value(&value).unwrap_err().contains("/startedAt"));
    }

    #[test]
    fn rejects_a_record_with_a_negative_or_fractional_count() {
        let mut value = record_value();
        value["keyboardActionCount"] = json!(-1);
        value["mouseActionCount"] = json!(1.5);
        let message = validate_user_activity_record_value(&value).unwrap_err();
        assert!(message.contains("/keyboardActionCount"));
        assert!(message.contains("/mouseActionCount"));
    }

    #[test]
    fn rejects_a_record_with_an_end_reason_that_the_json_schema_does_not_know() {
        let mut value = record_value();
        value["endReason"] = json!("lunch");
        assert!(validate_user_activity_record_value(&value).unwrap_err().contains("/endReason"));
    }

    #[test]
    fn rejects_a_value_that_is_not_an_object() {
        assert!(validate_user_activity_record_value(&json!("text")).unwrap_err().contains("(root)"));
        assert!(validate_user_activity_record_value(&json!([])).is_err());
    }
}
