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

/** The workspace that runs the active period is the selected workspace: the test selects the folder of a workspace. */
vi.mock("../stores/user_activity", async (importOriginal) => {
  const { ref } = await import("vue");
  return { ...(await importOriginal<typeof import("../stores/user_activity")>()), selectedWorkspaceFolder: ref("/work/heidrun") };
});

/** What one call to `Plotly.react` drew. */
type Drawing = {
  data: { type: string; x: number[]; y: number[]; customdata: string[] };
  layout: {
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
  return { data: call[1][0], layout: call[2] };
}

/** The sum of the heights of the bars of a drawing. */
function sumOfBars(): number {
  return lastDrawing().data.y.reduce((total, value) => total + value, 0);
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

/** The functions that the chart gave to the observer of its size. */
const resizeCallbacks: Array<() => void> = [];

/**
 * Mounts the tab with the records that the data layer gives, and one workspace that is open.
 *
 * @param records - The records that the data layer gives, or the error that it gives.
 * @param runningPeriodStartedAgoMs - How long ago the active period that runs now started, or `null` when no period runs.
 */
async function mountUserActivityTab(records: unknown[] | Error, runningPeriodStartedAgoMs: number | null = null) {
  invoke.mockReset();
  if (records instanceof Error) {
    invoke.mockRejectedValue(records);
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
  plotly.react.mockReset();
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
    const hourTooltips = lastDrawing().data.customdata;
    expect(hourTooltips).toHaveLength(168);
    expect(hourTooltips.every((tooltip) => /^.+, .+ to .+: \d+ min \d+ s$/.test(tooltip))).toBe(true);
    await chooseSlotLength(wrapper, "six_hours", 4);
    expect(lastDrawing().data.customdata.every((tooltip) => /^.+ to .+: \d+ h \d+ min$/.test(tooltip))).toBe(true);
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
});
