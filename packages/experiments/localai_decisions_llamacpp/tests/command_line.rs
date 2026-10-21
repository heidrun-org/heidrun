//! Runs the compiled command line tool.

use std::io::Write;
use std::process::{Command, Stdio};

use serde_json::Value;

fn tool() -> Command {
    Command::new(env!("CARGO_BIN_EXE_localai_decisions_llamacpp"))
}

fn json_output(output: std::process::Output) -> Value {
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    serde_json::from_slice(&output.stdout).unwrap()
}

#[test]
fn the_short_form_asks_one_choice_question() {
    let output = tool()
        .args(["--text", "I was charged twice.", "--question", "Which team?", "--choices", "billing,shipping"])
        .output()
        .unwrap();
    let response = json_output(output);
    assert_eq!(response["answers"]["question"]["choice"], "billing");
    assert_eq!(response["model"], "ggml-org/Kev-0.8B-GGUF");
}

#[test]
fn the_short_form_without_choices_asks_a_yes_or_no_question() {
    let output = tool().args(["--text", "I am very angry!", "--question", "Is the customer angry?"]).output().unwrap();
    let noul = json_output(output)["answers"]["question"]["noul"].as_f64().unwrap();
    assert!(noul > 0.5, "{noul}");
}

#[test]
fn a_request_comes_from_a_file_or_from_standard_input() {
    let request = r#"{"state": "The screen stays black.", "questions": {"q": {"type": "choice", "instructions": "Area?", "criteria": {"hardware": null, "billing": null}}}}"#;
    let path = std::env::temp_dir().join(format!("localai_decisions_llamacpp_request_{}.json", std::process::id()));
    std::fs::write(&path, request).unwrap();
    let from_file = json_output(tool().arg("--request").arg(&path).output().unwrap());
    std::fs::remove_file(&path).unwrap();

    let mut child = tool().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
    child.stdin.take().unwrap().write_all(request.as_bytes()).unwrap();
    let from_stdin = json_output(child.wait_with_output().unwrap());
    assert_eq!(from_file, from_stdin);
    assert_eq!(from_file["answers"]["q"]["choice"], "hardware");
}

#[test]
fn an_error_is_written_on_standard_error_with_a_non_zero_code() {
    let output = tool().args(["--model", "/no/such/model.gguf", "--text", "t", "--question", "q"]).output().unwrap();
    assert_eq!(output.status.success(), false);
    let message = String::from_utf8_lossy(&output.stderr);
    assert!(message.starts_with("Error: The model file /no/such/model.gguf does not exist"), "{message}");
}
