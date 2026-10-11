import { locale, t } from "../i18n/index";
import type { ChatMeta } from "../stores/chats";
import { fileName } from "./chat_files";
import { timeOptions } from "./format";

/** The most issue numbers or pull request numbers that the summary of a chat writes. The others count as "+N". */
const LISTED_NUMBERS = 3;

/** The most file names that the summary of a chat writes. The others count as "+N". */
const LISTED_FILES = 2;

/** The day of a date, for example "Oct 11". The year follows when it is not the year of `now`. */
function dayText(date: Date, now: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  return date.toLocaleDateString(locale.value, options);
}

function timeText(date: Date): string {
  return date.toLocaleTimeString(locale.value, timeOptions());
}

/** The first date and the last date of a chat: "Oct 10 → Oct 11", or "Oct 11, 17:55 → 18:20" inside one day. */
function datesText(firstAt: number | null, lastAt: number | null, now: Date): string {
  const first = firstAt ?? lastAt;
  const last = lastAt ?? firstAt;
  if (first === null || last === null) {
    return "";
  }
  const firstDate = new Date(first);
  const lastDate = new Date(last);
  const firstDay = dayText(firstDate, now);
  const lastDay = dayText(lastDate, now);
  if (firstDay !== lastDay) {
    return `${firstDay} → ${lastDay}`;
  }
  const firstTime = timeText(firstDate);
  const lastTime = timeText(lastDate);
  return firstTime === lastTime ? `${firstDay}, ${firstTime}` : `${firstDay}, ${firstTime} → ${lastTime}`;
}

/** The numbers as "#250 #251 #252 +4": the first ones, then how many more there are. */
function numbersText(numbers: number[]): string {
  const listed = numbers.slice(0, LISTED_NUMBERS).map((number) => `#${number}`);
  const more = numbers.length - listed.length;
  return more > 0 ? `${listed.join(" ")} +${more}` : listed.join(" ");
}

/** The names of the first files, then how many more there are: "chats.rs, chats_scan.rs, +4". */
function filesText(files: string[]): string {
  const listed = files.slice(0, LISTED_FILES).map(fileName);
  const more = files.length - listed.length;
  return more > 0 ? `${listed.join(", ")}, +${more}` : listed.join(", ");
}

/** The three lines of the summary of a chat. A line that has nothing to say is an empty text. */
export type ChatSummaryLines = {
  /** The first and the last date, then the number of messages from the developer. */
  dates: string;
  /** The issues, then the pull requests. */
  references: string;
  /** The names of the files that the coding agent wrote. */
  files: string;
};

/**
 * The summary that the list shows under the title of a chat, in three lines: the dates and the messages, the issues and
 * the pull requests, and the files written.
 * @param meta - what the scan of the file of the chat found
 * @param now - the current date, which decides whether the year shows in a date
 * @returns the three lines, each one an empty text when the chat has nothing for it
 */
export function chatSummaryLines(meta: ChatMeta, now: Date = new Date()): ChatSummaryLines {
  const dates = [datesText(meta.first_at, meta.last_at, now)];
  if (meta.user_messages > 0) {
    dates.push(t("chatsPanel.messages", { count: meta.user_messages }));
  }
  const references: string[] = [];
  if (meta.issues.length > 0) {
    references.push(t("chatsPanel.issues", { count: meta.issues.length, numbers: numbersText(meta.issues) }));
  }
  if (meta.pull_requests.length > 0) {
    references.push(
      t("chatsPanel.pullRequests", { count: meta.pull_requests.length, numbers: numbersText(meta.pull_requests) }),
    );
  }
  return {
    dates: dates.filter((part) => part !== "").join(" · "),
    references: references.join(" · "),
    files: filesText(meta.files_written),
  };
}
