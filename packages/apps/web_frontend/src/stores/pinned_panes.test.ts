import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaneLayoutSnapshot, SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import { state } from "./session";
import { settings } from "./settings";
import { allPinnedPanes, gridLayout, gridPanes, keptTabs, pinPane, unpinPane } from "./pinned_panes";

const AREA = { x: 0, y: 0, width: 120, height: 40 };

/** Pane of the tab one: the first pane on the left, the second and the third one above the other on the right. */
const LAYOUT_OF_TAB_ONE: PaneLayoutSnapshot = {
  workspace_id: "w1",
  tab_id: "w1:t1",
  zoomed: false,
  area: AREA,
  focused_pane_id: "w1:p1",
  panes: [
    { pane_id: "w1:p1", focused: true, rect: { x: 0, y: 0, width: 60, height: 40 } },
    { pane_id: "w1:p2", focused: false, rect: { x: 60, y: 0, width: 60, height: 20 } },
    { pane_id: "w1:p3", focused: false, rect: { x: 60, y: 20, width: 60, height: 20 } },
  ],
  splits: [
    { id: "split_0_root", direction: "right", ratio: 0.5, rect: AREA },
    { id: "split_1_1", direction: "down", ratio: 0.5, rect: { x: 60, y: 0, width: 60, height: 40 } },
  ],
};

/** The tab three holds one pane. No test selects it before the test that opens it. */
const LAYOUT_OF_TAB_THREE: PaneLayoutSnapshot = {
  workspace_id: "w1",
  tab_id: "w1:t3",
  zoomed: false,
  area: AREA,
  focused_pane_id: "w1:p5",
  panes: [{ pane_id: "w1:p5", focused: true, rect: AREA }],
  splits: [],
};

/** The tab two holds one pane. */
const LAYOUT_OF_TAB_TWO: PaneLayoutSnapshot = {
  workspace_id: "w1",
  tab_id: "w1:t2",
  zoomed: false,
  area: AREA,
  focused_pane_id: "w1:p4",
  panes: [{ pane_id: "w1:p4", focused: true, rect: AREA }],
  splits: [],
};

const SNAPSHOT: SessionSnapshot = {
  version: "test",
  protocol: 1,
  workspaces: [],
  tabs: [],
  panes: ["w1:p1", "w1:p2", "w1:p3", "w1:p4", "w1:p5"].map((paneId) => ({
    pane_id: paneId,
    terminal_id: `terminal-${paneId}`,
    workspace_id: "w1",
    tab_id: paneId === "w1:p5" ? "w1:t3" : paneId === "w1:p4" ? "w1:t2" : "w1:t1",
    focused: false,
    agent_status: "unknown",
    revision: 1,
  })),
  layouts: [LAYOUT_OF_TAB_ONE, LAYOUT_OF_TAB_TWO, LAYOUT_OF_TAB_THREE],
  agents: [],
};

/** The names of the panes of a list. */
function names(paneList: { pane_id: string }[]): string[] {
  return paneList.map((pane) => pane.pane_id);
}

beforeEach(() => {
  settings.pinnedPanes = [];
  state.snapshot = SNAPSHOT;
  state.selectedTabId = "w1:t1";
});

describe("the grid of the selected tab and the column of pinned panes", () => {
  it("draws every pane of the selected tab in the grid when no pane is pinned", () => {
    expect(names(gridPanes.value)).toEqual(["w1:p1", "w1:p2", "w1:p3"]);
    expect(gridLayout.value).toEqual(LAYOUT_OF_TAB_ONE);
    expect(allPinnedPanes.value).toEqual([]);
  });

  it("moves a pinned pane of the selected tab from the grid to the column of pinned panes", () => {
    pinPane("w1:p2");
    expect(names(gridPanes.value)).toEqual(["w1:p1", "w1:p3"]);
    expect(names(allPinnedPanes.value)).toEqual(["w1:p2"]);
  });

  it("gives the width of the pinned pane to the other panes of the grid", () => {
    pinPane("w1:p1");
    const rectOf = (paneId: string) => gridLayout.value?.panes.find((layoutPane) => layoutPane.pane_id === paneId)?.rect;
    expect(rectOf("w1:p1")).toBeUndefined();
    expect(rectOf("w1:p2")).toEqual({ x: 0, y: 0, width: 120, height: 20 });
    expect(rectOf("w1:p3")).toEqual({ x: 0, y: 20, width: 120, height: 20 });
  });

  it("keeps the same pinned panes in the column in every tab, the tab of the pinned pane included", () => {
    pinPane("w1:p2");
    const inTabOne = names(allPinnedPanes.value);
    state.selectedTabId = "w1:t2";
    expect(names(allPinnedPanes.value)).toEqual(inTabOne);
    expect(names(gridPanes.value)).toEqual(["w1:p4"]);
  });

  it("draws the pane in the grid again when it is unpinned", () => {
    pinPane("w1:p2");
    unpinPane("w1:p2");
    expect(names(gridPanes.value)).toEqual(["w1:p1", "w1:p2", "w1:p3"]);
    expect(allPinnedPanes.value).toEqual([]);
  });

  it("draws an empty grid when every pane of the selected tab is pinned", () => {
    pinPane("w1:p4");
    state.selectedTabId = "w1:t2";
    expect(gridPanes.value).toEqual([]);
    expect(gridLayout.value?.panes).toEqual([]);
    expect(names(allPinnedPanes.value)).toEqual(["w1:p4"]);
  });
});

describe("the tabs that keep their terminals alive", () => {
  it("lists a tab only after the developer selected it, in the order of the first selection", () => {
    state.selectedTabId = "w1:t1";
    state.selectedTabId = "w1:t2";
    state.selectedTabId = "w1:t1";
    const tabIds = keptTabs.value.map((tab) => tab.tabId);
    expect(tabIds.slice(0, 2)).toEqual(["w1:t1", "w1:t2"]);
    expect(tabIds).not.toContain("w1:t3");
  });

  it("marks only the selected tab as selected", () => {
    state.selectedTabId = "w1:t2";
    const selected = keptTabs.value.filter((tab) => tab.isSelected).map((tab) => tab.tabId);
    expect(selected).toEqual(["w1:t2"]);
    state.selectedTabId = "w1:t1";
    expect(keptTabs.value.filter((tab) => tab.isSelected).map((tab) => tab.tabId)).toEqual(["w1:t1"]);
  });

  it("keeps the tab after another tab is selected, with its panes and its layout", () => {
    state.selectedTabId = "w1:t1";
    state.selectedTabId = "w1:t2";
    const tabOne = keptTabs.value.find((tab) => tab.tabId === "w1:t1");
    expect(tabOne?.isSelected).toBe(false);
    expect(names(tabOne?.panes ?? [])).toEqual(["w1:p1", "w1:p2", "w1:p3"]);
    expect(tabOne?.layout).toEqual(LAYOUT_OF_TAB_ONE);
  });

  it("leaves the pinned panes out of every tab, the selected tab and the other tabs", () => {
    state.selectedTabId = "w1:t2";
    state.selectedTabId = "w1:t1";
    pinPane("w1:p2");
    pinPane("w1:p4");
    const tabOne = keptTabs.value.find((tab) => tab.tabId === "w1:t1");
    const tabTwo = keptTabs.value.find((tab) => tab.tabId === "w1:t2");
    expect(names(tabOne?.panes ?? [])).toEqual(["w1:p1", "w1:p3"]);
    expect(names(tabTwo?.panes ?? [])).toEqual([]);
    expect(tabTwo?.layout?.panes).toEqual([]);
  });

  it("lists a tab that the developer opens for the first time", () => {
    state.selectedTabId = "w1:t3";
    expect(keptTabs.value.map((tab) => tab.tabId)).toContain("w1:t3");
  });
});
