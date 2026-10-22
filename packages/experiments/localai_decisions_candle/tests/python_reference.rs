//! Compares the Rust results with the results that the Python package gliner2 saved in
//! `tests/fixtures/python_reference.json`. The first run downloads the model fastino/GLiNER2.5-Decide (1.9 GB).

use localai_decisions_candle::{DecisionConfig, DecisionEngine, DecisionTask};
use serde_json::Value;
use std::sync::OnceLock;

/// The largest difference that is accepted between a logit of Rust and the logit of Python.
const LOGIT_TOLERANCE: f32 = 2e-3;

/// The largest difference that is accepted between a probability of Rust and the probability of Python.
const PROBABILITY_TOLERANCE: f32 = 1e-3;

fn engine() -> &'static DecisionEngine {
    static ENGINE: OnceLock<DecisionEngine> = OnceLock::new();
    ENGINE.get_or_init(|| DecisionEngine::load(DecisionConfig::default()).expect("the model loads"))
}

fn read_fixture(name: &str) -> Vec<Value> {
    let path = format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
    let content = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {path}: {error}"));
    match serde_json::from_str(&content).expect("the fixture is JSON") {
        Value::Array(items) => items,
        _ => panic!("{path} is not a JSON list"),
    }
}

/// Turns the tasks in the Python form of `classify_text` into tasks of this package. The Python form is an object
/// that maps a task name to a list of labels or to an object with `labels`, `multi_label`, `cls_threshold`, `prompt`
/// and `top_k`. `labels` is a list or an object that maps a label to its description.
fn tasks_from_python(tasks: &Value) -> Vec<DecisionTask> {
    tasks
        .as_object()
        .expect("tasks is an object")
        .iter()
        .map(|(name, definition)| {
            let (labels, options) = match definition {
                Value::Array(_) => (definition, None),
                Value::Object(options) => (options.get("labels").expect("labels"), Some(options)),
                _ => panic!("unsupported task definition"),
            };
            let mut task = match labels {
                Value::Array(names) => DecisionTask::new(
                    name.clone(),
                    names
                        .iter()
                        .map(|label| label.as_str().expect("label name").to_string()),
                ),
                Value::Object(described) => {
                    let mut task = DecisionTask::new(name.clone(), described.keys().cloned());
                    for (label, description) in described {
                        task = task
                            .with_description(label, description.as_str().expect("description"));
                    }
                    task
                }
                _ => panic!("unsupported labels"),
            };
            if let Some(options) = options {
                if let Some(prompt) = options.get("prompt") {
                    task = task.with_prompt(prompt.as_str().expect("prompt"));
                }
                if options.get("multi_label").and_then(Value::as_bool) == Some(true) {
                    let threshold = options
                        .get("cls_threshold")
                        .and_then(Value::as_f64)
                        .unwrap_or(0.5) as f32;
                    task = task.with_multi_label(threshold);
                }
                if let Some(top_k) = options.get("top_k").and_then(Value::as_u64) {
                    task = task.with_top_k(top_k as usize);
                }
            }
            task
        })
        .collect()
}

fn examples_and_references() -> Vec<(Value, Value)> {
    let examples = read_fixture("examples.json");
    let references = read_fixture("python_reference.json");
    assert_eq!(examples.len(), references.len());
    examples.into_iter().zip(references).collect()
}

#[test]
fn the_tokens_equal_the_tokens_of_python() {
    for (example, reference) in examples_and_references() {
        let name = example["name"].as_str().unwrap();
        let tasks = tasks_from_python(&example["tasks"]);
        let encoded = engine()
            .encode(example["text"].as_str().unwrap(), &tasks)
            .unwrap();
        let expected: Vec<u32> = reference["input_ids"]
            .as_array()
            .unwrap()
            .iter()
            .map(|id| id.as_u64().unwrap() as u32)
            .collect();
        assert_eq!(
            encoded.input_ids, expected,
            "token identifiers differ for `{name}`"
        );
    }
}

#[test]
fn the_logits_and_probabilities_equal_the_values_of_python() {
    let mut largest_logit_difference = 0f32;
    let mut largest_probability_difference = 0f32;
    for (example, reference) in examples_and_references() {
        let name = example["name"].as_str().unwrap();
        let tasks = tasks_from_python(&example["tasks"]);
        let decisions = engine()
            .decide(example["text"].as_str().unwrap(), &tasks)
            .unwrap();
        let expected_tasks = reference["tasks"].as_array().unwrap();
        assert_eq!(
            decisions.len(),
            expected_tasks.len(),
            "task count differs for `{name}`"
        );
        for (decision, expected) in decisions.iter().zip(expected_tasks) {
            let expected_logits = expected["logits"].as_array().unwrap();
            let expected_probabilities = expected["probabilities"].as_array().unwrap();
            assert_eq!(
                decision.scores.len(),
                expected_logits.len(),
                "label count differs for `{name}`"
            );
            for (index, score) in decision.scores.iter().enumerate() {
                assert_eq!(score.label, expected["labels"][index].as_str().unwrap());
                let logit_difference =
                    (score.logit - expected_logits[index].as_f64().unwrap() as f32).abs();
                let probability_difference = (score.probability
                    - expected_probabilities[index].as_f64().unwrap() as f32)
                    .abs();
                largest_logit_difference = largest_logit_difference.max(logit_difference);
                largest_probability_difference =
                    largest_probability_difference.max(probability_difference);
                assert!(
                    logit_difference < LOGIT_TOLERANCE,
                    "logit of `{}` in `{name}` differs by {logit_difference}",
                    score.label
                );
                assert!(
                    probability_difference < PROBABILITY_TOLERANCE,
                    "probability of `{}` in `{name}` differs by {probability_difference}",
                    score.label
                );
            }
        }
    }
    eprintln!("largest logit difference: {largest_logit_difference}");
    eprintln!("largest probability difference: {largest_probability_difference}");
}

#[test]
fn the_chosen_labels_equal_the_labels_of_python() {
    for (example, reference) in examples_and_references() {
        let name = example["name"].as_str().unwrap();
        let tasks = tasks_from_python(&example["tasks"]);
        let decisions = engine()
            .decide(example["text"].as_str().unwrap(), &tasks)
            .unwrap();
        let expected_result = reference["result"].as_object().unwrap();
        assert_eq!(
            decisions.len(),
            expected_result.len(),
            "task count differs for `{name}`"
        );
        for decision in &decisions {
            let expected = &expected_result[&decision.task];
            let expected_labels: Vec<(String, f32)> = match expected {
                Value::Array(items) => items.iter().map(label_and_confidence).collect(),
                single => vec![label_and_confidence(single)],
            };
            let chosen: Vec<&str> = decision
                .chosen
                .iter()
                .map(|score| score.label.as_str())
                .collect();
            let expected_names: Vec<&str> = expected_labels
                .iter()
                .map(|(label, _)| label.as_str())
                .collect();
            assert_eq!(
                chosen, expected_names,
                "chosen labels differ for `{}` in `{name}`",
                decision.task
            );
            for (score, (_, confidence)) in decision.chosen.iter().zip(&expected_labels) {
                assert!((score.probability - confidence).abs() < PROBABILITY_TOLERANCE);
            }
        }
    }
}

fn label_and_confidence(item: &Value) -> (String, f32) {
    (
        item["label"].as_str().unwrap().to_string(),
        item["confidence"].as_f64().unwrap() as f32,
    )
}
