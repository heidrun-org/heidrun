import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { allPanes, refresh, selectPane, selectTab, state as session, toast, workspaceLabel, workspaces } from "./session";
import { allowCommand } from "./guards";
import { t } from "../i18n/index";
import { parseProjectConfig, type Action, type ProjectConfig, type ScriptAgent } from "../lib/project_config";
import { scriptNameFromCommand } from "../lib/script_name";

export type { Action };

export interface Detected {
  label: string;
  command: string;
  source: string;
  /** What the project file says about the command, for example the body of a script of `package.json`. */
  description?: string;
}

interface Project {
  root: string;
  config_path: string;
  config: ProjectConfig;
  detected: Detected[];
}

export type ActionStatus = "idle" | "running" | "finished";

const CONFIG_PATH = ".heidrun/config.json";

export const project = reactive({
  byWorkspace: {} as Record<string, Project | undefined>,
  errors: {} as Record<string, string | undefined>,
  /** `${workspaceId}:${actionId}` → pane running the action. */
  panes: {} as Record<string, string>,
  /** pane id → is a command in the foreground. */
  busy: {} as Record<string, boolean>,
  /** Panes being restarted (ctrl+C then the command again). */
});

/** Folder of a workspace: its worktree path, else the cwd of one of its panes. */
export function workspaceCwd(workspaceId: string): string | null {
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
    p.config = parseProjectConfig(p.config);
    project.byWorkspace[workspaceId] = p;
    project.errors[workspaceId] = undefined;
  } catch (e) {
    project.errors[workspaceId] = t("projectStore.invalidConfig", { path: CONFIG_PATH, reason: String(e instanceof Error ? e.message : e) });
  }
}

export async function saveProject(workspaceId: string): Promise<boolean> {
  const p = project.byWorkspace[workspaceId];
  if (!p) return false;
  let config: ProjectConfig;
  try {
    config = parseProjectConfig(p.config);
  } catch (e) {
    toast(t("projectStore.invalidConfig", { path: CONFIG_PATH, reason: String(e instanceof Error ? e.message : e) }));
    return false;
  }
  try {
    await invoke("project_save", { root: p.root, config });
    return true;
  } catch (e) {
    toast(String(e));
    return false;
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

/**
 * Adds a custom script. Without a name, the name is the first 20 characters of the command. With `agent`, the script is of
 * the kind Coding agent: its command is the command line that starts the coding agent, and `cwd` is its folder.
 * `description` is optional text on several lines.
 */
export async function addAction(workspaceId: string, label: string, command: string, agent?: ScriptAgent, cwd?: string, description?: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p || !command.trim()) return;
  const name = label.trim() || scriptNameFromCommand(command);
  const action: Action = { id: slug(name), label: name, command: command.trim() };
  if (agent !== undefined) {
    action.agent = agent;
  }
  if (description !== undefined && description.trim() !== "") {
    action.description = description.trim();
  }
  if (cwd !== undefined && cwd.trim() !== "") {
    action.cwd = cwd.trim();
  }
  p.config.actions.push(action);
  await saveProject(workspaceId);
}

export async function removeAction(workspaceId: string, id: string) {
  const p = project.byWorkspace[workspaceId];
  if (!p) return;
  p.config.actions = p.config.actions.filter((a) => a.id !== id);
  delete project.panes[`${workspaceId}:${id}`];
  await saveProject(workspaceId);
}

/** Replaces the values of the custom script `id`. A field that `values` does not have is removed from the script. */
export async function updateAction(workspaceId: string, id: string, values: Omit<Action, "id">) {
  const p = project.byWorkspace[workspaceId];
  const index = p?.config.actions.findIndex((x) => x.id === id) ?? -1;
  if (p === undefined || index === -1) return;
  p.config.actions[index] = { id, ...values };
  await saveProject(workspaceId);
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

export async function stopAction(workspaceId: string, action: Action) {
  const pane = actionPane(workspaceId, action);
  if (pane) await api.sendKeys(pane.pane_id, ["ctrl+c"]).catch(() => {});
}

/** Is a process other than the shell running in the pane? (null: unknown) */
async function paneBusy(paneId: string): Promise<boolean | null> {
  try {
    const r = await api.request<{ process_info: { shell_pid?: number | null; foreground_processes?: { pid: number }[] } }>(
      "pane.process_info",
      { pane_id: paneId },
    );
    const info = r.process_info;
    return (info.foreground_processes ?? []).some((proc) => proc.pid !== info.shell_pid);
  } catch {
    return null;
  }
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
      const busy = await paneBusy(paneId);
      if (busy !== null) project.busy[paneId] = busy; // else: keep the last known state
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
