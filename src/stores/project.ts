import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { allPanes, refresh, selectPane, selectTab, state as session, toast, workspaces } from "./session";

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
  return p.detected.filter((d) => !taken.has(d.command));
});

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

/** Runs a detected command once, without saving it as an action. */
export function runDetected(workspaceId: string, d: Detected) {
  return runAction(workspaceId, { id: `detected-${d.command}`, label: d.label, command: d.command });
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
