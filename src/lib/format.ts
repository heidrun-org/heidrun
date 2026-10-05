import type { AgentInfo, AgentStatus, PaneInfo } from "./types";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: "en cours",
  blocked: "bloqué",
  done: "terminé",
  idle: "inactif",
  unknown: "inconnu",
};

export function paneName(p: PaneInfo | AgentInfo): string {
  const name = (p as AgentInfo).name;
  return (
    name ||
    p.display_agent ||
    p.label ||
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
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const day = d.toLocaleDateString("fr-FR", { weekday: "short" });
  return `${day} ${time}`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "à l’instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.round(m / 60)} h`;
}

export function compactTokens(n?: number | null): string {
  if (n == null) return "";
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/** Colour level of a gauge: calm, watch, critical. */
export function gaugeLevel(percent: number): "ok" | "warn" | "crit" {
  if (percent >= 90) return "crit";
  if (percent >= 70) return "warn";
  return "ok";
}
