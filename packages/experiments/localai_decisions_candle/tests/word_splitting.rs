//! Compares the words that `split_words` finds with the words that the Python word splitter of gliner2 found, saved
//! in `tests/fixtures/word_splits.json`. These tests need no model.

use localai_decisions_candle::words::split_words;
use serde_json::Value;

#[test]
fn the_words_equal_the_words_of_python() {
    let path = format!(
        "{}/tests/fixtures/word_splits.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let cases: Vec<Value> =
        serde_json::from_str(&std::fs::read_to_string(&path).expect("the fixture exists"))
            .expect("the fixture is a JSON list");
    assert!(cases.len() > 10);
    for case in cases {
        let text = case["text"].as_str().unwrap();
        let expected: Vec<&str> = case["words"]
            .as_array()
            .unwrap()
            .iter()
            .map(|word| word.as_str().unwrap())
            .collect();
        assert_eq!(split_words(text), expected, "words differ for {text:?}");
    }
}
