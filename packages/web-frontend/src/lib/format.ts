import type { AgentInfo, AgentStatus, CodexUsage, LimitWindow, PaneInfo, QuotaBlock } from "./types";
import { locale, t } from "../i18n/index";

/** The text of an agent status, in the language in use. */
export function statusLabel(status: AgentStatus): string {
  return t(`format.status.${status}`);
}

export function paneName(p: PaneInfo | AgentInfo): string {
  const name = (p as AgentInfo).name;
  return (
    p.label ||
    name ||
    p.display_agent ||
    (p.agent ? p.agent : "") ||
    p.terminal_title_stripped ||
    "shell"
  );
}

export function isAgent(p: PaneInfo): boolean {
  return !!p.agent;
}

export function shortPath(path?: string | null): string {
  if (!path) return "";
  return path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
}

export function clockTime(epochSeconds?: number | null): string {
  if (!epochSeconds) return "";
  const d = new Date(epochSeconds * 1000);
  const now = new Date();
  const time = d.toLocaleTimeString(locale.value, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const day = d.toLocaleDateString(locale.value, { weekday: "short" });
  return `${day} ${time}`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return t("format.justNow");
  const m = Math.round(s / 60);
  if (m < 60) return t("format.minutesAgo", { minutes: m });
  return t("format.hoursAgo", { hours: Math.round(m / 60) });
}

export function compactTokens(n?: number | null): string {
  if (n == null) return "";
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/** Colour level of a gauge: calm, watch, critical. */
export function gaugeLevel(percent: number): "ok" | "warn" | "crit" {
  if (percent > 80) return "crit";
  if (percent >= 60) return "warn";
  return "ok";
}

/** "Claude", "Codex"… : the kind of agent, whatever the pane is called. */
export function agentKind(p: Pick<PaneInfo, "agent" | "display_agent">): string {
  const a = (p.agent ?? "").toLowerCase();
  if (a.includes("claude")) return "Claude";
  if (a.includes("codex")) return "Codex";
  return p.display_agent || p.agent || "Terminal";
}

/** 45 s → "< 1 min", 7 min, 1 h 05 */
export function duration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

const WEEK_WINDOW_MINUTES = 10080;

/**
 * The quota windows of Codex, named by their length and not by their position: since Sept 2026 some plans
 * report only the weekly window, and Codex then puts it in `primary`.
 * A window without a length keeps the old meaning of its position (`primary` is the session, `secondary` is the week).
 * A window whose reset time has passed is back to 0 %, until Codex reports again.
 */
export function codexWindows(codex: Pick<CodexUsage, "primary" | "secondary">, nowSeconds: number): QuotaBlock["windows"] {
  const windows: QuotaBlock["windows"] = [];
  const add = (window: LimitWindow | null | undefined, fallbackId: "session" | "week") => {
    if (window == null) return;
    const minutes = window.window_minutes ?? null;
    const id = minutes === null ? fallbackId : minutes >= WEEK_WINDOW_MINUTES ? "week" : "session";
    if (windows.some((w) => w.id === id)) return;
    const resetsAt = window.resets_at ?? undefined;
    const percent = resetsAt !== undefined && resetsAt < nowSeconds ? 0 : window.used_percent;
    windows.push({ id, name: t(id === "week" ? "sessionStore.window.week" : "sessionStore.window.session"), percent, resetsAt });
  };
  add(codex.primary, "session");
  add(codex.secondary, "week");
  return windows.sort((a, b) => (a.id === b.id ? 0 : a.id === "session" ? -1 : 1));
}
