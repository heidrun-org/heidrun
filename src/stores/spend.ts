// Claude spend by workspace. The status line reports each session's running cost
// (hd_cost); the increases are recorded with the pane's workspace, so the day and
// the current 5 h window can be split by project.
import { computed, reactive, ref, watch } from "vue";
import { allPanes, paneTarget, quotas, state, workspaceLabel } from "./session";

interface Entry {
  at: number; // ms
  ws: string; // workspace id
  wsLabel: string;
  who: string; // "onglet · agent"
  pane?: string;
  cost: number; // USD spent since the previous reading
}
interface Seen {
  sid: string;
  cost: number;
}

const KEY = "herdr-desk.spend";
const KEEP_MS = 8 * 24 * 3600_000;

function load(): Entry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && Array.isArray(v.entries)) return v.entries;
  } catch {
    /* ignore */
  }
  return [];
}

export const spend = reactive({ entries: load() });
// Last cost seen per pane, for this run only: what was spent while the app was
// closed cannot be dated, so it is not counted (it would inflate the current window).
const seen: Record<string, Seen> = {};

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ entries: spend.entries }));
  } catch {
    /* a convenience */
  }
}

/** Moves once a minute: "today" and a rolling 5 h window follow the clock. */
const tick = ref(Date.now());
setInterval(() => (tick.value = Date.now()), 60_000);

const num = (v?: string) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

// Panes there when the app started: a cost seen for the first time may be old
// (a resumed session), so it only sets the baseline. A pane created afterwards
// spends from 0.
let startPanes: Set<string> | null = null;

watch(
  () => state.snapshot,
  (snap) => {
    if (!snap) return;
    if (!startPanes) startPanes = new Set(snap.panes.map((p) => p.pane_id));
    const now = Date.now();
    let changed = false;
    for (const p of allPanes.value) {
      const cost = num(p.tokens?.hd_cost);
      const sid = p.tokens?.hd_sid ?? "";
      if (cost == null) continue;
      const prev = seen[p.pane_id];
      let delta = 0;
      if (prev) {
        // Same process: the cost only grows. Lower: a new session started from 0.
        delta = cost >= prev.cost ? cost - prev.cost : cost;
        // A different session reported at the same total: nothing new.
        if (prev.sid !== sid && cost === prev.cost) delta = 0;
      } else if (!startPanes.has(p.pane_id)) delta = cost;
      if (!prev || prev.cost !== cost || prev.sid !== sid) {
        seen[p.pane_id] = { sid, cost };
      }
      if (delta > 0.00001) {
        spend.entries.push({ at: now, ws: p.workspace_id, wsLabel: workspaceLabel(p.workspace_id), who: paneTarget(p), pane: p.pane_id, cost: delta });
        changed = true;
      }
    }
    // Old entries and closed panes go.
    const alive = new Set(snap.panes.map((p) => p.pane_id));
    for (const id of Object.keys(seen)) if (!alive.has(id)) delete seen[id];
    // Pruned only when the oldest entry has expired: no needless recomputation.
    if (spend.entries.length && now - spend.entries[0].at >= KEEP_MS) {
      spend.entries = spend.entries.filter((e) => now - e.at < KEEP_MS);
      changed = true;
    }
    if (changed) save();
  },
);

function startOfDay(): number {
  const d = new Date(tick.value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface SpendRow {
  ws: string;
  label: string;
  cost: number;
  share: number; // 0..1
  /** Estimated part of the 5 h quota, in points of percent. */
  quota?: number;
  agents: { who: string; cost: number }[];
}

function rows(from: number, quotaPercent?: number): { total: number; rows: SpendRow[] } {
  const byWs = new Map<string, { label: string; cost: number; agents: Map<string, number> }>();
  for (const e of spend.entries) {
    if (e.at < from) continue;
    const r = byWs.get(e.ws) ?? { label: e.wsLabel, cost: 0, agents: new Map() };
    r.cost += e.cost;
    r.agents.set(e.who, (r.agents.get(e.who) ?? 0) + e.cost);
    byWs.set(e.ws, r);
  }
  const total = [...byWs.values()].reduce((s, r) => s + r.cost, 0);
  const list = [...byWs.entries()]
    .map(([ws, r]) => ({
      ws,
      // The current name when the workspace still exists.
      label: (state.snapshot?.workspaces.some((w) => w.workspace_id === ws) ? workspaceLabel(ws) : r.label) || r.label,
      cost: r.cost,
      share: total ? r.cost / total : 0,
      quota: quotaPercent != null && total ? (r.cost / total) * quotaPercent : undefined,
      agents: [...r.agents.entries()].map(([who, cost]) => ({ who, cost })).sort((a, b) => b.cost - a.cost),
    }))
    .sort((a, b) => b.cost - a.cost);
  return { total, rows: list };
}

const fiveHour = computed(() => quotas.value.find((q) => q.provider === "claude")?.windows.find((w) => w.name === "Session 5 h"));

/** Start of the current 5 h window (from its reset time), or the last 5 h. */
const windowStart = computed(() => {
  const reset = fiveHour.value?.resetsAt;
  const now = tick.value;
  if (reset && reset * 1000 > now) return reset * 1000 - 5 * 3600_000;
  return now - 5 * 3600_000;
});

/** Spent by one pane between two times (for the history of a run). */
export function paneSpend(paneId: string, from: number, to: number): number {
  return spend.entries.filter((e) => e.pane === paneId && e.at >= from && e.at <= to).reduce((s, e) => s + e.cost, 0);
}

export const spendToday = computed(() => rows(startOfDay()));
export const spendWindow = computed(() => rows(windowStart.value, fiveHour.value?.percent));

/** Cost per 15 min slot of the 5 h window, by workspace (for the small chart). */
export const spendSlots = computed(() => {
  const from = windowStart.value;
  const slots = Array.from({ length: 20 }, () => new Map<string, number>());
  for (const e of spend.entries) {
    const i = Math.floor((e.at - from) / (15 * 60_000));
    if (i < 0 || i >= 20) continue;
    slots[i].set(e.ws, (slots[i].get(e.ws) ?? 0) + e.cost);
  }
  return { from, slots };
});
