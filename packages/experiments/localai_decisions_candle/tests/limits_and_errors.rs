//! Tests of the limits and the errors of the engine. They need the model fastino/GLiNER2.5-Decide in the cache.

use localai_decisions_candle::{DecisionConfig, DecisionEngine, DecisionTask};
use std::sync::OnceLock;

fn engine() -> &'static DecisionEngine {
    static ENGINE: OnceLock<DecisionEngine> = OnceLock::new();
    ENGINE.get_or_init(|| DecisionEngine::load(DecisionConfig::default()).expect("the model loads"))
}

#[test]
fn a_text_above_the_token_limit_is_refused_with_a_clear_error() {
    let text = "The package did not arrive. ".repeat(200);
    let error = engine()
        .decide(
            &text,
            &[DecisionTask::new("intent", ["shipping_delay", "other"])],
        )
        .unwrap_err();
    assert!(error.to_string().contains("accepts at most 512"), "{error}");
}

#[test]
fn no_task_is_an_error() {
    assert!(engine().decide("Hello", &[]).is_err());
}

#[test]
fn a_task_without_labels_is_an_error() {
    let task = DecisionTask::new("intent", Vec::<String>::new());
    assert!(engine().decide("Hello", &[task]).is_err());
}

#[test]
fn an_unknown_model_identifier_form_is_an_error() {
    let config = DecisionConfig {
        model_id: "no-slash-here".to_string(),
        ..DecisionConfig::default()
    };
    let error = DecisionEngine::load(config).err().expect("an error");
    assert!(error.to_string().contains("owner/model-name"), "{error}");
}

#[test]
fn the_cuda_backend_is_refused_in_a_build_without_the_feature() {
    if cfg!(feature = "cuda") {
        return;
    }
    let config = DecisionConfig {
        backend: localai_decisions_candle::Backend::Cuda,
        ..DecisionConfig::default()
    };
    let error = DecisionEngine::load(config).err().expect("an error");
    assert!(error.to_string().contains("CUDA is unavailable"), "{error}");
}

#[test]
fn the_same_text_gives_the_same_answer_twice() {
    let tasks = [DecisionTask::new("intent", ["refund_request", "other"])];
    let first = engine().decide("Can I get my money back?", &tasks).unwrap();
    let second = engine().decide("Can I get my money back?", &tasks).unwrap();
    assert_eq!(first, second);
}
