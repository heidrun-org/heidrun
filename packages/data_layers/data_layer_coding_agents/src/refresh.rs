//! The refresh interface of the package: the calls that copy what changed in the files of Claude Code and of Codex into the
//! SQLite file, and the prices of the models.
//!
//! A program that shows the chat sessions or the AI cost calls this file to collect, and `query.rs` to read. The two never mix:
//! a read never opens a chat session file. The caller holds the lock of the SQLite file during a refresh, so two programs never
//! write the file at the same time.

use crate::coding_agents::agent_homes::{claude_dir, codex_home};
use crate::coding_agents::scan_cache::{ScanCache, CACHE_FILE_NAME};
use crate::coding_agents::session_reader::{parse_date, read_chat_session_files};
use crate::coding_agents::token_usage_reader::TokenUsageFiles;
use crate::model::ai_cost_types::{AiCostSynchronization, AiCostWorkspace};
use crate::model::price_types::PriceRefresh;
use crate::model::types::{SynchronizationMode, SynchronizationReport};
use crate::pricing::price_list_parser::PRICE_LIST_ADDRESS;
use crate::pricing::price_list_source::{price_list_source_of, PriceListSource};
use crate::repository_finder::{find_repository, find_repository_key};
use crate::storage::database::ChatSessionsDatabase;
use crate::storage::model_price_database::ModelPriceDatabase;
use crate::storage::token_usage_database::TokenUsageDatabase;
use crate::synchronization::run_token_usage;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Mutex;

/// The shortest time between two tries to fetch the price list, in milliseconds: one hour. A computer without a network does not
/// wait for a fetch each time it is asked.
const PRICE_RETRY_MILLISECONDS: i64 = 3_600_000;

/// The name of the file where an earlier version of Heidrun kept its prices, next to the SQLite file. The SQLite file replaces it.
const OLD_PRICES_FILE: &str = "model_prices.json";

/// The caches of the scans of the process, by the path of their file. A cache stays in memory between two refreshes, so a chat
/// session file that did not change is not read again.
static SHARED_CACHES: Mutex<Option<HashMap<PathBuf, ScanCache>>> = Mutex::new(None);

/// When the last try to fetch the price list started, in milliseconds since 1970. Zero before the first try.
static LAST_PRICE_TRY_AT: AtomicI64 = AtomicI64::new(0);

/// Copies the chat sessions of Claude Code and of Codex that started in the workspace at `root` and changed since the last read
/// into the SQLite file at `database_path`. The SQLite file and its tables are created when they do not exist.
///
/// - The mode is initialize, which opens every chat session file, when the SQLite file holds no chat session of the workspace.
/// - Otherwise the mode is update: only the chat session files that changed since the last read are opened.
/// - A stored chat session whose file does not exist any more is deleted, so the list never shows a chat session that is gone.
///
/// The cache of the scans of the process saves its scans in the file `chats_cache.json` next to the SQLite file.
///
/// # Errors
/// An error when the SQLite file cannot be opened or written.
pub fn refresh_chat_sessions(database_path: &Path, root: &str) -> Result<SynchronizationReport, String> {
    refresh_chat_sessions_in(database_path, root, &claude_dir().join("projects"), &codex_home())
}

/// Like `refresh_chat_sessions`, with the folders of the coding agents given. It is the operation of the log: it holds the
/// opening and the saving of the cache of the scans, and the work of `refresh_chat_sessions_with`.
pub(crate) fn refresh_chat_sessions_in(
    database_path: &Path,
    root: &str,
    claude_projects: &Path,
    codex_home: &Path,
) -> Result<SynchronizationReport, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_chat_sessions", OperationKind::Synchronization)
        .parameter("root", root)
        .database(database_path);
    record(
        spec,
        || {
            with_shared_scan_cache(database_path, |cache| {
                refresh_chat_sessions_with(database_path, root, claude_projects, codex_home, cache)
            })
        },
        |report| Summary::count(report.chat_session_count).detail("mode", report.mode.name()),
    )
}

/// Like `refresh_chat_sessions`, with the folders of the coding agents and the cache of the scans given. The tests give a fake
/// folder for each coding agent.
pub(crate) fn refresh_chat_sessions_with(
    database_path: &Path,
    root: &str,
    claude_projects: &Path,
    codex_home: &Path,
    cache: &mut ScanCache,
) -> Result<SynchronizationReport, String> {
    let repository = find_repository_key(Path::new(root));
    let mut database = ChatSessionsDatabase::open(database_path)?;
    let since = database.find_last_updated_at_in_folder(&repository, root)?;
    let mode = if since.is_some() { SynchronizationMode::Update } else { SynchronizationMode::Initialize };
    let read =
        read_chat_session_files(cache, claude_projects, codex_home, root, since.as_deref().and_then(parse_date), &crate::ignore_log);
    database.upsert_chat_sessions(&repository, &read.records)?;
    database.delete_chat_sessions_not_in(&repository, root, &read.kept_ids)?;
    Ok(SynchronizationReport { mode, repository, since, chat_session_count: read.records.len() })
}

/// Copies the new tokens of the chat session files of each workspace into the SQLite file at `database_path`, then refreshes the
/// prices of the models when they are a day old. `roots` are the root folders of the workspaces. A root that is there two times
/// counts once. `now` is the time of now in milliseconds since 1970.
///
/// A workspace that was read before is read again with the mode update: only the chat sessions that changed since its last read
/// are opened. A workspace that was never read is read with the mode initialize, which opens every chat session file, only when
/// `is_import_allowed` is true. Otherwise it is left as it is.
///
/// # Errors
/// An error when the SQLite file cannot be opened. The error of one workspace is in its state, and it does not stop the others.
/// An error of the prices is in `price_warning`, and the latest known prices stay in use.
pub fn refresh_ai_cost(
    database_path: &Path,
    roots: &[String],
    is_import_allowed: bool,
    now: i64,
) -> Result<AiCostSynchronization, String> {
    refresh_ai_cost_in(database_path, roots, is_import_allowed, now, &claude_dir().join("projects"), &codex_home())
}

/// Like `refresh_ai_cost`, with the folders of the coding agents given. It is the operation of the log: it holds the token usage of
/// each workspace and the refresh of the prices.
pub(crate) fn refresh_ai_cost_in(
    database_path: &Path,
    roots: &[String],
    is_import_allowed: bool,
    now: i64,
    claude_projects: &Path,
    codex_home: &Path,
) -> Result<AiCostSynchronization, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_ai_cost", OperationKind::Synchronization)
        .parameter("roots", roots)
        .choice("isImportAllowed", is_import_allowed)
        .parameter("now", now)
        .database(database_path);
    record(
        spec,
        || refresh_ai_cost_inside(database_path, roots, is_import_allowed, now, claude_projects, codex_home),
        |answer| {
            Summary::count(answer.workspaces.len())
                .detail("workspaceErrorCount", answer.workspaces.iter().filter(|workspace| workspace.error.is_some()).count())
                .detail("hasPriceWarning", answer.price_warning.is_some())
        },
    )
}

/// The work of `refresh_ai_cost_in`, between the start event and the completion event of its operation.
fn refresh_ai_cost_inside(
    database_path: &Path,
    roots: &[String],
    is_import_allowed: bool,
    now: i64,
    claude_projects: &Path,
    codex_home: &Path,
) -> Result<AiCostSynchronization, String> {
    let workspaces = with_shared_scan_cache(database_path, |cache| {
        refresh_workspaces_with(database_path, roots, is_import_allowed, claude_projects, codex_home, cache, now)
    })?;
    let public_source = price_list_source_of(PRICE_LIST_ADDRESS);
    let price_warning = refresh_model_prices_when_due(database_path, public_source.as_ref(), now).err();
    Ok(AiCostSynchronization { workspaces, price_warning })
}

/// Like the first half of `refresh_ai_cost`, with the folders of the coding agents and the cache of the scans given.
pub(crate) fn refresh_workspaces_with(
    database_path: &Path,
    roots: &[String],
    is_import_allowed: bool,
    claude_projects: &Path,
    codex_home: &Path,
    cache: &mut ScanCache,
    now: i64,
) -> Result<Vec<AiCostWorkspace>, String> {
    let mut database = TokenUsageDatabase::open(database_path)?;
    let mut states = Vec::new();
    for root in distinct(roots) {
        let repository = match find_repository(Path::new(&root)) {
            Ok(repository) => repository,
            Err(message) => {
                states.push(state_of(&root, Err(message), &database, None));
                continue;
            }
        };
        let is_read_before = database.find_synchronization(&repository, &root)?.is_some();
        let mode = match (is_read_before, is_import_allowed) {
            (true, _) => SynchronizationMode::Update,
            (false, true) => SynchronizationMode::Initialize,
            (false, false) => {
                states.push(state_of(&root, Ok(repository), &database, None));
                continue;
            }
        };
        let mut files = TokenUsageFiles { cache: &mut *cache, claude_projects, codex_home };
        let result = run_token_usage(mode, &repository, &root, &mut files, &mut database, now, &crate::ignore_log);
        states.push(state_of(&root, Ok(repository), &database, result.err()));
    }
    Ok(states)
}

/// The state of the workspace at `root` in the SQLite file: the date of its last synchronization, and its error.
pub(crate) fn state_of(
    root: &str,
    repository: Result<String, String>,
    database: &TokenUsageDatabase,
    error: Option<String>,
) -> AiCostWorkspace {
    let (repository, find_error) = match repository {
        Ok(repository) => (Some(repository), None),
        Err(message) => (None, Some(message)),
    };
    let synchronized_at = repository
        .as_deref()
        .and_then(|repository| database.find_synchronization(repository, root).ok().flatten())
        .map(|synchronization| synchronization.synchronized_at);
    AiCostWorkspace { folder: root.to_string(), repository, synchronized_at, error: error.or(find_error) }
}

/// The roots without the ones that are there before, in the order of `roots`.
pub(crate) fn distinct(roots: &[String]) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for root in roots {
        if !found.contains(root) {
            found.push(root.clone());
        }
    }
    found
}

/// Fetches the price list from `source` when the latest version in the SQLite file at `database_path` is a day old, or when
/// `is_forced` is true, and keeps it there. The earlier file of prices of Heidrun, `model_prices.json` next to the SQLite file, is
/// deleted when the prices are in the SQLite file.
///
/// # Errors
/// An error when the SQLite file or the price list cannot be read. The prices that the file holds are not changed then.
pub fn refresh_model_prices(
    database_path: &Path,
    source: &dyn PriceListSource,
    is_forced: bool,
    now: i64,
) -> Result<PriceRefresh, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_model_prices", OperationKind::Synchronization)
        .choice("isForced", is_forced)
        .parameter("now", now)
        .database(database_path);
    record(spec, || refresh_model_prices_inside(database_path, source, is_forced, now), |refresh| {
        Summary::count(1).detail("result", price_refresh_name(refresh))
    })
}

/// The name of what a refresh of the prices did, as the log writes it.
fn price_refresh_name(refresh: &PriceRefresh) -> &'static str {
    match refresh {
        PriceRefresh::Fresh { .. } => "fresh",
        PriceRefresh::Unchanged { .. } => "unchanged",
        PriceRefresh::NewVersion { .. } => "new_version",
    }
}

/// The work of `refresh_model_prices`, between the start event and the completion event of its operation.
fn refresh_model_prices_inside(
    database_path: &Path,
    source: &dyn PriceListSource,
    is_forced: bool,
    now: i64,
) -> Result<PriceRefresh, String> {
    let result = ModelPriceDatabase::open(database_path)?.refresh(source, now, is_forced)?;
    let _ = std::fs::remove_file(database_path.with_file_name(OLD_PRICES_FILE));
    Ok(result)
}

/// Like `refresh_model_prices` without force, but it tries at most once an hour, whatever the outcome. Returns `Ok(None)` when
/// the last try is less than an hour old.
///
/// # Errors
/// The same as `refresh_model_prices`.
pub fn refresh_model_prices_when_due(
    database_path: &Path,
    source: &dyn PriceListSource,
    now: i64,
) -> Result<Option<PriceRefresh>, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_model_prices_when_due", OperationKind::Synchronization)
        .parameter("now", now)
        .database(database_path);
    record(spec, || refresh_model_prices_when_due_inside(database_path, source, now), |refresh| {
        Summary::count(usize::from(refresh.is_some()))
    })
}

/// The work of `refresh_model_prices_when_due`, between the start event and the completion event of its operation.
fn refresh_model_prices_when_due_inside(
    database_path: &Path,
    source: &dyn PriceListSource,
    now: i64,
) -> Result<Option<PriceRefresh>, String> {
    if now - LAST_PRICE_TRY_AT.load(Ordering::SeqCst) <= PRICE_RETRY_MILLISECONDS {
        return Ok(None);
    }
    LAST_PRICE_TRY_AT.store(now, Ordering::SeqCst);
    refresh_model_prices(database_path, source, false, now).map(Some)
}

/// Like `refresh_model_prices_when_due`, with the public price list of the project LiteLLM as the source. The desktop application
/// calls this function, so it needs no price source of its own.
///
/// # Errors
/// The same as `refresh_model_prices`.
pub fn refresh_public_model_prices_when_due(database_path: &Path, now: i64) -> Result<Option<PriceRefresh>, String> {
    let source = price_list_source_of(PRICE_LIST_ADDRESS);
    refresh_model_prices_when_due(database_path, source.as_ref(), now)
}

/// Runs `action` with the cache of the scans that belongs to the SQLite file at `database_path`: the file `chats_cache.json`
/// next to it. The cache is opened on the first call and stays in memory. Two calls never run at the same time. The cache is
/// saved on the disk when `action` ends.
fn with_shared_scan_cache<Result>(database_path: &Path, action: impl FnOnce(&mut ScanCache) -> Result) -> Result {
    let cache_path = database_path.with_file_name(CACHE_FILE_NAME);
    let mut guard = SHARED_CACHES.lock().unwrap_or_else(|error| error.into_inner());
    let caches = guard.get_or_insert_with(HashMap::new);
    let cache = caches.entry(cache_path.clone()).or_insert_with(|| ScanCache::open(cache_path));
    let result = action(cache);
    cache.save();
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coding_agents::session_files::claude_folder_name;
    use crate::model::types::ChatSessionTable;
    use crate::pricing::price_list_source::FilePriceListSource;
    use crate::test_samples::{codex_file, codex_message, temp_folder, write_file};

    const TYPED: &str = r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;

    /// A fake home with two chat sessions of Claude Code and one of Codex for `/work/app`.
    fn fixture(name: &str) -> (PathBuf, PathBuf) {
        let directory = temp_folder(name);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("older.jsonl"), &format!("{TYPED}\n"), 1000);
        write_file(&project.join("newer.jsonl"), &format!("{TYPED}\n"), 500);
        codex_file(&directory, "2026/10/10", "01a12c31-175b-7513-b12c-bba764f46420", "/work/app", &[&codex_message("Hi")], 800);
        (directory.clone(), directory.join("data_layer.sqlite"))
    }

    fn refresh(directory: &Path, database_path: &Path, cache: &mut ScanCache) -> SynchronizationReport {
        refresh_chat_sessions_with(database_path, "/work/app", &directory.join("projects"), directory, cache).unwrap()
    }

    #[test]
    fn reads_everything_the_first_time_and_then_only_what_changed() {
        let (directory, database_path) = fixture("refresh_chats");
        let mut cache = ScanCache::in_memory();
        let first = refresh(&directory, &database_path, &mut cache);
        assert_eq!((first.mode, first.since.clone(), first.chat_session_count), (SynchronizationMode::Initialize, None, 3));
        let second = refresh(&directory, &database_path, &mut cache);
        assert_eq!((second.mode, second.chat_session_count), (SynchronizationMode::Update, 1));
        let database = ChatSessionsDatabase::open_read_only(&database_path).unwrap();
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, &first.repository), Ok(3));
    }

    #[test]
    fn deletes_the_stored_chat_session_of_a_file_that_does_not_exist_any_more() {
        let (directory, database_path) = fixture("refresh_deleted");
        let mut cache = ScanCache::in_memory();
        let first = refresh(&directory, &database_path, &mut cache);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        std::fs::remove_file(project.join("older.jsonl")).unwrap();
        refresh(&directory, &database_path, &mut cache);
        let database = ChatSessionsDatabase::open_read_only(&database_path).unwrap();
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, &first.repository), Ok(2));
        assert_eq!(database.find_chat_session(&first.repository, "older"), Ok(None));
    }

    #[test]
    fn reads_everything_again_for_a_folder_that_has_no_stored_chat_session() {
        let (directory, database_path) = fixture("refresh_second_folder");
        let mut cache = ScanCache::in_memory();
        refresh(&directory, &database_path, &mut cache);
        let report = refresh_chat_sessions_with(&database_path, "/work/other", &directory.join("projects"), &directory, &mut cache)
            .unwrap();
        assert_eq!((report.mode, report.chat_session_count), (SynchronizationMode::Initialize, 0));
    }

    #[test]
    fn stores_a_workspace_without_a_remote_under_its_folder() {
        let (directory, database_path) = fixture("refresh_no_remote");
        let report = refresh(&directory, &database_path, &mut ScanCache::in_memory());
        assert_eq!(report.repository, "/work/app");
    }

    #[test]
    fn keeps_the_scans_in_one_cache_file_next_to_the_sqlite_file_and_in_memory_between_two_calls() {
        let (directory, database_path) = fixture("refresh_shared_cache");
        let scan_count = |database_path: &Path| {
            with_shared_scan_cache(database_path, |cache| {
                refresh_chat_sessions_with(database_path, "/work/app", &directory.join("projects"), &directory, cache).unwrap();
                cache.scan_count()
            })
        };
        let first = scan_count(&database_path);
        assert!(first > 0);
        assert!(directory.join(CACHE_FILE_NAME).exists());
        assert_eq!(scan_count(&database_path), first, "the second refresh opened no file again");
    }

    #[test]
    fn a_refresh_of_the_chat_sessions_is_one_operation_that_holds_the_cache_the_reads_and_the_writes() {
        let (directory, database_path) = fixture("refresh_events");
        let (report, events) =
            data_layer_operation_log::testing::capture(|| refresh_chat_sessions_in(&database_path, "/work/app", &directory.join("projects"), &directory).unwrap());
        assert_eq!(report.chat_session_count, 3);
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "coding_agents.refresh_chat_sessions");
        for nested in ["find_last_updated_at_in_folder", "read_chat_session_files", "delete_chat_sessions_not_in"] {
            assert!(tree.contains(&format!("  coding_agents.{nested}")), "{nested} is missing in {tree:?}");
        }
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[0].kind, data_layer_operation_log::OperationKind::Synchronization);
        assert_eq!(starts[0].parameters["root"], "/work/app");
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!((complete.result_count, complete.details["mode"].as_str()), (Some(3), Some("initialize")));
    }

    #[test]
    fn a_refresh_of_the_prices_records_what_it_did_and_the_check_when_due_records_that_it_did_nothing() {
        let directory = temp_folder("refresh_prices_events");
        let database_path = directory.join("data_layer.sqlite");
        let list_path = directory.join("list.json");
        std::fs::write(&list_path, PRICE_LIST).unwrap();
        let source = FilePriceListSource::new(list_path);
        let (_, events) =
            data_layer_operation_log::testing::capture(|| refresh_model_prices(&database_path, &source, false, 1_791_979_200_000).unwrap());
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "coding_agents.refresh_model_prices");
        assert!(tree.contains(&"  coding_agents.refresh_prices".to_string()), "{tree:?}");
        let starts = data_layer_operation_log::testing::starts(&events);
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.details["result"], "new_version");
        let now = 1_791_979_200_000;
        let (first, first_events) = data_layer_operation_log::testing::capture(|| refresh_model_prices_when_due(&database_path, &source, now).unwrap());
        let (second, second_events) = data_layer_operation_log::testing::capture(|| refresh_model_prices_when_due(&database_path, &source, now).unwrap());
        assert_eq!((first.is_some(), second.is_some()), (true, false));
        let first_starts = data_layer_operation_log::testing::starts(&first_events);
        let second_starts = data_layer_operation_log::testing::starts(&second_events);
        assert_eq!(data_layer_operation_log::testing::completion_of(&first_events, &first_starts[0].operation_id).unwrap().result_count, Some(1));
        assert_eq!(data_layer_operation_log::testing::completion_of(&second_events, &second_starts[0].operation_id).unwrap().result_count, Some(0));
        assert_eq!(data_layer_operation_log::testing::tree(&second_events), vec!["coding_agents.refresh_model_prices_when_due"]);
    }

    #[test]
    fn counts_a_root_that_is_there_two_times_once() {
        let roots = vec!["/a".to_string(), "/b".to_string(), "/a".to_string()];
        assert_eq!(distinct(&roots), vec!["/a", "/b"]);
    }

    const PRICE_LIST: &str = r#"{"claude-opus-5":{"litellm_provider":"anthropic","input_cost_per_token":1e-06,
        "output_cost_per_token":5e-06,"cache_read_input_token_cost":1e-07,"cache_creation_input_token_cost":2e-06}}"#;

    #[test]
    fn keeps_the_prices_in_the_sqlite_file_and_deletes_the_earlier_file_of_prices() {
        let directory = temp_folder("refresh_prices");
        let database_path = directory.join("data_layer.sqlite");
        let list_path = directory.join("list.json");
        std::fs::write(&list_path, PRICE_LIST).unwrap();
        std::fs::write(directory.join(OLD_PRICES_FILE), "{}").unwrap();
        let result = refresh_model_prices(&database_path, &FilePriceListSource::new(list_path), false, 1_791_979_200_000).unwrap();
        assert!(matches!(result, PriceRefresh::NewVersion { .. }), "{result:?}");
        assert!(!directory.join(OLD_PRICES_FILE).exists());
        let table = ModelPriceDatabase::open_read_only(&database_path).unwrap().load_latest_table().unwrap();
        assert!(table.price_of("claude-opus-5").is_some());
    }
}
