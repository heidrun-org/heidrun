// Background agents of a Claude Code session (main, jerome-645…): listed from the
// pane's screen, and reached with the arrow keys to send them a consigne.
import { reactive } from "vue";
import * as api from "../lib/api";
import { agentListState } from "../lib/refs";
import { allPanes, paneFullName, scheduleRefresh, toast } from "./session";
import { allowCommand } from "./guards";

export const subagents = reactive({
  /** pane id → names shown in Claude's agent list ("main" first). */
  byPane: {} as Record<string, string[]>,
  /** Pane being switched (one at a time). */
  busy: null as string | null,
});

async function listOf(paneId: string) {
  // The screen only: an old copy of the list in the scrollback must not count.
  const lines = (await api.readVisible(paneId)).replace(/\r/g, "").split("\n");
  return agentListState((i) => (i >= 0 && i < lines.length ? lines[i] : null), lines.length);
}

/** Reads the agent list of every Claude pane given (or all of them). */
export async function refreshSubagents(paneIds?: string[]) {
  const ids = paneIds ?? allPanes.value.filter((p) => (p.agent ?? "").includes("claude")).map((p) => p.pane_id);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const l = await listOf(id);
        if (l && l.names.length > 1) subagents.byPane[id] = l.names;
        else delete subagents.byPane[id];
      } catch {
        /* pane gone */
      }
    }),
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Moves the selection to `name` and opens it (Enter). False if the list cannot be reached. */
async function switchTo(paneId: string, name: string): Promise<boolean> {
  let list = await listOf(paneId);
  if (!list) return false;
  if (list.current != null && list.current === list.names.indexOf(name)) return true;
  if (list.selected === null) {
    // The first ↓ leaves the prompt for the list.
    await api.sendKeys(paneId, ["down"]);
    let after = null as Awaited<ReturnType<typeof listOf>>;
    for (let i = 0; i < 5; i++) {
      await wait(i ? 120 : 180);
      after = await listOf(paneId);
      if (!after || after.selected !== null) break;
    }
    // No ❯ (or no list): that ↓ may have walked the prompt history instead. Undo it
    // and stop, rather than pressing Enter on whatever is in the prompt box.
    if (!after || after.selected === null) {
      await api.sendKeys(paneId, ["up"]);
      return false;
    }
    list = after;
  }
  const target = list.names.indexOf(name);
  if (target === -1) return false;
  const steps = target - (list.selected ?? 0);
  await api.sendKeys(paneId, [...Array(Math.abs(steps)).fill(steps > 0 ? "down" : "up"), "enter"]);
  // Check it is really shown before typing anything.
  for (let i = 0; i < 6; i++) {
    await wait(200);
    const now = await listOf(paneId);
    if (now && now.current != null && now.current === now.names.indexOf(name)) return true;
  }
  return false;
}

/** After a failure: back on the first agent (main) if the session shows another one. */
async function restore(paneId: string, name: string) {
  if (name === "main") return;
  try {
    const l = await listOf(paneId);
    if (l && l.current != null && l.current !== 0) await switchTo(paneId, l.names[0]);
  } catch {
    /* nothing more to do */
  }
}

/**
 * Sends `text` to the background agent `name` of the Claude session in `paneId`,
 * then (by default) shows `main` again.
 */
export async function sendToSubagent(paneId: string, name: string, text: string, backToMain = true): Promise<boolean> {
  if (subagents.busy) {
    toast("Un envoi à un sous-agent est déjà en cours");
    return false;
  }
  // "! command": Claude's shell mode, checked like any other command.
  const shell = /^\s*!\s*(\S[\s\S]*)$/.exec(text);
  const pane = allPanes.value.find((p) => p.pane_id === paneId);
  if (shell && !(await allowCommand(shell[1], pane?.foreground_cwd || pane?.cwd || null, pane ? `${paneFullName(pane)} › ${name}` : name))) return false;
  // A permission menu is open: the arrows and Enter would answer it.
  if (pane?.agent_status === "blocked") {
    toast("L’agent attend une décision : réponds-lui d’abord");
    return false;
  }
  subagents.busy = paneId;
  toast(`Bascule vers ${name}…`);
  let switched = false;
  try {
    if (!(await switchTo(paneId, name))) {
      toast(`Impossible d’atteindre ${name} dans la liste des agents de Claude : consigne non envoyée`);
      await restore(paneId, name);
      return false;
    }
    switched = true;
    await api.prompt(paneId, text);
    if (backToMain && name !== "main") {
      await wait(500);
      const first = (await listOf(paneId))?.names[0] ?? "main";
      if (!(await switchTo(paneId, first))) toast(`Envoyé à ${name}, mais le retour sur ${first} a échoué`);
      else toast(`Envoyé à ${name}`);
    } else toast(`Envoyé à ${name}`);
    return true;
  } catch (e) {
    toast(String(e));
    if (switched) await restore(paneId, name);
    return false;
  } finally {
    subagents.busy = null;
    scheduleRefresh();
  }
}
