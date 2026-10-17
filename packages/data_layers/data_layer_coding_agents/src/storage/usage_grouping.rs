//! Cuts the token usage of each minute in periods: the minute, the hour in UTC, the calendar day of a time zone, or a slot of a
//! calendar day of a time zone.
//!
//! A day is cut in Rust and not in SQL, because SQLite does not know the time zones: a day of a zone that changes its clock
//! lasts 23 or 25 hours, and its start is not at a fixed offset from UTC. Every period starts at a whole minute, so the total of
//! the periods is always the total of the minutes: the groupings give the same sums.
//!
//! A slot counts its hours from the start of its day, not from the clock of the zone, so a slot never crosses midnight and the
//! slots of a day of 23 or 25 hours follow the real length of the day: with slots of 1 hour, the day of 25 hours has 25 slots,
//! and the repeated hour is not merged into one bar. A zone with a half hour offset, such as India, cuts its slots at its own
//! local hours, which a cut in UTC would not do.
//!
//! The rows of the tokens of a record without a date are not in any period, and so are never given here.

use crate::model::token_usage_types::{UsageGrouping, UsageRow, UsageTotals};
use crate::model::types::CodingAgent;
use crate::storage::minute_text::{parse_time_text, time_text};
use chrono::{DateTime, Duration, LocalResult, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Tz;
use std::collections::BTreeMap;

/// The number of milliseconds in one hour.
const HOUR_MILLISECONDS: i64 = 60 * 60 * 1000;

/// The most hours that the search of the first instant of a day goes forward when the clock skips midnight.
const MIDNIGHT_SEARCH_HOURS: i64 = 3;

/// The tokens of one chat session, one coding agent, and one model in one minute, as the view `token_usage_with_cost` gives
/// them.
#[derive(Debug, Clone, PartialEq)]
pub struct MinuteUsage {
    /// The minute, in UTC, in the format ISO 8601.
    pub minute_at: String,
    /// The chat session, or `None` when the rows of all the chat sessions are added together.
    pub chat_session_id: Option<String>,
    /// The coding agent.
    pub coding_agent: CodingAgent,
    /// The name of the model. It is an empty text when the model is not known.
    pub model: String,
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    pub fresh_input: u64,
    /// The input tokens that the provider read from its cache.
    pub cached_input: u64,
    /// The input tokens that the provider wrote to its cache.
    pub cache_write_input: u64,
    /// The output tokens.
    pub output: u64,
    /// The estimated cost in US dollars, or `None` when the model has no known price.
    pub cost_usd: Option<f64>,
}

/// The key of a period: its start, the chat session, the coding agent, and the model.
type PeriodKey = (String, Option<String>, CodingAgent, String);

/// Adds the minutes in periods. The result is sorted by the start of the period, then by chat session, coding agent, and model.
///
/// # Errors
/// An error when a minute is not a time in ISO 8601, or when the time zone of a day is not known.
pub fn group_minutes(minutes: Vec<MinuteUsage>, grouping: &UsageGrouping) -> Result<Vec<UsageRow>, String> {
    let time_zone = match grouping {
        UsageGrouping::Day { time_zone } => Some(find_time_zone(time_zone)?),
        UsageGrouping::Slot { hours, time_zone } => {
            check_slot_hours(*hours)?;
            Some(find_time_zone(time_zone)?)
        }
        _ => None,
    };
    let mut periods: BTreeMap<PeriodKey, UsageRow> = BTreeMap::new();
    for minute in minutes {
        let milliseconds = parse_time_text(&minute.minute_at)?;
        let (period_start, local_day) = match (grouping, time_zone) {
            (UsageGrouping::Minute, _) => (minute.minute_at.clone(), None),
            (UsageGrouping::Hour, _) => (time_text(milliseconds.div_euclid(HOUR_MILLISECONDS) * HOUR_MILLISECONDS)?, None),
            (UsageGrouping::Day { .. }, Some(zone)) => {
                let (start, day) = day_of(milliseconds, zone)?;
                (time_text(start)?, Some(day))
            }
            (UsageGrouping::Slot { hours, .. }, Some(zone)) => {
                let (start, day) = slot_of(milliseconds, zone, *hours)?;
                (time_text(start)?, Some(day))
            }
            (UsageGrouping::Day { time_zone } | UsageGrouping::Slot { time_zone, .. }, None) => {
                return Err(format!("The time zone {time_zone} is not known."))
            }
        };
        let key = (period_start.clone(), minute.chat_session_id.clone(), minute.coding_agent, minute.model.clone());
        let row = periods.entry(key).or_insert_with(|| UsageRow {
            period_start,
            local_day,
            chat_session_id: minute.chat_session_id.clone(),
            coding_agent: minute.coding_agent,
            model: minute.model.clone(),
            fresh_input: 0,
            cached_input: 0,
            cache_write_input: 0,
            output: 0,
            cost_usd: Some(0.0),
        });
        row.fresh_input += minute.fresh_input;
        row.cached_input += minute.cached_input;
        row.cache_write_input += minute.cache_write_input;
        row.output += minute.output;
        row.cost_usd = match (row.cost_usd, minute.cost_usd) {
            (Some(total), Some(cost)) => Some(total + cost),
            _ => None,
        };
    }
    Ok(periods.into_values().collect())
}

/// The totals of one period, and of one chat session when the query asked for one row for each chat session.
#[derive(Debug, Clone, PartialEq)]
pub struct PeriodUsage {
    /// The start of the period, in UTC, in the format ISO 8601.
    pub period_start: String,
    /// For a day or a slot, the date of the day in the time zone, in the format `YYYY-MM-DD`. `None` for a minute and for an hour.
    pub local_day: Option<String>,
    /// The chat session, when the query asked for one row for each chat session.
    pub chat_session_id: Option<String>,
    /// The tokens of the period, and its cost: the known cost, and the rows and tokens whose cost is unknown.
    pub totals: UsageTotals,
}

/// Adds the rows of the coding agents and of the models that share a period (and a chat session). `rows` must be sorted as
/// `group_minutes` sorts them.
pub fn summarize_periods(rows: &[UsageRow]) -> Vec<PeriodUsage> {
    let mut periods: Vec<PeriodUsage> = Vec::new();
    let mut start = 0;
    while start < rows.len() {
        let first = &rows[start];
        let mut end = start + 1;
        while end < rows.len() && rows[end].period_start == first.period_start && rows[end].chat_session_id == first.chat_session_id {
            end += 1;
        }
        periods.push(PeriodUsage {
            period_start: first.period_start.clone(),
            local_day: first.local_day.clone(),
            chat_session_id: first.chat_session_id.clone(),
            totals: UsageTotals::of(&rows[start..end]),
        });
        start = end;
    }
    periods
}

/// The name of the time zone of the computer, or `UTC` when the computer does not tell.
pub fn local_time_zone_name() -> String {
    iana_time_zone::get_timezone().ok().filter(|name| name.parse::<Tz>().is_ok()).unwrap_or_else(|| "UTC".to_string())
}

/// A bound of a time range, in milliseconds since 1970. The text is a time in the format ISO 8601 with its zone, for example
/// `2026-10-14T08:30:00Z`, or a date `YYYY-MM-DD`, which means the start of that day in `time_zone`.
///
/// # Errors
/// An error when the text is neither of the two, or when the time zone is not known.
pub fn parse_range_bound(text: &str, time_zone: &str) -> Result<i64, String> {
    if let Ok(date) = NaiveDate::parse_from_str(text, "%Y-%m-%d") {
        let zone = find_time_zone(time_zone)?;
        return start_of_day(date, zone, 0);
    }
    parse_time_text(text).map_err(|_| format!("`{text}` is neither a date YYYY-MM-DD nor a time in ISO 8601 with its zone."))
}

/// The time zone of a name in the database of the IANA.
///
/// # Errors
/// An error when the name is not in the database.
pub fn find_time_zone(name: &str) -> Result<Tz, String> {
    name.parse::<Tz>().map_err(|_| format!("The time zone {name} is not known. Use a name such as Europe/Paris or UTC."))
}

/// The start of the calendar day that holds `milliseconds` in `zone`, in milliseconds since 1970, and the date of this day.
fn day_of(milliseconds: i64, zone: Tz) -> Result<(i64, String), String> {
    let instant = DateTime::<Utc>::from_timestamp_millis(milliseconds)
        .ok_or_else(|| format!("The time {milliseconds} is out of the range of dates."))?;
    let date = instant.with_timezone(&zone).date_naive();
    Ok((start_of_day(date, zone, milliseconds)?, date.format("%Y-%m-%d").to_string()))
}

/// The start of the slot of `hours` hours that holds `milliseconds` in `zone`, in milliseconds since 1970, and the date of the
/// day of the slot. The first slot starts at the start of the day, and a slot never goes past the end of the day.
fn slot_of(milliseconds: i64, zone: Tz, hours: u32) -> Result<(i64, String), String> {
    let (day_start, day) = day_of(milliseconds, zone)?;
    let slot_milliseconds = i64::from(hours) * HOUR_MILLISECONDS;
    let slot_start = day_start + (milliseconds - day_start).div_euclid(slot_milliseconds) * slot_milliseconds;
    Ok((slot_start, day))
}

/// Refuses a length of slot that is not from 1 to 23 hours. A slot of 24 hours is a day.
fn check_slot_hours(hours: u32) -> Result<(), String> {
    if hours == 0 || hours >= 24 {
        return Err(format!("A slot lasts from 1 to 23 hours, not {hours}. Use the grouping by day for a slot of 24 hours."));
    }
    Ok(())
}

/// The first instant of `date` in `zone`. When the clock of the zone skips midnight, it is the first instant after the skip. Else
/// when the clock repeats midnight, it is the first of the two.
fn start_of_day(date: NaiveDate, zone: Tz, fallback: i64) -> Result<i64, String> {
    for hour in 0..=MIDNIGHT_SEARCH_HOURS {
        let local = date.and_time(NaiveTime::MIN) + Duration::hours(hour);
        match zone.from_local_datetime(&local) {
            LocalResult::Single(start) => return Ok(start.timestamp_millis()),
            LocalResult::Ambiguous(first, _) => return Ok(first.timestamp_millis()),
            LocalResult::None => continue,
        }
    }
    Ok(fallback)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minute(minute_at: &str, model: &str, output: u64, cost: Option<f64>) -> MinuteUsage {
        MinuteUsage {
            minute_at: minute_at.to_string(),
            chat_session_id: None,
            coding_agent: CodingAgent::ClaudeCode,
            model: model.to_string(),
            fresh_input: 1,
            cached_input: 2,
            cache_write_input: 3,
            output,
            cost_usd: cost,
        }
    }

    fn day(time_zone: &str) -> UsageGrouping {
        UsageGrouping::Day { time_zone: time_zone.to_string() }
    }

    #[test]
    fn keeps_each_minute_as_a_period_of_its_own() {
        let rows = group_minutes(
            vec![minute("2026-10-14T10:05:00.000Z", "a", 10, Some(1.0)), minute("2026-10-14T10:04:00.000Z", "a", 20, Some(2.0))],
            &UsageGrouping::Minute,
        )
        .unwrap();
        let starts: Vec<&str> = rows.iter().map(|row| row.period_start.as_str()).collect();
        assert_eq!(starts, ["2026-10-14T10:04:00.000Z", "2026-10-14T10:05:00.000Z"]);
        assert_eq!(rows[0].local_day, None);
    }

    #[test]
    fn adds_the_minutes_of_one_hour_in_utc_for_the_same_model_and_keeps_the_models_apart() {
        let rows = group_minutes(
            vec![
                minute("2026-10-14T10:05:00.000Z", "a", 10, Some(1.0)),
                minute("2026-10-14T10:55:00.000Z", "a", 20, Some(2.0)),
                minute("2026-10-14T10:55:00.000Z", "b", 5, None),
                minute("2026-10-14T11:00:00.000Z", "a", 1, Some(0.5)),
            ],
            &UsageGrouping::Hour,
        )
        .unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!((rows[0].period_start.as_str(), rows[0].model.as_str(), rows[0].output), ("2026-10-14T10:00:00.000Z", "a", 30));
        assert_eq!((rows[0].fresh_input, rows[0].cached_input, rows[0].cache_write_input), (2, 4, 6));
        assert_eq!(rows[0].cost_usd, Some(3.0));
        assert_eq!((rows[1].model.as_str(), rows[1].cost_usd), ("b", None));
        assert_eq!(rows[2].period_start, "2026-10-14T11:00:00.000Z");
    }

    #[test]
    fn cuts_the_days_at_the_midnight_of_the_time_zone() {
        // 2026-10-14 22:30 UTC is already 2026-10-15 00:30 in Paris (UTC+2 in October).
        let rows = group_minutes(
            vec![minute("2026-10-14T21:59:00.000Z", "a", 1, Some(1.0)), minute("2026-10-14T22:30:00.000Z", "a", 2, Some(1.0))],
            &day("Europe/Paris"),
        )
        .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!((rows[0].period_start.as_str(), rows[0].local_day.as_deref()), ("2026-10-13T22:00:00.000Z", Some("2026-10-14")));
        assert_eq!((rows[1].period_start.as_str(), rows[1].local_day.as_deref()), ("2026-10-14T22:00:00.000Z", Some("2026-10-15")));
    }

    #[test]
    fn gives_a_day_of_23_hours_and_a_day_of_25_hours_when_the_clock_changes() {
        // Europe/Paris: the clock goes forward on 2026-03-29 (a day of 23 hours) and back on 2026-10-25 (a day of 25 hours).
        let rows = group_minutes(
            vec![
                minute("2026-03-28T23:00:00.000Z", "a", 1, Some(1.0)),
                minute("2026-03-29T21:59:00.000Z", "a", 1, Some(1.0)),
                minute("2026-03-29T22:00:00.000Z", "a", 1, Some(1.0)),
                minute("2026-10-24T22:00:00.000Z", "a", 1, Some(1.0)),
                minute("2026-10-25T22:59:00.000Z", "a", 1, Some(1.0)),
                minute("2026-10-25T23:00:00.000Z", "a", 1, Some(1.0)),
            ],
            &day("Europe/Paris"),
        )
        .unwrap();
        let days: Vec<(&str, &str)> =
            rows.iter().map(|row| (row.local_day.as_deref().unwrap(), row.period_start.as_str())).collect();
        assert_eq!(
            days,
            [
                ("2026-03-29", "2026-03-28T23:00:00.000Z"),
                ("2026-03-30", "2026-03-29T22:00:00.000Z"),
                ("2026-10-25", "2026-10-24T22:00:00.000Z"),
                ("2026-10-26", "2026-10-25T23:00:00.000Z"),
            ]
        );
        assert_eq!(rows[0].output, 2, "the two minutes of the day of 23 hours are in one day");
        assert_eq!(rows[2].output, 2, "the two minutes of the day of 25 hours are in one day");
    }

    #[test]
    fn finds_the_start_of_a_day_whose_midnight_does_not_exist() {
        // America/Havana skips 2026-03-08 00:00 and goes to 01:00.
        let rows = group_minutes(vec![minute("2026-03-08T10:00:00.000Z", "a", 1, Some(1.0))], &day("America/Havana")).unwrap();
        assert_eq!(rows[0].local_day.as_deref(), Some("2026-03-08"));
        assert_eq!(rows[0].period_start, "2026-03-08T05:00:00.000Z");
    }

    fn slot(hours: u32, time_zone: &str) -> UsageGrouping {
        UsageGrouping::Slot { hours, time_zone: time_zone.to_string() }
    }

    fn slot_starts(minutes_at: &[&str], grouping: &UsageGrouping) -> Vec<(String, String)> {
        let minutes = minutes_at.iter().map(|minute_at| minute(minute_at, "a", 1, Some(1.0))).collect();
        group_minutes(minutes, grouping)
            .unwrap()
            .into_iter()
            .map(|row| (row.period_start, row.local_day.unwrap()))
            .collect()
    }

    #[test]
    fn counts_the_hours_of_a_slot_from_the_start_of_the_day_of_the_time_zone() {
        // Paris is UTC+2 on 2026-10-14: the day starts at 22:00 UTC the day before, and the slots of 6 hours start 4 hours later.
        let starts = slot_starts(
            &["2026-10-14T03:59:00.000Z", "2026-10-14T04:00:00.000Z", "2026-10-14T21:59:00.000Z", "2026-10-14T22:00:00.000Z"],
            &slot(6, "Europe/Paris"),
        );
        let expected = [
            ("2026-10-13T22:00:00.000Z", "2026-10-14"),
            ("2026-10-14T04:00:00.000Z", "2026-10-14"),
            ("2026-10-14T16:00:00.000Z", "2026-10-14"),
            ("2026-10-14T22:00:00.000Z", "2026-10-15"),
        ];
        assert_eq!(starts, expected.map(|(start, day)| (start.to_string(), day.to_string())));
    }

    #[test]
    fn cuts_the_slots_of_a_zone_with_a_half_hour_offset_at_its_own_local_hours() {
        // Asia/Kolkata is UTC+5:30 with no change of clock: the day of 2026-10-14 starts at 18:30 UTC the day before.
        let starts = slot_starts(&["2026-10-14T12:29:00.000Z", "2026-10-14T12:30:00.000Z"], &slot(6, "Asia/Kolkata"));
        assert_eq!(starts[0], ("2026-10-14T06:30:00.000Z".to_string(), "2026-10-14".to_string()));
        assert_eq!(starts[1], ("2026-10-14T12:30:00.000Z".to_string(), "2026-10-14".to_string()));
        let hours = slot_starts(&["2026-10-14T12:29:00.000Z"], &slot(1, "Asia/Kolkata"));
        assert_eq!(hours[0].0, "2026-10-14T11:30:00.000Z", "a slot of 1 hour starts at a local hour, not at an hour of UTC");
    }

    #[test]
    fn gives_the_last_slot_of_a_day_of_23_hours_its_real_length() {
        // Europe/Paris, 2026-03-29: the day lasts from 2026-03-28T23:00Z to 2026-03-29T22:00Z.
        let starts = slot_starts(
            &["2026-03-28T23:00:00.000Z", "2026-03-29T04:59:00.000Z", "2026-03-29T05:00:00.000Z", "2026-03-29T21:59:00.000Z", "2026-03-29T22:00:00.000Z"],
            &slot(6, "Europe/Paris"),
        );
        let slot_starts: Vec<&str> = starts.iter().map(|(start, _)| start.as_str()).collect();
        assert_eq!(
            slot_starts,
            [
                "2026-03-28T23:00:00.000Z",
                "2026-03-29T05:00:00.000Z",
                "2026-03-29T17:00:00.000Z",
                "2026-03-29T22:00:00.000Z"
            ],
            "the minute at 04:59 is in the first slot, the minute at 21:59 is in the last slot of 5 hours, and 22:00 is the next day"
        );
        assert_eq!(starts[2].1, "2026-03-29");
        assert_eq!(starts[3].1, "2026-03-30");
    }

    #[test]
    fn gives_a_day_of_25_hours_25_slots_of_1_hour_and_an_extra_last_slot_of_1_hour_for_slots_of_6_hours() {
        // Europe/Paris, 2026-10-25: the day lasts from 2026-10-24T22:00Z to 2026-10-25T23:00Z. 02:30 happens twice: 00:30Z and 01:30Z.
        let hours = slot_starts(&["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"], &slot(1, "Europe/Paris"));
        assert_eq!(hours.len(), 2, "the repeated hour is not merged into one slot");
        assert_eq!(hours[0].0, "2026-10-25T00:00:00.000Z");
        assert_eq!(hours[1].0, "2026-10-25T01:00:00.000Z");
        let six_hours = slot_starts(&["2026-10-25T21:59:00.000Z", "2026-10-25T22:00:00.000Z", "2026-10-25T23:00:00.000Z"], &slot(6, "Europe/Paris"));
        let starts: Vec<&str> = six_hours.iter().map(|(start, _)| start.as_str()).collect();
        assert_eq!(starts, ["2026-10-25T16:00:00.000Z", "2026-10-25T22:00:00.000Z", "2026-10-25T23:00:00.000Z"]);
        assert_eq!(six_hours[1].1, "2026-10-25", "the extra slot of 1 hour is still in the day of 25 hours");
        assert_eq!(six_hours[2].1, "2026-10-26");
    }

    #[test]
    fn gives_the_same_sums_for_every_grouping() {
        let minutes: Vec<MinuteUsage> = (0..500)
            .map(|index| {
                let milliseconds = 1_791_712_800_000_i64 + index * 37 * 60_000;
                minute(&time_text(milliseconds).unwrap(), "a", index as u64, Some(index as f64 * 0.01))
            })
            .collect();
        let total = |grouping: UsageGrouping| {
            let rows = group_minutes(minutes.clone(), &grouping).unwrap();
            (rows.iter().map(|row| row.output).sum::<u64>(), rows.iter().map(|row| row.cost_usd.unwrap()).sum::<f64>())
        };
        let minute_total = total(UsageGrouping::Minute);
        assert_eq!(total(UsageGrouping::Hour).0, minute_total.0);
        assert_eq!(total(day("Europe/Paris")).0, minute_total.0);
        assert_eq!(total(slot(1, "Asia/Kolkata")).0, minute_total.0);
        assert_eq!(total(slot(6, "Europe/Paris")).0, minute_total.0);
        assert!((total(day("America/New_York")).1 - minute_total.1).abs() < 1e-6);
        assert!((total(slot(6, "America/New_York")).1 - minute_total.1).abs() < 1e-6);
    }

    #[test]
    fn marks_a_period_as_unpriced_when_one_of_its_minutes_is_unpriced() {
        let rows = group_minutes(
            vec![minute("2026-10-14T10:05:00.000Z", "a", 10, Some(1.0)), minute("2026-10-14T10:06:00.000Z", "a", 20, None)],
            &UsageGrouping::Hour,
        )
        .unwrap();
        assert_eq!(rows[0].cost_usd, None);
    }

    #[test]
    fn adds_the_models_of_a_period_and_counts_the_unpriced_ones_apart() {
        let rows = group_minutes(
            vec![
                minute("2026-10-14T10:05:00.000Z", "a", 10, Some(1.0)),
                minute("2026-10-14T10:06:00.000Z", "b", 20, None),
                minute("2026-10-14T11:06:00.000Z", "a", 5, Some(0.5)),
            ],
            &UsageGrouping::Hour,
        )
        .unwrap();
        let periods = summarize_periods(&rows);
        assert_eq!(periods.len(), 2);
        assert_eq!((periods[0].totals.output, periods[0].totals.known_cost_usd), (30, 1.0));
        assert!(!periods[0].totals.is_complete());
        assert_eq!(periods[0].totals.unpriced_token_count, 1 + 2 + 3 + 20);
        assert!(periods[1].totals.is_complete());
    }

    #[test]
    fn reads_a_date_as_the_start_of_that_day_in_the_time_zone_and_a_time_as_it_is() {
        assert_eq!(parse_range_bound("2026-10-14", "UTC"), Ok(1_791_936_000_000));
        assert_eq!(parse_range_bound("2026-10-14", "Europe/Paris"), Ok(1_791_936_000_000 - 2 * 3_600_000));
        assert_eq!(parse_range_bound("2026-10-14T08:30:00Z", "Europe/Paris"), Ok(1_791_936_000_000 + 8 * 3_600_000 + 1_800_000));
        assert!(parse_range_bound("last week", "UTC").is_err());
        assert!(parse_range_bound("2026-10-14", "Mars/Olympus").is_err());
    }

    #[test]
    fn gives_the_name_of_a_time_zone_that_is_known() {
        assert!(find_time_zone(&local_time_zone_name()).is_ok());
    }

    #[test]
    fn refuses_a_slot_of_zero_hours_and_a_slot_of_a_day_or_more() {
        for hours in [0, 24, 30] {
            assert!(group_minutes(vec![], &slot(hours, "UTC")).unwrap_err().contains("from 1 to 23 hours"));
        }
        assert!(group_minutes(vec![], &slot(23, "UTC")).is_ok());
    }

    #[test]
    fn gives_the_grouping_by_day_for_a_slot_of_24_hours() {
        assert_eq!(UsageGrouping::by_hours(24, "UTC"), day("UTC"));
        assert_eq!(UsageGrouping::by_hours(6, "UTC"), slot(6, "UTC"));
        assert_eq!(slot(6, "UTC").name(), "slot");
    }

    #[test]
    fn refuses_a_time_zone_that_is_not_known_and_a_minute_that_is_not_a_time() {
        assert!(group_minutes(vec![], &slot(6, "Mars/Olympus")).unwrap_err().contains("Mars/Olympus"));
        assert!(group_minutes(vec![], &day("Mars/Olympus")).unwrap_err().contains("Mars/Olympus"));
        assert!(group_minutes(vec![minute("yesterday", "a", 1, None)], &UsageGrouping::Hour).is_err());
    }
}
