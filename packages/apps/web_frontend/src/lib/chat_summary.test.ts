import { beforeEach, describe, expect, it } from "vitest";
import { chatSummaryLines } from "./chat_summary";
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

describe("chatSummaryLines", () => {
  it("gives three empty lines when the scan found nothing", () => {
    expect(chatSummaryLines(emptyMeta(), NOW)).toEqual({ dates: "", references: "", files: "" });
  });

  it("writes the two days when the chat spans two days", () => {
    const meta = { ...emptyMeta(), first_at: at(10, 10, 9, 12), last_at: at(10, 11, 18, 20) };
    expect(chatSummaryLines(meta, NOW).dates).toBe("Oct 10 → Oct 11");
  });

  it("writes the day and the two times when the chat stays inside one day", () => {
    const meta = { ...emptyMeta(), first_at: at(10, 11, 17, 55), last_at: at(10, 11, 18, 20) };
    expect(chatSummaryLines(meta, NOW).dates).toBe("Oct 11, 17:55 → 18:20");
  });

  it("writes one time when the first and the last date have the same minute", () => {
    const meta = { ...emptyMeta(), first_at: at(10, 11, 17, 55), last_at: at(10, 11, 17, 55) };
    expect(chatSummaryLines(meta, NOW).dates).toBe("Oct 11, 17:55");
  });

  it("adds the year to a date of another year", () => {
    const meta = { ...emptyMeta(), first_at: at(12, 30, 9, 0, 2025), last_at: at(10, 11, 9, 0) };
    expect(chatSummaryLines(meta, NOW).dates).toBe("Dec 30, 2025 → Oct 11");
  });

  it("writes the number of messages from the developer after the dates, with the singular form for one", () => {
    expect(chatSummaryLines({ ...emptyMeta(), user_messages: 1 }, NOW).dates).toBe("1 message from you");
    expect(chatSummaryLines({ ...emptyMeta(), user_messages: 12 }, NOW).dates).toBe("12 messages from you");
    const meta = { ...emptyMeta(), first_at: at(10, 11, 17, 55), last_at: at(10, 11, 18, 20), user_messages: 4 };
    expect(chatSummaryLines(meta, NOW).dates).toBe("Oct 11, 17:55 → 18:20 · 4 messages from you");
  });

  it("writes the issues and the pull requests with their numbers on the second line", () => {
    expect(chatSummaryLines({ ...emptyMeta(), issues: [250] }, NOW).references).toBe("Issue #250");
    expect(chatSummaryLines({ ...emptyMeta(), issues: [250, 251], pull_requests: [249] }, NOW).references).toBe(
      "Issues #250 #251 · Pull request #249",
    );
  });

  it("writes the first three numbers, then how many more there are", () => {
    expect(chatSummaryLines({ ...emptyMeta(), issues: [1, 2, 3, 4, 5, 6] }, NOW).references).toBe("Issues #1 #2 #3 +3");
    expect(chatSummaryLines({ ...emptyMeta(), pull_requests: [1, 2, 3] }, NOW).references).toBe("Pull requests #1 #2 #3");
  });

  it("writes the names of the first two files written on the third line, then how many more there are, and leaves the folders out", () => {
    const folders = ["/x", "/y"];
    expect(chatSummaryLines({ ...emptyMeta(), files_written: ["/work/a/one.rs"], folders }, NOW).files).toBe("one.rs");
    expect(chatSummaryLines({ ...emptyMeta(), files_written: ["/work/a/one.rs", "/work/b/two.rs"] }, NOW).files).toBe(
      "one.rs, two.rs",
    );
    const six = ["a", "b", "c", "d", "e", "f"].map((name) => `/work/${name}.rs`);
    expect(chatSummaryLines({ ...emptyMeta(), files_written: six }, NOW).files).toBe("a.rs, b.rs, +4");
  });

  it("writes the texts in French when the language is French", () => {
    settings.language = "fr";
    const meta = { ...emptyMeta(), user_messages: 2, issues: [250, 251], pull_requests: [249] };
    const lines = chatSummaryLines(meta, NOW);
    expect(lines.dates).toBe("2 messages de ta part");
    expect(lines.references).toBe("Issues #250 #251 · Pull request #249");
  });
});
