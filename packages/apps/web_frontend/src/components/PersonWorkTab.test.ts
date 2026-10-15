import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { AiCostItems } from "../lib/ai_cost";
import type { PersonWorkItems } from "../lib/person_work";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The calls that the chart makes to Plotly.js: jsdom cannot draw an SVG chart, so Plotly.js is replaced. */
const plotly = { react: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } };
vi.mock("plotly.js-basic-dist-min", () => ({ default: plotly }));

/** The tab reads the repository of the selected workspace: the test chooses the folder of the workspace. */
vi.mock("../stores/user_activity", async () => {
  const { ref } = await import("vue");
  return { selectedWorkspaceFolder: ref<string | null>("/work/heidrun") };
});

/** Chooses the folder of the selected workspace. The module of the store is replaced by a plain reference that the test can set. */
async function selectFolder(folder: string | null): Promise<void> {
  const { selectedWorkspaceFolder } = await import("../stores/user_activity");
  (selectedWorkspaceFolder as unknown as { value: string | null }).value = folder;
}

/** The functions that the chart registered for the events of Plotly.js, by the name of the event. */
const plotlyHandlers: Record<string, (event: unknown) => void> = {};

/** What one call to `Plotly.react` drew: the two bar traces, and the layout. */
type Drawing = {
  traces: Array<{ name: string; x: string[]; y: number[]; hoverinfo: string; marker: { color: string } }>;
  layout: {
    barmode: string;
    title: { text: string };
    yaxis: { dtick?: number; tickprefix?: string };
    legend: { orientation: string; x: number; y: number };
  };
};

/** Waits until the chart has called Plotly.js this number of times: the chart loads Plotly.js after it mounts. */
async function waitForDrawings(drawingCount: number): Promise<void> {
  await vi.waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(drawingCount));
}

/** The last drawing that the chart gave to Plotly.js. */
function lastDrawing(): Drawing {
  const call = plotly.react.mock.calls[plotly.react.mock.calls.length - 1];
  return { traces: call[1], layout: call[2] };
}

/**
 * Moves the pointer onto the bar of a day, as Plotly.js tells the chart, and waits for the chart information card.
 *
 * @param dayIndex - The index of the day, from the oldest day.
 */
async function hoverDay(dayIndex: number): Promise<void> {
  plotlyHandlers.plotly_hover({ points: [{ pointNumber: dayIndex }], event: { clientX: 100, clientY: 50 } });
  await flushPromises();
}

/** What the chart information card shows: the title, the total or `null`, and the name and the value of each row. */
function cardOf(wrapper: VueWrapper) {
  const card = wrapper.find('[role="tooltip"]');
  if (card.exists() === false) {
    return null;
  }
  const total = card.find('[data-field="total"] span:last-child');
  return {
    title: card.get(".fw-semibold").text(),
    total: total.exists() ? total.text() : null,
    rows: card.findAll('[data-field="row"]').map((row) => [row.element.children[0].textContent?.trim(), row.element.children[1].textContent]),
  };
}

/** A time at 12:00 of the clock of the computer, `daysAgo` days before today, as an ISO 8601 text. */
function daysAgo(daysAgo: number): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, 12).toISOString();
}

/** Jérôme has three commits, one pull request, and two issues. Eric has one commit and one issue. */
function sampleItems(): PersonWorkItems {
  const jerome = { authorName: "Jerome Etienne", authorEmail: "jerome@example.com" };
  return {
    repository: "heidrun-org/heidrun",
    commits: [
      { ...jerome, committedAt: daysAgo(3) },
      { ...jerome, committedAt: daysAgo(0) },
      { ...jerome, committedAt: daysAgo(0) },
      { authorName: "Eric", authorEmail: "eric@example.com", committedAt: daysAgo(0) },
    ],
    pullRequests: [{ author: "jeromeetienne", createdAt: daysAgo(0) }],
    issues: [
      { author: "jeromeetienne", createdAt: daysAgo(0) },
      { author: "jeromeetienne", createdAt: daysAgo(10) },
      { author: "eric", createdAt: daysAgo(1) },
    ],
    codeHostingError: null,
  };
}

/**
 * Four chats: a chat of Claude Code that lasts two days (2.5 yesterday and 1.5 today), a chat of Claude Code of ten days ago
 * (3), a chat of Codex that costs 0.5 two days ago, and a chat of Codex of yesterday that has no known price.
 */
function sampleAiCostItems(): AiCostItems {
  return {
    chats: [
      { codingAgent: "claude", hours: [{ at: daysAgo(10), costUsd: 3 }] },
      { codingAgent: "codex", hours: [{ at: daysAgo(2), costUsd: 0.5 }] },
      {
        codingAgent: "claude",
        hours: [
          { at: daysAgo(1), costUsd: 2.5 },
          { at: daysAgo(0), costUsd: 1.5 },
        ],
      },
      { codingAgent: "codex", hours: [{ at: daysAgo(1), costUsd: null }] },
    ],
  };
}

/** Mounts the tab with the items that the commands give, or with an error. A promise that never ends keeps a read pending. */
async function mountPersonWorkTab(
  result: PersonWorkItems | Error | Promise<never> = sampleItems(),
  aiCost: AiCostItems | Error | Promise<never> = sampleAiCostItems(),
) {
  invoke.mockReset();
  invoke.mockImplementation(async (command: string) => {
    if (command === "person_work_in_range") {
      return result instanceof Error ? Promise.reject(result) : result;
    }
    if (command === "ai_cost_in_range") {
      return aiCost instanceof Error ? Promise.reject(aiCost) : aiCost;
    }
    return undefined;
  });
  const { default: PersonWorkTab } = await import("./PersonWorkTab.vue");
  const wrapper = mount(PersonWorkTab, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

/** The calls that asked the data layer for the work of the people: the other stores also call `invoke` when they load. */
function personWorkCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "person_work_in_range");
}

/** The calls that asked the data layer for the AI cost. */
function aiCostCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "ai_cost_in_range");
}

/** The texts and the states of the buttons of the radio button group that has this name. */
function radioGroup(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>, name: string) {
  const inputs = wrapper.findAll(`input[name="${name}"]`);
  return {
    texts: inputs.map((input) => input.element.closest("label")?.textContent?.trim()),
    checked: inputs.map((input) => (input.element as HTMLInputElement).checked),
    classes: inputs.map((input) => input.element.closest("label")?.className ?? ""),
  };
}

/** Chooses the source AI cost, and waits for the tab to read the chats. */
async function chooseAiCost(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): Promise<void> {
  await wrapper.get("#statistics-person-source-ai_cost").setValue(true);
  await flushPromises();
}

/** The totals of the AI cost under the chooser: Claude Code, Codex, and the two together. */
function aiCostTotalsOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return ["claude", "codex", "total"].map((id) => wrapper.get(`[data-total="${id}"] .fs-4`).text());
}

/** The three totals under the chooser: the commits, the pull requests, and the issues. */
function totalsOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return ["commits", "pull-requests", "issues"].map((id) => wrapper.get(`[data-total="${id}"] .fs-4`).text());
}

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  await selectFolder("/work/heidrun");
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {} }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
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

describe("PersonWorkTab", () => {
  it("reads the repository of the selected workspace for the last 30 days, through the data layer", async () => {
    await mountPersonWorkTab();
    expect(personWorkCalls()).toHaveLength(1);
    const parameters = personWorkCalls()[0][1] as { folder: string; since: string; until: string };
    expect(parameters.folder).toBe("/work/heidrun");
    const days = (Date.parse(parameters.until) - Date.parse(parameters.since)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(29.9);
    expect(days).toBeLessThanOrEqual(30.1);
  });

  it("chooses the person with the most items at first, and lists every person in the chooser", async () => {
    const wrapper = await mountPersonWorkTab();
    const select = wrapper.get("#statistics-person");
    expect((select.element as HTMLSelectElement).value).toBe("jeromeetienne");
    expect(select.findAll("option").map((option) => option.text())).toEqual(["Jerome Etienne", "Eric"]);
  });

  it("has a Bootstrap radio button group of the time range, with Last 7 days chosen at first", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = radioGroup(wrapper, "statistics-person-period");
    expect(group.texts).toEqual(["Last 7 days", "Last 30 days"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
  });

  it("has a Bootstrap radio button group of the source, with Git history chosen at first", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = radioGroup(wrapper, "statistics-person-source");
    expect(group.texts).toEqual(["Git history", "AI cost"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
  });

  it("shows the number of commits, of pull requests, and of issues of the person in the time range", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1"]);
    expect(wrapper.get('[data-total="commits"]').text()).toContain("Commits");
    expect(wrapper.get('[data-total="pull-requests"]').text()).toContain("Pull requests");
    expect(wrapper.get('[data-total="issues"]').text()).toContain("Issues");
  });

  it("draws one stacked bar for each day: the commits below, and the pull requests above", async () => {
    await mountPersonWorkTab();
    await waitForDrawings(1);
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.title.text).toBe("Jerome Etienne: commits and pull requests of each day");
    expect(traces.map((trace) => trace.name)).toEqual(["Commits", "Pull requests"]);
    expect(traces[0].x).toHaveLength(7);
    expect(traces[0].y).toEqual([0, 0, 0, 1, 0, 0, 2]);
    expect(traces[1].y).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(traces[0].marker.color).not.toBe(traces[1].marker.color);
    expect(traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(layout.yaxis.dtick).toBe(1);
  });

  it("shows a legend above the bars, and turns off the tooltip of Plotly.js", async () => {
    await mountPersonWorkTab();
    await waitForDrawings(1);
    const { layout } = lastDrawing();
    expect(layout.legend).toMatchObject({ orientation: "h", y: 1.1 });
    expect(Object.keys(plotlyHandlers).sort()).toEqual(["plotly_hover", "plotly_unhover"]);
  });

  it("shows no chart information card until the pointer is over a bar", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    expect(cardOf(wrapper)).toBeNull();
  });

  it("shows the day, and the commits and the pull requests of the day, in the chart information card, with no total", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await hoverDay(6);
    const card = cardOf(wrapper);
    expect(card?.title).not.toBe("");
    expect(card?.total).toBeNull();
    expect(card?.rows).toEqual([
      ["Commits", "2"],
      ["Pull requests", "1"],
    ]);
    expect(wrapper.findAll('[role="tooltip"] [data-field="row"] span[aria-hidden="true"]').map((dot) => dot.attributes("style"))).toEqual([
      expect.stringContaining("var(--primary-bg)"),
      expect.stringContaining("var(--success-bg)"),
    ]);
  });

  it("leaves a color out of the chart information card of a day where it has no value, and hides the card when the pointer leaves", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await hoverDay(3);
    expect(cardOf(wrapper)?.rows).toEqual([["Commits", "1"]]);
    plotlyHandlers.plotly_unhover({});
    await flushPromises();
    expect(cardOf(wrapper)).toBeNull();
  });

  it("draws thirty bars and counts the older issues when Last 30 days is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await waitForDrawings(2);
    expect(lastDrawing().traces[0].x).toHaveLength(30);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("draws the work of another person when the person changes, without reading again", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person").setValue("eric");
    await waitForDrawings(2);
    expect(lastDrawing().layout.title.text).toBe("Eric: commits and pull requests of each day");
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(totalsOf(wrapper)).toEqual(["1", "0", "1"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("tells that GitHub cannot be read, and still draws the commits", async () => {
    const wrapper = await mountPersonWorkTab({ ...sampleItems(), codeHostingError: "no network" });
    await waitForDrawings(1);
    const alert = wrapper.get(".alert.theme-warning");
    expect(alert.text()).toContain("GitHub cannot be read");
    expect(alert.text()).toContain("no network");
    expect(totalsOf(wrapper)[0]).toBe("3");
  });

  it("shows an error message when the work cannot be read", async () => {
    const wrapper = await mountPersonWorkTab(new Error("git failed"));
    expect(wrapper.get(".alert.theme-danger").text()).toContain("git failed");
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("tells that no workspace is selected, and reads nothing", async () => {
    await selectFolder(null);
    const wrapper = await mountPersonWorkTab();
    expect(wrapper.text()).toContain("No workspace is selected");
    expect(personWorkCalls()).toHaveLength(0);
  });

  it("tells that there is no work when the repository has no item in the time range", async () => {
    const wrapper = await mountPersonWorkTab({ ...sampleItems(), commits: [], pullRequests: [], issues: [] });
    expect(wrapper.text()).toContain("No commit, no pull request, and no issue");
    expect(wrapper.find("#statistics-person").exists()).toBe(false);
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("does not read the chats before the source AI cost is chosen", async () => {
    await mountPersonWorkTab();
    expect(aiCostCalls()).toHaveLength(0);
  });

  it("reads the chats of the repository for the last 30 days once, the first time that the source AI cost is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostCalls()).toHaveLength(1);
    const parameters = aiCostCalls()[0][1] as { folder: string; since: string; until: string };
    expect(parameters.folder).toBe("/work/heidrun");
    const days = (Date.parse(parameters.until) - Date.parse(parameters.since)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(29.9);
    expect(days).toBeLessThanOrEqual(30.1);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    await chooseAiCost(wrapper);
    expect(aiCostCalls()).toHaveLength(1);
  });

  it("shows the cost of each coding agent and the total in the time range", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
    expect(wrapper.get('[data-total="claude"]').text()).toContain("Claude Code");
    expect(wrapper.get('[data-total="codex"]').text()).toContain("Codex");
    expect(wrapper.get('[data-total="total"]').text()).toContain("Total");
  });

  it("draws one stacked bar for each day, with one color for each coding agent, in dollars", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.title.text).toBe("AI cost of each day, for each coding agent");
    expect(layout.yaxis.tickprefix).toBe("$");
    expect(layout.yaxis.dtick).toBeUndefined();
    expect(traces.map((trace) => trace.name)).toEqual(["Claude Code", "Codex"]);
    expect(traces[0].x).toHaveLength(7);
    expect(traces[0].y).toEqual([0, 0, 0, 0, 0, 2.5, 1.5]);
    expect(traces[1].y).toEqual([0, 0, 0, 0, 0.5, 0, 0]);
    expect(traces[0].marker.color).not.toBe(traces[1].marker.color);
    expect(traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(lastDrawing().layout.legend).toMatchObject({ orientation: "h", y: 1.1 });
  });

  it("shows the day, the total, and the cost of each coding agent that has a cost, in the chart information card", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await hoverDay(5);
    expect(cardOf(wrapper)?.total).toBe("$2.50");
    expect(cardOf(wrapper)?.rows).toEqual([["Claude Code", "$2.50"]]);
    await hoverDay(4);
    expect(cardOf(wrapper)?.total).toBe("$0.50");
    expect(cardOf(wrapper)?.rows).toEqual([["Codex", "$0.50"]]);
    await hoverDay(0);
    expect(cardOf(wrapper)?.total).toBe("$0.00");
    expect(cardOf(wrapper)?.rows).toEqual([]);
  });

  it("draws thirty bars and counts the older chats when Last 30 days is chosen with the source AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().traces[0].x).toHaveLength(30));
    expect(aiCostTotalsOf(wrapper)).toEqual(["$7.00", "$0.50", "$7.50"]);
    expect(aiCostCalls()).toHaveLength(1);
  });

  it("keeps the time range when the source changes, and hides the person chooser for the source AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await chooseAiCost(wrapper);
    expect(radioGroup(wrapper, "statistics-person-period").checked).toEqual([false, true]);
    expect(wrapper.find("#statistics-person").exists()).toBe(false);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(wrapper.find("#statistics-person").exists()).toBe(true);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2"]);
  });

  it("tells how many chats have no known price", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.get('[data-note="without-price"]').text()).toBe(
      "1 chat is not counted in the cost, because one of its models has no known price.",
    );
  });

  it("does not tell about the chats with no known price when every chat has a price", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), { chats: [{ codingAgent: "claude", hours: [{ at: daysAgo(0), costUsd: 1 }] }] });
    await chooseAiCost(wrapper);
    expect(wrapper.find('[data-note="without-price"]').exists()).toBe(false);
  });

  it("tells that no chat used tokens, and draws no chart, when the time range has no chat", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), { chats: [] });
    await chooseAiCost(wrapper);
    expect(wrapper.text()).toContain("No chat of a coding agent used tokens in the last 30 days.");
    expect(aiCostTotalsOf(wrapper)).toEqual(["$0.00", "$0.00", "$0.00"]);
    expect(plotly.react).toHaveBeenCalledTimes(1);
  });

  it("tells that the chats are read while the read lasts", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), new Promise<never>(() => {}));
    await chooseAiCost(wrapper);
    expect(wrapper.text()).toContain("Reading the chats of the coding agents…");
    expect(wrapper.find('[data-total="claude"]').exists()).toBe(false);
    const message = wrapper.get('[role="status"]');
    expect(message.element.firstElementChild?.classList.contains("spinner-border")).toBe(true);
    expect(message.get(".spinner-border").attributes("aria-hidden")).toBe("true");
  });

  it("puts a busy wheel before the message while the commits, the pull requests, and the issues are read", async () => {
    const wrapper = await mountPersonWorkTab(new Promise<never>(() => {}));
    const message = wrapper.get('[role="status"]');
    expect(message.text()).toBe("Reading the commits, the pull requests, and the issues…");
    expect(message.element.firstElementChild?.classList.contains("spinner-border")).toBe(true);
    expect(message.get(".spinner-border").attributes("aria-hidden")).toBe("true");
  });

  it("shows an error message when the chats cannot be read, and the Git history stays available", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), new Error("scan failed"));
    await chooseAiCost(wrapper);
    expect(wrapper.get(".alert.theme-danger").text()).toContain("scan failed");
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(wrapper.find(".alert.theme-danger").exists()).toBe(false);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1"]);
  });
});
