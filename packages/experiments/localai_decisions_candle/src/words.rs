//! Splits a text into lower-case words, the way the Python package gliner2 does before it tokenizes the text.

use regex::Regex;
use std::sync::OnceLock;

/// The characters of a word: letters, numbers, underscores, combining marks, and the two joiner characters.
const WORD_CHARACTER: &str = r"[\p{L}\p{N}_\p{M}‌‍]";

/// The characters that Python treats as white space and that the regular expression class `\s` does not cover.
const EXTRA_WHITESPACE: &str = r"\x1c-\x1f";

fn word_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        let non_whitespace = format!(r"[^\s{EXTRA_WHITESPACE}]");
        let pattern = format!(
            r"(?i)(?:https?://{non_whitespace}+|www\.{non_whitespace}+)|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{{2,}}|@[a-z0-9_]+|{WORD_CHARACTER}+(?:[-_]{WORD_CHARACTER}+)*|{non_whitespace}"
        );
        Regex::new(&pattern).expect("the word pattern is a valid regular expression")
    })
}

/// Returns the lower-case words of a text. A word is a web address, an e-mail address, an at-sign handle, a run of
/// word characters that may contain hyphens, or one other character that is not white space.
pub fn split_words(text: &str) -> Vec<String> {
    word_pattern()
        .find_iter(text)
        .map(|word| word.as_str().to_lowercase())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::split_words;

    #[test]
    fn splits_words_and_punctuation() {
        assert_eq!(
            split_words("My subscription renewed on April 15 for ¥5,400?"),
            [
                "my",
                "subscription",
                "renewed",
                "on",
                "april",
                "15",
                "for",
                "¥",
                "5",
                ",",
                "400",
                "?"
            ]
        );
    }

    #[test]
    fn keeps_hyphenated_and_underscored_words_together() {
        assert_eq!(
            split_words("e-mail well_known x-"),
            ["e-mail", "well_known", "x", "-"]
        );
    }

    #[test]
    fn keeps_web_addresses_and_e_mail_addresses_and_handles() {
        assert_eq!(
            split_words(
                "See https://Example.com/A?b=1 or www.Test.org, mail Bob@Example.COM and @Alice_9"
            ),
            [
                "see",
                "https://example.com/a?b=1",
                "or",
                "www.test.org,",
                "mail",
                "bob@example.com",
                "and",
                "@alice_9"
            ]
        );
    }

    #[test]
    fn keeps_accented_letters_and_combining_marks() {
        assert_eq!(split_words("Élève déjà"), ["élève", "déjà"]);
        assert_eq!(split_words("e\u{301}te\u{301}"), ["e\u{301}te\u{301}"]);
    }

    #[test]
    fn treats_control_separators_as_white_space() {
        assert_eq!(split_words("a\u{1f}b"), ["a", "b"]);
    }

    #[test]
    fn returns_nothing_for_white_space() {
        assert!(split_words(" \n\t ").is_empty());
    }
}
