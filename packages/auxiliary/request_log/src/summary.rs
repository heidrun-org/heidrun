//! The usage patterns in the log: how often each caller asks for each operation, with which values, and how long it takes.
//!
//! A summary counts the requests that a caller made for its own need. It leaves out a nested request, because the request
//! that holds it already counts, and it leaves out a replay, because a performance exercise is not usage. A person can ask
//! for both.

use crate::clock::parse_utc_text;
use crate::event::{RequestKind, ORIGIN_REPLAY};
use crate::reading::{PairedRequest, RequestState};
use serde_json::{Map, Value};
use std::collections::BTreeSet;

/// The parameters that change at each request without changing the workload, so two requests that differ only by them are
/// the same request.
const VOLATILE_PARAMETERS: [&str; 1] = ["now"];

/// The most distinct values of the field `repository` that a group keeps.
const MAX_LISTED_REPOSITORIES: usize = 10;

/// Which requests a summary counts.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Filter {
    /// Only the requests of this caller.
    pub caller: Option<String>,
    /// Only the requests of this package.
    pub package: Option<String>,
    /// Only the requests of this operation.
    pub operation: Option<String>,
    /// Only the requests that started at this time or later, in milliseconds since 1 January 1970 UTC.
    pub since_milliseconds: Option<i64>,
    /// Only the requests that started before this time, in milliseconds since 1 January 1970 UTC.
    pub until_milliseconds: Option<i64>,
    /// Only the requests that took at least this long, in microseconds. A request that did not end is left out.
    pub minimum_microseconds: Option<u64>,
    /// Only the requests in this state.
    pub state: Option<RequestState>,
    /// Only the requests that have no completion event, running or interrupted.
    pub only_unfinished: bool,
    /// Count the nested requests too.
    pub include_nested: bool,
    /// Count the requests of a replay too.
    pub include_replays: bool,
    /// Only the requests of a replay.
    pub only_replays: bool,
}

impl Filter {
    /// True when the request passes the filter.
    pub fn accepts(&self, request: &PairedRequest) -> bool {
        let start = &request.start;
        let is_replay = start.origin == ORIGIN_REPLAY;
        if self.only_replays && is_replay == false {
            return false;
        }
        if self.only_replays == false && self.include_replays == false && is_replay {
            return false;
        }
        if self.include_nested == false && start.parent_request_id.is_some() {
            return false;
        }
        if self.caller.as_ref().is_some_and(|caller| *caller != start.caller) {
            return false;
        }
        if self.package.as_ref().is_some_and(|package| *package != start.package) {
            return false;
        }
        if self.operation.as_ref().is_some_and(|operation| *operation != start.operation) {
            return false;
        }
        if self.state.is_some_and(|state| state != request.state) {
            return false;
        }
        if self.only_unfinished && request.state.is_unfinished() == false {
            return false;
        }
        let started = parse_utc_text(&start.started_at);
        if let Some(since) = self.since_milliseconds {
            if started.is_none_or(|started| started < since) {
                return false;
            }
        }
        if let Some(until) = self.until_milliseconds {
            if started.is_none_or(|started| started >= until) {
                return false;
            }
        }
        if let Some(minimum) = self.minimum_microseconds {
            if request.duration_microseconds().is_none_or(|duration| duration < minimum) {
                return false;
            }
        }
        true
    }
}

/// The requests that pass a filter.
pub fn filter_requests<'a>(requests: &'a [PairedRequest], filter: &Filter) -> Vec<&'a PairedRequest> {
    requests.iter().filter(|request| filter.accepts(request)).collect()
}

/// What the requests of a group have in common.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupBy {
    /// The caller, the package, and the operation.
    Operation,
    /// The same, and the pattern: the same statement or the same choices, with other values.
    Pattern,
    /// The same, and the same parameters: the requests that asked exactly the same thing.
    Parameters,
}

impl GroupBy {
    /// The group by of its name: `operation`, `pattern`, or `parameters`.
    pub fn from_name(name: &str) -> Option<GroupBy> {
        match name {
            "operation" => Some(GroupBy::Operation),
            "pattern" => Some(GroupBy::Pattern),
            "parameters" => Some(GroupBy::Parameters),
            _ => None,
        }
    }
}

/// The words for what a request does with the data, which tell an initial import from an incremental synchronization.
pub fn workload_of(request: &PairedRequest) -> &'static str {
    match request.start.kind {
        RequestKind::Query => "stored_data_query",
        RequestKind::Collection => "collection",
        RequestKind::Write => "database_write",
        RequestKind::Lock => "lock_wait",
        RequestKind::Synchronization => match request.start.parameters.get("mode").and_then(Value::as_str) {
            Some("initialize") => "initial_import",
            Some("update") => "incremental_synchronization",
            _ => "synchronization",
        },
    }
}

/// The durations of the requests that ended, with the numbers that describe how they spread.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct DurationStatistics {
    /// The number of durations.
    pub count: usize,
    /// The sum of the durations, in microseconds.
    pub total_microseconds: u64,
    /// The shortest duration, in microseconds.
    pub minimum_microseconds: u64,
    /// The mean duration, in microseconds.
    pub mean_microseconds: f64,
    /// The median, in microseconds.
    pub median_microseconds: u64,
    /// The 90th percentile, in microseconds.
    pub p90_microseconds: u64,
    /// The 95th percentile, in microseconds.
    pub p95_microseconds: u64,
    /// The 99th percentile, in microseconds.
    pub p99_microseconds: u64,
    /// The longest duration, in microseconds.
    pub maximum_microseconds: u64,
}

impl DurationStatistics {
    /// The statistics of a list of durations in microseconds. A percentile is the smallest duration with at least that share
    /// of the durations at or below it (the nearest-rank definition), so it is always a duration that happened.
    pub fn of(durations: &[u64]) -> Self {
        if durations.is_empty() {
            return DurationStatistics::default();
        }
        let mut sorted = durations.to_vec();
        sorted.sort_unstable();
        let total: u64 = sorted.iter().sum();
        DurationStatistics {
            count: sorted.len(),
            total_microseconds: total,
            minimum_microseconds: sorted[0],
            mean_microseconds: total as f64 / sorted.len() as f64,
            median_microseconds: percentile(&sorted, 50),
            p90_microseconds: percentile(&sorted, 90),
            p95_microseconds: percentile(&sorted, 95),
            p99_microseconds: percentile(&sorted, 99),
            maximum_microseconds: sorted[sorted.len() - 1],
        }
    }
}

/// The nearest-rank percentile of a list that is sorted from the shortest: the value at the rank `ceil(p / 100 * n)`.
fn percentile(sorted: &[u64], percent: usize) -> u64 {
    let rank = (percent * sorted.len()).div_ceil(100).max(1);
    sorted[rank - 1]
}

/// The requests that have the same caller, package, operation, and, by the group by, the same pattern or parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct Group {
    /// The program that made the requests.
    pub caller: String,
    /// The package that received the requests.
    pub package: String,
    /// The operation.
    pub operation: String,
    /// What the requests do with the data: `stored_data_query`, `initial_import`, and the other words of `workload_of`.
    pub workload: &'static str,
    /// The pattern of the requests, for the group by `pattern` and `parameters`.
    pub pattern: Option<String>,
    /// The parameters of the requests, for the group by `parameters`.
    pub parameters: Option<Value>,
    /// The number of requests.
    pub count: usize,
    /// The number of requests that ended with success.
    pub succeeded: usize,
    /// The number of requests that ended with a failure.
    pub failed: usize,
    /// The number of requests that have no completion event and whose process lives.
    pub running: usize,
    /// The number of requests that have no completion event and whose process is gone.
    pub interrupted: usize,
    /// The durations of the requests that ended.
    pub durations: DurationStatistics,
    /// The start of the first request.
    pub first_started_at: String,
    /// The start of the last request.
    pub last_started_at: String,
    /// The distinct repositories of the requests, at most ten.
    pub repositories: Vec<String>,
}

impl Group {
    /// The group as a row for a table or a JSON list. The durations are in milliseconds with three decimals.
    pub fn to_row(&self) -> Map<String, Value> {
        let milliseconds = |microseconds: u64| Value::from(microseconds as f64 / 1000.0);
        let mut row = Map::new();
        row.insert("caller".to_string(), Value::from(self.caller.clone()));
        row.insert("package".to_string(), Value::from(self.package.clone()));
        row.insert("operation".to_string(), Value::from(self.operation.clone()));
        row.insert("workload".to_string(), Value::from(self.workload));
        if let Some(pattern) = &self.pattern {
            row.insert("pattern".to_string(), Value::from(pattern.clone()));
        }
        if let Some(parameters) = &self.parameters {
            row.insert("parameters".to_string(), Value::from(parameters.to_string()));
        }
        row.insert("count".to_string(), Value::from(self.count));
        row.insert("succeeded".to_string(), Value::from(self.succeeded));
        row.insert("failed".to_string(), Value::from(self.failed));
        row.insert("running".to_string(), Value::from(self.running));
        row.insert("interrupted".to_string(), Value::from(self.interrupted));
        row.insert("totalMilliseconds".to_string(), milliseconds(self.durations.total_microseconds));
        row.insert("meanMilliseconds".to_string(), Value::from((self.durations.mean_microseconds / 10.0).round() / 100.0));
        row.insert("medianMilliseconds".to_string(), milliseconds(self.durations.median_microseconds));
        row.insert("p90Milliseconds".to_string(), milliseconds(self.durations.p90_microseconds));
        row.insert("p95Milliseconds".to_string(), milliseconds(self.durations.p95_microseconds));
        row.insert("p99Milliseconds".to_string(), milliseconds(self.durations.p99_microseconds));
        row.insert("maximumMilliseconds".to_string(), milliseconds(self.durations.maximum_microseconds));
        row.insert("firstStartedAt".to_string(), Value::from(self.first_started_at.clone()));
        row.insert("lastStartedAt".to_string(), Value::from(self.last_started_at.clone()));
        row.insert("repositories".to_string(), Value::from(self.repositories.join(", ")));
        row
    }
}

/// The parameters of a request without the values that change at each request, as one text with a fixed order of fields.
fn stable_parameters(request: &PairedRequest) -> Value {
    match &request.start.parameters {
        Value::Object(fields) => {
            let sorted: std::collections::BTreeMap<&String, &Value> =
                fields.iter().filter(|(name, _)| VOLATILE_PARAMETERS.contains(&name.as_str()) == false).collect();
            serde_json::to_value(sorted).unwrap_or(Value::Null)
        }
        other => other.clone(),
    }
}

/// Groups the requests, and counts and times each group. The groups come with the largest total time first.
pub fn summarize(requests: &[&PairedRequest], group_by: GroupBy) -> Vec<Group> {
    let mut groups: Vec<(Vec<String>, Vec<&PairedRequest>)> = Vec::new();
    let mut positions: std::collections::HashMap<Vec<String>, usize> = std::collections::HashMap::new();
    for request in requests {
        let start = &request.start;
        let mut key = vec![start.caller.clone(), start.package.clone(), start.operation.clone(), workload_of(request).to_string()];
        if group_by != GroupBy::Operation {
            key.push(start.pattern.clone());
        }
        if group_by == GroupBy::Parameters {
            key.push(stable_parameters(request).to_string());
        }
        match positions.get(&key) {
            Some(position) => groups[*position].1.push(request),
            None => {
                positions.insert(key.clone(), groups.len());
                groups.push((key, vec![request]));
            }
        }
    }
    let mut result: Vec<Group> = groups
        .into_iter()
        .map(|(_, members)| group_of(&members, group_by))
        .collect();
    result.sort_by(|left, right| {
        right
            .durations
            .total_microseconds
            .cmp(&left.durations.total_microseconds)
            .then(right.count.cmp(&left.count))
            .then(left.operation.cmp(&right.operation))
    });
    result
}

/// The group of requests that have the same key.
fn group_of(members: &[&PairedRequest], group_by: GroupBy) -> Group {
    let first = members[0];
    let durations: Vec<u64> = members.iter().filter_map(|request| request.duration_microseconds()).collect();
    let count_state = |state: RequestState| members.iter().filter(|request| request.state == state).count();
    let repositories: BTreeSet<String> = members
        .iter()
        .filter_map(|request| request.start.parameters.get("repository").and_then(Value::as_str).map(str::to_string))
        .collect();
    let mut started: Vec<&str> = members.iter().map(|request| request.start.started_at.as_str()).collect();
    started.sort_unstable();
    Group {
        caller: first.start.caller.clone(),
        package: first.start.package.clone(),
        operation: first.start.operation.clone(),
        workload: workload_of(first),
        pattern: if group_by == GroupBy::Operation { None } else { Some(first.start.pattern.clone()) },
        parameters: if group_by == GroupBy::Parameters { Some(stable_parameters(first)) } else { None },
        count: members.len(),
        succeeded: count_state(RequestState::Succeeded),
        failed: count_state(RequestState::Failed),
        running: count_state(RequestState::Running),
        interrupted: count_state(RequestState::Interrupted),
        durations: DurationStatistics::of(&durations),
        first_started_at: started[0].to_string(),
        last_started_at: started[started.len() - 1].to_string(),
        repositories: repositories.into_iter().take(MAX_LISTED_REPOSITORIES).collect(),
    }
}

/// The groups of the group by `parameters` that hold two requests or more: the requests that asked the same thing again.
pub fn repeated(groups: Vec<Group>) -> Vec<Group> {
    groups.into_iter().filter(|group| group.count >= 2).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::{empty_object, CompleteEvent, Outcome, StartEvent, FORMAT_VERSION, ORIGIN_APPLICATION};

    fn request(
        caller: &str,
        operation: &str,
        kind: RequestKind,
        parameters: Value,
        pattern: &str,
        microseconds: Option<u64>,
    ) -> PairedRequest {
        let start = StartEvent {
            v: FORMAT_VERSION,
            request_id: format!("{caller}-{operation}-{}", microseconds.unwrap_or(0)),
            parent_request_id: None,
            caller: caller.to_string(),
            origin: ORIGIN_APPLICATION.to_string(),
            replay_of: None,
            package: "coding_agents".to_string(),
            operation: operation.to_string(),
            kind,
            parameters,
            pattern: pattern.to_string(),
            started_at: "2026-10-17T12:00:00.000Z".to_string(),
            process_id: 1,
            software_version: "0.2.7".to_string(),
            concurrent_requests: 0,
            state: empty_object(),
            dropped_events: None,
        };
        let complete = microseconds.map(|duration| CompleteEvent {
            v: FORMAT_VERSION,
            request_id: start.request_id.clone(),
            package: start.package.clone(),
            operation: start.operation.clone(),
            ended_at: "2026-10-17T12:00:01.000Z".to_string(),
            duration_microseconds: duration,
            outcome: Outcome::Success,
            error_category: None,
            result_count: None,
            details: empty_object(),
            dropped_events: None,
        });
        let state = if complete.is_some() { RequestState::Succeeded } else { RequestState::Interrupted };
        PairedRequest { start, complete, state }
    }

    #[test]
    fn the_percentiles_are_durations_that_happened_by_the_nearest_rank() {
        let durations: Vec<u64> = (1..=100).collect();
        let statistics = DurationStatistics::of(&durations);
        assert_eq!(statistics.count, 100);
        assert_eq!(statistics.total_microseconds, 5050);
        assert_eq!(statistics.median_microseconds, 50);
        assert_eq!(statistics.p90_microseconds, 90);
        assert_eq!(statistics.p95_microseconds, 95);
        assert_eq!(statistics.p99_microseconds, 99);
        assert_eq!(statistics.maximum_microseconds, 100);
        assert_eq!(statistics.minimum_microseconds, 1);
        assert_eq!(DurationStatistics::of(&[7]).p99_microseconds, 7);
        assert_eq!(DurationStatistics::of(&[]), DurationStatistics::default());
    }

    #[test]
    fn a_group_by_operation_counts_the_requests_of_one_caller_and_operation() {
        let requests = vec![
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({ "repository": "a/b" }), "grouping=hour", Some(1000)),
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({ "repository": "c/d" }), "grouping=day", Some(3000)),
            request("heidrun_data", "find_usage", RequestKind::Query, serde_json::json!({}), "", Some(500)),
        ];
        let references: Vec<&PairedRequest> = requests.iter().collect();
        let groups = summarize(&references, GroupBy::Operation);
        assert_eq!(groups.len(), 2);
        assert_eq!((groups[0].caller.as_str(), groups[0].count), ("heidrun", 2));
        assert_eq!(groups[0].durations.total_microseconds, 4000);
        assert_eq!(groups[0].repositories, vec!["a/b".to_string(), "c/d".to_string()]);
        assert_eq!((groups[1].caller.as_str(), groups[1].count), ("heidrun_data", 1));
    }

    #[test]
    fn a_group_by_pattern_separates_the_choices() {
        let requests = vec![
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({ "repository": "a/b" }), "grouping=hour", Some(1000)),
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({ "repository": "c/d" }), "grouping=hour", Some(2000)),
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({ "repository": "a/b" }), "grouping=day", Some(5000)),
        ];
        let references: Vec<&PairedRequest> = requests.iter().collect();
        let groups = summarize(&references, GroupBy::Pattern);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].pattern.as_deref(), Some("grouping=day"));
        assert_eq!(groups[1].pattern.as_deref(), Some("grouping=hour"));
        assert_eq!(groups[1].count, 2);
    }

    #[test]
    fn a_group_by_parameters_finds_the_requests_that_asked_exactly_the_same_thing() {
        let requests = vec![
            request("heidrun", "read_usage", RequestKind::Query, serde_json::json!({ "repository": "a/b", "now": 1 }), "", Some(1000)),
            request("heidrun", "read_usage", RequestKind::Query, serde_json::json!({ "repository": "a/b", "now": 2 }), "", Some(1200)),
            request("heidrun", "read_usage", RequestKind::Query, serde_json::json!({ "repository": "c/d", "now": 3 }), "", Some(900)),
        ];
        let references: Vec<&PairedRequest> = requests.iter().collect();
        let groups = repeated(summarize(&references, GroupBy::Parameters));
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].count, 2);
        assert_eq!(groups[0].parameters.as_ref().unwrap()["repository"], "a/b");
    }

    #[test]
    fn a_synchronization_is_an_initial_import_or_an_incremental_synchronization_by_its_mode() {
        let initialize = request("heidrun", "synchronize", RequestKind::Synchronization, serde_json::json!({ "mode": "initialize" }), "", Some(1));
        let update = request("heidrun", "synchronize", RequestKind::Synchronization, serde_json::json!({ "mode": "update" }), "", Some(2));
        let collection = request("heidrun", "read_chat_sessions", RequestKind::Collection, serde_json::json!({}), "", Some(3));
        let query = request("heidrun", "query", RequestKind::Query, serde_json::json!({}), "", Some(4));
        assert_eq!(workload_of(&initialize), "initial_import");
        assert_eq!(workload_of(&update), "incremental_synchronization");
        let refresh = request("heidrun", "refresh_prices", RequestKind::Synchronization, serde_json::json!({}), "", Some(5));
        assert_eq!(workload_of(&refresh), "synchronization", "Without a mode, a synchronization is neither of the two");
        assert_eq!(workload_of(&collection), "collection");
        assert_eq!(workload_of(&query), "stored_data_query");
    }

    #[test]
    fn a_request_that_did_not_end_is_counted_and_has_no_duration() {
        let requests = vec![
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({}), "", Some(1000)),
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({}), "", None),
        ];
        let references: Vec<&PairedRequest> = requests.iter().collect();
        let groups = summarize(&references, GroupBy::Operation);
        assert_eq!((groups[0].count, groups[0].succeeded, groups[0].interrupted), (2, 1, 1));
        assert_eq!(groups[0].durations.count, 1);
    }

    #[test]
    fn a_summary_leaves_out_the_nested_requests_and_the_replays_unless_a_person_asks() {
        let mut nested = request("heidrun", "read_chat_sessions", RequestKind::Collection, serde_json::json!({}), "", Some(1));
        nested.start.parent_request_id = Some("parent".to_string());
        let mut replay = request("heidrun_data", "query", RequestKind::Query, serde_json::json!({}), "", Some(2));
        replay.start.origin = ORIGIN_REPLAY.to_string();
        let own = request("heidrun", "query", RequestKind::Query, serde_json::json!({}), "", Some(3));
        let requests = vec![nested, replay, own];
        assert_eq!(filter_requests(&requests, &Filter::default()).len(), 1);
        assert_eq!(filter_requests(&requests, &Filter { include_nested: true, ..Filter::default() }).len(), 2);
        assert_eq!(filter_requests(&requests, &Filter { include_replays: true, ..Filter::default() }).len(), 2);
        assert_eq!(filter_requests(&requests, &Filter { only_replays: true, ..Filter::default() }).len(), 1);
        assert_eq!(filter_requests(&requests, &Filter { only_unfinished: true, ..Filter::default() }).len(), 0);
    }

    #[test]
    fn a_filter_keeps_the_slow_requests_of_one_operation() {
        let requests = vec![
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({}), "", Some(1000)),
            request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({}), "", Some(9000)),
            request("heidrun", "query", RequestKind::Query, serde_json::json!({}), "", Some(9000)),
        ];
        let filter = Filter { operation: Some("find_usage".to_string()), minimum_microseconds: Some(5000), ..Filter::default() };
        let kept = filter_requests(&requests, &filter);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].duration_microseconds(), Some(9000));
    }

    #[test]
    fn the_row_of_a_group_has_the_durations_in_milliseconds() {
        let requests = vec![request("heidrun", "find_usage", RequestKind::Query, serde_json::json!({}), "", Some(1500))];
        let references: Vec<&PairedRequest> = requests.iter().collect();
        let row = summarize(&references, GroupBy::Operation)[0].to_row();
        assert_eq!(row["totalMilliseconds"], 1.5);
        assert_eq!(row["count"], 1);
        assert_eq!(row["workload"], "stored_data_query");
    }
}
