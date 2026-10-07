// "Ouvrir à côté": agents kept in a column next to the current tab, whatever the
// workspace, to watch several of them at once.
import { computed, reactive, watch } from "vue";
import { allPanes, state, toast } from "./session";
import { settings } from "./settings";
import { paneName } from "../lib/format";

export const MAX_DOCKED = 4;

export const dockState = reactive({
  /** Docked pane that has the keyboard (the main tab keeps its own selection). */
  focus: null as string | null,
});

export const docked = computed(() =>
  settings.dockedPanes.map((id) => allPanes.value.find((p) => p.pane_id === id)).filter((p): p is NonNullable<typeof p> => !!p),
);

/**
 * Shown in the column: a pane of the tab on screen is already in the grid, and a
 * terminal is attached only once.
 */
export const dockVisible = computed(() => docked.value.filter((p) => p.tab_id !== state.selectedTabId));

/** The pane with the keyboard: a docked one when clicked, else the tab's selection. */
export const activePaneId = () => dockState.focus ?? state.selectedPaneId;

export const isDocked = (paneId: string) => settings.dockedPanes.includes(paneId);

export function dock(paneId: string) {
  if (isDocked(paneId)) return;
  if (settings.dockedPanes.length >= MAX_DOCKED) {
    toast(`${MAX_DOCKED} agents à côté au maximum : retires-en un d’abord`);
    return;
  }
  settings.dockedPanes = [...settings.dockedPanes, paneId];
  const p = allPanes.value.find((x) => x.pane_id === paneId);
  if (p && p.tab_id === state.selectedTabId) toast(`${paneName(p)} restera à côté quand tu changeras d’onglet`);
}

export function undock(paneId: string) {
  settings.dockedPanes = settings.dockedPanes.filter((id) => id !== paneId);
  if (dockState.focus === paneId) dockState.focus = null;
}

export function toggleDock(paneId: string) {
  if (isDocked(paneId)) undock(paneId);
  else dock(paneId);
}

// Closed panes leave the column (only once Herdr has answered: not at startup).
watch(
  () => state.snapshot,
  (snap) => {
    if (!snap) return;
    const alive = new Set(snap.panes.map((p) => p.pane_id));
    const kept = settings.dockedPanes.filter((id) => alive.has(id));
    if (kept.length !== settings.dockedPanes.length) settings.dockedPanes = kept;
    if (dockState.focus && !alive.has(dockState.focus)) dockState.focus = null;
  },
);

// Clicking back in the main grid gives it the keyboard again.
watch(
  () => state.selectedPaneId,
  () => (dockState.focus = null),
);
