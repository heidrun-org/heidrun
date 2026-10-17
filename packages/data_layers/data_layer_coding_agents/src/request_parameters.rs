//! The parameters of the requests of this package in the log of the requests of the data layer, written and read back here, so
//! the format has one place.
//!
//! The command `heidrun_data requests replay` reads the parameters of a recorded `find_usage` and runs it again with
//! `usage_query_from_parameters`.

use crate::model::token_usage_types::{UsageGrouping, UsageQuery};
use crate::REQUEST_PACKAGE;
use request_log::{RequestKind, RequestSpec};
use serde_json::Value;
use std::path::Path;

/// The description of a request about the token usage of a workspace in a time range. The choices are the grouping and the
/// split by chat session, so a summary counts together the requests that differ by the repository or the dates.
pub(crate) fn usage_query_spec(operation: &'static str, query: &UsageQuery, database: &Path) -> RequestSpec {
    let mut spec = RequestSpec::new(REQUEST_PACKAGE, operation, RequestKind::Query)
        .parameter("repository", query.repository.clone())
        .parameter("folders", query.folders.clone())
        .parameter("since", query.since)
        .parameter("until", query.until)
        .choice("grouping", query.grouping.name())
        .choice("isByChat", query.is_by_chat)
        .database(database);
    match &query.grouping {
        UsageGrouping::Minute | UsageGrouping::Hour => {}
        UsageGrouping::Day { time_zone } => {
            spec = spec.parameter("timeZone", time_zone.clone());
        }
        UsageGrouping::Slot { hours, time_zone } => {
            spec = spec.choice("slotHours", *hours).parameter("timeZone", time_zone.clone());
        }
    }
    spec
}

/// The question about the token usage that the parameters of a recorded `find_usage` hold.
///
/// # Errors
/// An error when a parameter is missing or has a wrong type, or when the grouping is not known.
pub fn usage_query_from_parameters(parameters: &Value) -> Result<UsageQuery, String> {
    let text = |name: &str| {
        parameters.get(name).and_then(Value::as_str).map(str::to_string).ok_or(format!("The parameter {name} is missing."))
    };
    let number = |name: &str| {
        parameters.get(name).and_then(Value::as_i64).ok_or(format!("The parameter {name} is missing or is not a number."))
    };
    let folders = parameters
        .get("folders")
        .and_then(Value::as_array)
        .ok_or("The parameter folders is missing.")?
        .iter()
        .filter_map(|folder| folder.as_str().map(str::to_string))
        .collect();
    let time_zone = parameters.get("timeZone").and_then(Value::as_str).unwrap_or("UTC").to_string();
    let grouping = match text("grouping")?.as_str() {
        "slot" => {
            let hours = number("slotHours")?;
            UsageGrouping::Slot { hours: u32::try_from(hours).map_err(|_| format!("The slot of {hours} hours is wrong."))?, time_zone }
        }
        name => UsageGrouping::from_name(name, &time_zone)?,
    };
    Ok(UsageQuery {
        repository: text("repository")?,
        folders,
        since: number("since")?,
        until: number("until")?,
        grouping,
        is_by_chat: parameters.get("isByChat").and_then(Value::as_bool).unwrap_or(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use request_log::testing::{capture, starts};

    fn query(grouping: UsageGrouping) -> UsageQuery {
        UsageQuery {
            repository: "heidrun-org/heidrun".to_string(),
            folders: vec!["/work/heidrun".to_string(), "/work/other".to_string()],
            since: 1_000,
            until: 2_000,
            grouping,
            is_by_chat: true,
        }
    }

    fn recorded_parameters(query: &UsageQuery) -> Value {
        let (_, events) = capture(|| {
            request_log::record_value(usage_query_spec("find_usage", query, Path::new("/none")), || (), |_| request_log::Summary::none())
        });
        starts(&events)[0].parameters.clone()
    }

    #[test]
    fn each_grouping_comes_back_from_the_recorded_parameters_as_the_same_question() {
        for grouping in [
            UsageGrouping::Minute,
            UsageGrouping::Hour,
            UsageGrouping::Day { time_zone: "Europe/Paris".to_string() },
            UsageGrouping::Slot { hours: 6, time_zone: "Europe/Paris".to_string() },
        ] {
            let original = query(grouping);
            let parameters = recorded_parameters(&original);
            assert_eq!(usage_query_from_parameters(&parameters), Ok(original));
        }
    }

    #[test]
    fn the_pattern_has_the_choices_and_no_repository_and_no_date() {
        let (_, events) = capture(|| {
            let slot = query(UsageGrouping::Slot { hours: 6, time_zone: "Europe/Paris".to_string() });
            request_log::record_value(usage_query_spec("find_usage", &slot, Path::new("/none")), || (), |_| request_log::Summary::none())
        });
        assert_eq!(starts(&events)[0].pattern, "grouping=slot | isByChat=true | slotHours=6");
    }

    #[test]
    fn a_missing_parameter_is_an_error_with_its_name() {
        let error = usage_query_from_parameters(&serde_json::json!({ "repository": "a/b" })).unwrap_err();
        assert!(error.contains("folders") || error.contains("grouping"), "{error}");
    }
}
