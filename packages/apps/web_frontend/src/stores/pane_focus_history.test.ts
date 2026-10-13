import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import { state } from "./session";
import { settings } from "./settings";
import { pinnedPaneState } from "./pinned_panes";
import {
  PANE_FOCUS_STAY_MS,
  goBackInPaneFocusHistory,
  goForwardInPaneFocusHistory,
  goToPaneFocusHistoryEntry,
  paneFocusHistory,
} from "./pane_focus_history";

/** The panes `w1:p1`, `w1:p2`, and `w1:p3` are in the tab one, and the pane `w1:p4` is in the tab two. */
function snapshotOf(paneIds: string[]): SessionSnapshot {
  return {
    version: "test",
    protocol: 1,
    workspaces: [],
    tabs: [],
    panes: paneIds.map((paneId) => ({
      pane_id: paneId,
      terminal_id: `terminal-${paneId}`,
      workspace_id: "w1",
      tab_id: paneId === "w1:p4" ? "w1:t2" : "w1:t1",
      focused: false,
      agent_status: "unknown",
      revision: 1,
    })),
    layouts: [],
    agents: [],
  };
}

/**
 * Gives the focus to a pane by a click in the grid, then waits until the pane has kept the focus long enough for the
 * history to record it.
 */
async function focusAndStay(paneId: string) {
  state.selectedPaneId = paneId;
  pinnedPaneState.focus = null;
  await nextTick();
  vi.advanceTimersByTime(PANE_FOCUS_STAY_MS);
}

/** The names of the panes of the entries before the current entry, the nearest first. */
function before(): string[] {
  return paneFocusHistory.entriesBefore.map((entry) => entry.paneId);
}

/** The names of the panes of the entries after the current entry, the nearest first. */
function after(): string[] {
  return paneFocusHistory.entriesAfter.map((entry) => entry.paneId);
}

beforeEach(() => {
  vi.useFakeTimers();
  settings.pinnedPanes = [];
  state.snapshot = snapshotOf(["w1:p1", "w1:p2", "w1:p3", "w1:p4"]);
  state.selectedWorkspaceId = "w1";
  state.selectedTabId = "w1:t1";
  state.selectedPaneId = null;
  pinnedPaneState.focus = null;
  paneFocusHistory.remove(paneFocusHistory.paneIds);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("the recording of the focus", () => {
  it("records a pane that keeps the focus", async () => {
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    expect(paneFocusHistory.currentPaneId).toBe("w1:p2");
    expect(before()).toEqual(["w1:p1"]);
  });

  it("does not record a pane that keeps the focus only for a short time", async () => {
    await focusAndStay("w1:p1");
    state.selectedPaneId = "w1:p2";
    await nextTick();
    vi.advanceTimersByTime(PANE_FOCUS_STAY_MS - 100);
    await focusAndStay("w1:p3");
    expect(paneFocusHistory.currentPaneId).toBe("w1:p3");
    expect(before()).toEqual(["w1:p1"]);
  });

  it("records a pinned pane that a click gives the focus", async () => {
    settings.pinnedPanes = ["w1:p4"];
    await focusAndStay("w1:p1");
    pinnedPaneState.focus = "w1:p4";
    await nextTick();
    vi.advanceTimersByTime(PANE_FOCUS_STAY_MS);
    expect(paneFocusHistory.currentPaneId).toBe("w1:p4");
    expect(before()).toEqual(["w1:p1"]);
  });

  it("removes the entries of a pane that Herdr does not list any more", async () => {
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    state.snapshot = snapshotOf(["w1:p1", "w1:p3", "w1:p4"]);
    await nextTick();
    expect(paneFocusHistory.paneIds).toEqual(["w1:p1", "w1:p3"]);
  });
});

describe("the buttons Back and Forward", () => {
  it("gives the focus back to the previous pane, then forward to the next pane", async () => {
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    goBackInPaneFocusHistory();
    expect(state.selectedPaneId).toBe("w1:p2");
    goBackInPaneFocusHistory();
    expect(state.selectedPaneId).toBe("w1:p1");
    goForwardInPaneFocusHistory();
    expect(state.selectedPaneId).toBe("w1:p2");
  });

  it("does not record the focus that Back gives, and keeps the entries after it", async () => {
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    goBackInPaneFocusHistory();
    await nextTick();
    vi.advanceTimersByTime(PANE_FOCUS_STAY_MS);
    expect(paneFocusHistory.currentPaneId).toBe("w1:p1");
    expect(after()).toEqual(["w1:p2"]);
  });

  it("removes the entries after the current entry when a new pane gets the focus after Back", async () => {
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    goBackInPaneFocusHistory();
    await nextTick();
    await focusAndStay("w1:p1");
    expect(paneFocusHistory.currentPaneId).toBe("w1:p1");
    expect(after()).toEqual([]);
    expect(paneFocusHistory.paneIds).toEqual(["w1:p1", "w1:p2", "w1:p1"]);
  });

  it("goes back to a pane that got the focus a moment ago and is not recorded yet", async () => {
    await focusAndStay("w1:p1");
    state.selectedPaneId = "w1:p2";
    await nextTick();
    goBackInPaneFocusHistory();
    expect(state.selectedPaneId).toBe("w1:p1");
    expect(after()).toEqual(["w1:p2"]);
  });

  it("selects the tab of the pane that gets the focus", async () => {
    await focusAndStay("w1:p1");
    state.selectedTabId = "w1:t2";
    await focusAndStay("w1:p4");
    goBackInPaneFocusHistory();
    expect(state.selectedTabId).toBe("w1:t1");
    expect(state.selectedPaneId).toBe("w1:p1");
    goForwardInPaneFocusHistory();
    expect(state.selectedTabId).toBe("w1:t2");
    expect(state.selectedPaneId).toBe("w1:p4");
  });

  it("gives the focus to a pinned pane without leaving the selected tab", async () => {
    settings.pinnedPanes = ["w1:p4"];
    await focusAndStay("w1:p1");
    pinnedPaneState.focus = "w1:p4";
    await nextTick();
    vi.advanceTimersByTime(PANE_FOCUS_STAY_MS);
    goBackInPaneFocusHistory();
    expect(pinnedPaneState.focus).toBeNull();
    expect(state.selectedPaneId).toBe("w1:p1");
    goForwardInPaneFocusHistory();
    expect(pinnedPaneState.focus).toBe("w1:p4");
    expect(state.selectedTabId).toBe("w1:t1");
  });

  it("does nothing without an entry in the direction", async () => {
    await focusAndStay("w1:p1");
    goBackInPaneFocusHistory();
    goForwardInPaneFocusHistory();
    expect(state.selectedPaneId).toBe("w1:p1");
    expect(paneFocusHistory.canGoBack).toBe(false);
    expect(paneFocusHistory.canGoForward).toBe(false);
  });
});

describe("the choice of an entry in the list", () => {
  it("gives the focus to the pane of the chosen entry, and keeps the other entries", async () => {
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    goToPaneFocusHistoryEntry(0);
    expect(state.selectedPaneId).toBe("w1:p1");
    expect(after()).toEqual(["w1:p2", "w1:p3"]);
    goToPaneFocusHistoryEntry(2);
    expect(state.selectedPaneId).toBe("w1:p3");
    expect(before()).toEqual(["w1:p2", "w1:p1"]);
  });
});
