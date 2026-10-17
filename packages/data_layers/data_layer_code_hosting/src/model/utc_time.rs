//! Turns a time in the format ISO 8601, with a time zone offset, into the text that the dates of the stored items use.

use chrono::{DateTime, Duration, SecondsFormat, Timelike, Utc};

/// Turns a time in the format ISO 8601 that carries a time zone offset into the same moment in UTC, written with whole seconds
/// and the letter `Z`, for example `2026-10-14T17:52:04Z`, as GitHub writes its dates. A fraction of a second moves the time up
/// to the next whole second, so an item at a whole second compares as it does with the exact time.
///
/// # Errors
/// An error when the text is not a time with a time zone offset, for example `yesterday`, or a time with no offset.
pub fn to_whole_second_text(text: &str) -> Result<String, String> {
    let time = DateTime::parse_from_rfc3339(text)
        .map_err(|error| format!("`{text}` is not a time in UTC or with an offset: {error}"))?
        .with_timezone(&Utc);
    let rounded = if time.nanosecond() == 0 {
        time
    } else {
        time.with_nanosecond(0).unwrap_or(time) + Duration::seconds(1)
    };
    Ok(rounded.to_rfc3339_opts(SecondsFormat::Secs, true))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moves_an_offset_back_to_utc_and_keeps_whole_seconds() {
        assert_eq!(to_whole_second_text("2026-10-14T19:52:03+02:00"), Ok("2026-10-14T17:52:03Z".to_string()));
    }

    #[test]
    fn moves_a_fraction_of_a_second_up_to_the_next_whole_second() {
        assert_eq!(to_whole_second_text("2026-10-14T17:52:03.001Z"), Ok("2026-10-14T17:52:04Z".to_string()));
    }

    #[test]
    fn refuses_a_text_that_is_not_a_time_with_an_offset() {
        assert!(to_whole_second_text("yesterday").is_err());
    }
}
