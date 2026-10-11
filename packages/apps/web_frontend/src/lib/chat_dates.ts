import { locale, t } from "../i18n/index";
import type { ChatMeta } from "../stores/chats";
import { timeText } from "./chat_summary";

/** What the information card of the dates line shows for a chat. */
export type ChatDateRows = {
  /** The date and the time of the first record, or null when the chat has no date. */
  started: string | null;
  /** The date and the time of the last record, or null when the chat has no date. */
  lastActivity: string | null;
  /** How long the chat lasted, or null when the chat has no first date or no last date. */
  duration: string | null;
  /** The number of messages that the developer typed. */
  messages: number;
  /** The folders where the coding agent ran, each one below the root of the repository when it is. */
  folders: string[];
};

/** The units of a duration, from the biggest to the smallest, in milliseconds, with the key of their text. */
const DURATION_UNITS = [
  { milliseconds: 86_400_000, key: "chatsPanel.durationDays" },
  { milliseconds: 3_600_000, key: "chatsPanel.durationHours" },
  { milliseconds: 60_000, key: "chatsPanel.durationMinutes" },
] as const;

/** The most units that a duration shows: "1 hour 5 minutes", never "1 hour 5 minutes 3 seconds". */
const DURATION_MAX_UNITS = 2;

/**
 * A date with its day of the week and its time, for example "Sat, Oct 11, 2026, 21:23".
 * @param milliseconds - the date in milliseconds since 1970
 * @returns the text
 */
export function fullDateText(milliseconds: number): string {
  const date = new Date(milliseconds);
  const day = date.toLocaleDateString(locale.value, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  return `${day}, ${timeText(date)}`;
}

/**
 * How long a chat lasted, with at most two units: "13 minutes", "1 hour 5 minutes", "2 days 3 hours".
 * @param milliseconds - the duration in milliseconds
 * @returns the text, or "Less than a minute" for a duration under one minute
 */
export function durationText(milliseconds: number): string {
  let rest = Math.max(0, milliseconds);
  const parts: string[] = [];
  for (const unit of DURATION_UNITS) {
    const count = Math.floor(rest / unit.milliseconds);
    rest -= count * unit.milliseconds;
    if (count > 0 && parts.length < DURATION_MAX_UNITS) {
      parts.push(t(unit.key, { count }));
    }
  }
  return parts.length === 0 ? t("chatsPanel.durationLessThanMinute") : parts.join(" ");
}

/**
 * The path of a folder for the card: "./" for the root of the repository, the path below the root for a folder inside
 * the repository, and the absolute path for a folder outside it.
 * @param root - the root of the repository, or null when it is not known
 * @param folder - the absolute path of the folder
 * @returns the text
 */
export function folderText(root: string | null, folder: string): string {
  if (root === null) {
    return folder;
  }
  const base = root.endsWith("/") ? root.slice(0, -1) : root;
  if (folder === base || folder === `${base}/`) {
    return "./";
  }
  return folder.startsWith(`${base}/`) ? folder.slice(base.length + 1).replace(/\/+$/, "") : folder;
}

/**
 * What the information card of the dates line shows.
 * @param meta - what the scan of the file of the chat found
 * @param root - the root of the repository, or null when it is not known
 * @returns the rows of the card
 */
export function chatDateRows(meta: ChatMeta, root: string | null): ChatDateRows {
  const first = meta.first_at ?? meta.last_at;
  const last = meta.last_at ?? meta.first_at;
  const hasBothDates = meta.first_at !== null && meta.last_at !== null;
  return {
    started: first === null ? null : fullDateText(first),
    lastActivity: last === null ? null : fullDateText(last),
    duration: hasBothDates ? durationText((meta.last_at as number) - (meta.first_at as number)) : null,
    messages: meta.user_messages,
    folders: meta.folders.map((folder) => folderText(root, folder)),
  };
}
