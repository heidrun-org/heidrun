import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The calls that the chart makes to Plotly.js: jsdom cannot draw an SVG chart, so Plotly.js is replaced. */
const plotly = { react: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } };

/** The functions that the chart gave to Plotly.js for the events of the pointer: a test calls them as the pointer would. */
const plotlyHandlers: Record<string, (event: unknown) => void> = {};
vi.mock("plotly.js-basic-dist-min", () => ({ default: plotly }));

/** The chart reads each color from the theme: the test reads the name of the CSS variable of each color instead. */
vi.mock("../lib/chart_theme", () => ({ ChartTheme: { readColor: (token: string) => token } }));

/** The workspace that runs the active period is the selected workspace: the test selects the folder of a workspace. */
vi.mock("../stores/user_activity", async (importOriginal) => {
  const { ref } = await import("vue");
  return { ...(await importOriginal<typeof import("../stores/user_activity")>()), selectedWorkspaceFolder: ref("/work/heidrun") };
});

/** One trace of Plotly.js: one part of each stacked bar. */
type Trace = { type: string; name: string; x: number[]; y: number[]; hoverinfo: string; marker: { color: string } };

/** What one call to `Plotly.react` drew. */
type Drawing = {
  data: Trace;
  traces: Trace[];
  layout: {
    barmode: string;
    showlegend: boolean;
    legend: { orientation: string; itemclick: unknown; itemdoubleclick: unknown };
    yaxis: { range?: number[]; autorange?: boolean; title: { text: string } };
    xaxis: { tickvals: number[]; ticktext: string[]; title: { text: string } };
  };
};

/** The one hour, in milliseconds. */
const HOUR_MS = 3_600_000;

/** The folder of the workspace that is open, and the folder of a workspace that is closed. */
const OPEN_FOLDER = "/work/heidrun";
const CLOSED_FOLDER = "/work/old_experiment";

/** Waits until the chart has called Plotly.js this number of times: the chart loads Plotly.js after it mounts. */
async function waitForDrawings(drawingCount: number): Promise<void> {
  await vi.waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(drawingCount));
}

/** The last drawing that the chart gave to Plotly.js. */
function lastDrawing(): Drawing {
  const call = plotly.react.mock.calls[plotly.react.mock.calls.length - 1];
  return { data: call[1][0], traces: call[1], layout: call[2] };
}

/** The sum of the heights of the bars of a drawing, with all the parts of the stacked bars. */
function sumOfBars(): number {
  return lastDrawing().traces.reduce((total, trace) => total + trace.y.reduce((sum, value) => sum + value, 0), 0);
}

/** A record of an active period that ended `startedAgoMs` ago and lasted `durationMs`, in one workspace. */
function recordOf(workspaceFolder: string, startedAgoMs: number, durationMs: number) {
  const startedAt = Date.now() - startedAgoMs;
  return {
    workspaceFolder,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(startedAt + durationMs).toISOString(),
  };
}

/**
 * Moves the pointer onto the bar of a slot, as Plotly.js tells the chart, and waits for the tooltip.
 *
 * @param slotIndex - The index of the slot, from the oldest slot.
 * @param pointer - The place of the pointer in the window, in pixels.
 */
async function hoverSlot(slotIndex: number, pointer = { x: 100, y: 50 }): Promise<void> {
  plotlyHandlers.plotly_hover({ points: [{ pointNumber: slotIndex }], event: { clientX: pointer.x, clientY: pointer.y } });
  await flushPromises();
}

/** The index of the first slot of the last drawing that has user activity time. */
function firstSlotWithTime(): number {
  return lastDrawing().traces.reduce((first, trace) => {
    const index = trace.y.findIndex((value) => value > 0);
    return index === -1 ? first : Math.min(first, index);
  }, Number.POSITIVE_INFINITY);
}

/** What the tooltip shows: the title, the total, and the name and the time of each workspace row. */
function tooltipOf(wrapper: VueWrapper) {
  const tooltip = wrapper.find('[role="tooltip"]');
  if (tooltip.exists() === false) {
    return null;
  }
  return {
    title: tooltip.get(".fw-semibold").text(),
    total: tooltip.get('[data-field="total"] span:last-child').text(),
    rows: tooltip.findAll('[data-field="workspace"]').map((row) => [row.element.children[0].textContent?.trim(), row.element.children[1].textContent]),
  };
}

/** The functions that the chart gave to the observer of its size. */
const resizeCallbacks: Array<() => void> = [];

/**
 * Mounts the tab with the records that the data layer gives, and one workspace that is open.
 *
 * @param records - The records that the data layer gives, or the error that it gives.
 * @param runningPeriodStartedAgoMs - How long ago the active period that runs now started, or `null` when no period runs.
 */
async function mountUserActivityTab(records: unknown[] | Error | Promise<never>, runningPeriodStartedAgoMs: number | null = null) {
  invoke.mockReset();
  if (records instanceof Error) {
    invoke.mockRejectedValue(records);
  } else if (records instanceof Promise) {
    invoke.mockReturnValue(records);
  } else {
    invoke.mockResolvedValue(records);
  }
  const { state } = await import("../stores/session");
  state.snapshot = {
    workspaces: [{ workspace_id: "w1", number: 1, label: "Heidrun app", worktree: { path: OPEN_FOLDER } }],
    tabs: [],
    panes: [],
    agents: [],
  } as never;
  const stores = await import("../stores/user_activity");
  stores.activePeriodStartedAt.value = runningPeriodStartedAgoMs === null ? null : Date.now() - runningPeriodStartedAgoMs;
  const { default: UserActivityTab } = await import("./UserActivityTab.vue");
  const wrapper = mount(UserActivityTab, { attachTo: document.body });
  await flushPromises();
  return { wrapper };
}

/** The buttons of a group of toggle buttons, with their text and their state. */
function buttonsOf(wrapper: VueWrapper, groupLabel: string) {
  const group = wrapper.get(`[role="group"][aria-label="${groupLabel}"]`);
  return group.findAll("label.btn-check").map((button) => ({
    text: button.text(),
    isChecked: (button.get("input").element as HTMLInputElement).checked,
    input: button.get("input"),
  }));
}

/** Clicks a radio button of the group of the slot length, and waits for the next drawing of the chart. */
async function chooseSlotLength(wrapper: VueWrapper, slotLengthId: string, drawingCount: number): Promise<void> {
  await wrapper.get(`#statistics-slot-${slotLengthId}`).setValue(true);
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
  for (const name of Object.keys(plotlyHandlers)) {
    delete plotlyHandlers[name];
  }
  plotly.react.mockReset();
  plotly.react.mockImplementation((element: { on?: unknown }) => {
    element.on = (name: string, callback: (event: unknown) => void) => {
      plotlyHandlers[name] = callback;
    };
  });
  plotly.purge.mockReset();
  document.body.innerHTML = "";
});

describe("UserActivityTab: the slot length", () => {
  it("has a Bootstrap radio button group of slot lengths for each time range, with the default slot length chosen", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    expect(buttonsOf(wrapper, "Slot length").map((button) => [button.text, button.isChecked])).toEqual([
      ["1 minute", false],
      ["5 minutes", true],
      ["10 minutes", false],
    ]);
    await wrapper.get("#statistics-range-day").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => [button.text, button.isChecked])).toEqual([
      ["15 minutes", false],
      ["30 minutes", false],
      ["1 hour", true],
    ]);
    await wrapper.get("#statistics-range-week").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => [button.text, button.isChecked])).toEqual([
      ["1 hour", false],
      ["6 hours", false],
      ["1 day", true],
    ]);
    for (const button of buttonsOf(wrapper, "Slot length")) {
      expect(button.input.attributes("type")).toBe("radio");
    }
  });

  it("draws sixty bars of one minute for the last hour, with a vertical axis in seconds from 0 to 60", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await chooseSlotLength(wrapper, "one_minute", 2);
    const drawing = lastDrawing();
    expect(drawing.data.x).toHaveLength(60);
    expect(drawing.layout.yaxis.range).toEqual([0, 60]);
    expect(drawing.layout.yaxis.title.text).toBe("Seconds of activity");
  });

  it("draws six bars of ten minutes for the last hour, with a vertical axis from 0 to 10 minutes", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await chooseSlotLength(wrapper, "ten_minutes", 2);
    expect(lastDrawing().data.x).toHaveLength(6);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 10]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Minutes of activity");
  });

  it("draws ninety-six bars of fifteen minutes and forty-eight bars of thirty minutes for the last day", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-day").setValue(true);
    await waitForDrawings(2);
    await chooseSlotLength(wrapper, "fifteen_minutes", 3);
    expect(lastDrawing().data.x).toHaveLength(96);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 15]);
    await chooseSlotLength(wrapper, "thirty_minutes", 4);
    expect(lastDrawing().data.x).toHaveLength(48);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 30]);
  });

  it("draws one hundred sixty-eight bars of one hour and twenty-eight bars of six hours for the last week", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await waitForDrawings(2);
    await chooseSlotLength(wrapper, "one_hour", 3);
    expect(lastDrawing().data.x).toHaveLength(168);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 60]);
    await chooseSlotLength(wrapper, "six_hours", 4);
    expect(lastDrawing().data.x).toHaveLength(28);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 6]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Hours of activity");
  });

  it("goes back to the default slot length of a time range each time that the time range changes", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await chooseSlotLength(wrapper, "one_minute", 2);
    await wrapper.get("#statistics-range-day").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => button.isChecked)).toEqual([false, false, true]);
    await waitForDrawings(3);
    expect(lastDrawing().data.x).toHaveLength(24);
    await wrapper.get("#statistics-range-hour").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => button.isChecked)).toEqual([false, true, false]);
    await waitForDrawings(4);
    expect(lastDrawing().data.x).toHaveLength(12);
  });

  it("gives the same total of user activity time to every slot length of the last hour", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(OPEN_FOLDER, 20 * 60_000, 4 * 60_000 + 30_000)]);
    await waitForDrawings(1);
    expect(sumOfBars()).toBeCloseTo(4.5, 5);
    await chooseSlotLength(wrapper, "ten_minutes", 2);
    expect(sumOfBars()).toBeCloseTo(4.5, 5);
    await chooseSlotLength(wrapper, "one_minute", 3);
    expect(sumOfBars() * 1000).toBeCloseTo(4.5 * 60 * 1000, 3);
  });

  it("labels the horizontal axis with at most thirteen labels, and labels the days of the last week with slots of one hour", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "one_hour", 3);
    const { tickvals, ticktext } = lastDrawing().layout.xaxis;
    expect(tickvals.length).toBeLessThanOrEqual(13);
    expect(tickvals).toHaveLength(ticktext.length);
    expect(tickvals.length).toBeGreaterThanOrEqual(6);
    expect(lastDrawing().layout.xaxis.title.text).toBe("Start of the slot");
  });

  it("writes the day and the clock in the tooltip of a slot of one hour of the last week, and the hours in the tooltip of a slot of six hours", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(OPEN_FOLDER, 2 * HOUR_MS, 30 * 60_000)]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "one_hour", 3);
    await hoverSlot(firstSlotWithTime());
    expect(tooltipOf(wrapper)?.title).toMatch(/^.+, .+ to .+$/);
    expect(tooltipOf(wrapper)?.total).toMatch(/^\d+ min \d+ s$/);
    await chooseSlotLength(wrapper, "six_hours", 4);
    await hoverSlot(firstSlotWithTime());
    expect(tooltipOf(wrapper)?.title).toMatch(/^.+ to .+$/);
    expect(tooltipOf(wrapper)?.total).toMatch(/^\d+ h \d+ min$/);
  });

  it("reads the data layer only once for all the choices, from the start of the oldest slot of any choice", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await chooseSlotLength(wrapper, "one_minute", 2);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "six_hours", 4);
    const calls = invoke.mock.calls.filter((call) => call[0] === "user_activity_records_in_range");
    expect(calls).toHaveLength(1);
    const { since, until } = calls[0][1] as { since: string; until: string };
    expect(Date.parse(until) - Date.parse(since)).toBeGreaterThanOrEqual(167 * HOUR_MS);
  });
});

describe("UserActivityTab: the workspaces", () => {
  const records = () => [
    recordOf(OPEN_FOLDER, 30 * 60_000, 3 * 60_000),
    recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000),
    recordOf(OPEN_FOLDER, 10 * 60_000, 60_000),
  ];

  it("has a Bootstrap checkbox button for All workspaces and for each workspace, all of them chosen at first", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    const buttons = buttonsOf(wrapper, "Workspaces");
    expect(buttons.map((button) => [button.text, button.isChecked])).toEqual([
      ["All workspaces", true],
      ["Heidrun app", true],
      ["old_experiment", true],
    ]);
    for (const button of buttons) {
      expect(button.input.attributes("type")).toBe("checkbox");
    }
    expect(wrapper.get("label[title*='/work/old_experiment']").text()).toBe("old_experiment");
  });

  it("shows the user activity time of every workspace at first, and only the chosen workspaces after a choice", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(sumOfBars()).toBeCloseTo(6, 5);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    await waitForDrawings(2);
    expect(sumOfBars()).toBeCloseTo(4, 5);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([false, true, false]);
    await wrapper.get("#statistics-workspace-1").setValue(true);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(4);
    expect(sumOfBars()).toBeCloseTo(2, 5);
  });

  it("shows no workspace when All workspaces is unchosen, and every workspace again when it is chosen", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-all").setValue(false);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([false, false, false]);
    expect(wrapper.text()).toContain("No workspace is chosen");
    expect(plotly.purge).toHaveBeenCalled();
    await wrapper.get("#statistics-workspace-all").setValue(true);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([true, true, true]);
    expect(wrapper.text()).not.toContain("No workspace is chosen");
    await waitForDrawings(2);
    expect(sumOfBars()).toBeCloseTo(6, 5);
  });

  it("chooses every workspace again when All workspaces is clicked while a workspace is hidden", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    expect(buttonsOf(wrapper, "Workspaces")[0].isChecked).toBe(false);
    await wrapper.get("#statistics-workspace-all").setValue(true);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([true, true, true]);
  });

  it("keeps the choice of the workspaces when the time range and the slot length change", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    await wrapper.get("#statistics-range-day").setValue(true);
    await chooseSlotLength(wrapper, "thirty_minutes", 4);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([false, true, false]);
    expect(sumOfBars()).toBeCloseTo(4, 5);
  });

  it("counts the running active period only while its workspace is chosen", async () => {
    const { wrapper } = await mountUserActivityTab(records(), 30_000);
    await waitForDrawings(1);
    expect(sumOfBars()).toBeCloseTo(6.5, 1);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(2);
    expect(sumOfBars()).toBeCloseTo(2, 5);
  });

  it("lists the workspace of the running active period even when it has no record", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000)], 30_000);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.text)).toEqual(["All workspaces", "Heidrun app", "old_experiment"]);
  });

  it("does not list the selected workspace when it has no record and no active period runs", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000)]);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.text)).toEqual(["All workspaces", "old_experiment"]);
  });

  it("has no button of workspace when there is no record and no running active period, and it still draws the chart", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    expect(wrapper.find('[role="group"][aria-label="Workspaces"]').exists()).toBe(false);
    expect(lastDrawing().data.x).toHaveLength(12);
  });

  it("shows an error message when the records cannot be read", async () => {
    const { wrapper } = await mountUserActivityTab(new Error("no data layer"));
    expect(wrapper.get(".alert-danger").text()).toContain("no data layer");
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("puts a busy wheel before the message while the user activity is read", async () => {
    const { wrapper } = await mountUserActivityTab(new Promise<never>(() => {}));
    const message = wrapper.get('[role="status"]');
    expect(message.text()).toBe("Reading the user activity…");
    expect(message.element.firstElementChild?.classList.contains("spinner-border")).toBe(true);
    expect(message.get(".spinner-border").attributes("aria-hidden")).toBe("true");
  });
});

describe("UserActivityTab: the stacked bars", () => {
  /** The length of a slot of the last hour at first: five minutes. */
  const SLOT_MS = 5 * 60_000;

  /** A record of an active period inside the slot before the current slot, so that no slot limit cuts it. */
  function recordInPreviousSlot(workspaceFolder: string, offsetInSeconds: number, durationInSeconds: number) {
    const currentSlotStartedAt = new Date();
    currentSlotStartedAt.setMinutes(Math.floor(currentSlotStartedAt.getMinutes() / 5) * 5, 0, 0);
    const startedAt = currentSlotStartedAt.getTime() - SLOT_MS + offsetInSeconds * 1000;
    return {
      workspaceFolder,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(startedAt + durationInSeconds * 1000).toISOString(),
    };
  }

  /** The records of two workspaces: "Heidrun app" has 4 minutes in total, and "old_experiment" has 2 minutes. */
  const records = () => [
    recordOf(OPEN_FOLDER, 30 * 60_000, 3 * 60_000),
    recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000),
    recordOf(OPEN_FOLDER, 10 * 60_000, 60_000),
  ];

  /** The sum of the heights of the parts of one trace of the last drawing. */
  function sumOfTrace(index: number): number {
    return lastDrawing().traces[index].y.reduce((total, value) => total + value, 0);
  }

  it("stacks the bars, with one part for each chosen workspace, and a legend", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.showlegend).toBe(true);
    expect(traces.map((trace) => trace.name)).toEqual(["Heidrun app", "old_experiment"]);
    expect(traces.every((trace) => trace.type === "bar" && trace.x.length === 12)).toBe(true);
    expect(sumOfTrace(0)).toBeCloseTo(4, 5);
    expect(sumOfTrace(1)).toBeCloseTo(2, 5);
  });

  it("gives each workspace its own color, in the order of the buttons", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(lastDrawing().traces.map((trace) => trace.marker.color)).toEqual(["--blue-500", "--orange-500"]);
  });

  it("keeps the color of a workspace when another workspace is hidden, and when the time range changes", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(2);
    expect(lastDrawing().traces.map((trace) => [trace.name, trace.marker.color])).toEqual([["old_experiment", "--orange-500"]]);
    await wrapper.get("#statistics-range-day").setValue(true);
    await waitForDrawings(3);
    expect(lastDrawing().traces.map((trace) => [trace.name, trace.marker.color])).toEqual([["old_experiment", "--orange-500"]]);
  });

  it("shows the color of each workspace on its button, and none on the button All workspaces", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    const dotOf = (title: string) => wrapper.find(`label[title*='${title}'] span[aria-hidden='true']`);
    expect(dotOf("/work/heidrun").attributes("style")).toContain("var(--blue-500)");
    expect(dotOf("/work/old_experiment").attributes("style")).toContain("var(--orange-500)");
    expect(wrapper.find("label[title*='every workspace'] span[aria-hidden='true']").exists()).toBe(false);
  });

  it("keeps the color on the button of a workspace that is hidden", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await wrapper.get("#statistics-workspace-1").setValue(false);
    expect(wrapper.get("label[title*='/work/old_experiment'] span[aria-hidden='true']").attributes("style")).toContain("var(--orange-500)");
  });

  it("draws one part with the user activity time of the only workspace", async () => {
    await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)]);
    await waitForDrawings(1);
    const { traces } = lastDrawing();
    expect(traces).toHaveLength(1);
    expect(traces[0].marker.color).toBe("--blue-500");
    expect(sumOfTrace(0)).toBeCloseTo(1.5, 5);
  });

  it("draws one part of height 0 for each slot when there is no workspace", async () => {
    await mountUserActivityTab([]);
    await waitForDrawings(1);
    const { traces } = lastDrawing();
    expect(traces).toHaveLength(1);
    expect(traces[0].y).toEqual(new Array(12).fill(0));
  });

  it("gives the legend of the colors above the bars, and no way to hide a part from the legend", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    const { layout, traces } = lastDrawing();
    expect(layout.showlegend).toBe(true);
    expect(layout.legend.orientation).toBe("h");
    expect(layout.legend.itemclick).toBe(false);
    expect(layout.legend.itemdoubleclick).toBe(false);
    expect(traces.map((trace) => trace.name)).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("gives no legend when there is no workspace", async () => {
    await mountUserActivityTab([]);
    await waitForDrawings(1);
    expect(lastDrawing().layout.showlegend).toBe(false);
  });

  it("turns off the tooltip of Plotly.js, because the tooltip is HTML of the page", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(lastDrawing().traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(Object.keys(plotlyHandlers).sort()).toEqual(["plotly_hover", "plotly_unhover"]);
  });

  it("shows no tooltip until the pointer is over a bar", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(tooltipOf(wrapper)).toBeNull();
  });

  it("shows the title and the total in the tooltip of a slot of the only workspace, and no row", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)]);
    await waitForDrawings(1);
    await hoverSlot(10);
    const tooltip = tooltipOf(wrapper);
    expect(tooltip?.title).toMatch(/^.+ to .+$/);
    expect(tooltip?.total).toBe("1 min 30 s");
    expect(tooltip?.rows).toEqual([]);
  });

  it("shows one row for each workspace that has time in the slot, with the total above the rows", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(10);
    const tooltip = tooltipOf(wrapper);
    expect(tooltip?.total).toBe("2 min 0 s");
    expect(tooltip?.rows).toEqual([
      ["Heidrun app", "1 min 30 s"],
      ["old_experiment", "0 min 30 s"],
    ]);
  });

  it("shows the color of each workspace in the rows of the tooltip", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(10);
    const dots = wrapper.findAll('[role="tooltip"] [data-field="workspace"] span[aria-hidden="true"]');
    expect(dots.map((dot) => dot.attributes("style"))).toEqual([
      expect.stringContaining("var(--blue-500)"),
      expect.stringContaining("var(--orange-500)"),
    ]);
  });

  it("leaves a workspace out of the rows of a slot where it has no time", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordOf(CLOSED_FOLDER, 40 * 60_000, 30_000)]);
    await waitForDrawings(1);
    await hoverSlot(10);
    expect(tooltipOf(wrapper)?.rows).toEqual([["Heidrun app", "1 min 30 s"]]);
  });

  it("shows a total of 0 min 0 s, and no row, for a slot with no time", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(9);
    expect(tooltipOf(wrapper)?.total).toBe("0 min 0 s");
    expect(tooltipOf(wrapper)?.rows).toEqual([]);
  });

  it("writes the time of each workspace in hours and minutes in the tooltip of a slot of six hours", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "six_hours", 3);
    await hoverSlot(firstSlotWithTime());
    const tooltip = tooltipOf(wrapper);
    expect(tooltip?.total).toMatch(/^\d+ h \d+ min$/);
    expect(tooltip?.rows.map((row) => row[0])).toEqual(["Heidrun app", "old_experiment"]);
    expect(tooltip?.rows.every((row) => /^\d+ h \d+ min$/.test(row[1] ?? ""))).toBe(true);
  });

  it("writes the name of a workspace as text, so a sign '<' of a folder does not make markup, in the tooltip and in the legend", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot("/work/a<b>&c", 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(10);
    expect(tooltipOf(wrapper)?.rows[0][0]).toBe("a<b>&c");
    expect(wrapper.find('[role="tooltip"] a').exists()).toBe(false);
    expect(lastDrawing().traces[0].name).toBe("a&lt;b&gt;&amp;c");
  });

  it("hides the tooltip when the pointer leaves the bar, and when the time range changes", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)]);
    await waitForDrawings(1);
    await hoverSlot(10);
    expect(tooltipOf(wrapper)).not.toBeNull();
    plotlyHandlers.plotly_unhover({});
    await flushPromises();
    expect(tooltipOf(wrapper)).toBeNull();
    await hoverSlot(10);
    await wrapper.get("#statistics-range-day").setValue(true);
    await waitForDrawings(2);
    await flushPromises();
    expect(tooltipOf(wrapper)).toBeNull();
  });

  it("puts the tooltip beside the column, on the side that has room, with an arrow at the height of the pointer", async () => {
    const box = { left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) };
    const boxSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(box);
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)]);
    await waitForDrawings(1);
    await hoverSlot(10, { x: 100, y: 50 });
    const rightColumn = wrapper.get('[role="tooltip"]');
    expect(rightColumn.classes()).toContain("bs-popover-start");
    expect(rightColumn.classes()).not.toContain("bs-popover-end");
    expect(rightColumn.attributes("style")).toContain("right: calc(");
    expect(rightColumn.attributes("style")).not.toContain("left:");
    expect(rightColumn.attributes("style")).toContain("top: 50px");
    expect(rightColumn.attributes("style")).toContain("pointer-events: none");
    expect(rightColumn.get(".popover-arrow").attributes("style")).toContain("top:");
    await hoverSlot(1, { x: 350, y: 250 });
    const leftColumn = wrapper.get('[role="tooltip"]');
    expect(leftColumn.classes()).toContain("bs-popover-end");
    expect(leftColumn.classes()).not.toContain("bs-popover-start");
    expect(leftColumn.attributes("style")).toContain("left: calc(");
    expect(leftColumn.attributes("style")).not.toContain("right:");
    expect(leftColumn.attributes("style")).toContain("top: 250px");
    boxSpy.mockRestore();
  });
});
