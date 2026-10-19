//! Tests of the command line tool. The tests that take a decision need the model fastino/GLiNER2.5-Decide in the
//! cache. They run one after the other, because each run of the tool maps the whole model into memory.

use serde_json::Value;
use std::io::Write;
use std::process::{Command, Output, Stdio};
use std::sync::Mutex;

const REFUND_TEXT: &str =
    "My subscription renewed on April 15 for ¥5,400 after the service was already down. \
                           Can I get that charge refunded?";
const REFUND_LABELS: &str =
    "order_status,refund_request,cancel_subscription,update_payment,login_problem,\
                             shipping_delay,bug_report,speak_to_human,other";

static ONE_RUN_AT_A_TIME: Mutex<()> = Mutex::new(());

fn command() -> Command {
    Command::new(env!("CARGO_BIN_EXE_localai_decisions_candle"))
}

fn run(arguments: &[&str], input: Option<&str>) -> Output {
    let _guard = ONE_RUN_AT_A_TIME
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut child = command()
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the tool starts");
    if let Some(input) = input {
        child
            .stdin
            .take()
            .expect("standard input")
            .write_all(input.as_bytes())
            .expect("the input is written");
    } else {
        drop(child.stdin.take());
    }
    child.wait_with_output().expect("the tool ends")
}

fn json_output(output: &Output) -> Value {
    assert!(
        output.status.success(),
        "the tool failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("standard output is JSON")
}

fn chosen_labels(decision: &Value) -> Vec<&str> {
    decision["chosen"]
        .as_array()
        .unwrap()
        .iter()
        .map(|score| score["label"].as_str().unwrap())
        .collect()
}

#[test]
fn chooses_the_label_that_matches_the_text_from_the_arguments() {
    let output = run(
        &[
            "--text",
            REFUND_TEXT,
            "--labels",
            REFUND_LABELS,
            "--task-name",
            "intent",
        ],
        None,
    );
    let result = json_output(&output);
    assert_eq!(result["model"], "fastino/GLiNER2.5-Decide");
    assert_eq!(result["backend"], "cpu");
    let decision = &result["results"][0]["decisions"][0];
    assert_eq!(decision["task"], "intent");
    assert_eq!(chosen_labels(decision), ["refund_request"]);
    assert_eq!(decision["scores"].as_array().unwrap().len(), 9);
    let probability = decision["chosen"][0]["probability"].as_f64().unwrap();
    assert!((probability - 0.997067).abs() < 1e-3, "{probability}");
}

#[test]
fn reads_a_text_from_standard_input_and_saves_the_output_in_a_file() {
    let output_path =
        std::env::temp_dir().join(format!("localai_decisions_{}.json", std::process::id()));
    let output = run(
        &[
            "--labels",
            "positive,negative,mixed,neutral",
            "--task-name",
            "sentiment",
            "--output",
            output_path.to_str().unwrap(),
        ],
        Some("Battery dies before lunch, but the keyboard and the screen are the best I have used on a laptop."),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stdout.is_empty());
    let result: Value = serde_json::from_slice(&std::fs::read(&output_path).unwrap()).unwrap();
    std::fs::remove_file(&output_path).unwrap();
    assert_eq!(result["results"][0]["source"], "stdin");
    assert_eq!(
        chosen_labels(&result["results"][0]["decisions"][0]),
        ["positive"]
    );
}

#[test]
fn takes_several_decisions_about_several_texts_with_a_file_of_tasks() {
    let folder =
        std::env::temp_dir().join(format!("localai_decisions_tasks_{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let tasks_path = folder.join("tasks.json");
    let text_path = folder.join("review.txt");
    std::fs::write(
        &tasks_path,
        r#"[
            {"name": "sentiment", "labels": [{"name": "positive"}, {"name": "negative"}, {"name": "mixed"}]},
            {"name": "aspects", "multi_label": true, "threshold": 0.4,
             "labels": [{"name": "battery"}, {"name": "keyboard"}, {"name": "screen"}, {"name": "camera"},
                        {"name": "price"}, {"name": "support"}]}
        ]"#,
    )
    .unwrap();
    std::fs::write(
        &text_path,
        "Battery dies before lunch, but the keyboard and the screen are the best I have used on a laptop.",
    )
    .unwrap();

    let output = run(
        &[
            "--tasks-file",
            tasks_path.to_str().unwrap(),
            "--file",
            text_path.to_str().unwrap(),
            "--text",
            "The camera is fine.",
        ],
        None,
    );
    let result = json_output(&output);
    std::fs::remove_dir_all(&folder).unwrap();

    let results = result["results"].as_array().unwrap();
    assert_eq!(results.len(), 2);
    assert_eq!(results[0]["source"], "text:1");
    assert_eq!(results[1]["source"], text_path.display().to_string());
    let review = results[1]["decisions"].as_array().unwrap();
    assert_eq!(review[0]["task"], "sentiment");
    assert_eq!(review[1]["task"], "aspects");
    assert_eq!(chosen_labels(&review[1]), ["battery", "keyboard", "screen"]);
}

#[test]
fn asks_for_labels_when_there_are_none() {
    let output = run(&["--text", "Hello"], None);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("--labels"));
}

#[test]
fn refuses_labels_together_with_a_file_of_tasks() {
    let output = run(
        &[
            "--text",
            "Hello",
            "--labels",
            "a,b",
            "--tasks-file",
            "tasks.json",
        ],
        None,
    );
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("cannot be used with"));
}

#[test]
fn refuses_a_threshold_outside_zero_and_one() {
    let output = run(
        &[
            "--text",
            "Hello",
            "--labels",
            "a,b",
            "--multi-label",
            "--threshold",
            "2",
        ],
        None,
    );
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("threshold"));
}

#[test]
fn refuses_a_file_of_tasks_that_is_not_a_list_of_tasks() {
    let path = std::env::temp_dir().join(format!(
        "localai_decisions_bad_tasks_{}.json",
        std::process::id()
    ));
    std::fs::write(&path, r#"{"name": "intent"}"#).unwrap();
    let output = run(
        &["--text", "Hello", "--tasks-file", path.to_str().unwrap()],
        None,
    );
    std::fs::remove_file(&path).unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("JSON list of decision tasks"));
}

#[test]
fn prints_the_help() {
    let output = command().arg("--help").output().unwrap();
    let help = String::from_utf8_lossy(&output.stdout);
    assert!(output.status.success());
    assert!(help.contains("--labels"));
    assert!(help.contains("--multi-label"));
    assert!(help.contains("--backend"));
}
