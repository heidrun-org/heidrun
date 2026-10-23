//! Checks benchmark command discovery and validation without loading model weights.
use std::process::Command;

fn tool() -> Command {
    Command::new(env!("CARGO_BIN_EXE_localai_decisions_candle"))
}

#[test]
fn benchmark_is_a_discoverable_subcommand() {
    let output = tool().arg("--help").output().unwrap();
    assert!(output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("benchmark"));
    let output = tool().args(["benchmark", "--help"]).output().unwrap();
    assert!(output.status.success());
    let help = String::from_utf8_lossy(&output.stdout);
    for option in ["--model", "--decisions", "--output", "--json", "--backend"] {
        assert!(help.contains(option), "{help}");
    }
    assert!(!help.contains("--labels"));
    assert!(!help.contains("--seconds"));
    assert!(help.contains("[default: 5]"));
}

#[test]
fn invalid_benchmark_count_and_device_fail_before_model_loading() {
    for args in [
        vec!["benchmark", "--decisions", "0"],
        vec!["benchmark", "--decisions", "-1"],
        vec!["benchmark", "--backend", "unknown"],
    ] {
        let output = tool().args(args).output().unwrap();
        assert!(!output.status.success());
        let error = String::from_utf8_lossy(&output.stderr);
        assert!(!error.contains("before timing"), "{error}");
    }
}

#[test]
fn model_option_is_honored_before_and_after_benchmark() {
    for arguments in [
        vec!["--model", "no-such-model", "benchmark"],
        vec!["benchmark", "--model", "no-such-model"],
    ] {
        let output = tool().args(arguments).output().unwrap();
        assert!(!output.status.success());
        let error = String::from_utf8_lossy(&output.stderr);
        assert!(error.contains("Loading no-such-model"), "{error}");
    }
}
