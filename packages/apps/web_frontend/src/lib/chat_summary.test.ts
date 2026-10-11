import { beforeEach, describe, expect, it } from "vitest";
import { chatSummary } from "./chat_summary";
import { settings } from "../stores/settings";
import type { ChatMeta } from "../stores/chats";

/** A date in the time zone of the test, in milliseconds since 1970. */
function at(month: number, day: number, hour: number, minute: number, year = 2026): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

/** The scan of a chat that found nothing. */
function emptyMeta(): ChatMeta {
  return { first_at: null, last_at: null, user_messages: 0, folders: [], issues: [], pull_requests: [], files_written: [] };
}

const NOW = new Date(2026, 9, 12, 9, 0);

beforeEach(() => {
  settings.language = "en";
  settings.timeFormat = "24h";
});

describe("chatSummary", () => {
  it("gives an empty text when the scan found nothing", () => {
    expect(chatSummary(emptyMeta(), NOW)).toBe("");
  });

  it("writes the two days when the chat spans two days", () => {
    const meta = { ...emptyMeta(), first_at: at(10, 10, 9, 12), last_at: at(10, 11, 18, 20) };
    expect(chatSummary(meta, NOW)).toBe("Oct 10 → Oct 11");
  });

  it("writes the day and the two times when the chat stays inside one day", () => {
    const meta = { ...emptyMeta(), first_at: at(10, 11, 17, 55), last_at: at(10, 11, 18, 20) };
    expect(chatSummary(meta, NOW)).toBe("Oct 11, 17:55 → 18:20");
  });

  it("writes one time when the first and the last date have the same minute", () => {
    const meta = { ...emptyMeta(), first_at: at(10, 11, 17, 55), last_at: at(10, 11, 17, 55) };
    expect(chatSummary(meta, NOW)).toBe("Oct 11, 17:55");
  });

  it("adds the year to a date of another year", () => {
    const meta = { ...emptyMeta(), first_at: at(12, 30, 9, 0, 2025), last_at: at(10, 11, 9, 0) };
    expect(chatSummary(meta, NOW)).toBe("Dec 30, 2025 → Oct 11");
  });

  it("writes the number of messages from the developer, with the singular form for one", () => {
    expect(chatSummary({ ...emptyMeta(), user_messages: 1 }, NOW)).toBe("1 message from you");
    expect(chatSummary({ ...emptyMeta(), user_messages: 12 }, NOW)).toBe("12 messages from you");
  });

  it("writes the issues and the pull requests with their numbers", () => {
    expect(chatSummary({ ...emptyMeta(), issues: [250] }, NOW)).toBe("Issue #250");
    expect(chatSummary({ ...emptyMeta(), issues: [250, 251], pull_requests: [249] }, NOW)).toBe(
      "Issues #250 #251 · Pull request #249",
    );
  });

  it("writes the first three numbers, then how many more there are", () => {
    expect(chatSummary({ ...emptyMeta(), issues: [1, 2, 3, 4, 5, 6] }, NOW)).toBe("Issues #1 #2 #3 +3");
    expect(chatSummary({ ...emptyMeta(), pull_requests: [1, 2, 3] }, NOW)).toBe("Pull requests #1 #2 #3");
  });

  it("writes the number of files written, and leaves the folders out", () => {
    expect(chatSummary({ ...emptyMeta(), files_written: ["/a"], folders: ["/x", "/y"] }, NOW)).toBe("1 file written");
    expect(chatSummary({ ...emptyMeta(), files_written: ["/a", "/b"] }, NOW)).toBe("2 files written");
  });

  it("separates the parts with a dot, in the order dates, messages, issues, pull requests, files", () => {
    const meta = {
      ...emptyMeta(),
      first_at: at(10, 11, 17, 55),
      last_at: at(10, 11, 18, 20),
      user_messages: 4,
      issues: [250],
      pull_requests: [249],
      files_written: ["/a"],
    };
    expect(chatSummary(meta, NOW)).toBe(
      "Oct 11, 17:55 → 18:20 · 4 messages from you · Issue #250 · Pull request #249 · 1 file written",
    );
  });

  it("writes the texts in French when the language is French", () => {
    settings.language = "fr";
    expect(chatSummary({ ...emptyMeta(), user_messages: 2, files_written: ["/a"] }, NOW)).toBe(
      "2 messages de ta part · 1 fichier écrit",
    );
  });
});
