//! Checks a chat session, a memory file, a subagent, and a skill against their JSON schemas. The files of the folder `schemas`
//! are the only place that says which facts the column `data` of each table stores. The program holds the files inside, so it
//! needs no file at run time.

use crate::model::configuration_types::{ConfigurationItem, ConfigurationKind};
use crate::model::types::ChatSession;
use jsonschema::Validator;
use serde_json::Value;
use std::sync::OnceLock;

/// The text of the file `schemas/chat_session.schema.json`.
pub const CHAT_SESSION_SCHEMA: &str = include_str!("../../schemas/chat_session.schema.json");

/// The text of the file `schemas/memory_file.schema.json`.
pub const MEMORY_FILE_SCHEMA: &str = include_str!("../../schemas/memory_file.schema.json");

/// The text of the file `schemas/subagent.schema.json`.
pub const SUBAGENT_SCHEMA: &str = include_str!("../../schemas/subagent.schema.json");

/// The text of the file `schemas/skill.schema.json`.
pub const SKILL_SCHEMA: &str = include_str!("../../schemas/skill.schema.json");

/// The compiled check of a chat session. It is built at the first use.
static CHAT_SESSION_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// The compiled check of a memory file. It is built at the first use.
static MEMORY_FILE_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// The compiled check of a subagent. It is built at the first use.
static SUBAGENT_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// The compiled check of a skill. It is built at the first use.
static SKILL_VALIDATOR: OnceLock<Validator> = OnceLock::new();

/// The text of the JSON schema of the column `data` of the table of a kind of configuration item.
pub fn configuration_schema(kind: ConfigurationKind) -> &'static str {
    match kind {
        ConfigurationKind::MemoryFile => MEMORY_FILE_SCHEMA,
        ConfigurationKind::Subagent => SUBAGENT_SCHEMA,
        ConfigurationKind::Skill => SKILL_SCHEMA,
    }
}

/// Lists each problem of a JSON value that a check refuses.
fn find_problems(validator: &Validator, value: &Value) -> Vec<String> {
    validator
        .iter_errors(value)
        .map(|error| {
            let place = error.instance_path().to_string();
            let place = if place.is_empty() { "(root)".to_string() } else { place };
            format!("{place} {error}")
        })
        .collect()
}

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
    let problems = find_problems(validator, value);
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

/// Checks that a JSON value is a configuration item of a kind that follows the JSON schema of the kind.
///
/// # Errors
/// An error that lists each problem when the value does not follow the JSON schema.
pub fn validate_configuration_value(kind: ConfigurationKind, value: &Value) -> Result<(), String> {
    let validator = match kind {
        ConfigurationKind::MemoryFile => MEMORY_FILE_VALIDATOR.get_or_init(|| compile(MEMORY_FILE_SCHEMA)),
        ConfigurationKind::Subagent => SUBAGENT_VALIDATOR.get_or_init(|| compile(SUBAGENT_SCHEMA)),
        ConfigurationKind::Skill => SKILL_VALIDATOR.get_or_init(|| compile(SKILL_SCHEMA)),
    };
    let problems = find_problems(validator, value);
    if problems.is_empty() {
        return Ok(());
    }
    Err(format!("The {} does not follow its JSON schema: {}", kind.description(), problems.join("; ")))
}

/// Checks a configuration item against the JSON schema of its kind, and gives its JSON value.
///
/// # Errors
/// An error that lists each problem when the item does not follow the JSON schema, for example a subagent with a field
/// `memoryType`.
pub fn configuration_item_to_checked_value(kind: ConfigurationKind, item: &ConfigurationItem) -> Result<Value, String> {
    let value = serde_json::to_value(item)
        .map_err(|error| format!("The {} {} cannot become JSON: {error}", kind.description(), item.id))?;
    validate_configuration_value(kind, &value)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{chat_session, configuration_item};
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

    #[test]
    fn accepts_a_sample_of_each_kind_of_configuration_item() {
        for kind in ConfigurationKind::ALL {
            let item = configuration_item(kind, "/work/app/.claude/a.md");
            assert!(configuration_item_to_checked_value(kind, &item).is_ok(), "{}", kind.table_name());
        }
    }

    #[test]
    fn refuses_the_fields_of_a_memory_file_on_a_subagent_and_a_skill() {
        let mut item = configuration_item(ConfigurationKind::Subagent, "/work/app/.claude/agents/a.md");
        item.memory_type = Some("feedback".into());
        assert!(configuration_item_to_checked_value(ConfigurationKind::Subagent, &item).unwrap_err().contains("memoryType"));
        let mut item = configuration_item(ConfigurationKind::Skill, "/work/app/.claude/skills/a");
        item.origin_chat_session_id = Some("abc".into());
        assert!(configuration_item_to_checked_value(ConfigurationKind::Skill, &item).unwrap_err().contains("originChatSessionId"));
    }

    #[test]
    fn refuses_a_memory_file_of_codex_a_wrong_date_and_an_empty_name() {
        let mut item = configuration_item(ConfigurationKind::MemoryFile, "/memory/a.md");
        item.coding_agent = Some(crate::model::types::CodingAgent::Codex);
        assert!(configuration_item_to_checked_value(ConfigurationKind::MemoryFile, &item).is_err());
        let mut value = serde_json::to_value(configuration_item(ConfigurationKind::Skill, "/a")).unwrap();
        value["removedAt"] = json!("yesterday");
        assert!(validate_configuration_value(ConfigurationKind::Skill, &value).unwrap_err().contains("/removedAt"));
        value["removedAt"] = Value::Null;
        value["name"] = json!("");
        assert!(validate_configuration_value(ConfigurationKind::Skill, &value).unwrap_err().contains("/name"));
    }
}
