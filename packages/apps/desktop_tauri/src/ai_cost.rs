//! The AI cost of the chats of one repository, for the tab "Work of one person" of the Statistics window.
//!
//! The cost of a chat is the estimate of `chats.rs`: the tokens of each model, at the public price of the model. The package
//! `data_layer_coding_agents` keeps the tokens of each chat for each hour, in UTC, so a chat that lasts several days gives its
//! cost and its tokens to each hour where its requests were, and the web page cuts the hours into the days of the time zone of
//! the computer. The web page shows the cost in US dollars, or the tokens, as the developer chooses.

use crate::chats::{Chats, SortKey, SortOrder, Sorting, MAX_LIMIT};
use crate::model_prices::PriceTable;
use crate::person_work::parse_time;
use data_layer_coding_agents::{FolderScope, UNDATED_HOUR};
use serde::Serialize;

/// The name of Claude Code in the field `coding_agent`, the identifier of the coding agent in the web page.
const CLAUDE: &str = "claude";

/// The name of Codex in the field `coding_agent`, the identifier of the coding agent in the web page.
const CODEX: &str = "codex";

/// The number of milliseconds in one hour.
const HOUR_MILLISECONDS: i64 = 3_600_000;

/// The cost and the tokens of one chat in one hour.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HourCost {
    /// The start of the hour, in UTC, in the format ISO 8601. For the tokens of a request without a date, it is the date of the
    /// last record of the chat, or the date of the last change of its file when no record has a date.
    pub at: String,
    /// The estimated cost in US dollars of the tokens of the chat in this hour. `None` when a model of the chat has no known
    /// price: the chat has no cost in every hour, because a cost without the tokens of that model would be too small.
    pub cost_usd: Option<f64>,
    /// The tokens of the chat in this hour, for every model: the input tokens (with the ones read from the cache and written
    /// to it) and the output tokens. A chat with a model that has no known price has its tokens too.
    pub tokens: u64,
}

/// The cost of one chat.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatCost {
    /// The identifier of the chat for its coding agent. The web page uses it to count a chat once when two workspaces list it.
    pub id: String,
    /// The identifier of the coding agent: `claude` or `codex`.
    pub coding_agent: String,
    /// The hours of the time range where the chat used tokens, the oldest first.
    pub hours: Vec<HourCost>,
}

/// What the Statistics window needs to count the AI cost in a time range.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCostItems {
    /// The chats that used tokens in the time range, the one with the oldest hour first.
    pub chats: Vec<ChatCost>,
}

/// The time of a number of milliseconds since 1 January 1970, as an ISO 8601 text in UTC with the letter `Z`.
fn utc_text(milliseconds: i64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(milliseconds)
        .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        .unwrap_or_default()
}

/// The chats of `chats` that used tokens in the time range from `since` to `until`, in milliseconds since 1 January 1970, with
/// the cost of each hour at the prices of `table`. An hour is kept when it overlaps the time range, so that a time zone with a
/// half hour does not lose the half hour at the start of the time range.
fn costs_in_range(chats: &Chats, table: &PriceTable, since: i64, until: i64) -> AiCostItems {
    let mut found: Vec<(i64, ChatCost)> = Vec::new();
    for (coding_agent, agent_chats) in [(CLAUDE, &chats.claude), (CODEX, &chats.codex)] {
        for chat in &agent_chats.chats {
            let Some(usage) = chat.usage.as_ref() else { continue };
            let is_priced = usage.cost_usd.is_some();
            let mut hours: Vec<(i64, HourCost)> = Vec::new();
            for (hour, models) in &chat.token_hours {
                let (start, end) = if *hour == UNDATED_HOUR {
                    let last_record_at = chat.meta.last_at.unwrap_or(chat.updated_at);
                    (last_record_at, last_record_at + 1)
                } else {
                    (hour * HOUR_MILLISECONDS, (hour + 1) * HOUR_MILLISECONDS)
                };
                if end <= since || start >= until {
                    continue;
                }
                let cost_usd = is_priced.then(|| table.cost(models).unwrap_or(0.0));
                let tokens: u64 = models.values().map(|counts| counts.input_total() + counts.output).sum();
                hours.push((start, HourCost { at: utc_text(start), cost_usd, tokens }));
            }
            hours.sort_by_key(|(start, _)| *start);
            let Some(first) = hours.first().map(|(start, _)| *start) else { continue };
            found.push((
                first,
                ChatCost {
                    id: chat.id.clone(),
                    coding_agent: coding_agent.to_string(),
                    hours: hours.into_iter().map(|(_, hour_cost)| hour_cost).collect(),
                },
            ));
        }
    }
    found.sort_by_key(|(first, _)| *first);
    AiCostItems { chats: found.into_iter().map(|(_, cost)| cost).collect() }
}

/// Called by the Statistics window to read the AI cost of the chats of the repository that holds `folder`, with the chats of the
/// folders below its root, for the hours in the time range from `since` to `until`, two texts in ISO 8601.
#[tauri::command]
pub async fn ai_cost_in_range(folder: String, since: String, until: String) -> Result<AiCostItems, String> {
    let since = parse_time(&since)?.timestamp_millis();
    let until = parse_time(&until)?.timestamp_millis();
    // Off the main thread: the first read of the files of the coding agents takes a moment.
    tauri::async_runtime::spawn_blocking(move || {
        let sorting = Sorting { key: SortKey::LastUpdated, order: SortOrder::Descending };
        let chats = crate::chats::list(&folder, MAX_LIMIT, sorting, FolderScope::WithFoldersBelow);
        costs_in_range(&chats, &crate::model_prices::current(), since, until)
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chats::{AgentChats, Chat, ChatUsage};
    use crate::model_prices::ModelPrice;
    use data_layer_coding_agents::{ChatMeta, TokenCounts, TokensByHour, TokensByModel};
    use std::collections::BTreeMap;

    /// 14 October 2026, 12:00:00 in UTC, in milliseconds since 1 January 1970.
    const NOON: i64 = 1_791_979_200_000;

    /// The number of the hour that starts at `NOON`, as `TokensByHour` numbers the hours.
    const NOON_HOUR: i64 = 497_772;

    /// One hour, in milliseconds.
    const HOUR: i64 = HOUR_MILLISECONDS;

    /// The model of the tests.
    const MODEL: &str = "claude-opus-5";

    /// A table with the price of `MODEL`: one thousandth of a dollar for a fresh input token, and five thousandths for an
    /// output token.
    fn table() -> PriceTable {
        let price = ModelPrice { input: 0.001, cached_input: 0.0001, cache_write_input: 0.002, output: 0.005 };
        PriceTable { fetched_at: 0, prices: BTreeMap::from([(MODEL.to_string(), price)]) }
    }

    /// The tokens of one hour: `fresh_input` fresh input tokens, and `output` output tokens, with `MODEL`.
    fn hour(fresh_input: u64, output: u64) -> TokensByModel {
        TokensByModel::from([(
            MODEL.to_string(),
            TokenCounts { fresh_input, cached_input: 0, cache_write_input: 0, output },
        )])
    }

    /// A chat that used `token_hours`. `last_at` is the date of its last record, and `cost_usd` is the cost of the whole chat:
    /// `None` for a chat with a model that has no known price. A chat with no hour is a chat with no token.
    fn chat(last_at: Option<i64>, updated_at: i64, token_hours: TokensByHour, cost_usd: Option<f64>) -> Chat {
        let usage = (token_hours.is_empty() == false).then_some(ChatUsage {
            input_tokens: 10,
            cached_input_tokens: 0,
            output_tokens: 5,
            cost_usd,
        });
        Chat {
            id: "a-chat".to_string(),
            title: "A chat".to_string(),
            updated_at,
            meta: ChatMeta { last_at, ..ChatMeta::default() },
            tokens: TokensByModel::new(),
            token_hours,
            usage,
        }
    }

    fn chats_of(claude: Vec<Chat>, codex: Vec<Chat>) -> Chats {
        Chats {
            root: "/work/heidrun".to_string(),
            claude: AgentChats { chats: claude, has_more: false },
            codex: AgentChats { chats: codex, has_more: false },
        }
    }

    /// The cost of each hour of a chat, as `(at, cost)`.
    fn costs_of(chat_cost: &ChatCost) -> Vec<(&str, Option<f64>)> {
        chat_cost.hours.iter().map(|hour| (hour.at.as_str(), hour.cost_usd)).collect()
    }

    /// The tokens of each hour of a chat.
    fn tokens_of(chat_cost: &ChatCost) -> Vec<u64> {
        chat_cost.hours.iter().map(|hour| hour.tokens).collect()
    }

    #[test]
    fn a_chat_gives_the_cost_of_each_hour_where_it_used_tokens_and_keeps_its_coding_agent() {
        let hours = TokensByHour::from([(NOON_HOUR, hour(1_000, 200)), (NOON_HOUR + 26, hour(500, 0))]);
        let chats = chats_of(vec![chat(Some(NOON + 26 * HOUR), NOON, hours.clone(), Some(2.5))], vec![]);
        let items = costs_in_range(&chats, &table(), NOON - HOUR, NOON + 48 * HOUR);
        assert_eq!(items.chats.len(), 1);
        assert_eq!(items.chats[0].coding_agent, "claude");
        assert_eq!(
            costs_of(&items.chats[0]),
            vec![("2026-10-14T12:00:00.000Z", Some(2.0)), ("2026-10-15T14:00:00.000Z", Some(0.5))]
        );
    }

    #[test]
    fn the_tokens_of_an_hour_are_the_input_tokens_and_the_output_tokens_of_every_model() {
        let counts = |fresh_input, cached_input, cache_write_input, output| TokenCounts {
            fresh_input,
            cached_input,
            cache_write_input,
            output,
        };
        let models = TokensByModel::from([
            (MODEL.to_string(), counts(1_000, 4_000, 500, 200)),
            ("claude-sonnet-5".to_string(), counts(10, 0, 0, 5)),
        ]);
        let hours = TokensByHour::from([(NOON_HOUR, models), (NOON_HOUR + 1, hour(7, 3))]);
        let chats = chats_of(vec![chat(Some(NOON), NOON, hours, Some(1.0))], vec![]);
        let items = costs_in_range(&chats, &table(), NOON - HOUR, NOON + 4 * HOUR);
        assert_eq!(tokens_of(&items.chats[0]), vec![5_715, 10]);
    }

    #[test]
    fn a_chat_with_no_known_price_has_its_tokens() {
        let hours = TokensByHour::from([(NOON_HOUR, hour(1_000, 200))]);
        let chats = chats_of(vec![chat(Some(NOON), NOON, hours, None)], vec![]);
        let items = costs_in_range(&chats, &table(), NOON - HOUR, NOON + HOUR);
        assert_eq!(costs_of(&items.chats[0]), vec![("2026-10-14T12:00:00.000Z", None)]);
        assert_eq!(tokens_of(&items.chats[0]), vec![1_200]);
    }

    #[test]
    fn a_chat_of_codex_has_the_coding_agent_codex_and_the_chats_come_with_the_oldest_hour_first() {
        let claude = chat(Some(NOON), NOON, TokensByHour::from([(NOON_HOUR + 5, hour(1_000, 0))]), Some(1.0));
        let codex = chat(Some(NOON), NOON, TokensByHour::from([(NOON_HOUR, hour(1_000, 0))]), Some(1.0));
        let items = costs_in_range(&chats_of(vec![claude], vec![codex]), &table(), NOON - HOUR, NOON + 48 * HOUR);
        let agents: Vec<&str> = items.chats.iter().map(|chat| chat.coding_agent.as_str()).collect();
        assert_eq!(agents, vec!["codex", "claude"]);
    }

    #[test]
    fn an_hour_that_overlaps_the_time_range_counts_and_an_hour_that_does_not_overlap_it_does_not_count() {
        let hours = TokensByHour::from([
            (NOON_HOUR - 2, hour(1_000, 0)),
            (NOON_HOUR - 1, hour(2_000, 0)),
            (NOON_HOUR, hour(3_000, 0)),
            (NOON_HOUR + 1, hour(4_000, 0)),
        ]);
        let chats = chats_of(vec![chat(Some(NOON), NOON, hours, Some(10.0))], vec![]);
        let items = costs_in_range(&chats, &table(), NOON - HOUR / 2, NOON + HOUR);
        let costs: Vec<Option<f64>> = items.chats[0].hours.iter().map(|hour| hour.cost_usd).collect();
        assert_eq!(costs, vec![Some(2.0), Some(3.0)]);
    }

    #[test]
    fn a_chat_with_no_hour_in_the_time_range_does_not_count() {
        let hours = TokensByHour::from([(NOON_HOUR - 5, hour(1_000, 0))]);
        let chats = chats_of(vec![chat(Some(NOON), NOON, hours, Some(1.0))], vec![]);
        assert!(costs_in_range(&chats, &table(), NOON, NOON + HOUR).chats.is_empty());
    }

    #[test]
    fn the_tokens_of_a_request_without_a_date_count_at_the_date_of_the_last_record_of_the_chat() {
        let hours = TokensByHour::from([(UNDATED_HOUR, hour(1_000, 0))]);
        let chats = chats_of(vec![chat(Some(NOON + 90 * 60 * 1000), NOON, hours, Some(1.0))], vec![]);
        let items = costs_in_range(&chats, &table(), NOON, NOON + 2 * HOUR);
        assert_eq!(costs_of(&items.chats[0]), vec![("2026-10-14T13:30:00.000Z", Some(1.0))]);
    }

    #[test]
    fn the_tokens_of_a_request_without_a_date_in_a_chat_without_a_dated_record_count_at_the_date_of_the_file() {
        let hours = TokensByHour::from([(UNDATED_HOUR, hour(1_000, 0))]);
        let chats = chats_of(vec![chat(None, NOON, hours, Some(1.0))], vec![]);
        let items = costs_in_range(&chats, &table(), NOON - HOUR, NOON + HOUR);
        assert_eq!(costs_of(&items.chats[0]), vec![("2026-10-14T12:00:00.000Z", Some(1.0))]);
    }

    #[test]
    fn a_chat_with_no_token_does_not_count_and_a_chat_with_no_known_price_has_no_cost_in_each_hour() {
        let hours = TokensByHour::from([(NOON_HOUR, hour(1_000, 0)), (NOON_HOUR + 1, hour(1_000, 0))]);
        let chats = chats_of(
            vec![chat(Some(NOON), NOON, TokensByHour::new(), None), chat(Some(NOON), NOON, hours, None)],
            vec![],
        );
        let items = costs_in_range(&chats, &table(), NOON - HOUR, NOON + 4 * HOUR);
        assert_eq!(items.chats.len(), 1);
        let costs: Vec<Option<f64>> = items.chats[0].hours.iter().map(|hour| hour.cost_usd).collect();
        assert_eq!(costs, vec![None, None]);
    }

    #[test]
    fn the_answer_for_the_web_page_uses_the_names_of_the_fields_of_the_web_page() {
        let hours = TokensByHour::from([(NOON_HOUR, hour(1_500, 0))]);
        let chats = chats_of(vec![chat(Some(NOON), NOON, hours, Some(1.5))], vec![]);
        let json = serde_json::to_value(costs_in_range(&chats, &table(), NOON - HOUR, NOON + HOUR)).unwrap();
        assert_eq!(json["chats"][0]["id"], "a-chat");
        assert_eq!(json["chats"][0]["codingAgent"], "claude");
        assert_eq!(json["chats"][0]["hours"][0]["at"], "2026-10-14T12:00:00.000Z");
        assert_eq!(json["chats"][0]["hours"][0]["costUsd"], 1.5);
        assert_eq!(json["chats"][0]["hours"][0]["tokens"], 1_500);
    }

    #[test]
    fn a_text_that_is_not_a_time_is_refused() {
        let error = tauri::async_runtime::block_on(ai_cost_in_range(
            "/work/heidrun".to_string(),
            "yesterday".to_string(),
            "2026-10-14T12:00:00.000Z".to_string(),
        ))
        .unwrap_err();
        assert!(error.contains("is not a time in ISO 8601"));
    }
}
