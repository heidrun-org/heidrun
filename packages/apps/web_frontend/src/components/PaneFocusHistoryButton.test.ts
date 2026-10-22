import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import PaneFocusHistoryButton from "./PaneFocusHistoryButton.vue";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import { pinnedPaneState } from "../stores/pinned_panes";
import { PANE_FOCUS_STAY_MS, paneFocusHistory } from "../stores/pane_focus_history";

/** The names that the panes show in the list of the entries. */
const PANE_NAMES: Record<string, string> = { "w1:p1": "Alpha", "w1:p2": "Beta", "w1:p3": "Gamma" };

/** The panes `w1:p1`, `w1:p2`, and `w1:p3` are in the tab one. */
const SNAPSHOT: SessionSnapshot = {
  version: "test",
  protocol: 1,
  workspaces: [],
  tabs: [],
  panes: ["w1:p1", "w1:p2", "w1:p3"].map((paneId) => ({
    pane_id: paneId,
    terminal_id: `terminal-${paneId}`,
    workspace_id: "w1",
    tab_id: "w1:t1",
    label: PANE_NAMES[paneId],
    focused: false,
    agent_status: "unknown",
    revision: 1,
  })),
  layouts: [],
  agents: [],
};

/** How long the developer must press a button before the list opens, in milliseconds. */
const LONG_PRESS_MS = 500;

/** Gives the focus to a pane by a click in the grid, then waits until the history records it. */
async function focusAndStay(paneId: string) {
  state.selectedPaneId = paneId;
  await nextTick();
  vi.advanceTimersByTime(PANE_FOCUS_STAY_MS);
}

/** The items of the list that a long press opens. The list sits in the body of the page. */
function listItems(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]')];
}

/**
 * The button of a mounted component. The component has two root nodes, the button and the list, so the wrapper of the
 * component does not stand for the button.
 */
function buttonOf(mounted: VueWrapper) {
  return mounted.get("button.history-button");
}

/** Presses a button with the left mouse button, and keeps it pressed for some time. */
async function press(mounted: VueWrapper, pressedMs: number) {
  await buttonOf(mounted).trigger("pointerdown", { button: 0 });
  vi.advanceTimersByTime(pressedMs);
  await nextTick();
}

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  settings.pinnedPanes = [];
  state.snapshot = SNAPSHOT;
  state.selectedWorkspaceId = "w1";
  state.selectedTabId = "w1:t1";
  state.selectedPaneId = null;
  pinnedPaneState.focus = null;
  paneFocusHistory.remove(paneFocusHistory.paneIds);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("PaneFocusHistoryButton", () => {
  it("is an icon button with no border, so the shared style shows its background only under the pointer", () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "back" } });
    expect(buttonOf(wrapper).classes()).toEqual(expect.arrayContaining(["btn", "icon"]));
  });

  it("is disabled while the history has no entry in its direction", async () => {
    const back = mount(PaneFocusHistoryButton, { props: { direction: "back" } });
    const forward = mount(PaneFocusHistoryButton, { props: { direction: "forward" } });
    expect(buttonOf(back).attributes("disabled")).toBeDefined();
    expect(buttonOf(forward).attributes("disabled")).toBeDefined();
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    expect(buttonOf(back).attributes("disabled")).toBeUndefined();
    expect(buttonOf(forward).attributes("disabled")).toBeDefined();
    back.unmount();
    forward.unmount();
  });

  it("gives the focus to the previous pane on a click on Back, and enables Forward", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "back" } });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await buttonOf(wrapper).trigger("click");
    expect(state.selectedPaneId).toBe("w1:p1");
    expect(paneFocusHistory.canGoForward).toBe(true);
    expect(buttonOf(wrapper).attributes("disabled")).toBeDefined();
  });

  it("gives the focus to the next pane on a click on Forward", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "forward" } });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    paneFocusHistory.goBack();
    state.selectedPaneId = "w1:p1";
    await nextTick();
    await buttonOf(wrapper).trigger("click");
    expect(state.selectedPaneId).toBe("w1:p2");
  });

  it("does not open the list on a short press", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "back" }, attachTo: document.body });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await press(wrapper, LONG_PRESS_MS - 100);
    await buttonOf(wrapper).trigger("pointerup");
    await buttonOf(wrapper).trigger("click");
    expect(listItems()).toEqual([]);
    expect(state.selectedPaneId).toBe("w1:p1");
  });

  it("opens the list of the entries before on a long press on Back, the nearest first", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "back" }, attachTo: document.body });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    await press(wrapper, LONG_PRESS_MS);
    expect(listItems()).toHaveLength(2);
    expect(listItems()[0].textContent).toContain("Beta");
    expect(listItems()[1].textContent).toContain("Alpha");
  });

  it("does not give the focus to another pane on the click that ends a long press", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "back" }, attachTo: document.body });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await press(wrapper, LONG_PRESS_MS);
    await buttonOf(wrapper).trigger("pointerup");
    await buttonOf(wrapper).trigger("click");
    expect(state.selectedPaneId).toBe("w1:p2");
    expect(listItems()).toHaveLength(1);
  });

  it("gives the focus to the pane of the entry that the developer chooses, and closes the list", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "back" }, attachTo: document.body });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    await press(wrapper, LONG_PRESS_MS);
    listItems()[1].click();
    await nextTick();
    expect(state.selectedPaneId).toBe("w1:p1");
    expect(listItems()).toEqual([]);
    expect(paneFocusHistory.entriesAfter.map((entry) => entry.paneId)).toEqual(["w1:p2", "w1:p3"]);
  });

  it("opens the list of the entries after on a long press on Forward", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "forward" }, attachTo: document.body });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await focusAndStay("w1:p3");
    paneFocusHistory.goTo(0);
    await nextTick();
    await press(wrapper, LONG_PRESS_MS);
    expect(listItems()).toHaveLength(2);
    expect(listItems()[0].textContent).toContain("Beta");
    expect(listItems()[1].textContent).toContain("Gamma");
  });

  it("does not open a list while the button is disabled", async () => {
    wrapper = mount(PaneFocusHistoryButton, { props: { direction: "forward" }, attachTo: document.body });
    await focusAndStay("w1:p1");
    await focusAndStay("w1:p2");
    await press(wrapper, LONG_PRESS_MS);
    expect(listItems()).toEqual([]);
  });
});
