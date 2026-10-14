// Pinned panes: panes kept in a column of pinned panes next to the panes of the selected tab, whatever the
// workspace, to watch several of them at once.
import { computed, reactive, watch } from "vue";
import { allPanes, state, tabLayout, tabPanes, toast } from "./session";
import { settings } from "./settings";
import { paneName } from "../lib/format";
import { PaneLayoutWithoutPanes } from "../lib/pane_layout_without_panes";
import { t } from "../i18n/index";

export const MAX_PINNED_PANES = 4;

export const pinnedPaneState = reactive({
  /** Pinned pane that has the keyboard (the panes of the selected tab keep their own selection). */
  focus: null as string | null,
});

export const allPinnedPanes = computed(() =>
  settings.pinnedPanes.map((id) => allPanes.value.find((p) => p.pane_id === id)).filter((p): p is NonNullable<typeof p> => !!p),
);

/** The pane with the keyboard: a pinned one when clicked, else the tab's selection. */
export const activePaneId = () => pinnedPaneState.focus ?? state.selectedPaneId;

export const isPinned = (paneId: string) => settings.pinnedPanes.includes(paneId);

/**
 * The panes of the selected tab that the grid draws. A pinned pane is only in the column of pinned panes, in every tab,
 * so that it keeps the same width and a terminal is attached only once.
 */
export const gridPanes = computed(() => tabPanes.value.filter((p) => isPinned(p.pane_id) === false));

/**
 * The layout of the selected tab for the grid: the pinned panes are left out, and the other panes fill the width.
 * It is null when there is no layout, or when the splits cannot tell where each pane goes.
 */
export const gridLayout = computed(() => {
  const layout = tabLayout.value;
  if (layout === null) {
    return null;
  }
  return PaneLayoutWithoutPanes.remove(layout, settings.pinnedPanes);
});

export function pinPane(paneId: string) {
  if (isPinned(paneId)) return;
  if (settings.pinnedPanes.length >= MAX_PINNED_PANES) {
    toast(t("pinnedPanesStore.tooMany", { count: MAX_PINNED_PANES }));
    return;
  }
  settings.pinnedPanes = [...settings.pinnedPanes, paneId];
  const p = allPanes.value.find((x) => x.pane_id === paneId);
  if (p && p.tab_id === state.selectedTabId) toast(t("pinnedPanesStore.staysPinned", { name: paneName(p) }));
}

export function unpinPane(paneId: string) {
  settings.pinnedPanes = settings.pinnedPanes.filter((id) => id !== paneId);
  if (pinnedPaneState.focus === paneId) pinnedPaneState.focus = null;
}

export function togglePinnedPane(paneId: string) {
  if (isPinned(paneId)) unpinPane(paneId);
  else pinPane(paneId);
}

// Closed panes leave the column of pinned panes (only once Herdr has answered: not at startup).
watch(
  () => state.snapshot,
  (snap) => {
    if (!snap) return;
    const alive = new Set(snap.panes.map((p) => p.pane_id));
    const kept = settings.pinnedPanes.filter((id) => alive.has(id));
    if (kept.length !== settings.pinnedPanes.length) settings.pinnedPanes = kept;
    if (pinnedPaneState.focus && !alive.has(pinnedPaneState.focus)) pinnedPaneState.focus = null;
  },
);

// Clicking back in the grid of the selected tab gives it the keyboard again.
watch(
  () => state.selectedPaneId,
  () => (pinnedPaneState.focus = null),
);
