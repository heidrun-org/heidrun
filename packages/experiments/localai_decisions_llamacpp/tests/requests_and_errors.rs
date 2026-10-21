//! The errors of a request, with the same messages as the server of llama.cpp, and the limits.

use std::sync::OnceLock;

use localai_decisions_llamacpp::{resolve_model_file, DecisionConfig, DecisionEngine, Device};
use serde_json::{json, Value};

fn engine() -> &'static DecisionEngine {
    static ENGINE: OnceLock<DecisionEngine> = OnceLock::new();
    ENGINE.get_or_init(|| DecisionEngine::load(DecisionConfig::default()).expect("the model Kev-0.8B"))
}

fn error_of(request: Value) -> String {
    format!("{:#}", engine().decide(&request).expect_err("an error"))
}

#[test]
fn a_request_without_state_or_questions_is_refused() {
    assert_eq!(error_of(json!({"questions": {"q": {"type": "noul", "instructions": "?"}}})), "\"state\" must be provided");
    assert_eq!(error_of(json!({"state": "text", "questions": {}})), "\"questions\" must be a non-empty object");
}

#[test]
fn a_bad_question_is_refused_with_its_identifier() {
    assert_eq!(error_of(json!({"state": "t", "questions": {"q": {"type": "maybe", "instructions": "?"}}})), "questions.q: \"type\" must be one of: choice, score, noul");
    assert_eq!(error_of(json!({"state": "t", "questions": {"q": {"type": "noul"}}})), "questions.q: \"instructions\" must be provided");
    assert_eq!(
        error_of(json!({"state": "t", "questions": {"q": {"type": "score", "instructions": "?", "criteria": ["only one"]}}})),
        "questions.q: \"criteria\" must be an array of 2 to 10 levels"
    );
    assert_eq!(
        error_of(json!({"state": "t", "questions": {"q": {"type": "choice", "instructions": "?", "criteria": {}}}})),
        "questions.q: \"criteria\" must be a non-empty object"
    );
}

#[test]
fn too_many_options_are_refused() {
    let criteria: serde_json::Map<String, Value> = (0..256).map(|i| (format!("o{i}"), Value::Null)).collect();
    let message = error_of(json!({"state": "t", "questions": {"q": {"type": "choice", "instructions": "?", "criteria": criteria}}}));
    assert_eq!(message, "questions.q: too many options (256), this model supports at most 255");
}

#[test]
fn images_are_refused() {
    let message = error_of(json!({"state": "t", "images": ["data:image/png;base64,AAAA"], "questions": {"q": {"type": "noul", "instructions": "?"}}}));
    assert_eq!(message, "\"images\" is not supported: this package reads text only");
}

#[test]
fn a_prompt_larger_than_the_batch_is_refused() {
    let engine = DecisionEngine::load(DecisionConfig {
        batch_size: 32,
        ..DecisionConfig::default()
    })
    .unwrap();
    let request = json!({"state": "word ".repeat(100), "questions": {"q": {"type": "noul", "instructions": "?"}}});
    let message = format!("{:#}", engine.decide(&request).unwrap_err());
    assert!(message.contains("more than the batch size of 32"), "{message}");
}

#[test]
fn the_gpu_is_refused_by_a_processor_build() {
    if localai_decisions_llamacpp::llama::has_gpu_backend() {
        return;
    }
    let message = format!(
        "{:#}",
        DecisionEngine::load(DecisionConfig {
            device: Device::Gpu,
            ..DecisionConfig::default()
        })
        .err()
        .unwrap()
    );
    assert!(message.contains("no GPU backend"), "{message}");
}

#[test]
fn model_names_give_the_file_of_the_repository() {
    let path = resolve_model_file("ggml-org/Kev-0.8B-GGUF", false).unwrap();
    assert!(path.ends_with("Kev-0.8B-Q8_0.gguf"), "{}", path.display());
    let message = format!("{:#}", resolve_model_file("not-a-repository", false).unwrap_err());
    assert!(message.contains("owner/name"), "{message}");
    let message = format!("{:#}", resolve_model_file("/no/such/model.gguf", false).unwrap_err());
    assert!(message.contains("does not exist"), "{message}");
}

#[test]
fn the_engine_answers_the_same_request_twice_in_the_same_way() {
    let request = json!({"state": "The parcel arrived broken.", "questions": {"q": {"type": "choice", "instructions": "Topic?", "criteria": {"damage": null, "delay": null}}}});
    let first = engine().decide(&request).unwrap();
    let second = engine().decide(&request).unwrap();
    assert_eq!(first, second);
    assert_eq!(first["answers"]["q"]["choice"], "damage");
}
