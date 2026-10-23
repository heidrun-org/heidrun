//! The tests of the AI cost: a refresh of the token usage of workspaces with a fake folder of each coding agent, then a read of
//! the hours from the SQLite file only. Only the tests compile this file.

use crate::coding_agents::scan_cache::ScanCache;
use crate::model::ai_cost_types::{AiCostAnswer, AiCostWorkspace};
use crate::query::find_ai_cost;
use crate::refresh::refresh_workspaces_with;
use crate::storage::model_price_database::ModelPriceDatabase;
use std::path::{Path, PathBuf};
use std::process::Command;

/// 14 October 2026, 12:00:00 in UTC, in milliseconds since 1 January 1970.
const NOON: i64 = 1_791_979_200_000;

/// One day, in milliseconds.
const DAY: i64 = 86_400_000;

/// The price list of the tests: one model.
const PRICE_LIST: &str = r#"{"claude-opus-5":{"litellm_provider":"anthropic","input_cost_per_token":1e-06,
    "output_cost_per_token":5e-06,"cache_read_input_token_cost":1e-07,"cache_creation_input_token_cost":2e-06}}"#;

/// A scratch folder with a Git repository whose remote `origin` is `owner/name`, a fake folder of Claude Code, a fake folder of
/// Codex, and the path of a SQLite file. The folder is removed when the value is dropped.
struct Scratch {
    /// The scratch folder.
    folder: PathBuf,
}

impl Scratch {
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("data-layer-ai-cost-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(folder.join("repository")).unwrap();
        let scratch = Scratch { folder: folder.canonicalize().unwrap() };
        initialize_repository(&scratch.repository());
        scratch
    }

    fn repository(&self) -> PathBuf {
        self.folder.join("repository")
    }

    fn roots(&self) -> Vec<String> {
        vec![self.repository().display().to_string()]
    }

    fn database(&self) -> PathBuf {
        self.folder.join("data_layer.sqlite")
    }

    fn claude_projects(&self) -> PathBuf {
        self.folder.join("claude").join("projects")
    }

    fn codex_home(&self) -> PathBuf {
        self.folder.join("codex")
    }

    /// Writes a chat session of Claude Code that started in `folder` and has one answer for each `(timestamp, output)`.
    fn write_claude_chat(&self, folder: &Path, name: &str, answers: &[(&str, u64)]) {
        let project = self.claude_projects().join(folder.display().to_string().replace(|c: char| !c.is_ascii_alphanumeric(), "-"));
        std::fs::create_dir_all(&project).unwrap();
        let mut text = format!(
            r#"{{"type":"user","cwd":"{}","timestamp":"2026-10-11T10:00:00.000Z","message":{{"role":"user","content":"{name}"}}}}"#,
            folder.display()
        );
        for (index, (timestamp, output)) in answers.iter().enumerate() {
            text.push_str(&format!(
                "\n{{\"type\":\"assistant\",\"cwd\":\"{}\",\"timestamp\":\"{timestamp}\",\"message\":{{\"id\":\"{name}-{index}\",\"model\":\"claude-opus-5\",\"role\":\"assistant\",\"content\":[],\"usage\":{{\"input_tokens\":1000,\"cache_creation_input_tokens\":0,\"cache_read_input_tokens\":0,\"output_tokens\":{output}}}}}}}",
                folder.display()
            ));
        }
        std::fs::write(project.join(format!("{name}.jsonl")), text + "\n").unwrap();
    }

    fn write_prices(&self) {
        let path = self.folder.join("prices.json");
        std::fs::write(&path, PRICE_LIST).unwrap();
        let source = crate::pricing::price_list_source::price_list_source_of(&path.display().to_string());
        ModelPriceDatabase::open(&self.database()).unwrap().refresh(source.as_ref(), NOON, false).unwrap();
    }

    fn refresh_roots(&self, roots: &[String], is_import_allowed: bool) -> Vec<AiCostWorkspace> {
        refresh_workspaces_with(
            &self.database(),
            roots,
            is_import_allowed,
            &self.claude_projects(),
            &self.codex_home(),
            &mut ScanCache::in_memory(),
            NOON,
        )
        .unwrap()
    }

    fn refresh(&self, is_import_allowed: bool) -> Vec<AiCostWorkspace> {
        self.refresh_roots(&self.roots(), is_import_allowed)
    }

    fn read(&self, since: i64, until: i64, time_zone: &str) -> AiCostAnswer {
        find_ai_cost(&self.database(), &self.roots(), since, until, time_zone).unwrap()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.folder);
    }
}

/// Makes `folder` a Git repository whose remote `origin` is `owner/name`.
fn initialize_repository(folder: &Path) {
    for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:owner/name.git"]] {
        assert!(Command::new("git").arg("-C").arg(folder).args(arguments).status().unwrap().success());
    }
}

#[test]
fn a_history_that_was_never_imported_is_not_read_unless_the_import_is_allowed() {
    let scratch = Scratch::new("import");
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    let states = scratch.refresh(false);
    assert_eq!(states[0].synchronized_at, None);
    assert_eq!(scratch.read(NOON - DAY, NOON + DAY, "UTC").hours, vec![]);
    let states = scratch.refresh(true);
    assert!(states[0].synchronized_at.is_some());
    assert_eq!(states[0].repository.as_deref(), Some("owner/name"));
    assert_eq!(scratch.read(NOON - DAY, NOON + DAY, "UTC").hours.len(), 1);
}

#[test]
fn an_imported_history_is_updated_without_the_permission_to_import() {
    let scratch = Scratch::new("update");
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.refresh(true);
    scratch.write_claude_chat(&scratch.repository(), "second", &[("2026-10-14T11:00:00.000Z", 200)]);
    scratch.refresh(false);
    let answer = scratch.read(NOON - DAY, NOON + DAY, "UTC");
    let tokens: Vec<u64> = answer.hours.iter().map(|hour| hour.tokens).collect();
    assert_eq!(tokens, vec![1_100, 1_200], "the first chat is at 10:00 and the second chat is at 11:00");
}

#[test]
fn the_tokens_and_the_cost_of_an_hour_come_from_the_stored_rows_and_the_latest_prices() {
    let scratch = Scratch::new("cost");
    scratch.write_prices();
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.refresh(true);
    let answer = scratch.read(NOON - DAY, NOON + DAY, "UTC");
    assert_eq!(answer.hours.len(), 1);
    let hour = &answer.hours[0];
    assert_eq!((hour.day.as_str(), hour.coding_agent.as_str(), hour.tokens), ("2026-10-14", "claude", 1_100));
    // 1 000 fresh input tokens × 1 dollar + 100 output tokens × 5 dollars, for one million tokens
    assert!((hour.cost_usd.unwrap() - 0.0015).abs() < 1e-12, "{:?}", hour.cost_usd);
    assert_eq!(hour.unpriced_tokens, 0);
    assert_eq!(answer.price_version, Some(1));
}

#[test]
fn a_model_without_a_price_has_no_cost_and_its_tokens_are_counted_apart() {
    let scratch = Scratch::new("unpriced");
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.refresh(true);
    let answer = scratch.read(NOON - DAY, NOON + DAY, "UTC");
    assert_eq!((answer.hours[0].cost_usd, answer.hours[0].unpriced_tokens), (None, 1_100));
    assert_eq!(answer.price_version, None);
}

#[test]
fn a_chat_that_two_workspaces_list_counts_once() {
    let scratch = Scratch::new("overlap");
    // A second Git repository inside the first one, with the same remote: two workspaces, one inside the other.
    let inner = scratch.repository().join("inner");
    std::fs::create_dir_all(&inner).unwrap();
    initialize_repository(&inner);
    scratch.write_claude_chat(&inner, "in-inner", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.write_claude_chat(&scratch.repository(), "in-root", &[("2026-10-14T10:00:00.000Z", 200)]);
    let roots = [scratch.repository().display().to_string(), inner.display().to_string()];
    scratch.refresh_roots(&roots, true);
    let answer = find_ai_cost(&scratch.database(), &roots, NOON - DAY, NOON + DAY, "UTC").unwrap();
    assert_eq!(answer.workspaces.len(), 2);
    assert_eq!(answer.hours.len(), 1);
    assert_eq!(answer.hours[0].tokens, 1_100 + 1_200);
}

#[test]
fn the_hours_follow_the_time_zone_and_a_day_of_25_hours_has_25_of_them() {
    let scratch = Scratch::new("zone");
    // In Paris the clock goes back on 25 October 2026: that day lasts 25 hours, from 22:00 UTC on the 24th to 23:00 UTC on the
    // 25th. The answer at 22:30 UTC on the 25th is at 23:30 in Paris, so it is still on the 25th.
    scratch.write_claude_chat(
        &scratch.repository(),
        "first",
        &[("2026-10-24T22:30:00.000Z", 1), ("2026-10-25T22:30:00.000Z", 2), ("2026-10-25T23:30:00.000Z", 3)],
    );
    scratch.refresh(true);
    let since = 1_792_800_000_000;
    let answer = scratch.read(since, since + 4 * DAY, "Europe/Paris");
    let hours: Vec<(&str, &str, u64)> =
        answer.hours.iter().map(|hour| (hour.day.as_str(), hour.started_at.as_str(), hour.tokens)).collect();
    assert_eq!(
        hours,
        vec![
            ("2026-10-25", "2026-10-24T22:00:00.000Z", 1_001),
            ("2026-10-25", "2026-10-25T22:00:00.000Z", 1_002),
            ("2026-10-26", "2026-10-25T23:00:00.000Z", 1_003),
        ]
    );
}

#[test]
fn a_time_zone_that_is_not_known_is_an_error() {
    let scratch = Scratch::new("bad-zone");
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.refresh(true);
    let error = find_ai_cost(&scratch.database(), &scratch.roots(), NOON - DAY, NOON + DAY, "Mars/Olympus").unwrap_err();
    assert!(error.contains("Mars/Olympus"), "{error}");
}

#[test]
fn a_folder_without_a_remote_origin_is_an_error_of_the_workspace_and_not_of_the_call() {
    let scratch = Scratch::new("no-remote");
    let other = scratch.folder.join("other");
    std::fs::create_dir_all(&other).unwrap();
    assert!(Command::new("git").arg("-C").arg(&other).args(["init", "-q"]).status().unwrap().success());
    let states = scratch.refresh_roots(&[other.display().to_string()], true);
    assert!(states[0].error.as_deref().unwrap_or_default().contains("no remote origin"));
    assert_eq!(states[0].synchronized_at, None);
}

#[test]
fn a_database_that_does_not_exist_gives_workspaces_that_were_never_imported() {
    let scratch = Scratch::new("missing");
    let answer = scratch.read(NOON - DAY, NOON + DAY, "UTC");
    assert_eq!(answer.hours, vec![]);
    assert_eq!(answer.workspaces[0].synchronized_at, None);
    assert!(!scratch.database().exists());
}

#[test]
fn the_answer_uses_the_names_of_the_fields_of_the_web_page() {
    let scratch = Scratch::new("json");
    scratch.write_prices();
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.refresh(true);
    let json = serde_json::to_value(scratch.read(NOON - DAY, NOON + DAY, "UTC")).unwrap();
    assert_eq!(json["hours"][0]["startedAt"], "2026-10-14T10:00:00.000Z");
    assert_eq!(json["hours"][0]["codingAgent"], "claude");
    assert_eq!(json["hours"][0]["unpricedTokens"], 0);
    assert_eq!(json["workspaces"][0]["repository"], "owner/name");
    assert_eq!(json["priceVersion"], 1);
}

#[test]
fn the_answer_has_one_row_for_each_hour_that_had_tokens() {
    let scratch = Scratch::new("hours");
    scratch.write_claude_chat(
        &scratch.repository(),
        "first",
        &[("2026-10-14T10:00:00.000Z", 1), ("2026-10-14T10:30:00.000Z", 2), ("2026-10-14T13:00:00.000Z", 4)],
    );
    scratch.refresh(true);
    let hours: Vec<(String, String, u64)> =
        scratch.read(NOON - DAY, NOON + DAY, "UTC").hours.into_iter().map(|hour| (hour.started_at, hour.day, hour.tokens)).collect();
    let hour = |started_at: &str, tokens: u64| (started_at.to_string(), "2026-10-14".to_string(), tokens);
    assert_eq!(hours, vec![hour("2026-10-14T10:00:00.000Z", 2_003), hour("2026-10-14T13:00:00.000Z", 1_004)]);
}

#[test]
fn the_hours_of_a_time_zone_with_a_half_hour_offset_start_at_its_own_local_hours() {
    let scratch = Scratch::new("half-hour");
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:40:00.000Z", 1)]);
    scratch.refresh(true);
    let hours = scratch.read(NOON - DAY, NOON + DAY, "Asia/Kolkata").hours;
    assert_eq!((hours[0].started_at.as_str(), hours[0].day.as_str()), ("2026-10-14T10:30:00.000Z", "2026-10-14"));
}

#[test]
fn a_read_after_a_refresh_needs_no_chat_session_file_and_no_git_repository() {
    let scratch = Scratch::new("sources_gone");
    scratch.write_prices();
    scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
    scratch.refresh(true);
    let before = scratch.read(NOON - DAY, NOON + DAY, "UTC");
    std::fs::remove_dir_all(scratch.folder.join("claude")).unwrap();
    std::fs::remove_dir_all(scratch.repository().join(".git")).unwrap();
    let after = scratch.read(NOON - DAY, NOON + DAY, "UTC");
    assert_eq!(after, before);
    assert_eq!(after.hours.len(), 1);
    assert_eq!(after.workspaces[0].repository.as_deref(), Some("owner/name"));
}

#[test]
fn the_error_of_a_folder_without_a_remote_origin_comes_from_the_refresh_and_not_from_the_read() {
    let scratch = Scratch::new("error_in_refresh");
    let other = scratch.folder.join("other");
    std::fs::create_dir_all(&other).unwrap();
    assert!(Command::new("git").arg("-C").arg(&other).args(["init", "-q"]).status().unwrap().success());
    let roots = [other.display().to_string()];
    scratch.refresh_roots(&roots, true);
    let answer = find_ai_cost(&scratch.database(), &roots, NOON - DAY, NOON + DAY, "UTC").unwrap();
    assert_eq!((answer.workspaces[0].repository.clone(), answer.workspaces[0].error.clone()), (None, None));
}

#[test]
fn a_database_that_holds_only_the_tables_of_another_package_gives_workspaces_that_were_never_imported() {
    let scratch = Scratch::new("other_tables");
    rusqlite::Connection::open(scratch.database()).unwrap().execute_batch("CREATE TABLE commits (data TEXT)").unwrap();
    let answer = scratch.read(0, 1, "UTC");
    assert!(answer.hours.is_empty());
    assert_eq!(answer.workspaces[0].synchronized_at, None);
    let list = crate::query::find_chat_list(&scratch.database(), &scratch.roots()[0], 10, Default::default()).unwrap();
    assert!(list.claude.chats.is_empty() && list.codex.chats.is_empty());
}
