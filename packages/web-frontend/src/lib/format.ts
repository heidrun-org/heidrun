import type { AgentInfo, AgentStatus, PaneInfo } from "./types";
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
