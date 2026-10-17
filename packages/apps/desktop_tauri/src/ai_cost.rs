//! The AI cost of the tab "Work of one person" of the Statistics window, read from the token usage that the data layer stored.
//!
//! The package `data_layer_coding_agents` stores the tokens of each chat session, each model, and each minute in the SQLite file,
//! and the view `token_usage_with_cost` gives the estimated cost of each row at the latest prices. This file has two commands:
//!
//! - `ai_cost_synchronize` copies the new tokens of the chat session files into the SQLite file. It reads again only the chat
//!   sessions that changed since the last read of a workspace. It reads the whole history of a workspace, which can take a
//!   while, only when the developer allows the import, and never by itself.
//! - `ai_cost_in_range` reads the SQLite file only, never a chat session file, and gives the tokens and the cost of each hour
//!   and each coding agent. The hours are the slots of one hour of the days of the time zone that the caller gives: each day
//!   starts with a slot, so a slot never crosses midnight, and a day of 23 or 25 hours has 23 or 25 slots. The web page adds
//!   the hours into the slots that the developer chooses (1 hour, 6 hours, or 1 day), so a change of the slot length reads
//!   nothing again.
//!
//! A chat session that two workspaces list counts once. A cost is `None` when no row of the hour has a known price, and the
//! tokens that have no known price are counted apart, so a total never looks complete when it is not.

use crate::model_prices;
use crate::person_work::parse_time;
use data_layer_coding_agents::{
    default_database_path, find_repository, ignore_log, local_time_zone_name, parse_range_bound, summarize_periods,
    synchronize_token_usage, CodingAgent, ModelPriceDatabase, ScanCache, SynchronizationMode, TokenUsageDatabase,
    TokenUsageFiles, UsageGrouping, UsageQuery, UsageRow,
};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;

/// The length of the slots that `ai_cost_in_range` gives, in hours. The web page adds them into longer slots.
const HOURS_OF_A_SLOT: u32 = 1;

/// The name of Claude Code in the field `coding_agent`, the identifier of the coding agent in the web page.
const CLAUDE: &str = "claude";

/// The name of Codex in the field `coding_agent`, the identifier of the coding agent in the web page.
const CODEX: &str = "codex";

/// A workspace folder and the repository that holds it.
#[derive(Debug, Clone)]
struct Workspace {
    /// The root of the Git repository that holds the folder.
    root: String,
    /// The repository in the format `owner/name`, or the message of the error when it cannot be found.
    repository: Result<String, String>,
}

/// What the SQLite file knows about the token usage of one workspace.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostWorkspace {
    /// The root of the Git repository of the workspace.
    pub folder: String,
    /// The repository in the format `owner/name`, or `None` when it cannot be found.
    pub repository: Option<String>,
    /// When the token usage of the workspace was read the last time, in the format ISO 8601, or `None` when the history of the
    /// workspace was never imported.
    pub synchronized_at: Option<String>,
    /// The message of the error when the workspace cannot be read, or `None`.
    pub error: Option<String>,
}

/// What `ai_cost_synchronize` did.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostSynchronization {
    /// The state of each workspace after the synchronization.
    pub workspaces: Vec<AiCostWorkspace>,
    /// The message of the error when the prices of the models could not be refreshed, or `None`. The latest known prices stay
    /// in use.
    pub price_warning: Option<String>,
}

/// The tokens and the cost of one coding agent in one hour: a slot of one hour of a day of the time zone.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostHour {
    /// The start of the hour, in UTC, in the format ISO 8601. It is the start of the day in the time zone plus a whole number of
    /// hours, so in a time zone with a half hour offset it is at a half hour of UTC.
    pub started_at: String,
    /// The date, in the time zone, of the day that holds the hour, in the format `YYYY-MM-DD`.
    pub day: String,
    /// The identifier of the coding agent: `claude` or `codex`.
    pub coding_agent: String,
    /// The tokens of the hour: the input tokens (with the ones read from the cache and written to it) and the output tokens.
    pub tokens: u64,
    /// The estimated cost in US dollars of the tokens that have a known price, or `None` when no token of the hour has one.
    pub cost_usd: Option<f64>,
    /// The tokens of the hour whose model has no known price. They are in `tokens` and not in `cost_usd`.
    pub unpriced_tokens: u64,
}

/// What `ai_cost_in_range` gives.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostAnswer {
    /// The state of each workspace. A workspace that was never imported gives no day.
    pub workspaces: Vec<AiCostWorkspace>,
    /// The tokens and the cost of each coding agent in each hour that had tokens, the oldest hour first.
    pub hours: Vec<AiCostHour>,
    /// The number of the version of the prices that the costs use, or `None` when no price is stored.
    pub price_version: Option<i64>,
    /// When the price list was checked the last time, in the format ISO 8601, or `None` when no price is stored.
    pub prices_checked_at: Option<String>,
}

/// The workspaces of `folders`, each root once, in the order of the folders.
fn workspaces_of(folders: &[String]) -> Vec<Workspace> {
    let mut workspaces: Vec<Workspace> = Vec::new();
    for folder in folders {
        let root = crate::project::find_root(Path::new(folder));
        let root_text = root.display().to_string();
        if workspaces.iter().any(|known| known.root == root_text) {
            continue;
        }
        let repository = find_repository(&root);
        workspaces.push(Workspace { root: root_text, repository });
    }
    workspaces
}

/// The state of `workspace` in the SQLite file: the date of its last synchronization, and its error.
fn state_of(workspace: &Workspace, database: &TokenUsageDatabase, error: Option<String>) -> AiCostWorkspace {
    let (repository, find_error) = match &workspace.repository {
        Ok(repository) => (Some(repository.clone()), None),
        Err(message) => (None, Some(message.clone())),
    };
    let synchronized_at = repository
        .as_deref()
        .and_then(|repository| database.find_synchronization(repository, &workspace.root).ok().flatten())
        .map(|synchronization| synchronization.synchronized_at);
    AiCostWorkspace { folder: workspace.root.clone(), repository, synchronized_at, error: error.or(find_error) }
}

/// Copies the new tokens of the chat session files of each workspace into the SQLite file at `database_path`.
///
/// A workspace that was read before is read again with the mode update: only the chat sessions that changed since its last read
/// are opened. A workspace that was never read is read with the mode initialize, which opens every chat session file, only when
/// `is_import_allowed` is true. Otherwise it is left as it is.
///
/// # Errors
/// An error when the SQLite file cannot be opened. The error of one workspace is in its state, and it does not stop the others.
fn synchronize_workspaces(
    workspaces: &[Workspace],
    is_import_allowed: bool,
    database_path: &Path,
    claude_projects: &Path,
    codex_home: &Path,
    cache: &mut ScanCache,
    now: i64,
) -> Result<Vec<AiCostWorkspace>, String> {
    let mut database = TokenUsageDatabase::open(database_path)?;
    let mut states = Vec::new();
    for workspace in workspaces {
        let Ok(repository) = &workspace.repository else {
            states.push(state_of(workspace, &database, None));
            continue;
        };
        let is_read_before = database.find_synchronization(repository, &workspace.root)?.is_some();
        let mode = match (is_read_before, is_import_allowed) {
            (true, _) => SynchronizationMode::Update,
            (false, true) => SynchronizationMode::Initialize,
            (false, false) => {
                states.push(state_of(workspace, &database, None));
                continue;
            }
        };
        let mut files = TokenUsageFiles { cache: &mut *cache, claude_projects, codex_home };
        let result = synchronize_token_usage(mode, repository, &workspace.root, &mut files, &mut database, now, &ignore_log);
        states.push(state_of(workspace, &database, result.err()));
    }
    Ok(states)
}

/// The identifier of a coding agent in the web page.
fn agent_identifier(coding_agent: CodingAgent) -> &'static str {
    match coding_agent {
        CodingAgent::ClaudeCode => CLAUDE,
        CodingAgent::Codex => CODEX,
    }
}

/// The tokens and the cost of each coding agent in each hour, from the rows of the usage.
fn hours_of(rows: &[UsageRow]) -> Vec<AiCostHour> {
    let mut hours: BTreeMap<(String, &'static str), AiCostHour> = BTreeMap::new();
    for coding_agent in [CodingAgent::ClaudeCode, CodingAgent::Codex] {
        let agent_rows: Vec<UsageRow> = rows.iter().filter(|row| row.coding_agent == coding_agent).cloned().collect();
        for period in summarize_periods(&agent_rows) {
            let tokens = period.totals.token_count();
            if tokens == 0 {
                continue;
            }
            let identifier = agent_identifier(coding_agent);
            hours.insert(
                (period.period_start.clone(), identifier),
                AiCostHour {
                    started_at: period.period_start,
                    day: period.local_day.unwrap_or_default(),
                    coding_agent: identifier.to_string(),
                    tokens,
                    cost_usd: period.totals.cost_usd(),
                    unpriced_tokens: period.totals.unpriced_token_count,
                },
            );
        }
    }
    hours.into_values().collect()
}

/// The tokens and the cost of the workspaces in the time range from `since` to `until` (milliseconds since 1970), by hour of the
/// days of the time zone `time_zone`. It reads the SQLite file at `database_path` only.
///
/// # Errors
/// An error when the time zone is not known, or when the SQLite file cannot be read.
fn read_answer(
    workspaces: &[Workspace],
    database_path: &Path,
    since: i64,
    until: i64,
    time_zone: &str,
) -> Result<AiCostAnswer, String> {
    let mut answer = AiCostAnswer { workspaces: Vec::new(), hours: Vec::new(), price_version: None, prices_checked_at: None };
    if !database_path.exists() {
        answer.workspaces = workspaces
            .iter()
            .map(|workspace| AiCostWorkspace {
                folder: workspace.root.clone(),
                repository: workspace.repository.clone().ok(),
                synchronized_at: None,
                error: workspace.repository.clone().err(),
            })
            .collect();
        return Ok(answer);
    }
    let database = TokenUsageDatabase::open_read_only(database_path)?;
    let mut roots_of_repository: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for workspace in workspaces {
        let state = state_of(workspace, &database, None);
        if let (Some(repository), Some(_)) = (&state.repository, &state.synchronized_at) {
            roots_of_repository.entry(repository.clone()).or_default().push(workspace.root.clone());
        }
        answer.workspaces.push(state);
    }
    let mut rows = Vec::new();
    for (repository, folders) in roots_of_repository {
        let query = UsageQuery {
            repository,
            folders,
            since,
            until,
            grouping: UsageGrouping::by_hours(HOURS_OF_A_SLOT, time_zone),
            is_by_chat: false,
        };
        rows.extend(database.find_usage(&query)?);
    }
    answer.hours = hours_of(&rows);
    if let Some(version) = ModelPriceDatabase::open_read_only(database_path).and_then(|prices| prices.find_latest_version())? {
        answer.price_version = Some(version.version);
        answer.prices_checked_at = Some(version.checked_at);
    }
    Ok(answer)
}

/// Called by the Statistics window to copy the new tokens of the chat session files of the workspaces in `folders` into the SQLite
/// file, and to refresh the prices of the models when they are a day old.
///
/// A workspace whose history was never imported is imported only when `is_import_allowed` is true.
#[tauri::command]
pub async fn ai_cost_synchronize(folders: Vec<String>, is_import_allowed: bool) -> Result<AiCostSynchronization, String> {
    // Off the main thread: reading the chat session files takes a moment.
    tauri::async_runtime::spawn_blocking(move || {
        let database_path = default_database_path();
        let workspaces = workspaces_of(&folders);
        // Two programs that write the SQLite file at the same time would fail with "database is locked". The command line
        // heidrun_data takes the same lock.
        let _guard = heidrun_data::lock_database(&database_path)?;
        let now = chrono::Utc::now().timestamp_millis();
        let claude_projects = crate::claude::claude_dir().join("projects");
        let codex_home = crate::usage::codex_home();
        let states = crate::chats::with_scan_cache(|cache| {
            synchronize_workspaces(&workspaces, is_import_allowed, &database_path, &claude_projects, &codex_home, cache, now)
        })?;
        let price_warning =
            model_prices::refresh_when_due_locked(&database_path, model_prices::public_price_list().as_ref()).err();
        Ok(AiCostSynchronization { workspaces: states, price_warning })
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Called by the Statistics window to read the tokens and the cost of the workspaces in `folders`, by coding agent and by hour of
/// the days of the time zone `time_zone` (an IANA name such as `Europe/Paris`; an empty text is the time zone of the computer),
/// for the time range from `since` to `until`, two texts in ISO 8601. It never opens a chat session file.
#[tauri::command]
pub async fn ai_cost_in_range(
    folders: Vec<String>,
    since: String,
    until: String,
    time_zone: String,
) -> Result<AiCostAnswer, String> {
    let since = parse_time(&since)?.timestamp_millis();
    let until = parse_time(&until)?.timestamp_millis();
    tauri::async_runtime::spawn_blocking(move || {
        let time_zone = if time_zone.is_empty() { local_time_zone_name() } else { time_zone };
        parse_range_bound("1970-01-01", &time_zone)?;
        read_answer(&workspaces_of(&folders), &default_database_path(), since, until, &time_zone)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;

    /// 14 October 2026, 12:00:00 in UTC, in milliseconds since 1 January 1970.
    const NOON: i64 = 1_791_979_200_000;

    /// One day, in milliseconds.
    const DAY: i64 = 86_400_000;

    /// The price list of the tests: one model.
    const PRICE_LIST: &str = r#"{"claude-opus-5":{"litellm_provider":"anthropic","input_cost_per_token":1e-06,
        "output_cost_per_token":5e-06,"cache_read_input_token_cost":1e-07,"cache_creation_input_token_cost":2e-06}}"#;

    /// A scratch folder with a Git repository whose remote `origin` is `owner/name`, a fake folder of Claude Code, a fake folder
    /// of Codex, and the path of a SQLite file. The folder is removed when the value is dropped.
    struct Scratch {
        folder: PathBuf,
    }

    impl Scratch {
        fn new(name: &str) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun-ai-cost-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(folder.join("repository")).unwrap();
            let scratch = Scratch { folder: folder.canonicalize().unwrap() };
            for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:owner/name.git"]] {
                let status = Command::new("git").arg("-C").arg(scratch.repository()).args(arguments).status().unwrap();
                assert!(status.success());
            }
            scratch
        }

        fn repository(&self) -> PathBuf {
            self.folder.join("repository")
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
            let source = data_layer_coding_agents::price_list_source_of(&path.display().to_string());
            ModelPriceDatabase::open(&self.database()).unwrap().refresh(source.as_ref(), NOON, false).unwrap();
        }

        fn synchronize(&self, is_import_allowed: bool) -> Vec<AiCostWorkspace> {
            let workspaces = workspaces_of(&[self.repository().display().to_string()]);
            synchronize_workspaces(
                &workspaces,
                is_import_allowed,
                &self.database(),
                &self.claude_projects(),
                &self.codex_home(),
                &mut ScanCache::in_memory(),
                NOON,
            )
            .unwrap()
        }

        fn read(&self, since: i64, until: i64, time_zone: &str) -> AiCostAnswer {
            read_answer(&workspaces_of(&[self.repository().display().to_string()]), &self.database(), since, until, time_zone).unwrap()
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.folder);
        }
    }

    #[test]
    fn a_history_that_was_never_imported_is_not_read_unless_the_import_is_allowed() {
        let scratch = Scratch::new("import");
        scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
        let states = scratch.synchronize(false);
        assert_eq!(states[0].synchronized_at, None);
        assert_eq!(scratch.read(NOON - DAY, NOON + DAY, "UTC").hours, vec![]);
        let states = scratch.synchronize(true);
        assert!(states[0].synchronized_at.is_some());
        assert_eq!(states[0].repository.as_deref(), Some("owner/name"));
        assert_eq!(scratch.read(NOON - DAY, NOON + DAY, "UTC").hours.len(), 1);
    }

    #[test]
    fn an_imported_history_is_updated_without_the_permission_to_import() {
        let scratch = Scratch::new("update");
        scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
        scratch.synchronize(true);
        scratch.write_claude_chat(&scratch.repository(), "second", &[("2026-10-14T11:00:00.000Z", 200)]);
        scratch.synchronize(false);
        let answer = scratch.read(NOON - DAY, NOON + DAY, "UTC");
        let tokens: Vec<u64> = answer.hours.iter().map(|hour| hour.tokens).collect();
        assert_eq!(tokens, vec![1_100, 1_200], "the first chat is at 10:00 and the second chat is at 11:00");
    }

    #[test]
    fn the_tokens_and_the_cost_of_an_hour_come_from_the_stored_rows_and_the_latest_prices() {
        let scratch = Scratch::new("cost");
        scratch.write_prices();
        scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:00:00.000Z", 100)]);
        scratch.synchronize(true);
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
        scratch.synchronize(true);
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
        for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:owner/name.git"]] {
            assert!(Command::new("git").arg("-C").arg(&inner).args(arguments).status().unwrap().success());
        }
        scratch.write_claude_chat(&inner, "in-inner", &[("2026-10-14T10:00:00.000Z", 100)]);
        scratch.write_claude_chat(&scratch.repository(), "in-root", &[("2026-10-14T10:00:00.000Z", 200)]);
        let folders = [scratch.repository().display().to_string(), inner.display().to_string()];
        let workspaces = workspaces_of(&folders);
        assert_eq!(workspaces.len(), 2);
        synchronize_workspaces(
            &workspaces,
            true,
            &scratch.database(),
            &scratch.claude_projects(),
            &scratch.codex_home(),
            &mut ScanCache::in_memory(),
            NOON,
        )
        .unwrap();
        let answer = read_answer(&workspaces, &scratch.database(), NOON - DAY, NOON + DAY, "UTC").unwrap();
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
        scratch.synchronize(true);
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
        scratch.synchronize(true);
        let workspaces = workspaces_of(&[scratch.repository().display().to_string()]);
        let error = read_answer(&workspaces, &scratch.database(), NOON - DAY, NOON + DAY, "Mars/Olympus").unwrap_err();
        assert!(error.contains("Mars/Olympus"), "{error}");
    }

    #[test]
    fn a_folder_without_a_remote_origin_is_an_error_of_the_workspace_and_not_of_the_call() {
        let scratch = Scratch::new("no-remote");
        let other = scratch.folder.join("other");
        std::fs::create_dir_all(&other).unwrap();
        assert!(Command::new("git").arg("-C").arg(&other).args(["init", "-q"]).status().unwrap().success());
        let workspaces = workspaces_of(&[other.display().to_string()]);
        let states = synchronize_workspaces(
            &workspaces,
            true,
            &scratch.database(),
            &scratch.claude_projects(),
            &scratch.codex_home(),
            &mut ScanCache::in_memory(),
            NOON,
        )
        .unwrap();
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
        scratch.synchronize(true);
        let json = serde_json::to_value(scratch.read(NOON - DAY, NOON + DAY, "UTC")).unwrap();
        assert_eq!(json["hours"][0]["startedAt"], "2026-10-14T10:00:00.000Z");
        assert_eq!(json["hours"][0]["codingAgent"], "claude");
        assert_eq!(json["hours"][0]["unpricedTokens"], 0);
        assert_eq!(json["workspaces"][0]["repository"], "owner/name");
        assert_eq!(json["priceVersion"], 1);
    }

    #[test]
    fn a_text_that_is_not_a_time_is_refused() {
        let error = tauri::async_runtime::block_on(ai_cost_in_range(
            vec!["/work/heidrun".to_string()],
            "yesterday".to_string(),
            "2026-10-14T12:00:00.000Z".to_string(),
            "UTC".to_string(),
        ))
        .unwrap_err();
        assert!(error.contains("is not a time in ISO 8601"));
    }

    #[test]
    fn the_answer_has_one_row_for_each_hour_that_had_tokens() {
        let scratch = Scratch::new("hours");
        scratch.write_claude_chat(
            &scratch.repository(),
            "first",
            &[("2026-10-14T10:00:00.000Z", 1), ("2026-10-14T10:30:00.000Z", 2), ("2026-10-14T13:00:00.000Z", 4)],
        );
        scratch.synchronize(true);
        let hours: Vec<(String, String, u64)> =
            scratch.read(NOON - DAY, NOON + DAY, "UTC").hours.into_iter().map(|hour| (hour.started_at, hour.day, hour.tokens)).collect();
        let hour = |started_at: &str, tokens: u64| (started_at.to_string(), "2026-10-14".to_string(), tokens);
        assert_eq!(hours, vec![hour("2026-10-14T10:00:00.000Z", 2_003), hour("2026-10-14T13:00:00.000Z", 1_004)]);
    }

    #[test]
    fn the_hours_of_a_time_zone_with_a_half_hour_offset_start_at_its_own_local_hours() {
        let scratch = Scratch::new("half-hour");
        scratch.write_claude_chat(&scratch.repository(), "first", &[("2026-10-14T10:40:00.000Z", 1)]);
        scratch.synchronize(true);
        let hours = scratch.read(NOON - DAY, NOON + DAY, "Asia/Kolkata").hours;
        assert_eq!((hours[0].started_at.as_str(), hours[0].day.as_str()), ("2026-10-14T10:30:00.000Z", "2026-10-14"));
    }
}
