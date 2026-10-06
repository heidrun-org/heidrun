import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { moveId } from "../lib/reorder";
import { allPanes, refresh, selectPane, selectTab, state as session, toast, workspaceLabel, workspaces } from "./session";
import { allowCommand } from "./guards";

export interface Action {
  id: string;
  label: string;
  command: string;
  /** Optional sub-folder, relative to the project root. */
  cwd?: string;
}

export interface Detected {
  label: string;
  command: string;
  source: string;
}

interface ProjectConfig {
  version: number;
  actions: Action[];
  [key: string]: unknown;
}

interface Project {
  root: string;
  config_path: string;
  config: ProjectConfig;
  detected: Detected[];
}

export type ActionStatus = "idle" | "running" | "finished";

export interface RecentRun {
  label: string;
  command: string;
  at: number;
}

// History and suggestion order are personal: kept on this Mac, not in the repo.
// Keyed by project root, so they follow the project rather than a workspace id.
const LOCAL_KEY = "herdr-desk.project-local";

interface LocalData {
  recent: Record<string, RecentRun[]>;
  suggestionOrder: Record<string, string[]>;
}

function loadLocal(): LocalData {
  try {
    return { recent: {}, suggestionOrder: {}, ...JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") };
  } catch {
    return { recent: {}, suggestionOrder: {} };
  }
}

export const local = reactive<LocalData>(loadLocal());

watch(
  () => local,
  (v) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

export const project = reactive({
  byWorkspace: {} as Record<string, Project | undefined>,
  errors: {} as Record<string, string | undefined>,
  /** `${workspaceId}:${actionId}` → pane running the action. */
  panes: {} as Record<string, string>,
  /** pane id → is a command in the foreground. */
  busy: {} as Record<string, boolean>,
});

/** Folder of a workspace: its worktree path, else the cwd of one of its panes. */
function workspaceCwd(workspaceId: string): string | null {
  const ws = workspaces.value.find((w) => w.workspace_id === workspaceId);
  if (ws?.worktree?.path) return ws.worktree.path;
  const pane = allPanes.value.find((p) => p.workspace_id === workspaceId && p.cwd);
  return pane?.cwd ?? null;
}

export async function loadProject(workspaceId: string) {
  const cwd = workspaceCwd(workspaceId);
  if (!cwd) return;
  try {
    const p = await invoke<Project>("project_load", { cwd });
    if (!Array.isArray(p.config.actions)) p.config.actions = [];
    project.byWorkspace[workspaceId] = p;
    project.errors[workspaceId] = undefined;
  } catch (e) {
    project.errors[workspaceId] = String(e);
  }
}

async function save(workspaceId: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  try {
    await invoke("project_save", { root: p.root, config: p.config });
  } catch (e) {
    toast(String(e));
  }
}

export const currentProject = computed(() =>
  session.selectedWorkspaceId ? project.byWorkspace[session.selectedWorkspaceId] : undefined,
);

export const suggestions = computed(() => {
  const p = currentProject.value;
  if (!p) return [];
  const taken = new Set(p.config.actions.map((a) => a.command));
  const order = local.suggestionOrder[p.root] ?? [];
  const rank = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // User order first, then detection order for anything new.
  return p.detected
    .filter((d) => !taken.has(d.command))
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d.command) - rank(b.d.command) || a.i - b.i)
    .map((x) => x.d);
});

export const recentRuns = computed(() => {
  const p = currentProject.value;
  return p ? local.recent[p.root] ?? [] : [];
});

function recordRun(workspaceId: string, label: string, command: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  const list = (local.recent[p.root] ?? []).filter((r) => r.command !== command);
  list.unshift({ label, command, at: Date.now() });
  local.recent[p.root] = list.slice(0, 8);
}

export function clearRecent(workspaceId: string) {
  const p = project.byWorkspace[workspaceId];
  if (p) delete local.recent[p.root];
}

/** Drag and drop in the saved actions: the order is written to .herdr-desk.json. */
export async function moveAction(workspaceId: string, id: string, at: number) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  const byId = new Map(p.config.actions.map((a) => [a.id, a]));
  p.config.actions = moveId(p.config.actions.map((a) => a.id), id, at).map((x) => byId.get(x)!);
  await save(workspaceId);
}

export function moveSuggestion(workspaceId: string, command: string, at: number) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  local.suggestionOrder[p.root] = moveId(suggestions.value.map((d) => d.command), command, at);
}

function slug(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "action";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function addAction(workspaceId: string, label: string, command: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p || !command.trim()) return;
  p.config.actions.push({ id: slug(label || command), label: (label || command).trim(), command: command.trim() });
  await save(workspaceId);
}

export async function removeAction(workspaceId: string, id: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  p.config.actions = p.config.actions.filter((a) => a.id !== id);
  delete project.panes[`${workspaceId}:${id}`];
  await save(workspaceId);
}

export async function renameAction(workspaceId: string, id: string, label: string) {
  const a = project.byWorkspace[workspaceId]?.config.actions.find((x) => x.id === id);
  if (!a) return;
  a.label = label;
  await save(workspaceId);
}

export function actionPane(workspaceId: string, action: Action) {
  const paneId = project.panes[`${workspaceId}:${action.id}`];
  return paneId ? allPanes.value.find((p) => p.pane_id === paneId) ?? null : null;
}

export function actionStatus(workspaceId: string, action: Action): ActionStatus {
  const pane = actionPane(workspaceId, action);
  if (!pane) return "idle";
  return project.busy[pane.pane_id] ? "running" : "finished";
}

/**
 * Runs an action in its own tab, named after it. If its tab is still open the
 * click just brings it to the front; "rerun" types the command again in it.
 */
export async function runAction(workspaceId: string, action: Action, rerun = false) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  const existing = actionPane(workspaceId, action);
  // A click that will type the command: through the guards first.
  const willType = !existing || (rerun && !project.busy[existing.pane_id]);
  if (willType && !(await allowCommand(action.command, p.root, `${workspaceLabel(workspaceId)} · ${action.label}`))) return;
  if (!existing || rerun) recordRun(workspaceId, action.label, action.command);
  if (existing) {
    selectTab(existing.tab_id);
    selectPane(existing);
    if (rerun && !project.busy[existing.pane_id]) {
      await api.run(existing.pane_id, action.command).catch((e) => toast(String(e)));
      project.busy[existing.pane_id] = true;
    }
    return;
  }
  const cwd = action.cwd ? `${p.root.replace(/\/$/, "")}/${action.cwd}` : p.root;
  try {
    const pane = await api.newTab(workspaceId, cwd, action.label);
    project.panes[`${workspaceId}:${action.id}`] = pane.pane_id;
    // Let the shell print its prompt before typing into it.
    await new Promise((r) => setTimeout(r, 350));
    await api.run(pane.pane_id, action.command);
    project.busy[pane.pane_id] = true;
    await refresh();
    const fresh = allPanes.value.find((x) => x.pane_id === pane.pane_id);
    if (fresh) selectPane(fresh);
  } catch (e) {
    toast(String(e));
  }
}

/** Runs a command once without saving it (suggestions, history); reuses a saved action if any. */
export function runDetected(workspaceId: string, d: { label: string; command: string }) {
  const saved = project.byWorkspace[workspaceId]?.config.actions.find((a) => a.command === d.command);
  return runAction(workspaceId, saved ?? { id: `once-${d.command}`, label: d.label, command: d.command });
}

export async function stopAction(workspaceId: string, action: Action) {
  const pane = actionPane(workspaceId, action);
  if (pane) await api.sendKeys(pane.pane_id, ["ctrl+c"]).catch(() => {});
}

// ---- Status polling -------------------------------------------------------
// A command is "running" while some process other than the shell owns the terminal.

async function pollBusy() {
  const live = new Set(allPanes.value.map((p) => p.pane_id));
  for (const [key, paneId] of Object.entries(project.panes)) {
    if (!live.has(paneId)) {
      delete project.panes[key];
      delete project.busy[paneId];
      continue;
    }
    try {
      const r = await api.request<{ process_info: { shell_pid?: number | null; foreground_processes?: { pid: number }[] } }>(
        "pane.process_info",
        { pane_id: paneId },
      );
      const info = r.process_info;
      project.busy[paneId] = (info.foreground_processes ?? []).some((proc) => proc.pid !== info.shell_pid);
    } catch {
      /* keep the last known state */
    }
  }
}

let started = false;
export function startProjects() {
  if (started) return;
  started = true;
  window.setInterval(pollBusy, 2500);
  // Load the project file of the workspace in view (actions, badge, palette).
  watch(
    () => [session.selectedWorkspaceId, !!session.snapshot] as const,
    ([id, ready]) => {
      if (id && ready && !project.byWorkspace[id]) loadProject(id);
    },
    { immediate: true },
  );
}
