import { beforeEach, describe, expect, it } from "vitest";
import { chatDateRows, durationText, folderText, fullDateText } from "./chat_dates";
import { settings } from "../stores/settings";
import type { ChatMeta } from "../stores/chats";

/** A date in the time zone of the test, in milliseconds since 1970. */
function at(month: number, day: number, hour: number, minute: number, year = 2026): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function emptyMeta(): ChatMeta {
  return { first_at: null, last_at: null, user_messages: 0, folders: [], issues: [], pull_requests: [], files_written: [] };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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
    expect(durationText(13 * MINUTE + 40_000)).toBe("13 minutes");
  });

  it("writes hours and minutes, and drops a unit that is zero", () => {
    expect(durationText(HOUR + 5 * MINUTE)).toBe("1 hour 5 minutes");
    expect(durationText(3 * HOUR)).toBe("3 hours");
  });

  it("writes at most two units, the biggest ones", () => {
    expect(durationText(2 * DAY + 3 * HOUR + 4 * MINUTE)).toBe("2 days 3 hours");
    expect(durationText(DAY + 5 * MINUTE)).toBe("1 day 5 minutes");
  });

  it("treats a negative duration as zero", () => {
    expect(durationText(-5)).toBe("Less than a minute");
  });
});

describe("folderText", () => {
  it("gives ./ for the root of the repository, with or without a last slash", () => {
    expect(folderText("/work/app", "/work/app")).toBe("./");
    expect(folderText("/work/app/", "/work/app/")).toBe("./");
  });

  it("gives the path below the root for a folder inside the repository", () => {
    expect(folderText("/work/app", "/work/app/packages/web")).toBe("packages/web");
    expect(folderText("/work/app", "/work/app/.claude/worktrees/fix")).toBe(".claude/worktrees/fix");
  });

  it("gives the absolute path for a folder outside the repository, or when the root is not known", () => {
    expect(folderText("/work/app", "/work/application")).toBe("/work/application");
    expect(folderText("/work/app", "/elsewhere")).toBe("/elsewhere");
    expect(folderText(null, "/work/app")).toBe("/work/app");
  });
});

describe("chatDateRows", () => {
  it("gives nothing for a chat that has no date, no message, and no folder", () => {
    expect(chatDateRows(emptyMeta(), "/work/app")).toEqual({
      started: null,
      lastActivity: null,
      duration: null,
      messages: 0,
      folders: [],
    });
  });

  it("gives the two dates, the duration, the messages, and the folders", () => {
    const meta = {
      ...emptyMeta(),
      first_at: at(10, 11, 21, 23),
      last_at: at(10, 11, 21, 36),
      user_messages: 4,
      folders: ["/work/app", "/work/app/sub"],
    };
    expect(chatDateRows(meta, "/work/app")).toEqual({
      started: "Sun, Oct 11, 2026, 21:23",
      lastActivity: "Sun, Oct 11, 2026, 21:36",
      duration: "13 minutes",
      messages: 4,
      folders: ["./", "sub"],
    });
  });

  it("gives no duration when only one date is known, and uses it for both dates", () => {
    const rows = chatDateRows({ ...emptyMeta(), last_at: at(10, 11, 21, 36) }, null);
    expect(rows.started).toBe("Sun, Oct 11, 2026, 21:36");
    expect(rows.lastActivity).toBe("Sun, Oct 11, 2026, 21:36");
    expect(rows.duration).toBeNull();
  });
});
