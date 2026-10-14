import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
// The pane cards show terminals, which need a real browser: the list of panes in the column is the subject of these tests.
vi.mock("./PaneCard.vue", () => ({
  default: { props: ["pane", "isInColumnOfPinnedPanes"], template: '<div class="pane-card">{{ pane.pane_id }}</div>' },
}));

import ColumnOfPinnedPanes from "./ColumnOfPinnedPanes.vue";
import { state } from "../stores/session";
import { settings } from "../stores/settings";

const SNAPSHOT: SessionSnapshot = {
  version: "test",
  protocol: 1,
  workspaces: [],
  tabs: [],
  panes: ["w1:p1", "w1:p2", "w1:p3"].map((paneId) => ({
    pane_id: paneId,
    terminal_id: `terminal-${paneId}`,
    workspace_id: "w1",
    tab_id: paneId === "w1:p3" ? "w1:t2" : "w1:t1",
    focused: false,
    agent_status: "unknown",
    revision: 1,
  })),
  layouts: [],
  agents: [],
};

/** The names of the panes that the column shows, from top to bottom. */
function shownPaneNames(): string[] {
  const wrapper = mount(ColumnOfPinnedPanes);
  return wrapper.findAll(".pane-card").map((card) => card.text());
}

beforeEach(() => {
  settings.pinnedPanes = [];
  state.snapshot = SNAPSHOT;
  state.selectedTabId = "w1:t1";
});

describe("ColumnOfPinnedPanes", () => {
  it("shows a pinned pane of the selected tab, so that the pane has the same width in every tab", () => {
    settings.pinnedPanes = ["w1:p1"];
    expect(shownPaneNames()).toEqual(["w1:p1"]);
  });

  it("shows a pinned pane of another tab", () => {
    settings.pinnedPanes = ["w1:p3"];
    expect(shownPaneNames()).toEqual(["w1:p3"]);
  });

  it("shows the same pinned panes after the selected tab changes", () => {
    settings.pinnedPanes = ["w1:p1", "w1:p3"];
    const inTabOne = shownPaneNames();
    state.selectedTabId = "w1:t2";
    expect(shownPaneNames()).toEqual(inTabOne);
  });
});
