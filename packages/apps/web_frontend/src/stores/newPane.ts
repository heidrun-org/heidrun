import { launchAgent, newAgent } from "./agents";
import { newTerminal, selectedPane, selectedWorkspace } from "./session";
import { insertIntoFocusedPane } from "./input";

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

/** Starts one pane from the given values, without any window. */
export async function startNewPane(values: NewPaneValues) {
  const ws = selectedWorkspace.value;
  if (ws === null || ws === undefined) return;
  if (values.tool === "terminal") {
    newTerminal();
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
  });
  // Not sent: kept in the input bar so nothing is lost.
  if (res === "failed" && prompt.trim()) insertIntoFocusedPane(prompt);
}

/** Plain click on the plus icon opens the window; shift click starts the previous pane again. */
export function onNewPaneClick(e: MouseEvent) {
  const previous = loadNewPaneValues();
  if (e.shiftKey && previous !== null) {
    startNewPane(previous);
    return;
  }
  newAgent.open = true;
}
