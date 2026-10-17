//! The text form of a minute: the date in UTC in the format ISO 8601, with the seconds and the milliseconds at zero.

use crate::model::token_usage_types::MINUTE_MILLISECONDS;
use chrono::{DateTime, SecondsFormat, Utc};

/// The text of a minute, for example `2026-10-14T10:05:00.000Z`. All the texts have the same length and the same zone, so the
/// order of the texts is the order of the minutes.
///
/// # Errors
/// An error when the minute is out of the range of dates.
pub fn minute_text(minute: i64) -> Result<String, String> {
    DateTime::<Utc>::from_timestamp_millis(minute.saturating_mul(MINUTE_MILLISECONDS))
        .map(|date| date.to_rfc3339_opts(SecondsFormat::Millis, true))
        .ok_or_else(|| format!("The minute {minute} is out of the range of dates."))
}

/// The text of a time in milliseconds since 1970, in the same format as `minute_text`.
///
/// # Errors
/// An error when the time is out of the range of dates.
pub fn time_text(milliseconds: i64) -> Result<String, String> {
    DateTime::<Utc>::from_timestamp_millis(milliseconds)
        .map(|date| date.to_rfc3339_opts(SecondsFormat::Millis, true))
        .ok_or_else(|| format!("The time {milliseconds} is out of the range of dates."))
}

/// The time of a text in the format ISO 8601, in milliseconds since 1970.
///
/// # Errors
/// An error when the text is not a date.
pub fn parse_time_text(text: &str) -> Result<i64, String> {
    DateTime::parse_from_rfc3339(text)
        .map(|date| date.timestamp_millis())
        .map_err(|_| format!("`{text}` is not a time in ISO 8601."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_a_minute_in_utc_with_zero_seconds() {
        assert_eq!(minute_text(29_866_200).unwrap(), "2026-10-14T10:00:00.000Z");
        assert_eq!(minute_text(29_866_205).unwrap(), "2026-10-14T10:05:00.000Z");
        assert_eq!(minute_text(-1).unwrap(), "1969-12-31T23:59:00.000Z");
    }

    #[test]
    fn writes_and_reads_a_time() {
        assert_eq!(time_text(1_791_712_800_000).unwrap(), "2026-10-11T10:00:00.000Z");
        assert_eq!(parse_time_text("2026-10-11T12:00:00+02:00"), Ok(1_791_712_800_000));
        assert!(parse_time_text("yesterday").is_err());
    }
}
