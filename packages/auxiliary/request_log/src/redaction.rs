//! What the log never holds: a credential, an authentication token, and the text of a source.
//!
//! A package builds the parameters of a request from a short list of fields that it chooses, so the text of a conversation
//! never enters a parameter. This module is the second protection: every text goes through `redact_text` before it is
//! written, and a field whose name says that it holds a secret is replaced as a whole.

use serde_json::{Map, Value};

/// The text that replaces a secret.
pub const REDACTED: &str = "[redacted]";

/// The longest text of a parameter that the log keeps, in characters. A longer text is cut, and the parameter
/// `<name>Truncated` says so.
pub const MAX_TEXT_CHARACTERS: usize = 4096;

/// The words in the name of a field or of a variable that say it holds a secret.
const SECRET_NAMES: [&str; 9] =
    ["password", "passwd", "secret", "token", "apikey", "api_key", "authorization", "credential", "cookie"];

/// The beginnings of a word that is a token of a service, and the shortest length of such a token.
const SECRET_PREFIXES: [(&str, usize); 10] = [
    ("ghp_", 20),
    ("gho_", 20),
    ("ghu_", 20),
    ("ghs_", 20),
    ("ghr_", 20),
    ("github_pat_", 20),
    ("glpat-", 16),
    ("sk-", 20),
    ("xox", 20),
    ("AKIA", 20),
];

/// The characters that end a word: the white space, the quotes, and the signs of a list.
fn is_boundary(character: char) -> bool {
    character.is_whitespace() || matches!(character, '\'' | '"' | '`' | '(' | ')' | ',' | ';' | '[' | ']' | '{' | '}')
}

/// True when a name says that its value is a secret.
pub fn is_secret_name(name: &str) -> bool {
    let lowercase = name.to_lowercase();
    SECRET_NAMES.iter().any(|word| lowercase.contains(word))
}

/// True when a word is a token of a service or a JSON web token.
fn is_secret_word(word: &str) -> bool {
    let word = word.trim_end_matches(|character: char| character.is_ascii_punctuation() && character != '_' && character != '-');
    if SECRET_PREFIXES.iter().any(|(prefix, length)| word.starts_with(prefix) && word.len() >= *length) {
        return true;
    }
    word.starts_with("eyJ") && word.len() >= 40 && word.matches('.').count() == 2
}

/// The word with the password of a web address replaced, or the word itself when it holds none: `https://user:pass@host`.
fn without_address_password(word: &str) -> Option<String> {
    let scheme_end = word.find("://")? + 3;
    let rest = &word[scheme_end..];
    let at = rest.find('@')?;
    let authority = &rest[..at];
    if authority.contains('/') {
        return None;
    }
    let colon = authority.find(':')?;
    Some(format!("{}{}:{}{}", &word[..scheme_end], &authority[..colon], REDACTED, &rest[at..]))
}

/// The text with every secret replaced by `[redacted]`: a token of a service, a word after `Bearer`, the value of
/// `password=value` and of `token: value`, and the password of a web address.
pub fn redact_text(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut word = String::new();
    let mut previous: Vec<String> = Vec::new();
    let flush = |word: &mut String, result: &mut String, previous: &mut Vec<String>| {
        if word.is_empty() {
            return;
        }
        let is_after_bearer = previous.last().is_some_and(|last| matches!(last.to_lowercase().as_str(), "bearer" | "basic"));
        let is_after_separate_separator = previous.len() >= 2
            && matches!(previous[previous.len() - 1].as_str(), "=" | ":")
            && is_secret_name(&previous[previous.len() - 2]);
        let is_after_name_with_separator = previous
            .last()
            .is_some_and(|last| last.ends_with(['=', ':']) && is_secret_name(last.trim_end_matches(['=', ':'])));
        let is_after_secret_name = is_after_separate_separator || is_after_name_with_separator;
        let is_scheme = matches!(word.to_lowercase().as_str(), "bearer" | "basic");
        let replaced = if is_scheme {
            word.clone()
        } else if is_secret_word(word) || is_after_bearer || is_after_secret_name {
            REDACTED.to_string()
        } else if let Some(address) = without_address_password(word) {
            address
        } else if let Some(separator) = word.find(['=', ':']).filter(|position| *position > 0 && is_secret_name(&word[..*position])) {
            let value_start = separator + 1;
            if word[value_start..].is_empty() { word.clone() } else { format!("{}{}", &word[..value_start], REDACTED) }
        } else {
            word.clone()
        };
        previous.push(word.clone());
        if previous.len() > 2 {
            previous.remove(0);
        }
        result.push_str(&replaced);
        word.clear();
    };
    for character in text.chars() {
        if is_boundary(character) {
            flush(&mut word, &mut result, &mut previous);
            result.push(character);
        } else {
            word.push(character);
        }
    }
    flush(&mut word, &mut result, &mut previous);
    result
}

/// The text cut to `MAX_TEXT_CHARACTERS` characters. The second value is true when the text was cut.
pub fn truncate_text(text: &str) -> (String, bool) {
    match text.char_indices().nth(MAX_TEXT_CHARACTERS) {
        Some((index, _)) => (text[..index].to_string(), true),
        None => (text.to_string(), false),
    }
}

/// The value with every text redacted and cut, and every field whose name says it holds a secret replaced. The value is
/// copied, never changed.
pub fn redact_value(value: &Value) -> Value {
    match value {
        Value::String(text) => Value::String(truncate_text(&redact_text(text)).0),
        Value::Array(items) => Value::Array(items.iter().map(redact_value).collect()),
        Value::Object(fields) => {
            let mut redacted = Map::new();
            for (name, field) in fields {
                if is_secret_name(name) {
                    redacted.insert(name.clone(), Value::String(REDACTED.to_string()));
                } else {
                    redacted.insert(name.clone(), redact_value(field));
                }
            }
            Value::Object(redacted)
        }
        other => other.clone(),
    }
}

/// The SQL statement without its values: a text between quotes and a number become `?`, the white space becomes one space.
/// Two statements that ask for the same thing about other values give the same text, so a summary can count them together.
pub fn normalize_sql(sql: &str) -> String {
    let characters: Vec<char> = sql.chars().collect();
    let mut result = String::with_capacity(sql.len());
    let mut index = 0;
    while index < characters.len() {
        let character = characters[index];
        if character == '\'' {
            index += 1;
            while index < characters.len() {
                if characters[index] == '\'' {
                    if characters.get(index + 1) == Some(&'\'') {
                        index += 2;
                        continue;
                    }
                    break;
                }
                index += 1;
            }
            index += 1;
            result.push('?');
        } else if character.is_ascii_digit() && result.ends_with(|last: char| last.is_alphanumeric() || last == '_') == false {
            while index < characters.len() && (characters[index].is_ascii_digit() || characters[index] == '.') {
                index += 1;
            }
            result.push('?');
        } else if character.is_whitespace() {
            if result.ends_with(' ') == false && result.is_empty() == false {
                result.push(' ');
            }
            index += 1;
        } else {
            result.push(character);
            index += 1;
        }
    }
    result.trim_end().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_token_of_a_service_is_replaced() {
        let text = "select 1 where token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' and x = 1";
        let redacted = redact_text(text);
        assert!(redacted.contains("ghp_") == false, "{redacted}");
        assert!(redacted.contains(REDACTED));
        assert!(redacted.contains("and x = 1"));
    }

    #[test]
    fn a_key_of_a_model_provider_is_replaced() {
        let redacted = redact_text("sk-ant-api03-abcdefghijklmnopqrstuvwxyz and AKIAABCDEFGHIJKLMNOP");
        assert_eq!(redacted, "[redacted] and [redacted]");
    }

    #[test]
    fn the_word_after_bearer_is_replaced() {
        assert_eq!(redact_text("Authorization: Bearer abc.def.ghi"), "Authorization: Bearer [redacted]");
    }

    #[test]
    fn the_value_of_a_secret_name_is_replaced_in_each_written_form() {
        assert_eq!(redact_text("password=hunter2"), "password=[redacted]");
        assert_eq!(redact_text("API_KEY: hunter2"), "API_KEY: [redacted]");
        assert_eq!(redact_text("secret = hunter2 and name = Jerome"), "secret = [redacted] and name = Jerome");
    }

    #[test]
    fn the_password_of_a_web_address_is_replaced_and_the_rest_stays() {
        assert_eq!(redact_text("https://jerome:hunter2@github.com/heidrun-org/heidrun"), "https://jerome:[redacted]@github.com/heidrun-org/heidrun");
        assert_eq!(redact_text("https://github.com/heidrun-org/heidrun"), "https://github.com/heidrun-org/heidrun");
    }

    #[test]
    fn a_commit_hash_and_a_plain_statement_stay() {
        let text = "select * from commits where hash = 'f4b2c3d4e5f60718293a4b5c6d7e8f9012345678' order by committedAt desc";
        assert_eq!(redact_text(text), text);
    }

    #[test]
    fn a_field_with_a_secret_name_is_replaced_as_a_whole_in_a_nested_value() {
        let value = serde_json::json!({ "repository": "a/b", "options": { "githubToken": "plain", "limit": 10 } });
        let redacted = redact_value(&value);
        assert_eq!(redacted["options"]["githubToken"], REDACTED);
        assert_eq!(redacted["options"]["limit"], 10);
        assert_eq!(redacted["repository"], "a/b");
        assert_eq!(value["options"]["githubToken"], "plain");
    }

    #[test]
    fn a_long_text_is_cut_on_a_character_boundary() {
        let text = "é".repeat(MAX_TEXT_CHARACTERS + 10);
        let (cut, is_cut) = truncate_text(&text);
        assert!(is_cut);
        assert_eq!(cut.chars().count(), MAX_TEXT_CHARACTERS);
        assert_eq!(truncate_text("short"), ("short".to_string(), false));
    }

    #[test]
    fn a_statement_loses_its_values_and_its_extra_white_space() {
        let sql = "SELECT json_extract(data, '$.title')\n  FROM commits WHERE repository = 'a/b''c' AND committedAt > 20260101 LIMIT 50";
        assert_eq!(
            normalize_sql(sql),
            "SELECT json_extract(data, ?) FROM commits WHERE repository = ? AND committedAt > ? LIMIT ?"
        );
    }

    #[test]
    fn a_digit_inside_a_name_stays() {
        assert_eq!(normalize_sql("select a1, table_2 from t3 where x = 4.5"), "select a1, table_2 from t3 where x = ?");
    }
}
