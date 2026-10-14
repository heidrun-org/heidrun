import { locale, t } from "../i18n/index";
import type { ChatMeta } from "../stores/chats";
import { timeText } from "./chat_summary";

/** One date of the information card of the dates line, in two forms. */
export type ChatDate = {
  /** How long ago the date was, for example "2 days ago". The card shows it. */
  ago: string;
  /** The full date, with the day of the week and the time. The card gives it as the title of a question mark. */
  full: string;
};

/** What the information card of the dates line shows for a chat. */
export type ChatDateRows = {
  /** The first record of the chat, or null when the chat has no date. */
  started: ChatDate | null;
  /** The last record of the chat, or null when the chat has no date. */
  lastActivity: ChatDate | null;
  /** How long the chat lasted, or null when the chat has no first date or no last date. */
  duration: string | null;
  /** The number of messages that the developer typed. */
  messages: number;
  /** The text of the first messages that the developer typed, at most three, each one on one line. */
  firstMessages: string[];
};

/** The units of a duration, from the biggest to the smallest, in milliseconds, with the key of their text. */
const DURATION_UNITS = [
  { milliseconds: 86_400_000, key: "chatsPanel.durationDays" },
  { milliseconds: 3_600_000, key: "chatsPanel.durationHours" },
  { milliseconds: 60_000, key: "chatsPanel.durationMinutes" },
] as const;

/** The units of the time since a date, from the biggest to the smallest, in milliseconds, with the key of their text. */
const AGO_UNITS = [
  { milliseconds: 365 * 86_400_000, key: "chatsPanel.agoYears" },
  { milliseconds: 30 * 86_400_000, key: "chatsPanel.agoMonths" },
  { milliseconds: 86_400_000, key: "chatsPanel.agoDays" },
  { milliseconds: 3_600_000, key: "chatsPanel.agoHours" },
  { milliseconds: 60_000, key: "chatsPanel.agoMinutes" },
] as const;

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
 * How long a chat lasted, with one unit, rounded to the nearest: "13 minutes", "3 hours", "2 days".
 * @param milliseconds - the duration in milliseconds
 * @returns the text, or "Less than a minute" for a duration under one minute
 */
export function durationText(milliseconds: number): string {
  const duration = Math.max(0, milliseconds);
  for (const [index, unit] of DURATION_UNITS.entries()) {
    if (duration < unit.milliseconds) {
      continue;
    }
    const count = Math.round(duration / unit.milliseconds);
    const bigger = index === 0 ? undefined : DURATION_UNITS[index - 1];
    if (bigger !== undefined && count * unit.milliseconds >= bigger.milliseconds) {
      return t(bigger.key, { count: 1 });
    }
    return t(unit.key, { count });
  }
  return t("chatsPanel.durationLessThanMinute");
}

/**
 * How long ago a date was, with one unit: "5 minutes ago", "2 days ago", "3 months ago".
 * @param milliseconds - the date in milliseconds since 1970
 * @param now - the present time in milliseconds since 1970
 * @returns the text, or "Just now" for a date under one minute ago, or in the future
 */
export function agoText(milliseconds: number, now: number): string {
  const elapsed = Math.max(0, now - milliseconds);
  for (const unit of AGO_UNITS) {
    if (elapsed >= unit.milliseconds) {
      return t(unit.key, { count: Math.floor(elapsed / unit.milliseconds) });
    }
  }
  return t("chatsPanel.agoJustNow");
}

/**
 * What the information card of the dates line shows.
 * @param meta - what the scan of the file of the chat found
 * @param now - the present time in milliseconds since 1970
 * @returns the rows of the card
 */
export function chatDateRows(meta: ChatMeta, now: number): ChatDateRows {
  const first = meta.first_at ?? meta.last_at;
  const last = meta.last_at ?? meta.first_at;
  const hasBothDates = meta.first_at !== null && meta.last_at !== null;
  const dateOf = (milliseconds: number | null): ChatDate | null =>
    milliseconds === null ? null : { ago: agoText(milliseconds, now), full: fullDateText(milliseconds) };
  return {
    started: dateOf(first),
    lastActivity: dateOf(last),
    duration: hasBothDates ? durationText((meta.last_at as number) - (meta.first_at as number)) : null,
    messages: meta.user_messages,
    firstMessages: meta.first_messages,
  };
}
