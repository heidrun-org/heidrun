import { locale, t } from "../i18n/index";
import type { ChatMeta } from "../stores/chats";
import { chatFiles, fileName, type ChatFile } from "./chat_files";
import { chatWorktrees, worktreesText, type ChatWorktree } from "./chat_worktrees";
import { timeOptions } from "./format";

/** The most issue numbers or pull request numbers that the summary of a chat writes. The others count as "+N". */
const LISTED_NUMBERS = 3;

/** The most file names that the summary of a chat writes. The others count as "+N". */
const LISTED_FILES = 2;

/** The day of a date, for example "Oct 11". The year follows when it is not the year of `now`. */
export function dayText(date: Date, now: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  return date.toLocaleDateString(locale.value, options);
}

/** The time of a date, for example "17:55", in the format of the settings. */
export function timeText(date: Date): string {
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
function filesText(files: ChatFile[]): string {
  const listed = files.slice(0, LISTED_FILES).map((file) => fileName(file.label));
  const more = files.length - listed.length;
  return more > 0 ? `${listed.join(", ")}, +${more}` : listed.join(", ");
}

/** The four lines of the summary of a chat. A line that has nothing to say is an empty text. */
export type ChatSummaryLines = {
  /** The first and the last date, then the number of messages from the developer. */
  dates: string;
  /** The issues, then the pull requests. */
  references: string;
  /** The names of the files that the coding agent wrote. */
  files: string;
  /** The files that the coding agent wrote, each one once. The information card of the third line lists them. */
  fileEntries: ChatFile[];
  /** The names of the worktrees that the coding agent worked in. */
  worktrees: string;
  /** The worktrees that the coding agent worked in, each name once. The fourth line lists them. */
  worktreeEntries: ChatWorktree[];
};

/**
 * The summary that the list shows under the title of a chat, in four lines: the dates and the messages, the issues and
 * the pull requests, the files written, and the worktrees.
 * @param meta - what the scan of the file of the chat found
 * @param now - the current date, which decides whether the year shows in a date
 * @param root - the root of the repository, or null when it is not known: the files are named below it
 * @returns the four lines, each one an empty text when the chat has nothing for it
 */
export function chatSummaryLines(meta: ChatMeta, now: Date = new Date(), root: string | null = null): ChatSummaryLines {
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
  const fileEntries = chatFiles(root, meta.files_written);
  const worktreeEntries = chatWorktrees(meta.folders, meta.files_written);
  return {
    dates: dates.filter((part) => part !== "").join(" · "),
    references: references.join(" · "),
    files: filesText(fileEntries),
    fileEntries,
    worktrees: worktreesText(worktreeEntries),
    worktreeEntries,
  };
}
