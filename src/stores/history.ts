// Agents' work history, kept on this Mac (~/.config/herdr-desk/history.jsonl):
// every finished run with its workspace, agent, branch, active time and cost.
import { computed, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { allPanes, lastPrompt, onRunEnd, state, type ActivityEntry } from "./session";
import { paneSpend } from "./spend";
import type { GitStatus } from "./git";

export interface HistoryRun {
  id: string;
  start: number;
  end: number;
  /** Working time, without the waits for a decision. */
  activeMs: number;
  blockedMs: number;
  /** Already running when the app saw it: the real start is earlier. */
  startUnknown: boolean;
  ws: string;
  wsId?: string;
  tab: string;
  agent: string;
  kind: string;
  paneId: string;
  branch?: string | null;
  cost?: number;
  summary: string;
  closed: boolean;
  /** 2: cost measured per session (older lines may hold an inflated cost). */
  v?: number;
  /** Still running (shown live, not stored yet). */
  live?: boolean;
}

export const history = reactive({
  open: false,
  loaded: false,
  runs: [] as HistoryRun[],
  /** Finished, waiting the few seconds before being written (cost, branch). */
  pending: [] as HistoryRun[],
});

export async function loadHistory() {
  try {
    // Re-read from the file: what is shown is what is stored.
    const list = await invoke<HistoryRun[]>("history_read", { since: 0 });
    history.runs = list
      .filter((r) => r && typeof r.end === "number")
      // Recorded before the cost fix: the time is right, the cost is not.
      .map((r) => (r.v === 2 ? r : { ...r, cost: undefined }))
      .sort((a, b) => b.end - a.end);
  } catch {
    /* no history yet */
  }
  history.loaded = true;
}

// Cost reports arrive with the status line, a little after the run ends.
const COST_DELAY = 15_000;

onRunEnd((r: ActivityEntry) => {
  if (r.end == null) return;
  const end = r.end;
  const blockedMs = r.blockedMs ?? 0;
  const activeMs = Math.max(0, end - r.start - blockedMs);
  if (activeMs < 1000) return;
  const pane = allPanes.value.find((p) => p.pane_id === r.paneId);
  // Captured while the run was open: a closed pane has no folder any more.
  const cwd = r.cwd || pane?.foreground_cwd || pane?.cwd || null;
  // The consigne that started this run (sent just before it), not an older one.
  const lp = lastPrompt[r.paneId];
  const summary = (lp && lp.at >= r.start - 120_000 && lp.at <= end ? lp.text : "") || pane?.terminal_title_stripped || "";
  const base = {
    id: `${r.paneId}-${r.start}`,
    start: r.start,
    end,
    activeMs,
    blockedMs,
    startUnknown: r.startUnknown,
    ws: r.workspace,
    wsId: r.workspaceId,
    tab: r.tab,
    agent: r.name,
    kind: r.kind,
    paneId: r.paneId,
    summary,
    closed: r.status === "closed",
  };
  // Shown right away: no gap between "en cours" and the recorded line.
  history.pending.unshift({ ...base, cost: paneSpend(r.paneId, r.start, end) || undefined, v: 2 });
  window.setTimeout(async () => {
    const branch = cwd ? (await invoke<GitStatus | null>("git_status", { cwd }).catch(() => null))?.branch ?? null : null;
    // Up to the next run of the same pane, so that cost is never counted twice.
    const next = state.activity.filter((x) => x.paneId === r.paneId && x.start > end).map((x) => x.start);
    const to = Math.min(end + COST_DELAY, ...next);
    const cost = paneSpend(r.paneId, r.start, to);
    const run: HistoryRun = { ...base, branch, cost: cost || undefined, v: 2 };
    await invoke("history_append", { entry: run }).catch(() => {});
    history.pending = history.pending.filter((x) => x.id !== run.id);
    if (history.loaded && !history.runs.some((x) => x.id === run.id)) {
      // Recorded 15 s late, possibly out of order: keep most recent first.
      const i = history.runs.findIndex((x) => x.end < run.end);
      history.runs.splice(i === -1 ? history.runs.length : i, 0, run);
    }
  }, COST_DELAY);
});

function startOfDay(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Moves every 15 s: runs in progress grow, and "today" changes at midnight. */
const tick = ref(Date.now());
setInterval(() => (tick.value = Date.now()), 15_000);

/** Runs still going (working or waiting for a decision), counted up to now. */
export const liveRuns = computed<HistoryRun[]>(() => {
  const now = tick.value;
  return state.activity
    .filter((r) => r.end === null)
    .map((r) => {
      const blocked = (r.blockedMs ?? 0) + (r.blockedAt ? now - r.blockedAt : 0);
      return {
        id: `${r.paneId}-${r.start}`,
        start: r.start,
        end: now,
        activeMs: Math.max(0, now - r.start - blocked),
        blockedMs: blocked,
        startUnknown: r.startUnknown,
        ws: r.workspace,
        wsId: r.workspaceId,
        tab: r.tab,
        agent: r.name,
        kind: r.kind,
        paneId: r.paneId,
        summary: lastPrompt[r.paneId] && lastPrompt[r.paneId].at >= r.start - 120_000 ? lastPrompt[r.paneId].text : "",
        cost: paneSpend(r.paneId, r.start, now) || undefined,
        closed: false,
        live: true,
      };
    });
});

/** Finished and running, most recent first: what the window and the summary show. */
export const allRuns = computed(() => {
  const seen = new Set<string>();
  const out: HistoryRun[] = [];
  for (const r of [...liveRuns.value, ...history.pending, ...history.runs]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
});

/** Today, for the one-line summary of the right panel. */
export const todaySummary = computed(() => {
  const from = startOfDay(tick.value);
  const byWs = new Map<string, number>();
  let total = 0;
  for (const r of allRuns.value) {
    if (r.end < from) continue;
    total += r.activeMs;
    byWs.set(r.ws, (byWs.get(r.ws) ?? 0) + r.activeMs);
  }
  return { total, top: [...byWs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) };
});

export function hm(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

const csvCell = (v: string | number) => {
  let s = String(v);
  // "- fix tests", "=1+1": Excel would read a formula.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolons: what Excel expects with a French locale. */
export function toCsv(runs: HistoryRun[]): string {
  const d2 = (n: number) => String(n).padStart(2, "0");
  const date = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
  };
  const time = (t: number) => {
    const d = new Date(t);
    return `${d2(d.getHours())}:${d2(d.getMinutes())}`;
  };
  const head = ["Date", "Début", "Fin", "Durée active (min)", "Attente décision (min)", "Workspace", "Onglet", "Agent", "Type", "Branche", "Coût (USD)", "Résumé"];
  const rows = runs.map((r) => [
    date(r.start),
    (r.startUnknown ? "≤ " : "") + time(r.start),
    time(r.end),
    (r.activeMs / 60_000).toFixed(1).replace(".", ","),
    (r.blockedMs / 60_000).toFixed(1).replace(".", ","),
    r.ws,
    r.tab,
    r.agent,
    r.kind,
    r.branch ?? "",
    r.cost != null ? r.cost.toFixed(2).replace(".", ",") : "",
    r.summary,
  ]);
  return [head, ...rows].map((l) => l.map(csvCell).join(";")).join("\n") + "\n";
}

/** Local midnight `days` days before today (DST-safe). */
export function daysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export { startOfDay };
