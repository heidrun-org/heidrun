//! Tokens: how many tokens one chat session file of Claude Code or of Codex used, found without a model.
//!
//! Both coding agents write the tokens of each request in the file of the conversation, with the model of the request.
//!
//! - Claude Code writes the field `message.usage` in every record of type `assistant`, and the field `message.model`. One
//!   answer is written on several lines that all have the same `message.id`, and the usage of a later line is never smaller
//!   than the usage of an earlier line. A conversation that was resumed also holds the lines of the earlier conversation
//!   again, far from the first copy. Each answer counts once.
//! - Codex writes the record `token_count` (the event `payload.type`) after each request. Its field
//!   `info.total_token_usage` is a total that only grows, and its field `info.last_token_usage` is the usage of the last
//!   request. The model is in the record `turn_context` that starts each turn. A conversation that was forked from another
//!   conversation starts with the total of the first one, so the total of the last record is not the usage of this
//!   conversation: the usage of each request is added instead, when the total changed.
//!
//! The tokens are kept for each model, because each model has its own price (`model_prices`), and for each minute of the
//! request, because a conversation can last several days and the usage of each minute, hour, or day is wanted. The minute
//! is the date of the record, in UTC, cut at the minute: the tokens of a request belong to the minute of the record that
//! reports them, and the scan does not measure the generation of the tokens one by one. A record without a date goes in the
//! minute `UNDATED_MINUTE`.

use crate::model::token_usage_types::{MINUTE_MILLISECONDS, UNDATED_MINUTE};
use crate::model::types::ModelTokens;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

/// The name that a request without a known model has in `TokensByModel`.
pub const UNKNOWN_MODEL: &str = "";

/// The model that Claude Code writes for the answers that it makes itself, with no request. Its usage is always zero.
const SYNTHETIC_MODEL: &str = "<synthetic>";

/// The tokens of one kind of request. The four numbers never count the same token twice.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct TokenCounts {
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    pub fresh_input: u64,
    /// The input tokens that the provider read from its cache. They cost less than a fresh input token.
    pub cached_input: u64,
    /// The input tokens that the provider wrote to its cache. They can cost more than a fresh input token.
    pub cache_write_input: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output: u64,
}

/// The tokens of a conversation, for each model. A request without a known model is under `UNKNOWN_MODEL`.
pub type TokensByModel = BTreeMap<String, TokenCounts>;

/// The tokens of a conversation, for each minute, then for each model. The key of a minute is the number of whole minutes
/// since 1 January 1970 00:00 UTC, so the minute that starts at 1 January 1970 00:01 UTC is 1. A request whose record has no
/// date is under `UNDATED_MINUTE`.
pub type TokensByMinute = BTreeMap<i64, TokensByModel>;

/// The tokens of each model in the stored shape `ModelTokens`, sorted by the name of the model.
pub fn model_tokens_of(totals: &TokensByModel) -> Vec<ModelTokens> {
    totals
        .iter()
        .map(|(model, counts)| ModelTokens {
            model: model.clone(),
            fresh_input: counts.fresh_input,
            cached_input: counts.cached_input,
            cache_write_input: counts.cache_write_input,
            output: counts.output,
        })
        .collect()
}

impl TokenCounts {
    /// Adds the tokens of `other` to these tokens.
    pub fn add(&mut self, other: &TokenCounts) {
        self.fresh_input += other.fresh_input;
        self.cached_input += other.cached_input;
        self.cache_write_input += other.cache_write_input;
        self.output += other.output;
    }

    /// True when no token of any kind was used.
    pub fn is_empty(&self) -> bool {
        *self == TokenCounts::default()
    }

    /// Every input token that was sent: the fresh ones, the ones read from the cache, and the ones written to it.
    pub fn input_total(&self) -> u64 {
        self.fresh_input + self.cached_input + self.cache_write_input
    }

    /// The largest value of each kind, in these tokens and in `other`.
    fn keep_largest(&mut self, other: &TokenCounts) {
        self.fresh_input = self.fresh_input.max(other.fresh_input);
        self.cached_input = self.cached_input.max(other.cached_input);
        self.cache_write_input = self.cache_write_input.max(other.cache_write_input);
        self.output = self.output.max(other.output);
    }
}

/// The lines of one answer of Claude Code that are being read: the last answer that was seen.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
struct ClaudeAnswer {
    /// The hash of `message.id`.
    id: u32,
    model: String,
    /// The minute of the first line of the answer.
    minute: i64,
    tokens: TokenCounts,
}

/// What the scan of one file knows about the tokens, and the state that lets the next scan of the same file continue.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct TokenScan {
    /// The tokens of the answers that are finished, for each minute and each model.
    finished: TokensByMinute,
    /// The answer of Claude Code that the last lines belong to. It is not in `finished` yet: its next line can still raise it.
    answer: Option<ClaudeAnswer>,
    /// The hashes of the identifiers of the finished answers of Claude Code, so that a copy of an answer far away is skipped.
    /// A hash of 32 bits is enough: a conversation holds a few thousand answers at most, and a collision skips one answer.
    seen: BTreeSet<u32>,
    /// The model of the last turn of Codex, or `UNKNOWN_MODEL` before its first turn.
    codex_model: String,
    /// The total of tokens of the last record `token_count` of Codex that changed it.
    codex_total: Option<u64>,
}

impl TokenScan {
    /// The tokens of the conversation so far, for each model. A model that used no token is left out.
    pub fn totals(&self) -> TokensByModel {
        let mut totals = TokensByModel::new();
        for models in self.finished.values() {
            for (model, tokens) in models {
                totals.entry(model.clone()).or_default().add(tokens);
            }
        }
        if let Some(answer) = &self.answer {
            totals.entry(answer.model.clone()).or_default().add(&answer.tokens);
        }
        totals.retain(|_, tokens| !tokens.is_empty());
        totals
    }

    /// The tokens of the conversation so far, for each minute and each model. A model that used no token in a minute is left
    /// out, and a minute without a token is left out.
    pub fn by_minute(&self) -> TokensByMinute {
        let mut minutes = self.finished.clone();
        if let Some(answer) = &self.answer {
            minutes.entry(answer.minute).or_default().entry(answer.model.clone()).or_default().add(&answer.tokens);
        }
        for models in minutes.values_mut() {
            models.retain(|_, tokens| !tokens.is_empty());
        }
        minutes.retain(|_, models| !models.is_empty());
        minutes
    }

    /// Adds the tokens of `other`, for each minute and each model, to the finished tokens of this scan. The tokens of a
    /// subagent or of a workflow of Claude Code count for the chat that started it. The state that lets this scan continue
    /// does not change, so use it on a copy that is not kept.
    pub fn add_tokens_of(&mut self, other: &TokenScan) {
        for (minute, models) in other.by_minute() {
            for (model, counts) in models {
                self.finished.entry(minute).or_default().entry(model).or_default().add(&counts);
            }
        }
    }

    /// Reads one record of type `assistant` of Claude Code.
    pub fn note_claude_answer(&mut self, record: &Value) {
        let Some(message) = record.get("message") else { return };
        let (Some(usage), Some(id)) = (message.get("usage"), message.get("id").and_then(Value::as_str)) else { return };
        let model = message.get("model").and_then(Value::as_str).unwrap_or(UNKNOWN_MODEL);
        if model == SYNTHETIC_MODEL {
            return;
        }
        let tokens = TokenCounts {
            fresh_input: number(usage, "input_tokens"),
            cached_input: number(usage, "cache_read_input_tokens"),
            cache_write_input: number(usage, "cache_creation_input_tokens"),
            output: number(usage, "output_tokens"),
        };
        let id = hash(id);
        if let Some(answer) = self.answer.as_mut().filter(|answer| answer.id == id) {
            answer.tokens.keep_largest(&tokens);
            return;
        }
        if self.seen.contains(&id) {
            return;
        }
        self.finish_answer();
        self.answer = Some(ClaudeAnswer { id, model: model.to_string(), minute: minute_of(record), tokens });
    }

    /// Reads one record of Codex: the record `turn_context` gives the model, and the record `token_count` gives the tokens of
    /// the last request.
    pub fn note_codex_record(&mut self, record: &Value) {
        let Some(payload) = record.get("payload") else { return };
        match record.get("type").and_then(Value::as_str) {
            Some("turn_context") => {
                if let Some(model) = payload.get("model").and_then(Value::as_str) {
                    self.codex_model = model.to_string();
                }
            }
            Some("event_msg") if payload.get("type").and_then(Value::as_str) == Some("token_count") => {
                self.note_codex_token_count(payload, minute_of(record));
            }
            _ => {}
        }
    }

    /// Moves the answer of Claude Code that was being read to the finished answers.
    fn finish_answer(&mut self) {
        if let Some(answer) = self.answer.take() {
            self.finished.entry(answer.minute).or_default().entry(answer.model).or_default().add(&answer.tokens);
            self.seen.insert(answer.id);
        }
    }

    /// Adds the last request of a record `token_count`, unless the total did not change: Codex writes the same record twice
    /// when a turn ends without a new request. A record without `info` only gives the limits of the account.
    fn note_codex_token_count(&mut self, payload: &Value, minute: i64) {
        let Some(info) = payload.get("info") else { return };
        let (Some(total), Some(last)) = (info.get("total_token_usage"), info.get("last_token_usage")) else { return };
        let Some(total) = total.get("total_tokens").and_then(Value::as_u64) else { return };
        if self.codex_total == Some(total) {
            return;
        }
        self.codex_total = Some(total);
        // In the usage of Codex, the input tokens already include the cached ones and the written ones.
        let cached_input = number(last, "cached_input_tokens");
        let cache_write_input = number(last, "cache_write_input_tokens");
        let tokens = TokenCounts {
            fresh_input: number(last, "input_tokens").saturating_sub(cached_input).saturating_sub(cache_write_input),
            cached_input,
            cache_write_input,
            output: number(last, "output_tokens"),
        };
        self.finished.entry(minute).or_default().entry(self.codex_model.clone()).or_default().add(&tokens);
    }
}

/// The minute of a record, from its field `timestamp`, or `UNDATED_MINUTE` when the record has no date that can be read.
fn minute_of(record: &Value) -> i64 {
    record
        .get("timestamp")
        .and_then(Value::as_str)
        .and_then(|text| chrono::DateTime::parse_from_rfc3339(text).ok())
        .map_or(UNDATED_MINUTE, |date| date.timestamp_millis().div_euclid(MINUTE_MILLISECONDS))
}

/// The unsigned number of the field `name` of `value`, or zero.
fn number(value: &Value, name: &str) -> u64 {
    value.get(name).and_then(Value::as_u64).unwrap_or(0)
}

/// The hash FNV-1a of 32 bits of `text`.
fn hash(text: &str) -> u32 {
    text.bytes().fold(0x811c_9dc5_u32, |hash, byte| (hash ^ u32::from(byte)).wrapping_mul(0x0100_0193))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn answer(id: &str, model: &str, input: u64, cache_read: u64, cache_write: u64, output: u64) -> Value {
        json!({"type": "assistant", "message": {"id": id, "model": model, "usage": {
            "input_tokens": input,
            "cache_read_input_tokens": cache_read,
            "cache_creation_input_tokens": cache_write,
            "output_tokens": output,
        }}})
    }

    /// The record `value` with the field `timestamp`.
    fn at(timestamp: &str, mut value: Value) -> Value {
        value["timestamp"] = json!(timestamp);
        value
    }

    fn token_count(total: u64, input: u64, cached: u64, output: u64) -> Value {
        json!({"type": "event_msg", "payload": {"type": "token_count", "info": {
            "total_token_usage": {"total_tokens": total},
            "last_token_usage": {"input_tokens": input, "cached_input_tokens": cached, "output_tokens": output},
        }}})
    }

    fn turn(model: &str) -> Value {
        json!({"type": "turn_context", "payload": {"model": model}})
    }

    fn counts(fresh_input: u64, cached_input: u64, cache_write_input: u64, output: u64) -> TokenCounts {
        TokenCounts { fresh_input, cached_input, cache_write_input, output }
    }

    #[test]
    fn counts_the_lines_of_one_answer_of_claude_once_and_keeps_the_largest() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 10, 100, 20, 5));
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 10, 100, 20, 80));
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 10, 100, 20, 80));
        assert_eq!(scan.totals()["claude-opus-5"], counts(10, 100, 20, 80));
    }

    #[test]
    fn skips_a_copy_of_a_finished_answer_that_comes_later() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 1, 2, 3, 4));
        scan.note_claude_answer(&answer("msg_2", "claude-opus-5", 10, 20, 30, 40));
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 1, 2, 3, 4));
        scan.note_claude_answer(&answer("msg_2", "claude-opus-5", 10, 20, 30, 40));
        assert_eq!(scan.totals()["claude-opus-5"], counts(11, 22, 33, 44));
    }

    #[test]
    fn keeps_the_tokens_of_each_model_of_claude_apart_and_skips_the_synthetic_model() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 1, 0, 0, 2));
        scan.note_claude_answer(&answer("msg_2", "claude-haiku-5-5", 3, 0, 0, 4));
        scan.note_claude_answer(&answer("msg_3", SYNTHETIC_MODEL, 0, 0, 0, 0));
        let totals = scan.totals();
        assert_eq!(totals.keys().collect::<Vec<_>>(), vec!["claude-haiku-5-5", "claude-opus-5"]);
        assert_eq!(totals["claude-haiku-5-5"], counts(3, 0, 0, 4));
    }

    #[test]
    fn ignores_a_record_of_claude_without_usage_or_without_identifier() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&json!({"type": "assistant", "message": {"id": "msg_1", "model": "claude-opus-5"}}));
        scan.note_claude_answer(&json!({"type": "assistant", "message": {"model": "x", "usage": {"input_tokens": 5}}}));
        assert!(scan.totals().is_empty());
    }

    #[test]
    fn adds_the_last_request_of_each_record_token_count_of_codex_under_the_model_of_the_turn() {
        let mut scan = TokenScan::default();
        scan.note_codex_record(&turn("gpt-6-sol"));
        scan.note_codex_record(&token_count(1_100, 1_000, 600, 100));
        scan.note_codex_record(&token_count(1_100, 1_000, 600, 100));
        scan.note_codex_record(&turn("gpt-6-luna"));
        scan.note_codex_record(&token_count(2_300, 1_000, 900, 200));
        let totals = scan.totals();
        assert_eq!(totals["gpt-6-sol"], counts(400, 600, 0, 100));
        assert_eq!(totals["gpt-6-luna"], counts(100, 900, 0, 200));
    }

    #[test]
    fn does_not_count_the_total_that_a_fork_of_codex_inherits() {
        let mut scan = TokenScan::default();
        scan.note_codex_record(&turn("gpt-6-sol"));
        scan.note_codex_record(&token_count(5_001_100, 1_000, 0, 100));
        scan.note_codex_record(&token_count(5_002_300, 1_000, 0, 200));
        assert_eq!(scan.totals()["gpt-6-sol"], counts(2_000, 0, 0, 300));
    }

    #[test]
    fn counts_a_request_of_codex_when_the_total_goes_down_after_a_compaction() {
        let mut scan = TokenScan::default();
        scan.note_codex_record(&token_count(9_000, 8_000, 0, 1_000));
        scan.note_codex_record(&token_count(400, 300, 0, 100));
        assert_eq!(scan.totals()[UNKNOWN_MODEL], counts(8_300, 0, 0, 1_100));
    }

    #[test]
    fn ignores_a_record_token_count_without_info_and_a_record_of_another_kind() {
        let mut scan = TokenScan::default();
        scan.note_codex_record(&json!({"type": "event_msg", "payload": {"type": "token_count", "info": null}}));
        scan.note_codex_record(&json!({"type": "event_msg", "payload": {"type": "task_started"}}));
        assert!(scan.totals().is_empty());
    }

    #[test]
    fn continues_from_the_state_that_the_cache_kept() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 1, 2, 3, 4));
        let mut scan: TokenScan = serde_json::from_str(&serde_json::to_string(&scan).unwrap()).unwrap();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 1, 2, 3, 9));
        scan.note_claude_answer(&answer("msg_2", "claude-opus-5", 1, 1, 1, 1));
        assert_eq!(scan.totals()["claude-opus-5"], counts(2, 3, 4, 10));
    }

    /// The minute that starts at 2026-10-14 10:00 UTC.
    const MINUTE_10_00: i64 = 29_866_200;

    #[test]
    fn keeps_the_tokens_of_claude_in_the_minute_of_the_first_line_of_each_answer() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&at("2026-10-14T10:59:59.000Z", answer("msg_1", "claude-opus-5", 1, 2, 3, 4)));
        scan.note_claude_answer(&at("2026-10-14T11:00:01.000Z", answer("msg_1", "claude-opus-5", 1, 2, 3, 9)));
        scan.note_claude_answer(&at("2026-10-14T11:00:02.000Z", answer("msg_2", "claude-haiku-5-5", 10, 0, 0, 20)));
        let minutes = scan.by_minute();
        assert_eq!(minutes.keys().copied().collect::<Vec<_>>(), vec![MINUTE_10_00 + 59, MINUTE_10_00 + 60]);
        assert_eq!(minutes[&(MINUTE_10_00 + 59)]["claude-opus-5"], counts(1, 2, 3, 9));
        assert_eq!(minutes[&(MINUTE_10_00 + 60)]["claude-haiku-5-5"], counts(10, 0, 0, 20));
        assert_eq!(scan.totals()["claude-opus-5"], counts(1, 2, 3, 9));
    }

    #[test]
    fn keeps_the_tokens_of_codex_in_the_minute_of_each_record_token_count() {
        let mut scan = TokenScan::default();
        scan.note_codex_record(&at("2026-10-14T09:59:00.000Z", turn("gpt-6-sol")));
        scan.note_codex_record(&at("2026-10-14T10:05:30.000Z", token_count(1_100, 1_000, 600, 100)));
        scan.note_codex_record(&at("2026-10-14T12:30:00.000Z", token_count(2_300, 1_000, 900, 200)));
        let minutes = scan.by_minute();
        assert_eq!(minutes.keys().copied().collect::<Vec<_>>(), vec![MINUTE_10_00 + 5, MINUTE_10_00 + 150]);
        assert_eq!(minutes[&(MINUTE_10_00 + 5)]["gpt-6-sol"], counts(400, 600, 0, 100));
        assert_eq!(minutes[&(MINUTE_10_00 + 150)]["gpt-6-sol"], counts(100, 900, 0, 200));
    }

    #[test]
    fn puts_two_requests_of_the_same_minute_in_the_same_minute() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&at("2026-10-14T10:05:01.000Z", answer("msg_1", "claude-opus-5", 1, 0, 0, 2)));
        scan.note_claude_answer(&at("2026-10-14T10:05:59.000Z", answer("msg_2", "claude-opus-5", 3, 0, 0, 4)));
        let minutes = scan.by_minute();
        assert_eq!(minutes.len(), 1);
        assert_eq!(minutes[&(MINUTE_10_00 + 5)]["claude-opus-5"], counts(4, 0, 0, 6));
    }

    #[test]
    fn puts_a_record_without_a_date_in_the_undated_minute() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 1, 0, 0, 2));
        scan.note_claude_answer(&at("not a date", answer("msg_2", "claude-opus-5", 3, 0, 0, 4)));
        assert_eq!(scan.by_minute().keys().copied().collect::<Vec<_>>(), vec![UNDATED_MINUTE]);
        assert_eq!(scan.totals()["claude-opus-5"], counts(4, 0, 0, 6));
    }

    #[test]
    fn counts_a_date_before_1970_in_a_minute_that_is_not_the_undated_minute() {
        assert_eq!(minute_of(&json!({"timestamp": "1970-01-01T00:00:30.000Z"})), 0);
        assert_eq!(minute_of(&json!({"timestamp": "1969-12-31T23:59:30.000Z"})), -1);
    }

    #[test]
    fn keeps_the_minutes_through_the_cache() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&at("2026-10-14T10:00:00.000Z", answer("msg_1", "claude-opus-5", 1, 2, 3, 4)));
        scan.note_claude_answer(&answer("msg_2", "claude-opus-5", 1, 1, 1, 1));
        let scan: TokenScan = serde_json::from_str(&serde_json::to_string(&scan).unwrap()).unwrap();
        assert_eq!(scan.by_minute().keys().copied().collect::<Vec<_>>(), vec![UNDATED_MINUTE, MINUTE_10_00]);
    }

    #[test]
    fn adds_the_tokens_of_another_scan_for_each_minute_and_each_model_without_changing_its_own_state() {
        let mut scan = TokenScan::default();
        scan.note_claude_answer(&answer("msg_1", "claude-opus-5", 10, 0, 0, 5));
        let mut other = TokenScan::default();
        other.note_claude_answer(&answer("msg_2", "claude-opus-5", 1, 0, 0, 7));
        other.note_claude_answer(&answer("msg_3", "claude-sonnet-5", 2, 0, 0, 9));
        let before = scan.clone();
        let mut sum = scan.clone();
        sum.add_tokens_of(&other);
        assert_eq!(sum.totals()["claude-opus-5"].output, 12);
        assert_eq!(sum.totals()["claude-sonnet-5"].output, 9);
        assert_eq!(sum.answer, before.answer);
        assert_eq!(sum.seen, before.seen);
        assert_eq!(scan, before);
    }
}
