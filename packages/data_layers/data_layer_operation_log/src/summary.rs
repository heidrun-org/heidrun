//! The usage patterns in the log: how often each caller calls each public function, with which values, and how long it takes.
//!
//! A summary counts the operations that a caller made for its own need. It leaves out a nested operation, because the operation
//! that holds it already counts, and it leaves out a replay, because a performance exercise is not usage. A person can ask
//! for both.

use crate::clock::parse_utc_text;
use crate::event::{OperationKind, ORIGIN_REPLAY};
use crate::reading::{PairedOperation, OperationState};
use serde_json::{Map, Value};
use std::collections::BTreeSet;

/// The parameters that change at each operation without changing the workload, so two operations that differ only by them are
/// the same operation.
const VOLATILE_PARAMETERS: [&str; 1] = ["now"];

/// The most distinct values of the field `repository` that a group keeps.
const MAX_LISTED_REPOSITORIES: usize = 10;

/// Which operations a summary counts.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Filter {
    /// Only the operations of this caller.
    pub caller: Option<String>,
    /// Only the operations of this package.
    pub package: Option<String>,
    /// Only the operations with this operation name.
    pub operation_name: Option<String>,
    /// Only the operations that started at this time or later, in milliseconds since 1 January 1970 UTC.
    pub since_milliseconds: Option<i64>,
    /// Only the operations that started before this time, in milliseconds since 1 January 1970 UTC.
    pub until_milliseconds: Option<i64>,
    /// Only the operations that took at least this long, in microseconds. An operation that did not end is left out.
    pub minimum_microseconds: Option<u64>,
    /// Only the operations in this state.
    pub state: Option<OperationState>,
    /// Only the operations that have no completion event, running or interrupted.
    pub only_unfinished: bool,
    /// Count the nested operations too.
    pub include_nested: bool,
    /// Count the operations of a replay too.
    pub include_replays: bool,
    /// Only the operations of a replay.
    pub only_replays: bool,
}

impl Filter {
    /// True when the operation passes the filter.
    pub fn accepts(&self, operation: &PairedOperation) -> bool {
        let start = &operation.start;
        let is_replay = start.origin == ORIGIN_REPLAY;
        if self.only_replays && is_replay == false {
            return false;
        }
        if self.only_replays == false && self.include_replays == false && is_replay {
            return false;
        }
        if self.include_nested == false && start.parent_operation_id.is_some() {
            return false;
        }
        if self.caller.as_ref().is_some_and(|caller| *caller != start.caller) {
            return false;
        }
        if self.package.as_ref().is_some_and(|package| *package != start.package) {
            return false;
        }
        if self.operation_name.as_ref().is_some_and(|operation_name| *operation_name != start.operation_name) {
            return false;
        }
        if self.state.is_some_and(|state| state != operation.state) {
            return false;
        }
        if self.only_unfinished && operation.state.is_unfinished() == false {
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
            if operation.duration_microseconds().is_none_or(|duration| duration < minimum) {
                return false;
            }
        }
        true
    }
}

/// The operations that pass a filter.
pub fn filter_operations<'a>(operations: &'a [PairedOperation], filter: &Filter) -> Vec<&'a PairedOperation> {
    operations.iter().filter(|operation| filter.accepts(operation)).collect()
}

/// What the operations of a group have in common.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupBy {
    /// The caller, the package, and the operation name.
    OperationName,
    /// The same, and the pattern: the same statement or the same choices, with other values.
    Pattern,
    /// The same, and the same parameters: the operations that asked exactly the same thing.
    Parameters,
}

impl GroupBy {
    /// The group by of its name: `operation-name`, `pattern`, or `parameters`.
    pub fn from_name(name: &str) -> Option<GroupBy> {
        match name {
            "operation-name" => Some(GroupBy::OperationName),
            "pattern" => Some(GroupBy::Pattern),
            "parameters" => Some(GroupBy::Parameters),
            _ => None,
        }
    }
}

/// The words for what an operation does with the data, which tell an initial import from an incremental synchronization. A
/// synchronization that chooses its mode while it runs has no `mode` parameter, and its completion event says the mode in the
/// detail `mode`.
pub fn workload_of(operation: &PairedOperation) -> &'static str {
    match operation.start.kind {
        OperationKind::Query => "stored_data_query",
        OperationKind::Collection => "collection",
        OperationKind::Write => "database_write",
        OperationKind::Lock => "lock_wait",
        OperationKind::Synchronization => match synchronization_mode_of(operation) {
            Some("initialize") => "initial_import",
            Some("update") => "incremental_synchronization",
            _ => "synchronization",
        },
    }
}

/// The mode of a synchronization: its parameter `mode`, or else the detail `mode` of its completion event.
fn synchronization_mode_of(operation: &PairedOperation) -> Option<&str> {
    operation
        .start
        .parameters
        .get("mode")
        .and_then(Value::as_str)
        .or_else(|| operation.complete.as_ref().and_then(|complete| complete.details.get("mode")).and_then(Value::as_str))
}

/// The durations of the operations that ended, with the numbers that describe how they spread.
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

/// The operations that have the same caller, package, operation name, and, by the group by, the same pattern or parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct Group {
    /// The program that made the operations.
    pub caller: String,
    /// The package that received the operations.
    pub package: String,
    /// The operation name.
    pub operation_name: String,
    /// What the operations do with the data: `stored_data_query`, `initial_import`, and the other words of `workload_of`.
    pub workload: &'static str,
    /// The pattern of the operations, for the group by `pattern` and `parameters`.
    pub pattern: Option<String>,
    /// The parameters of the operations, for the group by `parameters`.
    pub parameters: Option<Value>,
    /// The number of operations.
    pub count: usize,
    /// The number of operations that ended with success.
    pub succeeded: usize,
    /// The number of operations that ended with a failure.
    pub failed: usize,
    /// The number of operations that have no completion event and whose process lives.
    pub running: usize,
    /// The number of operations that have no completion event and whose process is gone.
    pub interrupted: usize,
    /// The durations of the operations that ended.
    pub durations: DurationStatistics,
    /// The start of the first operation.
    pub first_started_at: String,
    /// The start of the last operation.
    pub last_started_at: String,
    /// The distinct repositories of the operations, at most ten.
    pub repositories: Vec<String>,
}

impl Group {
    /// The group as a row for a table or a JSON list. The durations are in milliseconds with three decimals.
    pub fn to_row(&self) -> Map<String, Value> {
        let milliseconds = |microseconds: u64| Value::from(microseconds as f64 / 1000.0);
        let mut row = Map::new();
        row.insert("caller".to_string(), Value::from(self.caller.clone()));
        row.insert("package".to_string(), Value::from(self.package.clone()));
        row.insert("operationName".to_string(), Value::from(self.operation_name.clone()));
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

/// The parameters of an operation without the values that change at each operation, as one text with a fixed order of fields.
fn stable_parameters(operation: &PairedOperation) -> Value {
    match &operation.start.parameters {
        Value::Object(fields) => {
            let sorted: std::collections::BTreeMap<&String, &Value> =
                fields.iter().filter(|(name, _)| VOLATILE_PARAMETERS.contains(&name.as_str()) == false).collect();
            serde_json::to_value(sorted).unwrap_or(Value::Null)
        }
        other => other.clone(),
    }
}

/// Groups the operations, and counts and times each group. The groups come with the largest total time first.
pub fn summarize(operations: &[&PairedOperation], group_by: GroupBy) -> Vec<Group> {
    let mut groups: Vec<(Vec<String>, Vec<&PairedOperation>)> = Vec::new();
    let mut positions: std::collections::HashMap<Vec<String>, usize> = std::collections::HashMap::new();
    for operation in operations {
        let start = &operation.start;
        let mut key = vec![start.caller.clone(), start.package.clone(), start.operation_name.clone(), workload_of(operation).to_string()];
        if group_by != GroupBy::OperationName {
            key.push(start.pattern.clone());
        }
        if group_by == GroupBy::Parameters {
            key.push(stable_parameters(operation).to_string());
        }
        match positions.get(&key) {
            Some(position) => groups[*position].1.push(operation),
            None => {
                positions.insert(key.clone(), groups.len());
                groups.push((key, vec![operation]));
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
            .then(left.operation_name.cmp(&right.operation_name))
    });
    result
}

/// The group of operations that have the same key.
fn group_of(members: &[&PairedOperation], group_by: GroupBy) -> Group {
    let first = members[0];
    let durations: Vec<u64> = members.iter().filter_map(|operation| operation.duration_microseconds()).collect();
    let count_state = |state: OperationState| members.iter().filter(|operation| operation.state == state).count();
    let repositories: BTreeSet<String> = members
        .iter()
        .filter_map(|operation| operation.start.parameters.get("repository").and_then(Value::as_str).map(str::to_string))
        .collect();
    let mut started: Vec<&str> = members.iter().map(|operation| operation.start.started_at.as_str()).collect();
    started.sort_unstable();
    Group {
        caller: first.start.caller.clone(),
        package: first.start.package.clone(),
        operation_name: first.start.operation_name.clone(),
        workload: workload_of(first),
        pattern: if group_by == GroupBy::OperationName { None } else { Some(first.start.pattern.clone()) },
        parameters: if group_by == GroupBy::Parameters { Some(stable_parameters(first)) } else { None },
        count: members.len(),
        succeeded: count_state(OperationState::Succeeded),
        failed: count_state(OperationState::Failed),
        running: count_state(OperationState::Running),
        interrupted: count_state(OperationState::Interrupted),
        durations: DurationStatistics::of(&durations),
        first_started_at: started[0].to_string(),
        last_started_at: started[started.len() - 1].to_string(),
        repositories: repositories.into_iter().take(MAX_LISTED_REPOSITORIES).collect(),
    }
}

/// The groups of the group by `parameters` that hold two operations or more: the operations that asked the same thing again.
pub fn repeated(groups: Vec<Group>) -> Vec<Group> {
    groups.into_iter().filter(|group| group.count >= 2).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::{empty_object, CompleteEvent, Outcome, StartEvent, FORMAT_VERSION, ORIGIN_APPLICATION};

    fn operation(
        caller: &str,
        operation_name: &str,
        kind: OperationKind,
        parameters: Value,
        pattern: &str,
        microseconds: Option<u64>,
    ) -> PairedOperation {
        let start = StartEvent {
            v: FORMAT_VERSION,
            operation_id: format!("{caller}-{operation_name}-{}", microseconds.unwrap_or(0)),
            parent_operation_id: None,
            caller: caller.to_string(),
            origin: ORIGIN_APPLICATION.to_string(),
            replay_of: None,
            package: "coding_agents".to_string(),
            operation_name: operation_name.to_string(),
            kind,
            parameters,
            pattern: pattern.to_string(),
            started_at: "2026-10-17T12:00:00.000Z".to_string(),
            process_id: 1,
            software_version: "0.2.7".to_string(),
            concurrent_operations: 0,
            state: empty_object(),
            dropped_events: None,
        };
        let complete = microseconds.map(|duration| CompleteEvent {
            v: FORMAT_VERSION,
            operation_id: start.operation_id.clone(),
            package: start.package.clone(),
            operation_name: start.operation_name.clone(),
            ended_at: "2026-10-17T12:00:01.000Z".to_string(),
            duration_microseconds: duration,
            outcome: Outcome::Success,
            error_category: None,
            result_count: None,
            details: empty_object(),
            dropped_events: None,
        });
        let state = if complete.is_some() { OperationState::Succeeded } else { OperationState::Interrupted };
        PairedOperation { start, complete, state }
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
    fn a_group_by_operation_counts_the_operations_of_one_caller_and_operation() {
        let operations = vec![
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({ "repository": "a/b" }), "grouping=hour", Some(1000)),
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({ "repository": "c/d" }), "grouping=day", Some(3000)),
            operation("heidrun_code_data", "find_usage", OperationKind::Query, serde_json::json!({}), "", Some(500)),
        ];
        let references: Vec<&PairedOperation> = operations.iter().collect();
        let groups = summarize(&references, GroupBy::OperationName);
        assert_eq!(groups.len(), 2);
        assert_eq!((groups[0].caller.as_str(), groups[0].count), ("heidrun", 2));
        assert_eq!(groups[0].durations.total_microseconds, 4000);
        assert_eq!(groups[0].repositories, vec!["a/b".to_string(), "c/d".to_string()]);
        assert_eq!((groups[1].caller.as_str(), groups[1].count), ("heidrun_code_data", 1));
    }

    #[test]
    fn a_group_by_pattern_separates_the_choices() {
        let operations = vec![
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({ "repository": "a/b" }), "grouping=hour", Some(1000)),
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({ "repository": "c/d" }), "grouping=hour", Some(2000)),
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({ "repository": "a/b" }), "grouping=day", Some(5000)),
        ];
        let references: Vec<&PairedOperation> = operations.iter().collect();
        let groups = summarize(&references, GroupBy::Pattern);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].pattern.as_deref(), Some("grouping=day"));
        assert_eq!(groups[1].pattern.as_deref(), Some("grouping=hour"));
        assert_eq!(groups[1].count, 2);
    }

    #[test]
    fn a_group_by_parameters_finds_the_operations_that_asked_exactly_the_same_thing() {
        let operations = vec![
            operation("heidrun", "read_usage", OperationKind::Query, serde_json::json!({ "repository": "a/b", "now": 1 }), "", Some(1000)),
            operation("heidrun", "read_usage", OperationKind::Query, serde_json::json!({ "repository": "a/b", "now": 2 }), "", Some(1200)),
            operation("heidrun", "read_usage", OperationKind::Query, serde_json::json!({ "repository": "c/d", "now": 3 }), "", Some(900)),
        ];
        let references: Vec<&PairedOperation> = operations.iter().collect();
        let groups = repeated(summarize(&references, GroupBy::Parameters));
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].count, 2);
        assert_eq!(groups[0].parameters.as_ref().unwrap()["repository"], "a/b");
    }

    #[test]
    fn a_synchronization_is_an_initial_import_or_an_incremental_synchronization_by_its_mode() {
        let initialize = operation("heidrun", "synchronize", OperationKind::Synchronization, serde_json::json!({ "mode": "initialize" }), "", Some(1));
        let update = operation("heidrun", "synchronize", OperationKind::Synchronization, serde_json::json!({ "mode": "update" }), "", Some(2));
        let collection = operation("heidrun", "read_chat_sessions", OperationKind::Collection, serde_json::json!({}), "", Some(3));
        let query = operation("heidrun", "query", OperationKind::Query, serde_json::json!({}), "", Some(4));
        assert_eq!(workload_of(&initialize), "initial_import");
        assert_eq!(workload_of(&update), "incremental_synchronization");
        let refresh = operation("heidrun", "refresh_prices", OperationKind::Synchronization, serde_json::json!({}), "", Some(5));
        assert_eq!(workload_of(&refresh), "synchronization", "Without a mode, a synchronization is neither of the two");
        assert_eq!(workload_of(&collection), "collection");
        assert_eq!(workload_of(&query), "stored_data_query");
    }

    #[test]
    fn a_synchronization_that_chooses_its_mode_while_it_runs_is_told_by_the_mode_in_its_completion_event() {
        let mut refresh = operation("desktop", "refresh_code_hosting", OperationKind::Synchronization, serde_json::json!({}), "", Some(6));
        refresh.complete.as_mut().unwrap().details = serde_json::json!({ "mode": "initialize" });
        assert_eq!(workload_of(&refresh), "initial_import");
        refresh.complete.as_mut().unwrap().details = serde_json::json!({ "mode": "update" });
        assert_eq!(workload_of(&refresh), "incremental_synchronization");
    }

    #[test]
    fn a_operation_that_did_not_end_is_counted_and_has_no_duration() {
        let operations = vec![
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({}), "", Some(1000)),
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({}), "", None),
        ];
        let references: Vec<&PairedOperation> = operations.iter().collect();
        let groups = summarize(&references, GroupBy::OperationName);
        assert_eq!((groups[0].count, groups[0].succeeded, groups[0].interrupted), (2, 1, 1));
        assert_eq!(groups[0].durations.count, 1);
    }

    #[test]
    fn a_summary_leaves_out_the_nested_operations_and_the_replays_unless_a_person_asks() {
        let mut nested = operation("heidrun", "read_chat_sessions", OperationKind::Collection, serde_json::json!({}), "", Some(1));
        nested.start.parent_operation_id = Some("parent".to_string());
        let mut replay = operation("heidrun_code_data", "query", OperationKind::Query, serde_json::json!({}), "", Some(2));
        replay.start.origin = ORIGIN_REPLAY.to_string();
        let own = operation("heidrun", "query", OperationKind::Query, serde_json::json!({}), "", Some(3));
        let operations = vec![nested, replay, own];
        assert_eq!(filter_operations(&operations, &Filter::default()).len(), 1);
        assert_eq!(filter_operations(&operations, &Filter { include_nested: true, ..Filter::default() }).len(), 2);
        assert_eq!(filter_operations(&operations, &Filter { include_replays: true, ..Filter::default() }).len(), 2);
        assert_eq!(filter_operations(&operations, &Filter { only_replays: true, ..Filter::default() }).len(), 1);
        assert_eq!(filter_operations(&operations, &Filter { only_unfinished: true, ..Filter::default() }).len(), 0);
    }

    #[test]
    fn a_filter_keeps_the_slow_operations_of_one_operation() {
        let operations = vec![
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({}), "", Some(1000)),
            operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({}), "", Some(9000)),
            operation("heidrun", "query", OperationKind::Query, serde_json::json!({}), "", Some(9000)),
        ];
        let filter = Filter { operation_name: Some("find_usage".to_string()), minimum_microseconds: Some(5000), ..Filter::default() };
        let kept = filter_operations(&operations, &filter);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].duration_microseconds(), Some(9000));
    }

    #[test]
    fn the_row_of_a_group_has_the_durations_in_milliseconds() {
        let operations = vec![operation("heidrun", "find_usage", OperationKind::Query, serde_json::json!({}), "", Some(1500))];
        let references: Vec<&PairedOperation> = operations.iter().collect();
        let row = summarize(&references, GroupBy::OperationName)[0].to_row();
        assert_eq!(row["totalMilliseconds"], 1.5);
        assert_eq!(row["count"], 1);
        assert_eq!(row["workload"], "stored_data_query");
    }
}
