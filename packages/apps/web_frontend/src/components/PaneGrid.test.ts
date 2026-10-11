import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { PaneLayoutSnapshot } from "../lib/types";

const mocks = await vi.hoisted(async () => {
  const { ref } = await import("vue");
  return {
    tabLayout: ref<unknown>(null),
    tabPanes: ref<unknown[]>([]),
    setSplitRatios: vi.fn(),
  };
});

vi.mock("../stores/session", () => ({
  tabLayout: mocks.tabLayout,
  tabPanes: mocks.tabPanes,
  setSplitRatios: mocks.setSplitRatios,
}));

// The panes show terminals, which need a real browser: the lines between the panes are the subject of these tests.
vi.mock("./PaneCard.vue", () => ({ default: { template: "<div></div>" } }));

import PaneGrid from "./PaneGrid.vue";

const AREA = { x: 0, y: 0, width: 120, height: 40 };

/** Two panes side by side, and the second pane split in two panes, one above the other. Like Herdr 0.9.3 sends it. */
const THREE_PANES: PaneLayoutSnapshot = {
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

const OUTER_EDGES = { left: true, right: true };
const NO_OUTER_EDGES = { left: false, right: false };

/** The screen is 1200 pixels wide and 800 pixels high, so one cell of Herdr is 10 pixels wide and 20 pixels high. */
function mountPaneGrid(layout: PaneLayoutSnapshot, outerEdges = NO_OUTER_EDGES) {
  mocks.tabLayout.value = layout;
  mocks.tabPanes.value = layout.panes.map((layoutPane) => ({ pane_id: layoutPane.pane_id }));
  const wrapper = mount(PaneGrid, {
    props: { outerEdges },
    attachTo: document.body,
  });
  wrapper.element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 }) as DOMRect;
  return wrapper;
}

/** Moves the pointer on the window, like a drag does. */
function movePointer(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX, clientY }));
}

function releasePointer() {
  window.dispatchEvent(new MouseEvent("pointerup"));
}

beforeEach(() => {
  mocks.setSplitRatios.mockClear();
  mocks.tabLayout.value = null;
  mocks.tabPanes.value = [];
  document.body.innerHTML = "";
});

describe("PaneGrid lines between panes", () => {
  it("shows one line for each split, a horizontal one for a split down and a vertical one for a split right", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const lines = wrapper.findAll(".separator");
    expect(lines.map((line) => line.attributes("aria-orientation"))).toEqual(["vertical", "horizontal"]);
    expect(lines.map((line) => line.attributes("role"))).toEqual(["separator", "separator"]);
  });

  it("shows no line when a pane is zoomed", () => {
    const wrapper = mountPaneGrid({ ...THREE_PANES, zoomed: true });
    expect(wrapper.findAll(".separator").length).toBe(0);
  });

  it("shows no line when Herdr sends no split", () => {
    const wrapper = mountPaneGrid({ ...THREE_PANES, splits: undefined });
    expect(wrapper.findAll(".separator").length).toBe(0);
  });

  it("sends the new share of a split after a drag of the horizontal line, one cell for each 20 pixels", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const line = wrapper.find(".separator.down");
    await line.trigger("pointerdown", { clientX: 900, clientY: 400 });
    movePointer(900, 440);
    releasePointer();
    expect(mocks.setSplitRatios).toHaveBeenCalledTimes(1);
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes).toHaveLength(1);
    expect(changes[0].tabId).toBe("w1:t1");
    expect(changes[0].path).toEqual([true]);
    expect(changes[0].ratio).toBeCloseTo(0.55);
  });

  it("sends the new share of a split after a drag of the vertical line, one cell for each 10 pixels", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.right").trigger("pointerdown", { clientX: 600, clientY: 400 });
    movePointer(480, 400);
    releasePointer();
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes[0].path).toEqual([]);
    expect(changes[0].ratio).toBeCloseTo(0.4);
  });

  it("sends nothing while the pointer stays inside the same cell", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.down").trigger("pointerdown", { clientX: 900, clientY: 400 });
    movePointer(900, 405);
    movePointer(900, 392);
    releasePointer();
    expect(mocks.setSplitRatios).not.toHaveBeenCalled();
  });

  it("does not follow the pointer any more after the pointer is released", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.down").trigger("pointerdown", { clientX: 900, clientY: 400 });
    releasePointer();
    movePointer(900, 500);
    expect(mocks.setSplitRatios).not.toHaveBeenCalled();
    expect(document.body.style.cursor).toBe("");
  });

  it("shares the room evenly after a double-click", async () => {
    const wrapper = mountPaneGrid({
      ...THREE_PANES,
      splits: [THREE_PANES.splits![0], { ...THREE_PANES.splits![1], ratio: 0.8 }],
    });
    await wrapper.find(".separator.down").trigger("dblclick");
    expect(mocks.setSplitRatios).toHaveBeenCalledWith([{ tabId: "w1:t1", path: [true], ratio: 0.5 }]);
  });

  it("moves a line by one cell with the arrow keys, and by four cells with the key Shift", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const line = wrapper.find(".separator.down");
    await line.trigger("keydown", { key: "ArrowDown" });
    await line.trigger("keydown", { key: "ArrowUp", shiftKey: true });
    await line.trigger("keydown", { key: "ArrowLeft" });
    expect(mocks.setSplitRatios).toHaveBeenCalledTimes(2);
    expect(mocks.setSplitRatios.mock.calls[0][0][0].ratio).toBeCloseTo(0.525);
    expect(mocks.setSplitRatios.mock.calls[1][0][0].ratio).toBeCloseTo(0.4);
  });
});

describe("PaneGrid corners", () => {
  it("shows a corner where the vertical line meets the horizontal line", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(wrapper.findAll(".corner").length).toBe(1);
  });

  it("moves both lines with one drag of the corner", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".corner").trigger("pointerdown", { clientX: 600, clientY: 400 });
    movePointer(480, 440);
    releasePointer();
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes.map((change: { path: boolean[] }) => change.path)).toEqual([[true], []]);
    expect(changes[0].ratio).toBeCloseTo(0.55);
    expect(changes[1].ratio).toBeCloseTo(0.4);
  });

  it("shows a corner at each side that has a column of the window against it", () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    expect(wrapper.findAll(".corner").length).toBe(2);
  });

  it("tells the parent to move the column that sits against the corner, with the move of the pointer", async () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    await wrapper.findAll(".corner")[1].trigger("pointerdown", { clientX: 1200, clientY: 400 });
    movePointer(1150, 440);
    releasePointer();
    expect(wrapper.emitted("outerStart")).toEqual([["right"]]);
    expect(wrapper.emitted("outerMove")).toEqual([["right", -50]]);
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toEqual([true]);
  });

  it("keeps the corner element while the lines move, so that the drag goes on", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const corner = wrapper.find(".corner").element;
    await wrapper.find(".corner").trigger("pointerdown", { clientX: 600, clientY: 400 });
    const moved: PaneLayoutSnapshot = {
      ...THREE_PANES,
      panes: [
        { pane_id: "w1:p1", focused: true, rect: { x: 0, y: 0, width: 48, height: 40 } },
        { pane_id: "w1:p2", focused: false, rect: { x: 48, y: 0, width: 72, height: 22 } },
        { pane_id: "w1:p3", focused: false, rect: { x: 48, y: 22, width: 72, height: 18 } },
      ],
      splits: [
        { id: "split_0_root", direction: "right", ratio: 0.4, rect: AREA },
        { id: "split_1_1", direction: "down", ratio: 0.55, rect: { x: 48, y: 0, width: 72, height: 40 } },
      ],
    };
    mocks.tabLayout.value = moved;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".corner").element).toBe(corner);
    releasePointer();
  });
});
