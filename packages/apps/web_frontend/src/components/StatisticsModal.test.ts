import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The calls that the chart makes to Plotly.js: jsdom cannot draw an SVG chart, so Plotly.js is replaced. */
const plotly = { react: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } };
vi.mock("plotly.js-basic-dist-min", () => ({ default: plotly }));

/** What one call to `Plotly.react` drew. */
type Drawing = {
  data: { type: string; x: string[]; y: number[]; customdata: string[] };
  layout: { yaxis: { range?: number[]; autorange?: boolean } };
};

/** Waits until the chart has called Plotly.js this number of times: the chart loads Plotly.js after it mounts. */
async function waitForDrawings(drawingCount: number): Promise<void> {
  await vi.waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(drawingCount));
}

/** The last drawing that the chart gave to Plotly.js. */
function lastDrawing(): Drawing {
  const call = plotly.react.mock.calls[plotly.react.mock.calls.length - 1];
  return { data: call[1][0], layout: call[2] };
}

/** The sum of the heights of the bars of a drawing. */
function sumOfBars(drawing: Drawing): number {
  return drawing.data.y.reduce((total, value) => total + value, 0);
}

/** The calls that asked the data layer for the records: the other stores also call `invoke` when they load. */
function recordRangeCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "user_activity_records_in_range");
}

/** The functions that the chart gave to the observer of its size: a test calls them to change the size. */
const resizeCallbacks: Array<() => void> = [];

/** Mounts the window with the records that the data layer gives. */
async function mountStatisticsModal(records: unknown[] | Error) {
  invoke.mockReset();
  if (records instanceof Error) {
    invoke.mockRejectedValue(records);
  } else {
    invoke.mockResolvedValue(records);
  }
  const { statisticsModal, openStatisticsModal } = await import("../stores/statistics_modal");
  const { default: StatisticsModal } = await import("./StatisticsModal.vue");
  openStatisticsModal();
  const wrapper = mount(StatisticsModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, statisticsModal };
}

/** Clicks the radio button of a time range, and waits for the next drawing of the chart. */
async function chooseRange(wrapper: VueWrapper, rangeId: "hour" | "day" | "week", drawingCount: number): Promise<void> {
  await wrapper.get(`#statistics-range-${rangeId}`).setValue(true);
  await waitForDrawings(drawingCount);
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.useRealTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {} }));
  resizeCallbacks.length = 0;
  plotly.Plots.resize.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  plotly.react.mockReset();
  plotly.purge.mockReset();
  document.body.innerHTML = "";
});

describe("StatisticsModal", () => {
  it("has the title Statistics and a close button", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    expect(wrapper.get(".dialog-title").text()).toBe("Statistics");
    expect(wrapper.find("button[aria-label='Close (Escape)']").exists()).toBe(true);
  });

  it("has one tab, User activity, built as a Bootstrap tab list, and it is the selected tab", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const tabList = wrapper.get('[role="tablist"]');
    expect(tabList.classes()).toEqual(expect.arrayContaining(["nav", "nav-tabs"]));
    const tabs = tabList.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["User activity"]);
    expect(tabs[0].classes()).toContain("active");
    expect(tabs[0].attributes("aria-selected")).toBe("true");
    const pane = wrapper.get('[role="tabpanel"]');
    expect(pane.classes()).toEqual(expect.arrayContaining(["tab-pane", "active"]));
    expect(pane.attributes("id")).toBe(tabs[0].attributes("aria-controls"));
    expect(pane.attributes("aria-labelledby")).toBe(tabs[0].attributes("id"));
  });

  it("has a Bootstrap radio button group with Last hour, Last day, and Last week, and Last hour is chosen at first", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const group = wrapper.get(".btn-group");
    expect(group.attributes("aria-label")).toBe("Time range");
    const buttons = group.findAll("label.btn-check.btn-outline.theme-secondary");
    expect(buttons.map((button) => button.text())).toEqual(["Last hour", "Last day", "Last week"]);
    for (const button of buttons) {
      expect(button.attributes("title")).not.toBe("");
      expect(button.get("input").attributes("type")).toBe("radio");
    }
    const checked = buttons.map((button) => (button.get("input").element as HTMLInputElement).checked);
    expect(checked).toEqual([true, false, false]);
  });

  it("reads the records of the last week through the data layer each time that it opens", async () => {
    const first = await mountStatisticsModal([]);
    expect(recordRangeCalls()).toHaveLength(1);
    const { since, until } = recordRangeCalls()[0][1] as { since: string; until: string };
    const range = Date.parse(until) - Date.parse(since);
    expect(range).toBeGreaterThanOrEqual(6 * 24 * 3_600_000 - 3_600_000);
    expect(range).toBeLessThanOrEqual(7 * 24 * 3_600_000);
    first.wrapper.unmount();
    vi.resetModules();
    await mountStatisticsModal([]);
    expect(recordRangeCalls()).toHaveLength(1);
  });

  it("draws one histogram at first, the last hour: twelve bars, and a vertical axis from 0 to 5 minutes", async () => {
    await mountStatisticsModal([]);
    await waitForDrawings(1);
    const drawing = lastDrawing();
    expect(drawing.data.type).toBe("bar");
    expect(drawing.data.x).toHaveLength(12);
    expect(drawing.layout.yaxis.range).toEqual([0, 5]);
    expect(drawing.layout.yaxis.autorange).toBe(false);
    expect(plotly.react).toHaveBeenCalledTimes(1);
  });

  it("draws the last day when Last day is chosen: twenty-four bars, and a vertical axis from 0 to 60 minutes", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    await waitForDrawings(1);
    await chooseRange(wrapper, "day", 2);
    const drawing = lastDrawing();
    expect(drawing.data.x).toHaveLength(24);
    expect(drawing.layout.yaxis.range).toEqual([0, 60]);
  });

  it("draws the last week when Last week is chosen: seven bars, and a vertical axis in hours that follows the longest day", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    await waitForDrawings(1);
    await chooseRange(wrapper, "week", 2);
    const drawing = lastDrawing();
    expect(drawing.data.x).toHaveLength(7);
    expect(drawing.layout.yaxis.autorange).toBe(true);
    expect(drawing.layout.yaxis.range).toBeUndefined();
  });

  it("gives the same period to the three time ranges, in minutes for the last hour and the last day, and in hours for the last week", async () => {
    const now = Date.now();
    const record = { startedAt: new Date(now - 60_000).toISOString(), endedAt: new Date(now - 30_000).toISOString() };
    const { wrapper } = await mountStatisticsModal([record]);
    await waitForDrawings(1);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5, 5);
    await chooseRange(wrapper, "day", 2);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5, 5);
    await chooseRange(wrapper, "week", 3);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5 / 60, 5);
    await chooseRange(wrapper, "hour", 4);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5, 5);
  });

  it("writes the tooltip of the last hour with the start, the end, and the minutes and seconds, and the tooltip of the last week with the day, the hours, and the minutes", async () => {
    const now = Date.now();
    const record = { startedAt: new Date(now - 3_600_000).toISOString(), endedAt: new Date(now - 60_000).toISOString() };
    const { wrapper } = await mountStatisticsModal([record]);
    await waitForDrawings(1);
    expect(lastDrawing().data.customdata.every((tooltip) => /^.+ to .+: \d+ min \d+ s$/.test(tooltip))).toBe(true);
    await chooseRange(wrapper, "week", 2);
    const tooltips = lastDrawing().data.customdata;
    expect(tooltips).toHaveLength(7);
    expect(tooltips.every((tooltip) => /: \d+ h \d+ min$/.test(tooltip))).toBe(true);
  });

  it("draws the chart again at its new size when the window changes size", async () => {
    await mountStatisticsModal([]);
    await waitForDrawings(1);
    expect(resizeCallbacks).toHaveLength(1);
    resizeCallbacks[0]();
    expect(plotly.Plots.resize).toHaveBeenCalledTimes(1);
  });

  it("draws the chart again when the theme changes", async () => {
    const { settings } = await import("../stores/settings");
    await mountStatisticsModal([]);
    await waitForDrawings(1);
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    await vi.waitFor(() => expect(plotly.react.mock.calls.length).toBeGreaterThan(1));
  });

  it("shows an error message when the records cannot be read", async () => {
    const { wrapper } = await mountStatisticsModal(new Error("no data layer"));
    expect(wrapper.get(".alert-danger").text()).toContain("no data layer");
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("closes when the key Escape is pressed and when the close button is clicked", async () => {
    const { wrapper, statisticsModal } = await mountStatisticsModal([]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(statisticsModal.open).toBe(false);
    statisticsModal.open = true;
    await wrapper.get("button[aria-label='Close (Escape)']").trigger("click");
    expect(statisticsModal.open).toBe(false);
  });
});
