//! Turns a time in the format ISO 8601, with a time zone offset, into a time in UTC with a fixed width. The fixed width lets
//! SQLite and the package compare two times as text.

use chrono::{DateTime, SecondsFormat, Utc};

/// Turns a time in the format ISO 8601 that carries a time zone offset into the same moment in UTC. The result always has
/// three digits of milliseconds, and ends with the letter `Z`, for example `2026-10-14T17:52:03.412Z`. A fraction of a
/// second that is more precise than a millisecond is cut.
///
/// # Errors
/// An error when the text is not a time with a time zone offset, for example `yesterday`, or a time with no offset.
pub fn to_utc_text(text: &str) -> Result<String, String> {
    let time = DateTime::parse_from_rfc3339(text).map_err(|error| format!("`{text}` is not a time in UTC or with an offset: {error}"))?;
    Ok(time.with_timezone(&Utc).to_rfc3339_opts(SecondsFormat::Millis, true))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moves_a_time_with_a_positive_offset_back_to_utc() {
        assert_eq!(to_utc_text("2026-10-14T19:52:03.412+02:00"), Ok("2026-10-14T17:52:03.412Z".to_string()));
    }

    #[test]
    fn moves_a_time_with_a_negative_offset_forward_to_utc_and_changes_the_day_when_needed() {
        assert_eq!(to_utc_text("2026-10-14T22:30:00.000-03:30"), Ok("2026-10-15T02:00:00.000Z".to_string()));
    }

    #[test]
    fn keeps_a_time_that_is_already_in_utc() {
        assert_eq!(to_utc_text("2026-10-14T17:52:03.412Z"), Ok("2026-10-14T17:52:03.412Z".to_string()));
        assert_eq!(to_utc_text("2026-10-14T17:52:03.412+00:00"), Ok("2026-10-14T17:52:03.412Z".to_string()));
    }

    #[test]
    fn writes_three_digits_of_milliseconds_when_the_text_has_no_fraction_or_a_longer_fraction() {
        assert_eq!(to_utc_text("2026-10-14T17:52:03Z"), Ok("2026-10-14T17:52:03.000Z".to_string()));
        assert_eq!(to_utc_text("2026-10-14T17:52:03.4129876Z"), Ok("2026-10-14T17:52:03.412Z".to_string()));
    }

    #[test]
    fn gives_texts_that_sort_in_the_order_of_time() {
        let earlier = to_utc_text("2026-10-14T23:59:59.999+02:00").unwrap();
        let later = to_utc_text("2026-10-14T22:00:00.000Z").unwrap();
        assert!(earlier < later);
    }

    #[test]
    fn refuses_a_text_that_is_not_a_time_or_that_has_no_time_zone_offset() {
        assert!(to_utc_text("yesterday").unwrap_err().contains("yesterday"));
        assert!(to_utc_text("2026-10-14T17:52:03.412").unwrap_err().contains("2026-10-14T17:52:03.412"));
        assert!(to_utc_text("").is_err());
    }
}
