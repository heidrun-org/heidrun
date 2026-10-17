//! The query interface of the package: the typed reads that a program uses to show the chat sessions and the AI cost. A read opens
//! the SQLite file only. It never opens a chat session file, it never runs the command `git`, and it never uses the network.
//!
//! The cost of a chat session or of an hour is calculated here, at the prices of the latest version in the SQLite file, so a
//! program never multiplies tokens by a price.

use crate::coding_agents::session_reader::parse_date;
use crate::coding_agents::scan::ChatMeta;
use crate::model::ai_cost_types::{AiCostAnswer, AiCostHour, AiCostWorkspace};
use crate::model::chat_list_types::{AgentChats, Chat, ChatList, ChatUsage, SortKey, SortOrder, Sorting, MAX_LIMIT};
use crate::model::token_usage_types::{UsageGrouping, UsageQuery, UsageRow};
use crate::model::types::{ChatSession, ChatSessionRelations, CodingAgent};
use crate::pricing::price_table::PriceTable;
use crate::refresh::distinct;
use crate::storage::database::ChatSessionsDatabase;
use crate::storage::model_price_database::ModelPriceDatabase;
use crate::storage::token_usage_database::TokenUsageDatabase;
use crate::storage::usage_grouping::{parse_range_bound, summarize_periods};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::Path;

/// The length of the slots that `find_ai_cost` gives, in hours. A program adds them into longer slots.
const HOURS_OF_A_SLOT: u32 = 1;

/// The identifier of Claude Code in the field `coding_agent` of an hour, the identifier of the coding agent in the web page.
const CLAUDE: &str = "claude";

/// The identifier of Codex in the field `coding_agent` of an hour, the identifier of the coding agent in the web page.
const CODEX: &str = "codex";

/// The first `limit` chat sessions of Claude Code and of Codex that started in the workspace at `root`, read from the SQLite file
/// at `database_path`, sorted by `sorting`. `limit` is cut to the range 1 to 10 000 for each coding agent.
///
/// The answer is what the last refresh stored. A SQLite file that does not exist, or that holds no chat session of the workspace,
/// gives two empty lists: the chat sessions were never copied yet.
///
/// # Errors
/// An error when the SQLite file cannot be read.
pub fn find_chat_list(database_path: &Path, root: &str, limit: usize, sorting: Sorting) -> Result<ChatList, String> {
    let root = root.trim_end_matches('/').to_string();
    let mut list = ChatList { root: root.clone(), ..ChatList::default() };
    if !database_path.exists() {
        return Ok(list);
    }
    let database = ChatSessionsDatabase::open_read_only(database_path)?;
    if !database.has_chat_sessions_table()? {
        return Ok(list);
    }
    let sessions = database.find_chat_sessions_in_folder(&root)?;
    let relations = database.find_relations_in_folder(&root)?;
    let prices = ModelPriceDatabase::open_read_only(database_path).and_then(|prices| prices.load_latest_table()).unwrap_or_default();
    let limit = limit.clamp(1, MAX_LIMIT);
    list.claude = agent_chats(&sessions, &relations, CodingAgent::ClaudeCode, &root, limit, sorting, &prices);
    list.codex = agent_chats(&sessions, &relations, CodingAgent::Codex, &root, limit, sorting, &prices);
    Ok(list)
}

/// The tokens and the cost of the workspaces at `roots` in the time range from `since` to `until` (milliseconds since 1970), by hour
/// of the days of the time zone `time_zone`, read from the SQLite file at `database_path`.
///
/// The repository of a workspace is the one that the last refresh stored, so a workspace whose folder has no remote `origin` is
/// reported as never imported here, and its error is in the answer of the refresh.
///
/// # Errors
/// An error when the time zone is not known, or when the SQLite file cannot be read.
pub fn find_ai_cost(
    database_path: &Path,
    roots: &[String],
    since: i64,
    until: i64,
    time_zone: &str,
) -> Result<AiCostAnswer, String> {
    parse_range_bound("1970-01-01", time_zone)?;
    let mut answer = AiCostAnswer { workspaces: Vec::new(), hours: Vec::new(), price_version: None, prices_checked_at: None };
    let roots = distinct(roots);
    if !database_path.exists() {
        answer.workspaces = roots.iter().map(|root| never_imported(root)).collect();
        return Ok(answer);
    }
    let database = TokenUsageDatabase::open_read_only(database_path)?;
    let mut roots_of_repository: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for root in &roots {
        let synchronization = database.find_latest_synchronization_of_folder(root)?;
        let Some(synchronization) = synchronization else {
            answer.workspaces.push(never_imported(root));
            continue;
        };
        roots_of_repository.entry(synchronization.repository.clone()).or_default().push(root.clone());
        answer.workspaces.push(AiCostWorkspace {
            folder: root.clone(),
            repository: Some(synchronization.repository),
            synchronized_at: Some(synchronization.synchronized_at),
            error: None,
        });
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

///////////////////////////////////////////////////////////////////////////////
// The chat list
///////////////////////////////////////////////////////////////////////////////

/// The chat sessions of one coding agent, sorted and cut to `limit`.
fn agent_chats(
    sessions: &[ChatSession],
    relations: &HashMap<String, ChatSessionRelations>,
    coding_agent: CodingAgent,
    root: &str,
    limit: usize,
    sorting: Sorting,
    prices: &PriceTable,
) -> AgentChats {
    let empty = ChatSessionRelations::default();
    let mut keyed: Vec<(i64, Chat)> = sessions
        .iter()
        .filter(|session| session.coding_agent == coding_agent)
        .map(|session| {
            let chat = chat_of(session, relations.get(&session.id).unwrap_or(&empty), prices);
            (sort_value(&chat, root, sorting.key), chat)
        })
        .collect();
    keyed.sort_by(|a, b| {
        if sorting.key == SortKey::LastUpdated {
            let by_date = match sorting.order {
                SortOrder::Descending => b.1.updated_at.cmp(&a.1.updated_at),
                SortOrder::Ascending => a.1.updated_at.cmp(&b.1.updated_at),
            };
            return by_date.then_with(|| a.1.id.cmp(&b.1.id));
        }
        let by_value = match sorting.order {
            SortOrder::Descending => b.0.cmp(&a.0),
            SortOrder::Ascending => a.0.cmp(&b.0),
        };
        by_value.then_with(|| b.1.updated_at.cmp(&a.1.updated_at)).then_with(|| a.1.id.cmp(&b.1.id))
    });
    let has_more = keyed.len() > limit;
    AgentChats { chats: keyed.into_iter().take(limit).map(|(_, chat)| chat).collect(), has_more }
}

/// The chat of a stored chat session and its relations.
fn chat_of(session: &ChatSession, relations: &ChatSessionRelations, prices: &PriceTable) -> Chat {
    let meta = ChatMeta {
        first_at: session.first_record_at.as_deref().and_then(parse_date),
        last_at: session.last_record_at.as_deref().and_then(parse_date),
        user_messages: session.user_message_count,
        first_messages: session.first_messages.clone(),
        folders: relations.folders.iter().cloned().collect(),
        issues: relations.issues.iter().filter_map(|number| u32::try_from(*number).ok()).collect(),
        pull_requests: relations.pull_requests.iter().filter_map(|number| u32::try_from(*number).ok()).collect(),
        files_written: relations.files_written.iter().cloned().collect(),
        is_review_chat: false,
    };
    Chat {
        id: session.id.clone(),
        title: session.title.clone(),
        updated_at: parse_date(&session.updated_at).unwrap_or_default(),
        meta,
        usage: usage_of(session, prices),
    }
}

/// The tokens of a chat session and their cost. `None` when the chat session used no token.
fn usage_of(session: &ChatSession, prices: &PriceTable) -> Option<ChatUsage> {
    let mut usage = ChatUsage { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cost_usd: None };
    for tokens in &session.tokens {
        usage.input_tokens += tokens.fresh_input + tokens.cached_input + tokens.cache_write_input;
        usage.cached_input_tokens += tokens.cached_input;
        usage.output_tokens += tokens.output;
    }
    if usage.input_tokens + usage.output_tokens == 0 {
        return None;
    }
    usage.cost_usd = prices.cost(&session.tokens);
    Some(usage)
}

/// The number that a chat is sorted by: a date in milliseconds since 1970, or a count.
fn sort_value(chat: &Chat, root: &str, key: SortKey) -> i64 {
    match key {
        SortKey::CreatedOn => chat.meta.first_at.unwrap_or(chat.updated_at),
        SortKey::LastUpdated => chat.updated_at,
        SortKey::Messages => i64::from(chat.meta.user_messages),
        SortKey::Issues => chat.meta.issues.len() as i64,
        SortKey::PullRequests => chat.meta.pull_requests.len() as i64,
        SortKey::FilesWritten => written_file_count(&chat.meta.files_written, root) as i64,
    }
}

/// The number of different files that a chat session wrote. A file written in a worktree of the repository
/// (`.claude/worktrees/<name>/...` below `root`) and the same file at the root count as one, as the summary of the chat session
/// counts them.
fn written_file_count(files: &BTreeSet<String>, root: &str) -> usize {
    let prefix = format!("{}/", root.trim_end_matches('/'));
    let names: HashSet<String> = files
        .iter()
        .map(|path| match path.strip_prefix(&prefix) {
            Some(relative) => strip_worktree(relative).to_string(),
            None => path.clone(),
        })
        .collect();
    names.len()
}

/// The path without its first part `.claude/worktrees/<name>/`, when it starts with this part.
fn strip_worktree(relative: &str) -> &str {
    relative
        .strip_prefix(".claude/worktrees/")
        .and_then(|rest| rest.split_once('/'))
        .filter(|(name, _)| !name.is_empty())
        .map_or(relative, |(_, path)| path)
}

///////////////////////////////////////////////////////////////////////////////
// The AI cost
///////////////////////////////////////////////////////////////////////////////

/// The state of a workspace whose token usage was never copied: no repository, no date, no error. The repository of a folder is
/// found by the refresh, with the command `git`, and a read never runs it.
fn never_imported(root: &str) -> AiCostWorkspace {
    AiCostWorkspace { folder: root.to_string(), repository: None, synchronized_at: None, error: None }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coding_agents::scan_cache::ScanCache;
    use crate::coding_agents::session_files::claude_folder_name;
    use crate::model::price_types::ModelPrice;
    use crate::refresh::refresh_chat_sessions_with;
    use crate::test_samples::{codex_file, codex_message, temp_folder, write_file};
    use std::path::PathBuf;

    const ROOT: &str = "/work/app";

    /// A title line, a message line with the date `timestamp`, and an answer line for Claude Code.
    fn title_line(title: &str) -> String {
        format!(r#"{{"type":"custom-title","customTitle":"{title}","sessionId":"x"}}"#)
    }

    fn user_line(timestamp: &str, text: &str) -> String {
        format!(
            r#"{{"type":"user","cwd":"{ROOT}","timestamp":"{timestamp}","message":{{"role":"user","content":"{text}"}}}}"#
        )
    }

    fn write_tool_line(path: &str) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"2026-10-11T10:00:05.000Z","message":{{"role":"assistant","content":[{{"type":"tool_use","name":"Write","input":{{"file_path":"{path}"}}}}]}}}}"#
        )
    }

    fn answer_line(id: &str, model: &str, output: u64) -> String {
        format!(
            r#"{{"type":"assistant","message":{{"id":"{id}","model":"{model}","content":[],"usage":{{"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":4000,"output_tokens":{output}}}}}}}"#
        )
    }

    /// Writes a chat session of Claude Code for the root, `age_seconds` before now, and returns nothing.
    fn write_chat(directory: &Path, name: &str, lines: &[String], age_seconds: u64) {
        let mut all = vec![title_line(name)];
        all.extend(lines.iter().cloned());
        let project = directory.join("projects").join(claude_folder_name(ROOT));
        write_file(&project.join(format!("{name}.jsonl")), &format!("{}\n", all.join("\n")), age_seconds);
    }

    /// Refreshes the chat sessions of the fake home into a new SQLite file and gives the path of the file.
    fn stored(directory: &Path) -> PathBuf {
        let database_path = directory.join("data_layer.sqlite");
        refresh_chat_sessions_with(&database_path, ROOT, &directory.join("projects"), directory, &mut ScanCache::in_memory())
            .unwrap();
        database_path
    }

    fn titles(agent_chats: &AgentChats) -> Vec<&str> {
        agent_chats.chats.iter().map(|chat| chat.title.as_str()).collect()
    }

    fn sorted(database_path: &Path, limit: usize, key: SortKey, order: SortOrder) -> AgentChats {
        find_chat_list(database_path, ROOT, limit, Sorting { key, order }).unwrap().claude
    }

    #[test]
    fn lists_the_chat_sessions_newest_first_and_tells_when_there_are_more() {
        let directory = temp_folder("query_limit");
        for (index, age) in [(1, 400), (2, 300), (3, 200), (4, 100)] {
            write_chat(&directory, &format!("Chat {index}"), &[], age);
        }
        let database_path = stored(&directory);
        let found = find_chat_list(&database_path, ROOT, 2, Sorting::default()).unwrap();
        assert_eq!(found.root, ROOT);
        assert_eq!(titles(&found.claude), vec!["Chat 4", "Chat 3"]);
        assert!(found.claude.has_more);
        let found = find_chat_list(&database_path, ROOT, 4, Sorting::default()).unwrap();
        assert_eq!(titles(&found.claude), vec!["Chat 4", "Chat 3", "Chat 2", "Chat 1"]);
        assert!(!found.claude.has_more);
    }

    #[test]
    fn gives_empty_lists_when_nothing_was_copied_yet() {
        let directory = temp_folder("query_nothing");
        let missing = directory.join("none.sqlite");
        let found = find_chat_list(&missing, ROOT, 5, Sorting::default()).unwrap();
        assert_eq!((found.root.as_str(), found.claude, found.codex), (ROOT, AgentChats::default(), AgentChats::default()));
        assert!(!missing.exists(), "a read never creates the file");
        let other = directory.join("other.sqlite");
        rusqlite::Connection::open(&other).unwrap().execute_batch("CREATE TABLE other (a TEXT)").unwrap();
        assert_eq!(find_chat_list(&other, ROOT, 5, Sorting::default()).unwrap().claude, AgentChats::default());
    }

    #[test]
    fn answers_the_root_without_its_last_slash() {
        let directory = temp_folder("query_root");
        let found = find_chat_list(&directory.join("none.sqlite"), "/work/app/", 5, Sorting::default()).unwrap();
        assert_eq!(found.root, "/work/app");
    }

    #[test]
    fn lists_the_chat_sessions_of_codex_apart_with_the_title_of_the_index() {
        let directory = temp_folder("query_codex");
        let id = "01a12c31-175b-7513-b12c-bba764f46420";
        codex_file(&directory, "2026/10/10", id, ROOT, &[&codex_message("Please fix issue 250")], 5);
        write_file(&directory.join("session_index.jsonl"), &format!("{{\"id\":\"{id}\",\"thread_name\":\"Fix it\"}}\n"), 1);
        write_chat(&directory, "Claude", &[], 10);
        let found = find_chat_list(&stored(&directory), ROOT, 5, Sorting::default()).unwrap();
        assert_eq!(titles(&found.codex), vec!["Fix it"]);
        assert_eq!(titles(&found.claude), vec!["Claude"]);
        assert_eq!(found.codex.chats[0].meta.issues.iter().collect::<Vec<_>>(), vec![&250]);
    }

    #[test]
    fn gives_the_meta_information_of_each_chat_from_the_stored_rows() {
        let directory = temp_folder("query_meta");
        write_chat(&directory, "Fix it", &[user_line("2026-10-11T10:00:00.000Z", "Fix the issue 250"), write_tool_line("/work/app/a.ts")], 5);
        let found = sorted(&stored(&directory), 5, SortKey::LastUpdated, SortOrder::Descending);
        let meta = &found.chats[0].meta;
        assert_eq!(meta.user_messages, 1);
        assert_eq!(meta.first_at, Some(1_791_712_800_000));
        assert_eq!(meta.first_messages, vec!["Fix the issue 250"]);
        assert_eq!(meta.issues.iter().collect::<Vec<_>>(), vec![&250]);
        assert_eq!(meta.folders.iter().collect::<Vec<_>>(), vec![ROOT]);
        assert_eq!(meta.files_written.iter().collect::<Vec<_>>(), vec!["/work/app/a.ts"]);
    }

    #[test]
    fn sorts_by_the_modification_date_in_ascending_order() {
        let directory = temp_folder("query_ascending");
        for (index, age) in [(1, 400), (2, 300), (3, 200), (4, 100)] {
            write_chat(&directory, &format!("Chat {index}"), &[], age);
        }
        let found = sorted(&stored(&directory), 2, SortKey::LastUpdated, SortOrder::Ascending);
        assert_eq!(titles(&found), vec!["Chat 1", "Chat 2"]);
        assert!(found.has_more);
    }

    #[test]
    fn sorts_by_the_number_of_messages_and_puts_the_newest_file_first_among_equal_numbers() {
        let directory = temp_folder("query_messages");
        let messages = |count: usize| -> Vec<String> {
            (0..count).map(|_| user_line("2026-10-11T10:00:00.000Z", "hello")).collect()
        };
        write_chat(&directory, "A", &messages(1), 400);
        write_chat(&directory, "B", &messages(3), 300);
        write_chat(&directory, "C", &messages(2), 200);
        write_chat(&directory, "D", &messages(3), 100);
        let database_path = stored(&directory);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::Messages, SortOrder::Descending)), vec!["D", "B", "C", "A"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::Messages, SortOrder::Ascending)), vec!["A", "C", "D", "B"]);
    }

    #[test]
    fn sorts_by_the_date_of_the_first_message_and_by_the_modification_date_when_no_record_has_a_date() {
        let directory = temp_folder("query_created");
        write_chat(&directory, "A", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        write_chat(&directory, "B", &[user_line("2026-10-09T10:00:00.000Z", "hello")], 100);
        write_chat(&directory, "C", &[user_line("2026-10-10T10:00:00.000Z", "hello")], 200);
        let database_path = stored(&directory);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::CreatedOn, SortOrder::Descending)), vec!["A", "C", "B"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::CreatedOn, SortOrder::Ascending)), vec!["B", "C", "A"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::LastUpdated, SortOrder::Descending)), vec!["B", "C", "A"]);
        let undated = temp_folder("query_created_undated");
        write_chat(&undated, "Dated", &[user_line("2020-01-01T00:00:00.000Z", "hello")], 100);
        let line = r#"{"type":"user","message":{"role":"user","content":"Fix the tab bar"}}"#.to_string();
        write_chat(&undated, "Undated", &[line], 50);
        let found = sorted(&stored(&undated), 10, SortKey::CreatedOn, SortOrder::Descending);
        assert_eq!(titles(&found), vec!["Undated", "Dated"]);
    }

    #[test]
    fn sorts_by_the_number_of_issues_and_by_the_number_of_pull_requests() {
        let directory = temp_folder("query_references");
        let time = "2026-10-11T10:00:00.000Z";
        write_chat(&directory, "A", &[user_line(time, "Fix issue 1")], 400);
        write_chat(&directory, "B", &[user_line(time, "Fix issue 2 and issue 3")], 300);
        write_chat(&directory, "C", &[user_line(time, "Merge pull request 5")], 200);
        write_chat(&directory, "D", &[user_line(time, "Merge pull request 6 and pull request 7")], 100);
        let database_path = stored(&directory);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::Issues, SortOrder::Descending)), vec!["B", "A", "D", "C"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::Issues, SortOrder::Ascending)), vec!["D", "C", "A", "B"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::PullRequests, SortOrder::Descending)), vec!["D", "C", "B", "A"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::PullRequests, SortOrder::Ascending)), vec!["B", "A", "C", "D"]);
    }

    #[test]
    fn sorts_by_the_number_of_files_and_counts_a_file_of_a_worktree_once() {
        let directory = temp_folder("query_files");
        let worktree_copy = write_tool_line("/work/app/.claude/worktrees/fix-1/a.ts");
        write_chat(&directory, "A", &[write_tool_line("/work/app/a.ts"), worktree_copy], 300);
        write_chat(&directory, "B", &[write_tool_line("/work/app/a.ts"), write_tool_line("/work/app/b.ts")], 200);
        let outside = [write_tool_line("/elsewhere/x.ts"), write_tool_line("/elsewhere/y.ts"), write_tool_line("/work/app/z.ts")];
        write_chat(&directory, "C", &outside, 100);
        let database_path = stored(&directory);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::FilesWritten, SortOrder::Descending)), vec!["C", "B", "A"]);
        assert_eq!(titles(&sorted(&database_path, 10, SortKey::FilesWritten, SortOrder::Ascending)), vec!["A", "B", "C"]);
    }

    #[test]
    fn counts_the_written_files_with_the_worktrees_of_the_repository_removed() {
        let files: BTreeSet<String> = [
            "/work/app/a.ts",
            "/work/app/.claude/worktrees/fix-1/a.ts",
            "/work/app/.claude/worktrees/fix-2/src/b.ts",
            "/work/app/.claude/worktrees//c.ts",
            "/other/a.ts",
        ]
        .iter()
        .map(|path| path.to_string())
        .collect();
        assert_eq!(written_file_count(&files, "/work/app"), 4);
        assert_eq!(written_file_count(&files, "/work/app/"), 4);
        assert_eq!(written_file_count(&BTreeSet::new(), "/work/app"), 0);
    }

    #[test]
    fn lists_only_the_chat_sessions_that_started_in_the_root_and_not_the_ones_of_a_worktree() {
        let directory = temp_folder("query_scope");
        write_chat(&directory, "In the root", &[], 10);
        let worktree = directory.join("projects").join(claude_folder_name("/work/app/.claude/worktrees/fix-1"));
        let line = user_line("2026-10-11T10:00:00.000Z", "In a worktree").replace(ROOT, "/work/app/.claude/worktrees/fix-1");
        write_file(&worktree.join("wt.jsonl"), &format!("{line}\n"), 10);
        assert_eq!(titles(&sorted(&stored(&directory), 10, SortKey::LastUpdated, SortOrder::Descending)), vec!["In the root"]);
    }

    fn price_table() -> PriceTable {
        PriceTable {
            version: None,
            prices: BTreeMap::from([(
                "claude-opus-5".to_string(),
                ModelPrice { fresh_input: 5.0, cached_input: 0.5, cache_write_input: 6.25, output: 25.0 },
            )]),
        }
    }

    #[test]
    fn gives_the_tokens_and_the_cost_of_a_chat_and_no_cost_for_a_model_without_a_price() {
        let directory = temp_folder("query_usage");
        let lines = [user_line("2026-10-11T10:00:00.000Z", "hello"), answer_line("msg_1", "claude-opus-5", 100), answer_line("msg_1", "claude-opus-5", 200)];
        write_chat(&directory, "Priced", &lines, 100);
        let lines = [user_line("2026-10-11T10:00:00.000Z", "hello"), answer_line("msg_1", "claude-unknown-9", 100)];
        write_chat(&directory, "Not priced", &lines, 200);
        write_chat(&directory, "No answer", &[user_line("2026-10-11T10:00:00.000Z", "hello")], 300);
        let database_path = stored(&directory);
        let sessions = ChatSessionsDatabase::open_read_only(&database_path)
            .unwrap()
            .find_chat_sessions_in_folder(ROOT)
            .unwrap();
        let usage: Vec<Option<ChatUsage>> = ["Priced", "Not priced", "No answer"]
            .iter()
            .map(|title| usage_of(sessions.iter().find(|session| &session.title == title).unwrap(), &price_table()))
            .collect();
        let cost = usage[0].as_ref().unwrap().cost_usd.unwrap();
        // 1 000 × 5 + 4 000 × 0.5 + 200 × 25, all divided by 1 000 000
        assert!((cost - 0.012).abs() < 1e-9, "{cost}");
        assert_eq!(
            usage[0].as_ref().map(|usage| (usage.input_tokens, usage.cached_input_tokens, usage.output_tokens)),
            Some((5_000, 4_000, 200))
        );
        assert_eq!(usage[1].as_ref().map(|usage| (usage.input_tokens, usage.cost_usd)), Some((5_000, None)));
        assert_eq!(usage[2], None);
    }

    #[test]
    fn sends_the_usage_to_the_front_end_and_not_the_tokens_of_each_model() {
        let directory = temp_folder("query_json");
        let lines = [user_line("2026-10-11T10:00:00.000Z", "hello"), answer_line("msg_1", "claude-opus-5", 100)];
        write_chat(&directory, "Priced", &lines, 100);
        let found = sorted(&stored(&directory), 5, SortKey::LastUpdated, SortOrder::Descending);
        let json = serde_json::to_value(&found.chats[0]).unwrap();
        assert_eq!(json["usage"]["input_tokens"], 5_000);
        assert_eq!(json["usage"]["cost_usd"], serde_json::Value::Null);
        assert!(json.get("tokens").is_none());
        assert_eq!(json["meta"]["first_messages"][0], "hello");
    }

    #[test]
    fn reads_the_sort_key_and_the_order_that_the_front_end_sends() {
        let keys = ["created_on", "last_updated", "messages", "issues", "pull_requests", "files_written"];
        let read: Vec<SortKey> = keys.iter().map(|key| serde_json::from_str(&format!("\"{key}\"")).unwrap()).collect();
        assert_eq!(
            read,
            vec![SortKey::CreatedOn, SortKey::LastUpdated, SortKey::Messages, SortKey::Issues, SortKey::PullRequests, SortKey::FilesWritten]
        );
        assert_eq!(serde_json::from_str::<SortOrder>("\"ascending\"").unwrap(), SortOrder::Ascending);
        assert!(serde_json::from_str::<SortKey>("\"best_match\"").is_err());
        assert_eq!(Sorting::default(), Sorting { key: SortKey::LastUpdated, order: SortOrder::Descending });
    }
}
