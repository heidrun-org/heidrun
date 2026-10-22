//! The wall-clock time as text, in UTC, with the format `2026-10-17T12:34:56.789Z`.
//!
//! The package writes the time as text, so that a person and a SQL statement can read it. The duration of an operation never
//! uses this clock: it uses the monotonic clock of the program.

use std::time::{SystemTime, UNIX_EPOCH};

/// The number of milliseconds in one day.
const MILLISECONDS_PER_DAY: i64 = 86_400_000;

/// The number of milliseconds since 1 January 1970 UTC.
pub fn now_milliseconds() -> i64 {
    system_time_milliseconds(SystemTime::now())
}

/// The number of milliseconds since 1 January 1970 UTC of a time. A time before 1970 gives 0.
pub fn system_time_milliseconds(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH).map(|duration| duration.as_millis() as i64).unwrap_or(0)
}

/// The text `2026-10-17T12:34:56.789Z` of a number of milliseconds since 1 January 1970 UTC.
pub fn utc_text(milliseconds: i64) -> String {
    let days = milliseconds.div_euclid(MILLISECONDS_PER_DAY);
    let of_day = milliseconds.rem_euclid(MILLISECONDS_PER_DAY);
    let (year, month, day) = civil_from_days(days);
    let hour = of_day / 3_600_000;
    let minute = of_day % 3_600_000 / 60_000;
    let second = of_day % 60_000 / 1000;
    let millisecond = of_day % 1000;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millisecond:03}Z")
}

/// The number of milliseconds since 1 January 1970 UTC of a text written by `utc_text`. A text with another format gives
/// `None`.
pub fn parse_utc_text(text: &str) -> Option<i64> {
    let bytes = text.as_bytes();
    if bytes.len() != 24 || bytes[4] != b'-' || bytes[7] != b'-' || bytes[10] != b'T' || bytes[13] != b':' {
        return None;
    }
    if bytes[16] != b':' || bytes[19] != b'.' || bytes[23] != b'Z' {
        return None;
    }
    let number = |from: usize, to: usize| text.get(from..to)?.parse::<i64>().ok();
    let (year, month, day) = (number(0, 4)?, number(5, 7)?, number(8, 10)?);
    let (hour, minute, second, millisecond) = (number(11, 13)?, number(14, 16)?, number(17, 19)?, number(20, 23)?);
    if (1..=12).contains(&month) == false || (1..=31).contains(&day) == false || hour > 23 || minute > 59 || second > 59 {
        return None;
    }
    let days = days_from_civil(year, month, day);
    Some(days * MILLISECONDS_PER_DAY + hour * 3_600_000 + minute * 60_000 + second * 1000 + millisecond)
}

/// The year, the month, and the day of a number of days since 1 January 1970.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era = (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 { month_index + 3 } else { month_index - 9 };
    let year = year_of_era + era * 400 + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

/// The number of days since 1 January 1970 of a year, a month, and a day.
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year.rem_euclid(400);
    let month_index = if month > 2 { month - 3 } else { month + 9 };
    let day_of_year = (153 * month_index + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_epoch_is_the_first_of_january_1970() {
        assert_eq!(utc_text(0), "1970-01-01T00:00:00.000Z");
    }

    #[test]
    fn a_known_time_gives_the_known_text() {
        // 2026-10-17T12:34:56.789Z, from `date -u -r 1792240496`.
        assert_eq!(utc_text(1_792_240_496_789), "2026-10-17T12:34:56.789Z");
    }

    #[test]
    fn a_leap_day_is_written_and_read_back() {
        let milliseconds = parse_utc_text("2024-02-29T23:59:59.999Z").unwrap();
        assert_eq!(utc_text(milliseconds), "2024-02-29T23:59:59.999Z");
        assert_eq!(utc_text(milliseconds + 1), "2024-03-01T00:00:00.000Z");
    }

    #[test]
    fn a_text_is_read_back_to_the_same_milliseconds() {
        for milliseconds in [0, 1, 86_399_999, 1_000_000_000_000, 1_792_240_496_789, 4_102_444_800_000] {
            assert_eq!(parse_utc_text(&utc_text(milliseconds)), Some(milliseconds));
        }
    }

    #[test]
    fn a_text_with_another_format_gives_nothing() {
        assert_eq!(parse_utc_text("2026-10-17"), None);
        assert_eq!(parse_utc_text("2026-13-17T12:34:56.789Z"), None);
        assert_eq!(parse_utc_text("2026-10-17 12:34:56.789Z"), None);
    }
}
