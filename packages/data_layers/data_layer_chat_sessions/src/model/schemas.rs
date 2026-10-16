//! Checks a chat session against its JSON schema. The file `schemas/chat_session.schema.json` is the only place that says which
//! facts the column `data` stores. The program holds the file inside, so it needs no file at run time.

use crate::model::types::ChatSession;
use jsonschema::Validator;
use serde_json::Value;
use std::sync::OnceLock;

/// The text of the file `schemas/chat_session.schema.json`.
pub const CHAT_SESSION_SCHEMA: &str = include_str!("../../schemas/chat_session.schema.json");

/// The compiled check of a chat session. It is built at the first use.
static CHAT_SESSION_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// Compiles the text of a JSON schema file into a check. The dates must follow the format `date-time`.
fn compile(schema_text: &str) -> Validator {
    let schema: Value = serde_json::from_str(schema_text).expect("A JSON schema file of the package is not valid JSON");
    jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .expect("A JSON schema file of the package is not a valid JSON schema")
}

/// Checks that a JSON value is a chat session that follows the file `schemas/chat_session.schema.json`.
///
/// # Errors
/// An error that lists each problem when the value does not follow the JSON schema.
pub fn validate_chat_session_value(value: &Value) -> Result<(), String> {
    let validator = CHAT_SESSION_VALIDATOR.get_or_init(|| compile(CHAT_SESSION_SCHEMA));
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
    Err(format!("The chat session does not follow its JSON schema: {}", problems.join("; ")))
}

/// Checks a chat session against the file `schemas/chat_session.schema.json`, and gives its JSON value.
///
/// # Errors
/// An error that lists each problem when the chat session does not follow the JSON schema, for example a date that is not a
/// date.
pub fn chat_session_to_checked_value(chat_session: &ChatSession) -> Result<Value, String> {
    let value = serde_json::to_value(chat_session)
        .map_err(|error| format!("The chat session cannot become JSON: {error}"))?;
    validate_chat_session_value(&value)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::chat_session;
    use serde_json::json;

    /// The JSON value of a sample chat session.
    fn sample_value() -> Value {
        serde_json::to_value(chat_session("a")).unwrap()
    }

    #[test]
    fn accepts_a_sample_chat_session() {
        assert_eq!(chat_session_to_checked_value(&chat_session("a")), Ok(sample_value()));
    }

    #[test]
    fn accepts_a_chat_session_without_dated_records_and_without_tokens() {
        let mut value = sample_value();
        value["firstRecordAt"] = Value::Null;
        value["lastRecordAt"] = Value::Null;
        value["tokens"] = json!([]);
        assert_eq!(validate_chat_session_value(&value), Ok(()));
    }

    #[test]
    fn refuses_a_missing_field_and_an_extra_field() {
        let mut value = sample_value();
        value.as_object_mut().unwrap().remove("title");
        assert!(validate_chat_session_value(&value).unwrap_err().contains("title"));
        let mut value = sample_value();
        value["cost"] = json!(1.5);
        assert!(validate_chat_session_value(&value).unwrap_err().contains("cost"));
    }

    #[test]
    fn refuses_a_wrong_coding_agent_a_wrong_date_and_a_negative_count() {
        let mut value = sample_value();
        value["codingAgent"] = json!("ANTIGRAVITY");
        assert!(validate_chat_session_value(&value).is_err());
        let mut value = sample_value();
        value["updatedAt"] = json!("yesterday");
        assert!(validate_chat_session_value(&value).unwrap_err().contains("/updatedAt"));
        let mut value = sample_value();
        value["userMessageCount"] = json!(-1);
        assert!(validate_chat_session_value(&value).unwrap_err().contains("/userMessageCount"));
        let mut value = sample_value();
        value["tokens"][0]["output"] = json!(-5);
        assert!(validate_chat_session_value(&value).unwrap_err().contains("/tokens/0/output"));
    }

    #[test]
    fn refuses_an_empty_title_and_an_empty_identifier() {
        let mut value = sample_value();
        value["title"] = json!("");
        assert!(validate_chat_session_value(&value).unwrap_err().contains("/title"));
        let mut value = sample_value();
        value["id"] = json!("");
        assert!(validate_chat_session_value(&value).unwrap_err().contains("/id"));
    }
}
