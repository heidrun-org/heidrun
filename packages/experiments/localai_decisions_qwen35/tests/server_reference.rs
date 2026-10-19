//! Compares the answers of the package with the answers of the server of llama.cpp v0.6.0 on the same
//! requests, with Kev-0.8B. The server results are in tests/fixtures/server_reference.json.

use localai_decisions_qwen35::{DecisionConfig, DecisionEngine};
use serde_json::Value;

/// The package and the server run the same llama.cpp code on the processor, so the results are equal on
/// the computer that wrote the fixture; the tolerance leaves room for the last digits of another processor.
const TOLERANCE: f64 = 0.000001;

fn fixture(name: &str) -> Value {
    let path = format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

fn compare(path: &str, package: &Value, server: &Value, largest: &mut f64) {
    match (package, server) {
        (Value::Object(a), Value::Object(b)) => {
            let keys_a: Vec<&String> = a.keys().collect();
            let keys_b: Vec<&String> = b.keys().collect();
            assert_eq!(keys_a, keys_b, "{path}: the keys differ");
            for key in keys_b {
                compare(&format!("{path}.{key}"), &a[key], &b[key], largest);
            }
        }
        (Value::Number(a), Value::Number(b)) => {
            let difference = (a.as_f64().unwrap() - b.as_f64().unwrap()).abs();
            *largest = largest.max(difference);
            assert!(difference <= TOLERANCE, "{path}: {a} differs from the server value {b}");
        }
        _ => assert_eq!(package, server, "{path}"),
    }
}

#[test]
fn answers_are_equal_to_the_server_answers() {
    let engine = DecisionEngine::load(DecisionConfig::default()).expect("the model Kev-0.8B");
    let reference = fixture("server_reference.json");
    let requests = fixture("requests.json");
    let mut largest = 0.0f64;
    for (item, expected) in requests.as_array().unwrap().iter().zip(reference["results"].as_array().unwrap()) {
        assert_eq!(item["name"], expected["name"]);
        let name = item["name"].as_str().unwrap();
        let response = engine.decide(&item["request"]).unwrap();
        assert_eq!(response["usage"], expected["usage"], "{name}: the number of prompt tokens differs");
        compare(name, &response["answers"], &expected["answers"], &mut largest);
    }
    println!("largest difference with the server: {largest:e}");
}
