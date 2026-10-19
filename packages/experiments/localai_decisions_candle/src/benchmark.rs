//! Speed measurements owned by the Candle command line tool.
use anyhow::{Context, Result};
use clap::Args;
use localai_decisions_candle::{DecisionConfig, DecisionEngine, DecisionTask};
use serde::Serialize;
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

#[derive(Debug, Args)]
pub(crate) struct Arguments {
    /// Completed decisions per case, after loading and warmup.
    #[arg(long, default_value_t = 5, value_parser = clap::value_parser!(u64).range(1..))]
    decisions: u64,
    /// Print JSON instead of the table.
    #[arg(long)]
    json: bool,
}

struct Case {
    name: String,
    text: String,
    task: DecisionTask,
}

pub(crate) fn run(
    arguments: Arguments,
    config: DecisionConfig,
    output: Option<PathBuf>,
) -> Result<()> {
    eprintln!(
        "Loading {} on {} before timing...",
        config.model_id,
        config.backend.as_str()
    );
    let started = Instant::now();
    let engine = DecisionEngine::load(config.clone())?;
    let model_load_seconds = started.elapsed().as_secs_f64();
    let mut results = Vec::new();
    for case in cases() {
        let tasks = [case.task];
        let input_tokens = engine.encode(&case.text, &tasks)?.input_ids.len();
        let warmup = Instant::now();
        // Returned probabilities have been copied to the processor, completing GPU work.
        engine.decide(&case.text, &tasks)?;
        let warmup_seconds = warmup.elapsed().as_secs_f64();
        eprintln!(
            "Measuring {}: {} decisions...",
            case.name, arguments.decisions
        );
        let started = Instant::now();
        let measurement = measure_decisions(
            arguments.decisions,
            || {
                engine.decide(&case.text, &tasks)?;
                Ok(())
            },
            || started.elapsed(),
        )?;
        results.push(CaseResult {
            case: case.name,
            input_tokens,
            warmup_seconds,
            measurement,
        });
    }
    write_report(&Report {
        package: "localai_decisions_candle", model: config.model_id.clone(),
        backend: config.backend.as_str(), decisions_per_case: arguments.decisions,
        model_load_seconds, cases: results, peak_process_resident_bytes: peak_memory(),
        memory_scope: "Process resident-memory high-water mark over model loading, warmup and inference; separate GPU allocations are not measured",
    }, &arguments, output.as_deref())
}

fn cases() -> Vec<Case> {
    let mut cases = Vec::new();
    for (length, text) in [
        ("short", SHORT_TEXT.to_string()),
        ("long", LONG_PARAGRAPH.repeat(4)),
    ] {
        cases.push(Case {
            name: format!("Single label / {length}"),
            text: text.clone(),
            task: DecisionTask::new(
                "intent",
                [
                    "refund_request",
                    "shipping_question",
                    "technical_support",
                    "other",
                ],
            ),
        });
        cases.push(Case {
            name: format!("Several labels / {length}"),
            text,
            task: DecisionTask::new(
                "topics",
                [
                    "billing",
                    "refund",
                    "shipping",
                    "account",
                    "technical_support",
                ],
            )
            .with_multi_label(0.5),
        });
    }
    cases
}

#[cfg(test)]
fn check_case(case: &Case) {
    case.task.validate().unwrap();
}

/// Timing of a fixed number of fully completed decisions.
#[derive(Debug, Serialize)]
struct Measurement {
    completed_decisions: u64,
    total_seconds: f64,
    seconds_per_decision: f64,
    decisions_per_second: f64,
}

#[derive(Debug, Serialize)]
struct CaseResult {
    case: String,
    input_tokens: usize,
    warmup_seconds: f64,
    #[serde(flatten)]
    measurement: Measurement,
}

#[derive(Debug, Serialize)]
struct Report {
    package: &'static str,
    model: String,
    backend: &'static str,
    decisions_per_case: u64,
    model_load_seconds: f64,
    cases: Vec<CaseResult>,
    peak_process_resident_bytes: Option<u64>,
    memory_scope: &'static str,
}

const SHORT_TEXT: &str = "I was charged twice for my order. Please refund the extra payment today.";
const LONG_PARAGRAPH: &str =
    "I contacted customer support about the duplicate payment for my order. \
    The first payment was accepted and the order arrived last week, but my bank statement shows \
    another charge for the same amount. The online account shows only one purchase. \
    Please check the billing records and refund the extra payment. I need the money today. ";

fn measure_decisions(
    decisions: u64,
    mut decide: impl FnMut() -> Result<()>,
    mut elapsed: impl FnMut() -> Duration,
) -> Result<Measurement> {
    anyhow::ensure!(
        decisions > 0,
        "The decision count must be greater than zero"
    );
    for _ in 0..decisions {
        decide()?;
    }
    let total_seconds = elapsed().as_secs_f64();
    anyhow::ensure!(
        total_seconds > 0.0,
        "The measured elapsed time must be greater than zero"
    );
    Ok(Measurement {
        completed_decisions: decisions,
        total_seconds,
        seconds_per_decision: total_seconds / decisions as f64,
        decisions_per_second: decisions as f64 / total_seconds,
    })
}

fn write_report(
    report: &Report,
    arguments: &Arguments,
    output: Option<&std::path::Path>,
) -> Result<()> {
    let json = serde_json::to_string_pretty(report)?;
    if let Some(path) = output {
        std::fs::write(path, format!("{json}\n"))
            .with_context(|| format!("Could not write {}", path.display()))?;
    }
    if arguments.json {
        println!("{json}");
        return Ok(());
    }
    println!("Model: {}", report.model);
    println!("Backend: {}", report.backend);
    println!(
        "Model loaded in {:.2} seconds (excluded from timing)",
        report.model_load_seconds
    );
    println!(
        "Each case is warmed up, then {} completed decisions are measured.",
        report.decisions_per_case
    );
    println!(
        "{:<24} {:>12} {:>13} {:>16} {:>16}",
        "Case", "Input tokens", "Total seconds", "Seconds/decision", "Decisions/second"
    );
    for result in &report.cases {
        println!(
            "{:<24} {:>12} {:>13.3} {:>16.4} {:>16.2}",
            result.case,
            result.input_tokens,
            result.measurement.total_seconds,
            result.measurement.seconds_per_decision,
            result.measurement.decisions_per_second
        );
    }
    if let Some(bytes) = report.peak_process_resident_bytes {
        println!(
            "Peak process resident memory: {:.1} MiB",
            bytes as f64 / 1_048_576.0
        );
    }
    if let Some(path) = output {
        println!("JSON: {}", path.display());
    }
    Ok(())
}

fn peak_memory() -> Option<u64> {
    #[cfg(unix)]
    {
        let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
        // Safety: getrusage initializes this correctly sized and aligned structure on success.
        if unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) } != 0 {
            return None;
        }
        let usage = unsafe { usage.assume_init() };
        let value = u64::try_from(usage.ru_maxrss).ok()?;
        #[cfg(target_os = "macos")]
        return Some(value);
        #[cfg(not(target_os = "macos"))]
        return Some(value * 1024);
    }
    #[cfg(not(unix))]
    {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn benchmark_completes_five_decisions_and_calculates_average_time_and_rate() {
        let clock = Cell::new(0);
        let calls = Cell::new(0);
        let result = measure_decisions(
            5,
            || {
                calls.set(calls.get() + 1);
                clock.set(clock.get() + 2000);
                Ok(())
            },
            || Duration::from_millis(clock.get()),
        )
        .unwrap();
        assert_eq!(calls.get(), 5);
        assert_eq!(result.completed_decisions, 5);
        assert_eq!(result.total_seconds, 10.0);
        assert_eq!(result.seconds_per_decision, 2.0);
        assert_eq!(result.decisions_per_second, 0.5);
    }

    #[test]
    fn benchmark_waits_for_slow_decisions_instead_of_returning_zero() {
        let clock = Cell::new(0);
        let result = measure_decisions(
            5,
            || {
                clock.set(clock.get() + 6000);
                Ok(())
            },
            || Duration::from_millis(clock.get()),
        )
        .unwrap();
        assert_eq!(result.completed_decisions, 5);
        assert_eq!(result.total_seconds, 30.0);
        assert_eq!(result.seconds_per_decision, 6.0);
        assert_eq!(result.decisions_per_second, 1.0 / 6.0);
    }

    #[test]
    fn benchmark_reports_errors_instead_of_counting_failed_decisions() {
        let calls = Cell::new(0);
        let result = measure_decisions(
            5,
            || {
                calls.set(calls.get() + 1);
                if calls.get() == 3 {
                    anyhow::bail!("device failed");
                }
                Ok(())
            },
            || Duration::from_secs(10),
        );
        assert!(result.is_err());
        assert_eq!(calls.get(), 3);
    }

    #[test]
    fn benchmark_rejects_zero_decisions_and_zero_elapsed_time() {
        assert!(measure_decisions(0, || panic!("must not run"), || Duration::ZERO).is_err());
        assert!(measure_decisions(5, || Ok(()), || Duration::ZERO).is_err());
    }

    #[test]
    fn benchmark_cases_have_short_and_long_texts_and_one_decision_each() {
        let cases = cases();
        assert!(!cases.is_empty());
        let names: std::collections::BTreeSet<_> = cases.iter().map(|case| &case.name).collect();
        assert_eq!(names.len(), cases.len());
        assert!(cases.iter().any(|case| case.name.ends_with("short")));
        assert!(cases.iter().any(|case| case.name.ends_with("long")));
        assert!(LONG_PARAGRAPH.repeat(4).len() > SHORT_TEXT.len() * 5);
        for case in &cases {
            check_case(case);
        }
    }
}
