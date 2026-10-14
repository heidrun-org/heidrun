import { beforeEach, describe, expect, it } from "vitest";
import { agoText, chatDateRows, durationText, fullDateText } from "./chat_dates";
import { settings } from "../stores/settings";
import type { ChatMeta } from "../stores/chats";

/** A date in the time zone of the test, in milliseconds since 1970. */
function at(month: number, day: number, hour: number, minute: number, year = 2026): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function emptyMeta(): ChatMeta {
  return {
    first_at: null,
    last_at: null,
    user_messages: 0,
    first_messages: [],
    folders: [],
    issues: [],
    pull_requests: [],
    files_written: [],
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = at(10, 13, 22, 0);

beforeEach(() => {
  settings.language = "en";
  settings.timeFormat = "24h";
});

describe("fullDateText", () => {
  it("gives the day of the week, the date with its year, and the time", () => {
    expect(fullDateText(at(10, 11, 21, 23))).toBe("Sun, Oct 11, 2026, 21:23");
  });
});

describe("durationText", () => {
  it("says less than a minute under one minute", () => {
    expect(durationText(0)).toBe("Less than a minute");
    expect(durationText(59_999)).toBe("Less than a minute");
  });

  it("writes minutes with the singular form for one", () => {
    expect(durationText(MINUTE)).toBe("1 minute");
    expect(durationText(13 * MINUTE + 40_000)).toBe("14 minutes");
  });

  it("writes one unit only, rounded to the nearest", () => {
    expect(durationText(2 * HOUR + 52 * MINUTE)).toBe("3 hours");
    expect(durationText(HOUR + 20 * MINUTE)).toBe("1 hour");
    expect(durationText(2 * DAY + 3 * HOUR)).toBe("2 days");
    expect(durationText(2 * DAY + 20 * HOUR)).toBe("3 days");
  });

  it("goes up to the next unit when the rounding reaches it", () => {
    expect(durationText(59 * MINUTE + 40_000)).toBe("1 hour");
    expect(durationText(23 * HOUR + 40 * MINUTE)).toBe("1 day");
  });

  it("treats a negative duration as zero", () => {
    expect(durationText(-5)).toBe("Less than a minute");
  });
});

describe("agoText", () => {
  it("says just now under one minute, and for a date in the future", () => {
    expect(agoText(NOW - 59_999, NOW)).toBe("Just now");
    expect(agoText(NOW + HOUR, NOW)).toBe("Just now");
  });

  it("writes one unit, the biggest one that fits, and rounds down", () => {
    expect(agoText(NOW - MINUTE, NOW)).toBe("1 minute ago");
    expect(agoText(NOW - 45 * MINUTE, NOW)).toBe("45 minutes ago");
    expect(agoText(NOW - HOUR - 59 * MINUTE, NOW)).toBe("1 hour ago");
    expect(agoText(NOW - 2 * DAY - 20 * HOUR, NOW)).toBe("2 days ago");
  });

  it("goes on with months and years for an old date", () => {
    expect(agoText(NOW - 29 * DAY, NOW)).toBe("29 days ago");
    expect(agoText(NOW - 30 * DAY, NOW)).toBe("1 month ago");
    expect(agoText(NOW - 90 * DAY, NOW)).toBe("3 months ago");
    expect(agoText(NOW - 400 * DAY, NOW)).toBe("1 year ago");
  });
});

describe("chatDateRows", () => {
  it("gives nothing for a chat that has no date and no message", () => {
    expect(chatDateRows(emptyMeta(), NOW)).toEqual({
      started: null,
      lastActivity: null,
      duration: null,
      messages: 0,
      firstMessages: [],
    });
  });

  it("gives the two dates in two forms, the duration, the messages, and the text of the first messages", () => {
    const meta = {
      ...emptyMeta(),
      first_at: at(10, 11, 21, 23),
      last_at: at(10, 11, 21, 36),
      user_messages: 4,
      first_messages: ["Fix it", "Thanks"],
    };
    expect(chatDateRows(meta, NOW)).toEqual({
      started: { ago: "2 days ago", full: "Sun, Oct 11, 2026, 21:23" },
      lastActivity: { ago: "2 days ago", full: "Sun, Oct 11, 2026, 21:36" },
      duration: "13 minutes",
      messages: 4,
      firstMessages: ["Fix it", "Thanks"],
    });
  });

  it("gives no duration when only one date is known, and uses it for both dates", () => {
    const rows = chatDateRows({ ...emptyMeta(), last_at: at(10, 11, 21, 36) }, NOW);
    expect(rows.started?.full).toBe("Sun, Oct 11, 2026, 21:36");
    expect(rows.lastActivity?.full).toBe("Sun, Oct 11, 2026, 21:36");
    expect(rows.duration).toBeNull();
  });
});
