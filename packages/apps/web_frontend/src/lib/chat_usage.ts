import { locale, t } from "../i18n/index";
import type { ChatUsage } from "../stores/chats";

/** The smallest cost that the card shows as a number. A smaller cost shows as "Less than $0.01". */
const SMALLEST_COST = 0.01;

/** The units of a big number of tokens, from the biggest to the smallest: thousand, million, billion, trillion. */
const TOKEN_UNITS = [
  { size: 1_000_000_000_000, suffix: "TT" },
  { size: 1_000_000_000, suffix: "BT" },
  { size: 1_000_000, suffix: "MT" },
  { size: 1_000, suffix: "KT" },
] as const;

/** A number of tokens as the card shows it: short, and with the full number when the short text is rounded. */
export type TokenCountText = {
  /** The short text: "84", "20.61 KT", "3.10 MT", "1.23 BT". */
  text: string;
  /** The full number with the separators of the language and the word "tokens" ("3,103,109 tokens"), for the title of the question mark, or null for a number under one thousand. */
  full: string | null;
};

/** What the information card of the dates line shows about the tokens of a chat, written as texts. */
export type ChatUsageRows = {
  /** Every input token that was sent. */
  inputTokens: TokenCountText;
  /** The input tokens that the provider read from its cache, or null when there was none. */
  cachedInputTokens: TokenCountText | null;
  /** The output tokens. */
  outputTokens: TokenCountText;
  /** The estimated cost in money, or null when a model of the chat has no known price. */
  cost: string | null;
};

/**
 * A number of tokens, short: a number under one thousand stays as it is, and a bigger number has two digits after the
 * decimal point and the unit KT (thousand), MT (million), BT (billion), or TT (trillion). A number that rounds up to
 * 1000 of a unit moves to the next unit: 999,999 is "1.00 MT".
 * @param count - the number of tokens
 * @returns the short text, and the full number with the separators of the language in use and the word "tokens"
 * ("3,103,109 tokens"), or null for a number under one thousand
 */
export function tokenCountText(count: number): TokenCountText {
  const number = count.toLocaleString(locale.value);
  const index = TOKEN_UNITS.findIndex((unit) => count >= unit.size);
  if (index === -1) {
    return { text: number, full: null };
  }
  const round = (unit: (typeof TOKEN_UNITS)[number]) => Math.round((count / unit.size) * 100) / 100;
  const unit = round(TOKEN_UNITS[index]) >= 1_000 && index > 0 ? TOKEN_UNITS[index - 1] : TOKEN_UNITS[index];
  const digits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return {
    text: `${round(unit).toLocaleString(locale.value, digits)} ${unit.suffix}`,
    full: t("chatsPanel.tokenCountFull", { value: number }),
  };
}

/**
 * A cost in US dollars with the format of the language in use: "$12.34".
 * @param dollars - the cost in US dollars
 * @returns the text, or "Less than $0.01" for a cost under one cent
 */
export function costText(dollars: number): string {
  const format = (value: number) => value.toLocaleString(locale.value, { style: "currency", currency: "USD" });
  return dollars < SMALLEST_COST ? t("chatsPanel.costLessThanCent", { value: format(SMALLEST_COST) }) : format(dollars);
}

/**
 * What the information card of the dates line shows about the tokens of a chat.
 * @param usage - the tokens and the cost of the chat, or null or undefined when the chat used no token
 * @returns the rows of the card, or null when the chat used no token
 */
export function chatUsageRows(usage: ChatUsage | null | undefined): ChatUsageRows | null {
  if (usage === null || usage === undefined) {
    return null;
  }
  return {
    inputTokens: tokenCountText(usage.input_tokens),
    cachedInputTokens: usage.cached_input_tokens > 0 ? tokenCountText(usage.cached_input_tokens) : null,
    outputTokens: tokenCountText(usage.output_tokens),
    cost: usage.cost_usd === null ? null : costText(usage.cost_usd),
  };
}
