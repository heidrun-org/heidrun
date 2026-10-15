import { launchAgent } from "./agents";
import { newTerminal, newWorkspace, selectedPane, selectedWorkspace, splitPane } from "./session";
import { insertIntoFocusedPane } from "./input";
import { settings } from "./settings";
import type { PaneInfo } from "../lib/types";

const KEY = "heidrun.newPane";

export type NewPaneValues = {
  tool: "terminal" | "claude" | "codex";
  agent: string | null;
  model: string;
  label: string;
  labelTouched: boolean;
  text: string;
};

/** The values of the last pane started from the window "New pane", or null when there are none. */
export function loadNewPaneValues(): NewPaneValues | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v !== null && typeof v === "object" ? (v as NewPaneValues) : null;
  } catch {
    return null;
  }
}

export function saveNewPaneValues(values: NewPaneValues) {
  try {
    localStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    /* ignore */
  }
}

export function forgetNewPaneValues() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Starts one pane from the given values, without any window.
 * @param values - the command of the pane and its options
 * @param existingPane - a pane that already exists, for example the first pane of a new workspace: the command runs in
 *   this pane and no new tab is created. A terminal needs no command, so a terminal starts nothing in this pane.
 */
export async function startNewPane(values: NewPaneValues, existingPane?: PaneInfo) {
  const ws = selectedWorkspace.value;
  if (ws === null || ws === undefined) return;
  if (values.tool === "terminal") {
    if (existingPane === undefined) {
      newTerminal();
    }
    return;
  }
  const prompt = values.text;
  const res = await launchAgent({
    workspaceId: ws.workspace_id,
    cwd: selectedPane.value?.foreground_cwd || selectedPane.value?.cwd || null,
    tool: values.tool,
    agent: values.tool === "claude" ? values.agent : null,
    model: values.model.trim() || null,
    label: values.label.trim(),
    prompt,
    existingPane,
  });
  // Not sent: kept in the input bar so nothing is lost.
  if (res === "failed" && prompt.trim()) insertIntoFocusedPane(prompt);
}

/** The values of the pane that the default command of a new tab starts: a free agent, with the default model and no starting prompt. */
export function defaultNewTabValues(): NewPaneValues {
  const tool = settings.newTabCommand;
  return {
    tool,
    agent: null,
    model: "",
    label: tool,
    labelTouched: false,
    text: "",
  };
}

/** Plain click on the plus button starts the default command of a new tab; shift click starts a terminal. */
export function onNewPaneClick(e: MouseEvent) {
  if (e.shiftKey) {
    newTerminal();
    return;
  }
  startDefaultNewTab();
}

/**
 * Plain click on a split control starts the default command of a new tab in the new pane; shift click starts a terminal.
 * @param e - the click on the split control
 * @param direction - where the new pane goes: to the right of the pane, or below it
 * @param paneId - the pane to split, the selected pane when it is not given
 * @returns a promise that ends when the command is started, or when the failure is shown
 */
export async function onSplitPaneClick(e: MouseEvent, direction: "right" | "down", paneId?: string): Promise<void> {
  if (e.shiftKey) {
    await splitPane(direction, paneId);
    return;
  }
  await startDefaultSplit(direction, paneId);
}

/**
 * Splits a pane, then starts the default command of a new tab in the new pane: the split controls, the shortcuts
 * Command+D and Shift+Command+D, and the command palette do the same. The new pane is in an existing tab, so the tab keeps
 * its name. A terminal needs no command, so the default command "terminal" only splits the pane.
 * @param direction - where the new pane goes: to the right of the pane, or below it
 * @param paneId - the pane to split, the selected pane when it is not given
 * @returns a promise that ends when the command is started, or when the failure is shown
 */
export async function startDefaultSplit(direction: "right" | "down", paneId?: string): Promise<void> {
  const pane = await splitPane(direction, paneId);
  if (pane === undefined) {
    return;
  }
  await startNewPane({ ...defaultNewTabValues(), label: "" }, pane);
}

/** Starts the default command of a new tab: the plus button of the tab bar and the shortcut Command+T do the same. */
export function startDefaultNewTab() {
  return startNewPane(defaultNewTabValues());
}

/**
 * Creates a workspace for a folder, selects it, and starts the default command of a new tab in its first tab. Herdr creates
 * this first tab with the workspace, so this function creates no other tab ([issue 379](https://github.com/heidrun-org/heidrun/issues/379)).
 * @param cwd - the path of the folder of the workspace, absolute or starting with `~`
 * @param label - the name of the workspace
 * @returns a promise that ends when the command is started, or when the failure is shown
 */
export async function openNewWorkspace(cwd: string | null, label: string | null): Promise<void> {
  const rootPane = await newWorkspace(cwd, label);
  if (rootPane === undefined) {
    return;
  }
  await startNewPane(defaultNewTabValues(), rootPane);
}
