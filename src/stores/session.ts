import { computed, reactive } from "vue";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import * as api from "../lib/api";
import { notify } from "../lib/notify";
import { settings } from "./settings";
import { paneName } from "../lib/format";
import type {
  AgentInfo,
  AgentStatus,
  CodexUsage,
  ContextUsage,
  PaneInfo,
  QuotaBlock,
  SessionSnapshot,
} from "../lib/types";

export interface ActivityEntry {
  at: number;
  status: AgentStatus;
}

export interface OutputWatch {
  id: number;
  paneId: string;
  regex: string;
}

export const state = reactive({
  snapshot: null as SessionSnapshot | null,
  connected: false,
  error: "",
  selectedWorkspaceId: null as string | null,
  selectedTabId: null as string | null,
  selectedPaneId: null as string | null,
  codex: null as CodexUsage | null,
  paletteOpen: false,
  /** Panes that just turned blocked: they pulse once. */
  pulse: {} as Record<string, number>,
  activity: {} as Record<string, ActivityEntry[]>,
  /** When each pane entered its current status (local clock). */
  since: {} as Record<string, number>,
  watches: [] as OutputWatch[],
  /** "À traiter" cards closed by the user, until the pane changes state again. */
  dismissed: {} as Record<string, string>,
  /** What is being renamed in place: "ws:<id>", "tab:<id>" or "pane:<id>". */
  renaming: null as string | null,
  toast: "" as string,
});

// ---- Derived views --------------------------------------------------------

export const workspaces = computed(() =>
  [...(state.snapshot?.workspaces ?? [])].sort((a, b) => a.number - b.number),
);

export const selectedWorkspace = computed(() =>
  workspaces.value.find((w) => w.workspace_id === state.selectedWorkspaceId) ?? null,
);

export const tabs = computed(() =>
  (state.snapshot?.tabs ?? [])
    .filter((t) => t.workspace_id === state.selectedWorkspaceId)
    .sort((a, b) => a.number - b.number),
);

export const agentsByPane = computed(() => {
  const map = new Map<string, AgentInfo>();
  for (const a of state.snapshot?.agents ?? []) map.set(a.pane_id, a);
  return map;
});

/** Pane enriched with its agent record when there is one. */
export function paneView(p: PaneInfo): AgentInfo {
  return { ...p, ...(agentsByPane.value.get(p.pane_id) ?? {}) };
}

export const allPanes = computed(() => (state.snapshot?.panes ?? []).map(paneView));

export const workspacePanes = computed(() =>
  allPanes.value.filter((p) => p.workspace_id === state.selectedWorkspaceId),
);

export const tabLayout = computed(() =>
  (state.snapshot?.layouts ?? []).find((l) => l.tab_id === state.selectedTabId) ?? null,
);

export const tabPanes = computed(() => allPanes.value.filter((p) => p.tab_id === state.selectedTabId));

export const selectedPane = computed(() => allPanes.value.find((p) => p.pane_id === state.selectedPaneId) ?? null);

/** Agents waiting on the user, blocked first, then most recent first. */
export function attentionKey(p: AgentInfo): string {
  return `${p.agent_status}:${p.state_change_seq ?? 0}`;
}

export function dismiss(p: AgentInfo) {
  state.dismissed[p.pane_id] = attentionKey(p);
}

export const attention = computed(() =>
  allPanes.value
    .filter((p) => p.agent && (p.agent_status === "blocked" || p.agent_status === "done"))
    .filter((p) => state.dismissed[p.pane_id] !== attentionKey(p))
    .sort((a, b) => {
      if (a.agent_status !== b.agent_status) return a.agent_status === "blocked" ? -1 : 1;
      return (b.state_change_seq ?? 0) - (a.state_change_seq ?? 0);
    }),
);

export const counts = computed(() => {
  const c = { blocked: 0, working: 0, done: 0 };
  for (const p of allPanes.value) {
    if (!p.agent) continue;
    if (p.agent_status === "blocked") c.blocked++;
    else if (p.agent_status === "working") c.working++;
    else if (p.agent_status === "done") c.done++;
  }
  return c;
});

export function tabLabel(id: string): string {
  const t = state.snapshot?.tabs.find((x) => x.tab_id === id);
  return t ? t.label || `onglet ${t.number}` : "";
}

export function workspaceLabel(id: string): string {
  return workspaces.value.find((w) => w.workspace_id === id)?.label ?? id;
}

// ---- Context and quotas ---------------------------------------------------

const num = (v?: string) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export function contextFor(p: AgentInfo): ContextUsage | null {
  const t = p.tokens ?? {};
  const claude = num(t.hd_ctx);
  if (claude != null) {
    const size = num(t.hd_ctx_size);
    return { percent: claude, size, used: size ? Math.round((claude / 100) * size) : undefined };
  }
  const sid = p.agent_session?.value;
  const codex = sid ? state.codex?.sessions?.[sid] : undefined;
  if (codex?.context_used != null && codex.context_window) {
    return {
      percent: Math.min(100, (codex.context_used / codex.context_window) * 100),
      used: codex.context_used,
      size: codex.context_window,
    };
  }
  return null;
}

export const quotas = computed<QuotaBlock[]>(() => {
  const blocks: QuotaBlock[] = [];

  // Claude: the status line script reports the account limits as tokens on its pane.
  const reporters = allPanes.value
    .filter((p) => p.tokens?.hd_q5h != null || p.tokens?.hd_q7d != null)
    .sort((a, b) => (num(b.tokens?.hd_ts) ?? 0) - (num(a.tokens?.hd_ts) ?? 0));
  const latest = reporters[0];
  if (latest?.tokens) {
    const t = latest.tokens;
    const windows: QuotaBlock["windows"] = [];
    if (num(t.hd_q5h) != null) windows.push({ name: "Session 5 h", percent: num(t.hd_q5h)!, resetsAt: num(t.hd_q5h_reset) });
    if (num(t.hd_q7d) != null) windows.push({ name: "Semaine", percent: num(t.hd_q7d)!, resetsAt: num(t.hd_q7d_reset) });
    const cost = allPanes.value.reduce((sum, p) => sum + (num(p.tokens?.hd_cost) ?? 0), 0);
    blocks.push({ label: "Claude", windows, cost: cost || undefined, updatedAt: num(t.hd_ts) });
  }

  const c = state.codex;
  if (c?.primary || c?.secondary) {
    const windows: QuotaBlock["windows"] = [];
    if (c.primary) windows.push({ name: "Session 5 h", percent: c.primary.used_percent, resetsAt: c.primary.resets_at ?? undefined });
    if (c.secondary) windows.push({ name: "Semaine", percent: c.secondary.used_percent, resetsAt: c.secondary.resets_at ?? undefined });
    blocks.push({ label: c.plan ? `Codex · ${c.plan}` : "Codex", windows, updatedAt: c.updated_at ?? undefined });
  }
  return blocks;
});

// ---- Snapshot refresh -----------------------------------------------------

let refreshTimer: number | undefined;
let inflight = false;
let again = false;
let lastPaneKey = "";

export function scheduleRefresh(delay = 60) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refresh, delay);
}

export async function refresh() {
  if (inflight) {
    again = true;
    return;
  }
  inflight = true;
  try {
    do {
      again = false;
      const snap = await api.snapshot();
      applySnapshot(snap);
      state.connected = true;
      state.error = "";
    } while (again);
  } catch (e) {
    state.connected = false;
    state.error = String(e);
  } finally {
    inflight = false;
  }
}

function applySnapshot(snap: SessionSnapshot) {
  const previous = new Map((state.snapshot?.panes ?? []).map((p) => [p.pane_id, p.agent_status]));
  const agents = new Map(snap.agents.map((a) => [a.pane_id, a]));
  const now = Date.now();

  for (const pane of snap.panes) {
    const before = previous.get(pane.pane_id);
    const after = pane.agent_status;
    if (before === after) continue;
    state.since[pane.pane_id] = now;
    if (!pane.agent) continue;
    const log = (state.activity[pane.pane_id] ??= []);
    log.unshift({ at: now, status: after });
    log.splice(12);
    if (before === undefined) continue; // first sight, not a transition
    const view = { ...pane, ...(agents.get(pane.pane_id) ?? {}) };
    const ws = snap.workspaces.find((w) => w.workspace_id === pane.workspace_id)?.label ?? "";
    if (after === "blocked") {
      state.pulse[pane.pane_id] = now;
      window.setTimeout(() => delete state.pulse[pane.pane_id], 1400);
      if (!document.hasFocus() || state.selectedPaneId !== pane.pane_id) {
        notify(`${paneName(view)} attend une décision`, ws);
      }
    } else if (after === "done" && before === "working") {
      if (!document.hasFocus() || state.selectedPaneId !== pane.pane_id) {
        notify(`${paneName(view)} a terminé`, ws);
      }
    }
  }

  state.snapshot = snap;
  fixSelection(snap);

  const ids = snap.panes.filter((p) => p.agent).map((p) => p.pane_id).sort();
  const key = ids.join(",");
  // Re-sent every time: Rust ignores identical sets while their subscription is alive.
  api.watchPanes(ids).catch(() => {});
  if (key !== lastPaneKey) {
    lastPaneKey = key;
    refreshCodex();
  }
}

function fixSelection(snap: SessionSnapshot) {
  const ws = snap.workspaces;
  if (!ws.some((w) => w.workspace_id === state.selectedWorkspaceId)) {
    state.selectedWorkspaceId = snap.focused_workspace_id ?? ws[0]?.workspace_id ?? null;
  }
  const wsInfo = ws.find((w) => w.workspace_id === state.selectedWorkspaceId);
  const wsTabs = snap.tabs.filter((t) => t.workspace_id === state.selectedWorkspaceId);
  if (!wsTabs.some((t) => t.tab_id === state.selectedTabId)) {
    state.selectedTabId = wsInfo?.active_tab_id ?? wsTabs[0]?.tab_id ?? null;
  }
  const panes = snap.panes.filter((p) => p.tab_id === state.selectedTabId);
  if (!panes.some((p) => p.pane_id === state.selectedPaneId)) {
    const layout = snap.layouts.find((l) => l.tab_id === state.selectedTabId);
    state.selectedPaneId = layout?.focused_pane_id ?? panes[0]?.pane_id ?? null;
  }
}

// ---- Codex usage polling --------------------------------------------------

export async function refreshCodex() {
  try {
    const ids = (state.snapshot?.panes ?? [])
      .filter((p) => p.agent === "codex" || p.agent_session?.agent === "codex")
      .map((p) => p.agent_session?.value ?? "")
      .filter(Boolean);
    state.codex = await api.codexUsage(ids);
  } catch {
    /* ignore */
  }
}

// ---- Selection ------------------------------------------------------------

export function selectWorkspace(id: string) {
  state.selectedWorkspaceId = id;
  state.selectedTabId = null;
  state.selectedPaneId = null;
  if (state.snapshot) fixSelection(state.snapshot);
}

export function selectTab(id: string) {
  state.selectedTabId = id;
  state.selectedPaneId = null;
  if (state.snapshot) fixSelection(state.snapshot);
}

export function selectPane(p: PaneInfo) {
  state.selectedWorkspaceId = p.workspace_id;
  state.selectedTabId = p.tab_id;
  state.selectedPaneId = p.pane_id;
}

// ---- Actions --------------------------------------------------------------

export function toast(message: string) {
  state.toast = message;
  window.setTimeout(() => {
    if (state.toast === message) state.toast = "";
  }, 4000);
}

async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    scheduleRefresh();
    return r;
  } catch (e) {
    toast(humanError(String(e)));
    return undefined;
  }
}

function humanError(e: string): string {
  if (e.includes("agent_blocked")) return "L’agent attend une décision : réponds-lui d’abord.";
  if (e.includes("herdr_unreachable")) return "Herdr ne répond pas. Lance « herdr » dans un terminal.";
  return e;
}

export function newTerminal() {
  const ws = selectedWorkspace.value;
  if (!ws) return;
  const cwd = selectedPane.value?.cwd ?? null;
  return guard(async () => {
    const pane = await api.newTab(ws.workspace_id, cwd);
    await refresh();
    if (pane) selectPane(pane);
  });
}

export function splitPane(direction: "right" | "down" = "right", paneId?: string) {
  const p = paneId ? allPanes.value.find((x) => x.pane_id === paneId) : selectedPane.value;
  if (!p) return newTerminal();
  return guard(async () => {
    const pane = await api.split(p.pane_id, direction, p.cwd);
    await refresh();
    if (pane) selectPane(pane);
  });
}

export async function newWorkspace(cwd: string | null, label: string | null) {
  // The raw socket API wants absolute paths.
  if (cwd?.startsWith("~")) {
    const home = (await homeDir()).replace(/\/$/, "");
    cwd = home + cwd.slice(1);
  }
  return guard(() => api.newWorkspace(cwd, label));
}

export function closePane(paneId: string) {
  return guard(() => api.closePane(paneId));
}

export function startRename(kind: "ws" | "tab" | "pane", id: string) {
  if (kind === "ws") selectWorkspace(id);
  if (kind === "tab") selectTab(id);
  state.renaming = `${kind}:${id}`;
  if (kind === "ws") settings.leftOpen = true;
}

export async function finishRename(kind: "ws" | "tab" | "pane", id: string, label: string | null) {
  state.renaming = null;
  if (label === null && kind !== "pane") return;
  if (kind === "ws") await guard(() => api.renameWorkspace(id, label!));
  else if (kind === "tab") await guard(() => api.renameTab(id, label!));
  else await guard(() => api.renamePane(id, label));
}

export function closeTab(tabId: string) {
  return guard(() => api.closeTab(tabId));
}

export function sendPrompt(paneId: string, text: string) {
  return guard(() => api.prompt(paneId, text));
}

export function sendKeys(paneId: string, keys: string[]) {
  return guard(() => api.sendKeys(paneId, keys));
}

export function runInPane(paneId: string, command: string) {
  rememberCommand(command);
  return guard(() => api.run(paneId, command));
}

export async function runInNewPane(command: string, watch?: string) {
  rememberCommand(command);
  const base = selectedPane.value;
  const ws = selectedWorkspace.value;
  if (!ws) return;
  const pane = await guard(async () =>
    base ? api.split(base.pane_id, "right", base.cwd) : api.newTab(ws.workspace_id, null),
  );
  if (!pane) return;
  // Give the new shell a moment to print its prompt before typing into it.
  await new Promise((r) => setTimeout(r, 350));
  await guard(() => api.run(pane.pane_id, command));
  await refresh();
  selectPane(pane);
  if (watch) addWatch(pane.pane_id, watch);
}

let watchSeq = 1;
export function addWatch(paneId: string, regex: string) {
  const w: OutputWatch = { id: watchSeq++, paneId, regex };
  state.watches.push(w);
  api
    .waitForOutput(paneId, regex)
    .then((line) => {
      const pane = allPanes.value.find((p) => p.pane_id === paneId);
      notify(`${pane ? paneName(pane) : paneId} : motif trouvé`, line ?? regex);
    })
    .catch(() => {})
    .finally(() => {
      state.watches = state.watches.filter((x) => x.id !== w.id);
    });
}

/** Sends the end of a terminal to an agent and asks it to fix the failure. */
export async function askAgentToFix(sourcePaneId: string, agentPaneId: string) {
  const text = await guard(() => api.read(sourcePaneId, 80));
  if (text == null) return;
  const source = allPanes.value.find((p) => p.pane_id === sourcePaneId);
  const message =
    `La commande dans le terminal « ${source ? paneName(source) : sourcePaneId} » a échoué. ` +
    `Voici la fin de sa sortie. Trouve la cause et corrige-la.\n\n\`\`\`\n${text.trim()}\n\`\`\``;
  await sendPrompt(agentPaneId, message);
  const agent = allPanes.value.find((p) => p.pane_id === agentPaneId);
  if (agent) toast(`Sortie envoyée à ${paneName(agent)}`);
}

// ---- Recent commands (local convenience only) ----------------------------

const RECENT_KEY = "herdr-desk.recent";

export function recentCommands(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function rememberCommand(cmd: string) {
  try {
    const list = [cmd, ...recentCommands().filter((c) => c !== cmd)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// ---- Boot -----------------------------------------------------------------

export async function start() {
  await listen("herdr://event", () => scheduleRefresh());
  await listen("herdr://connected", () => refresh());
  await listen("herdr://resync", () => scheduleRefresh(150));
  await listen<string>("herdr://disconnected", (e) => {
    state.connected = false;
    state.error = e.payload;
  });
  await refresh();
  // Safety net: events invalidate the cache, a slow poll catches anything missed.
  window.setInterval(() => scheduleRefresh(0), 5000);
  window.setInterval(refreshCodex, 10_000);
}
