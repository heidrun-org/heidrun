import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** A workspace that is open in the test, as the store gives it. */
type TestWorkspace = { workspaceId: string; label: string; folder: string };

/** The tab reads the repository of an open workspace: the test chooses the open workspaces and the selected workspace. */
vi.mock("../stores/user_activity", async () => {
  const { ref } = await import("vue");
  return { selectedWorkspaceId: ref<string | null>(null), openWorkspaces: ref<TestWorkspace[]>([]) };
});

/** The two workspaces that are open at the start of each test. The first one is selected. */
const WORKSPACES: TestWorkspace[] = [
  { workspaceId: "workspace-heidrun", label: "heidrun", folder: "/work/heidrun" },
  { workspaceId: "workspace-mobile", label: "mobile", folder: "/work/mobile" },
];

/**
 * Chooses the workspaces that are open, and the selected workspace. The module of the store is replaced by plain references
 * that the test can set.
 *
 * @param workspaces - The workspaces that are open.
 * @param selectedId - The identifier of the selected workspace, or `null` when no workspace is selected.
 */
async function openWorkspacesAre(workspaces: TestWorkspace[], selectedId: string | null = workspaces[0]?.workspaceId ?? null): Promise<void> {
  const store = await import("../stores/user_activity");
  (store.openWorkspaces as unknown as { value: TestWorkspace[] }).value = workspaces;
  (store.selectedWorkspaceId as unknown as { value: string | null }).value = selectedId;
}

/** The functions that the chart registered for the events of Plotly.js, by the name of the event. */
const plotlyHandlers: Record<string, (event: unknown) => void> = {};

/** What one call to `Plotly.react` drew: the two bar traces, and the layout. */
type Drawing = {
  traces: Array<{ name: string; x: string[]; y: number[]; hoverinfo: string; marker: { color: string } }>;
  layout: {
    barmode: string;
    title: { text: string };
    yaxis: { dtick?: number; tickprefix?: string; ticksuffix?: string };
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

/**
 * Jérôme has three commits (18 lines added and 6 lines deleted), one pull request, and two issues. Eric has one commit
 * (7 lines added and no line deleted) and one issue.
 */
function sampleItems(): PersonWorkItems {
  const jerome = { authorName: "Jerome Etienne", authorEmail: "jerome@example.com" };
  return {
    repository: "heidrun-org/heidrun",
    commits: [
      { ...jerome, committedAt: daysAgo(3), insertions: 10, deletions: 2 },
      { ...jerome, committedAt: daysAgo(0), insertions: 5, deletions: 1 },
      { ...jerome, committedAt: daysAgo(0), insertions: 3, deletions: 3 },
      { authorName: "Eric", authorEmail: "eric@example.com", committedAt: daysAgo(0), insertions: 7, deletions: 0 },
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
 * Four chats: a chat of Claude Code that lasts two days (2.5 dollars and 25,000 tokens yesterday, and 1.5 dollars and 15,000
 * tokens today), a chat of Claude Code of ten days ago (3 dollars and 30,000 tokens), a chat of Codex that costs 0.5 dollars
 * and used 5,000 tokens two days ago, and a chat of Codex of yesterday that has no known price and used 20,000 tokens.
 */
function sampleAiCostItems(): AiCostItems {
  return {
    chats: [
      { id: "chat-1", codingAgent: "claude", hours: [{ at: daysAgo(10), costUsd: 3, tokens: 30_000 }] },
      { id: "chat-2", codingAgent: "codex", hours: [{ at: daysAgo(2), costUsd: 0.5, tokens: 5_000 }] },
      {
        id: "chat-3",
        codingAgent: "claude",
        hours: [
          { at: daysAgo(1), costUsd: 2.5, tokens: 25_000 },
          { at: daysAgo(0), costUsd: 1.5, tokens: 15_000 },
        ],
      },
      { id: "chat-4", codingAgent: "codex", hours: [{ at: daysAgo(1), costUsd: null, tokens: 20_000 }] },
    ],
  };
}

/**
 * The tabs that the tests of this file mounted. The tab watches the store of the workspaces, and the test replaces the store
 * by plain references that every test shares, so a tab that stays mounted reads again when the next test changes them.
 */
const mountedTabs: VueWrapper[] = [];

/** Mounts the tab with the items that the commands give, or with an error. A promise that never ends keeps a read pending. */
async function mountPersonWorkTab(
  result: PersonWorkItems | Error | Promise<PersonWorkItems> = sampleItems(),
  aiCost: AiCostItems | Error | Promise<AiCostItems> = sampleAiCostItems(),
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
  mountedTabs.push(wrapper);
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

/** The identifiers of the totals of the Git history under the chooser, from left to right. */
const GIT_HISTORY_TOTAL_IDS = ["commits", "pull-requests", "issues", "lines-added", "lines-deleted"];

/** The totals under the chooser: the commits, the pull requests, the issues, the lines added, and the lines deleted. */
function totalsOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return GIT_HISTORY_TOTAL_IDS.map((id) => wrapper.get(`[data-total="${id}"] .fs-4`).text());
}

/** The average per day under each total of the Git history, from left to right. */
function perDayOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return GIT_HISTORY_TOTAL_IDS.map((id) => wrapper.get(`[data-total="${id}"] [data-per-day]`).text());
}

/** The average per day under each total of the AI cost, from left to right. */
function aiCostPerDayOf(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return ["claude", "codex", "total"].map((id) => wrapper.get(`[data-total="${id}"] [data-per-day]`).text());
}

/** The commits, the pull requests, and the issues of the second workspace, a repository that is not the first one. */
function mobileItems(): PersonWorkItems {
  return {
    repository: "heidrun-org/mobile",
    commits: [{ authorName: "Jerome Etienne", authorEmail: "jerome@example.com", committedAt: daysAgo(1), insertions: 40, deletions: 4 }],
    pullRequests: [{ author: "jeromeetienne", createdAt: daysAgo(2) }],
    issues: [],
    codeHostingError: null,
  };
}

/** The chats of the second workspace: a chat of Codex that costs 9 dollars and used 90,000 tokens today. */
function mobileAiCostItems(): AiCostItems {
  return { chats: [{ id: "mobile-1", codingAgent: "codex", hours: [{ at: daysAgo(0), costUsd: 9, tokens: 90_000 }] }] };
}

/** Makes the two commands answer with the data of each folder. A folder that the answers do not hold gives an error. */
function answerByFolder(answers: Record<string, { gitHistory: PersonWorkItems | Error; aiCost: AiCostItems | Error }>): void {
  invoke.mockImplementation(async (command: string, parameters: { folder: string }) => {
    const answer = answers[parameters?.folder]?.[command === "person_work_in_range" ? "gitHistory" : "aiCost"];
    if (command !== "person_work_in_range" && command !== "ai_cost_in_range") {
      return undefined;
    }
    if (answer === undefined) {
      throw new Error(`no answer for ${parameters?.folder}`);
    }
    return answer instanceof Error ? Promise.reject(answer) : answer;
  });
}

/** The checkbox of a workspace, in the buttons of the workspaces. */
function workspaceBox(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>, workspaceId: string) {
  return wrapper.get(`#statistics-person-workspace-${workspaceId}`);
}

/** Chooses or drops a workspace, and waits for the reads. */
async function chooseWorkspace(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>, workspaceId: string, isChosen: boolean): Promise<void> {
  await workspaceBox(wrapper, workspaceId).setValue(isChosen);
  await flushPromises();
}

/** The names of the workspaces that are chosen, in the order of the buttons. */
function chosenWorkspaceNames(wrapper: Awaited<ReturnType<typeof mountPersonWorkTab>>): string[] {
  return wrapper
    .findAll('input[id^="statistics-person-workspace-workspace-"]')
    .filter((input) => (input.element as HTMLInputElement).checked)
    .map((input) => input.element.closest("label")?.textContent?.trim() ?? "");
}

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  await openWorkspacesAre(WORKSPACES);
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

afterEach(() => {
  for (const wrapper of mountedTabs.splice(0)) {
    wrapper.unmount();
  }
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
    expect(totalsOf(wrapper).slice(0, 3)).toEqual(["3", "1", "1"]);
    expect(wrapper.get('[data-total="commits"]').text()).toContain("Commits");
    expect(wrapper.get('[data-total="pull-requests"]').text()).toContain("Pull requests");
    expect(wrapper.get('[data-total="issues"]').text()).toContain("Issues");
  });

  it("shows the lines added and the lines deleted by the commits of the person in the time range", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(totalsOf(wrapper).slice(3)).toEqual(["18", "6"]);
    expect(wrapper.get('[data-total="lines-added"]').text()).toContain("Lines added");
    expect(wrapper.get('[data-total="lines-deleted"]').text()).toContain("Lines deleted");
  });

  it("shows the average per day under each total of the Git history, for 7 days and for 30 days", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(perDayOf(wrapper)).toEqual(["0.43 per day", "0.14 per day", "0.14 per day", "2.6 per day", "0.86 per day"]);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(perDayOf(wrapper)).toEqual(["0.1 per day", "0.03 per day", "0.07 per day", "0.6 per day", "0.2 per day"]);
  });

  it("changes the totals and the averages when the person changes", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person").setValue("eric");
    expect(totalsOf(wrapper).slice(3)).toEqual(["7", "0"]);
    expect(perDayOf(wrapper)[3]).toBe("1 per day");
    expect(perDayOf(wrapper)[4]).toBe("0 per day");
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

  it("has a radio button group of the metric of the Git history, with the commits and the pull requests chosen at first, for the source Git history only", async () => {
    const wrapper = await mountPersonWorkTab();
    const group = radioGroup(wrapper, "statistics-person-metric");
    expect(group.texts).toEqual(["Commits and pull requests", "Lines added and lines deleted"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
    expect(wrapper.find('[role="group"][aria-label="Metric of the Git history"]').exists()).toBe(true);
    await chooseAiCost(wrapper);
    expect(wrapper.find('input[name="statistics-person-metric"]').exists()).toBe(false);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(radioGroup(wrapper, "statistics-person-metric").checked).toEqual([true, false]);
  });

  it("draws one stacked bar for each day with the lines added below and the lines deleted above when the lines are chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.title.text).toBe("Jerome Etienne: lines added and lines deleted of each day");
    expect(traces.map((trace) => trace.name)).toEqual(["Lines added", "Lines deleted"]);
    expect(traces[0].x).toHaveLength(7);
    expect(traces[0].y).toEqual([0, 0, 0, 10, 0, 0, 8]);
    expect(traces[1].y).toEqual([0, 0, 0, 2, 0, 0, 4]);
    expect(traces[0].marker.color).not.toBe(traces[1].marker.color);
    expect(traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(layout.legend).toMatchObject({ orientation: "h", y: 1.1 });
  });

  it("gives the chart of the lines a title for the vertical axis and a description for a screen reader", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    const chart = wrapper.get('[role="img"]');
    expect(chart.attributes("aria-label")).toBe("Bar chart of the lines added and of the lines deleted by the commits of one person, for each day");
    expect(plotly.react.mock.calls[1][2].yaxis.title.text).toBe("Number of lines");
  });

  it("shows the lines added and the lines deleted of the day in the chart information card, with no total", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await hoverDay(6);
    const card = cardOf(wrapper);
    expect(card?.title).not.toBe("");
    expect(card?.total).toBeNull();
    expect(card?.rows).toEqual([
      ["Lines added", "8"],
      ["Lines deleted", "4"],
    ]);
    expect(wrapper.findAll('[role="tooltip"] [data-field="row"] span[aria-hidden="true"]').map((dot) => dot.attributes("style"))).toEqual([
      expect.stringContaining("var(--success-bg)"),
      expect.stringContaining("var(--danger-bg)"),
    ]);
  });

  it("leaves a color out of the chart information card of a day where it has no lines, and shows nothing for a day with no commit", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await wrapper.get("#statistics-person").setValue("eric");
    await waitForDrawings(3);
    await hoverDay(6);
    expect(cardOf(wrapper)?.rows).toEqual([["Lines added", "7"]]);
    await hoverDay(0);
    expect(cardOf(wrapper)?.rows).toEqual([]);
  });

  it("writes a number of lines with the separator of the language of the interface", async () => {
    const wrapper = await mountPersonWorkTab({
      ...sampleItems(),
      commits: [{ authorName: "Eric", authorEmail: "eric@example.com", committedAt: daysAgo(0), insertions: 12345, deletions: 1000 }],
      pullRequests: [],
      issues: [],
    });
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await hoverDay(6);
    expect(cardOf(wrapper)?.rows).toEqual([
      ["Lines added", (12345).toLocaleString("en")],
      ["Lines deleted", (1000).toLocaleString("en")],
    ]);
  });

  it("does not read again, and keeps the totals, the person, and the time range, when the metric changes", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person").setValue("eric");
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await flushPromises();
    expect((wrapper.get("#statistics-person").element as HTMLSelectElement).value).toBe("eric");
    expect(radioGroup(wrapper, "statistics-person-period").checked).toEqual([false, true]);
    expect(totalsOf(wrapper)).toEqual(["1", "0", "1", "7", "0"]);
    expect(lastDrawing().layout.title.text).toBe("Eric: lines added and lines deleted of each day");
    expect(lastDrawing().traces[0].x).toHaveLength(30);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("draws the commits and the pull requests again when the commits and the pull requests are chosen again", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await waitForDrawings(2);
    await wrapper.get("#statistics-person-metric-commits_and_pull_requests").setValue(true);
    await waitForDrawings(3);
    expect(lastDrawing().traces.map((trace) => trace.name)).toEqual(["Commits", "Pull requests"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("keeps the metric when the source changes to the AI cost and back, and does not change the AI cost", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-metric-lines").setValue(true);
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(radioGroup(wrapper, "statistics-person-metric").checked).toEqual([false, true]);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Lines added"));
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
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2", "18", "6"]);
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("draws the work of another person when the person changes, without reading again", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await wrapper.get("#statistics-person").setValue("eric");
    await waitForDrawings(2);
    expect(lastDrawing().layout.title.text).toBe("Eric: commits and pull requests of each day");
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(totalsOf(wrapper)).toEqual(["1", "0", "1", "7", "0"]);
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

  it("tells that no workspace is open, and reads nothing", async () => {
    await openWorkspacesAre([]);
    const wrapper = await mountPersonWorkTab();
    expect(wrapper.text()).toContain("No workspace is open");
    expect(wrapper.find("#statistics-person-workspace").exists()).toBe(false);
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

  it("shows the average cost per day under each total of the AI cost, for 7 days and for 30 days", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostPerDayOf(wrapper)).toEqual(["$0.57 per day", "$0.07 per day", "$0.64 per day"]);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(aiCostPerDayOf(wrapper)).toEqual(["$0.23 per day", "$0.02 per day", "$0.25 per day"]);
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
    expect(totalsOf(wrapper)).toEqual(["3", "1", "2", "18", "6"]);
  });

  it("tells how many chats have no known price", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.get('[data-note="without-price"]').text()).toBe(
      "1 chat is not counted in the cost, because one of its models has no known price.",
    );
  });

  it("does not tell about the chats with no known price when every chat has a price", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), { chats: [{ id: "chat-5", codingAgent: "claude", hours: [{ at: daysAgo(0), costUsd: 1, tokens: 100 }] }] });
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
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
  });

  it("has a button with a checkbox for each open workspace, and only the selected workspace is chosen at first", async () => {
    await openWorkspacesAre(WORKSPACES, "workspace-mobile");
    const wrapper = await mountPersonWorkTab();
    const boxes = wrapper.findAll('input[id^="statistics-person-workspace-workspace-"]');
    expect(boxes.map((box) => box.element.closest("label")?.textContent?.trim())).toEqual(["heidrun", "mobile"]);
    expect(boxes.every((box) => box.attributes("type") === "checkbox")).toBe(true);
    expect(boxes.every((box) => box.element.closest("label")?.className.includes("btn-check btn-outline theme-secondary"))).toBe(true);
    expect(chosenWorkspaceNames(wrapper)).toEqual(["mobile"]);
    expect(wrapper.find('[role="group"][aria-label="Workspaces"]').exists()).toBe(true);
    expect(personWorkCalls()).toHaveLength(1);
    expect((personWorkCalls()[0][1] as { folder: string }).folder).toBe("/work/mobile");
  });

  it("chooses the first open workspace at first when the selected workspace is not in the list", async () => {
    await openWorkspacesAre(WORKSPACES, null);
    const wrapper = await mountPersonWorkTab();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun"]);
    expect((personWorkCalls()[0][1] as { folder: string }).folder).toBe("/work/heidrun");
  });

  it("shows the workspace buttons for the source AI cost too", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.find("#statistics-person-workspace-workspace-mobile").exists()).toBe(true);
  });

  it("reads the commits, the pull requests, and the issues of another workspace when only that workspace is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    expect(chosenWorkspaceNames(wrapper)).toEqual(["mobile"]);
    expect(personWorkCalls()).toHaveLength(2);
    expect((personWorkCalls()[1][1] as { folder: string }).folder).toBe("/work/mobile");
    expect(totalsOf(wrapper)).toEqual(["1", "1", "0", "40", "4"]);
  });

  it("adds up the work of every chosen workspace, and reads only the workspace that is new", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun", "mobile"]);
    expect(personWorkCalls()).toHaveLength(2);
    expect(totalsOf(wrapper)).toEqual(["4", "2", "1", "58", "10"]);
    expect(wrapper.get("#statistics-person").findAll("option").map((option) => option.text())).toEqual(["Jerome Etienne", "Eric"]);
  });

  it("counts a repository once when two chosen workspaces read the same repository", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: sampleItems(), aiCost: sampleAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
  });

  it("chooses every workspace with the button All workspaces, and none when every workspace is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostItems() } });
    const all = wrapper.get("#statistics-person-workspace-all");
    expect(all.element.closest("label")?.textContent?.trim()).toBe("All workspaces");
    expect((all.element as HTMLInputElement).checked).toBe(false);
    await all.setValue(true);
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["heidrun", "mobile"]);
    expect((all.element as HTMLInputElement).checked).toBe(true);
    await all.setValue(false);
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual([]);
  });

  it("tells that no workspace is chosen, and shows no total and no chart, when every workspace is dropped", async () => {
    const wrapper = await mountPersonWorkTab();
    await waitForDrawings(1);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    expect(wrapper.text()).toContain("No workspace is chosen. Choose a workspace to see its work.");
    expect(wrapper.find('[data-total="commits"]').exists()).toBe(false);
    expect(wrapper.find("#statistics-person").exists()).toBe(false);
    await chooseAiCost(wrapper);
    expect(wrapper.text()).toContain("No workspace is chosen");
    expect(aiCostCalls()).toHaveLength(0);
  });

  it("keeps what a workspace gave when the workspace is dropped, and does not read it again when it comes back", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await chooseWorkspace(wrapper, "workspace-mobile", false);
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(totalsOf(wrapper)).toEqual(["4", "2", "1", "58", "10"]);
    expect(personWorkCalls()).toHaveLength(2);
  });

  it("shows the reading in progress, and not the work, while a chosen workspace is read", async () => {
    const wrapper = await mountPersonWorkTab();
    invoke.mockImplementation(async () => new Promise<never>(() => {}));
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(wrapper.text()).toContain("Reading the commits, the pull requests, and the issues…");
    expect(wrapper.find('[data-total="commits"]').exists()).toBe(false);
  });

  it("shows the error of a workspace, and still shows the work of the workspaces that were read", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: new Error("not a repository"), aiCost: mobileAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(wrapper.get(".alert.theme-danger").text()).toContain("not a repository");
    expect(totalsOf(wrapper)).toEqual(["3", "1", "1", "18", "6"]);
    await chooseWorkspace(wrapper, "workspace-heidrun", false);
    expect(wrapper.get(".alert.theme-danger").text()).toContain("not a repository");
    expect(wrapper.find('[data-total="commits"]').exists()).toBe(false);
  });

  it("reads the chats of another workspace when that workspace is chosen with the source AI cost, and adds them up", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(aiCostCalls()).toHaveLength(1);
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(aiCostCalls()).toHaveLength(2);
    expect((aiCostCalls()[1][1] as { folder: string }).folder).toBe("/work/mobile");
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$9.50", "$13.50"]);
    expect(personWorkCalls()).toHaveLength(1);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["40.00 KT", "115.00 KT", "155.00 KT"]);
  });

  it("counts a chat once when two chosen workspaces list the same chat", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    answerByFolder({ "/work/mobile": { gitHistory: sampleItems(), aiCost: sampleAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
  });

  it("reads the data of a workspace only for the source that is shown, and the other source the next time that it is chosen", async () => {
    const wrapper = await mountPersonWorkTab();
    answerByFolder({ "/work/mobile": { gitHistory: mobileItems(), aiCost: mobileAiCostItems() } });
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(aiCostCalls()).toHaveLength(0);
    await chooseAiCost(wrapper);
    expect(aiCostCalls().map((call) => (call[1] as { folder: string }).folder)).toEqual(["/work/heidrun", "/work/mobile"]);
    await chooseWorkspace(wrapper, "workspace-mobile", false);
    expect(personWorkCalls()).toHaveLength(2);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    await flushPromises();
    expect(personWorkCalls()).toHaveLength(2);
    expect(aiCostCalls()).toHaveLength(2);
  });

  it("reads a folder once when two chosen workspaces have the same folder", async () => {
    await openWorkspacesAre([...WORKSPACES, { workspaceId: "workspace-copy", label: "copy", folder: "/work/heidrun" }]);
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-workspace-all").setValue(true);
    await flushPromises();
    expect(personWorkCalls().map((call) => (call[1] as { folder: string }).folder)).toEqual(["/work/heidrun", "/work/mobile"]);
  });

  it("keeps the source, the unit, and the time range when the workspaces change", async () => {
    const wrapper = await mountPersonWorkTab();
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    expect(radioGroup(wrapper, "statistics-person-period").checked).toEqual([false, true]);
    expect(radioGroup(wrapper, "statistics-person-source").checked).toEqual([false, true]);
    expect(radioGroup(wrapper, "statistics-person-unit").checked).toEqual([false, true]);
  });

  it("drops a workspace that closes, and chooses the first open workspace when no chosen workspace stays open", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseWorkspace(wrapper, "workspace-mobile", true);
    await openWorkspacesAre([WORKSPACES[1]], "workspace-mobile");
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["mobile"]);
    await openWorkspacesAre([{ workspaceId: "workspace-new", label: "new", folder: "/work/new" }], "workspace-new");
    await flushPromises();
    expect(chosenWorkspaceNames(wrapper)).toEqual(["new"]);
  });

  it("has a radio button group of the unit of the AI cost, with US dollars chosen at first, for the source AI cost only", async () => {
    const wrapper = await mountPersonWorkTab();
    expect(wrapper.find('input[name="statistics-person-unit"]').exists()).toBe(false);
    await chooseAiCost(wrapper);
    const group = radioGroup(wrapper, "statistics-person-unit");
    expect(group.texts).toEqual(["US dollars", "Tokens"]);
    expect(group.checked).toEqual([true, false]);
    expect(group.classes.every((name) => name.includes("btn-check") && name.includes("btn-outline") && name.includes("theme-secondary"))).toBe(true);
    await wrapper.get("#statistics-person-source-git_history").setValue(true);
    expect(wrapper.find('input[name="statistics-person-unit"]').exists()).toBe(false);
  });

  it("shows the tokens of each coding agent and the total in the time range when Tokens is chosen, with the tokens of a chat with no known price", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["40.00 KT", "25.00 KT", "65.00 KT"]);
    expect(wrapper.get('[data-total="claude"]').text()).toContain("Claude Code");
    expect(wrapper.get('[data-total="total"]').text()).toContain("Total");
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["70.00 KT", "25.00 KT", "95.00 KT"]);
  });

  it("shows the average of tokens per day under each total, rounded to a whole number of tokens", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(aiCostPerDayOf(wrapper)).toEqual(["5.71 KT per day", "3.57 KT per day", "9.29 KT per day"]);
    await wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    expect(aiCostPerDayOf(wrapper)).toEqual(["2.33 KT per day", "833 per day", "3.17 KT per day"]);
  });

  it("shows the cost in US dollars again when US dollars is chosen again", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await wrapper.get("#statistics-person-unit-dollars").setValue(true);
    expect(aiCostTotalsOf(wrapper)).toEqual(["$4.00", "$0.50", "$4.50"]);
    expect(aiCostCalls()).toHaveLength(1);
  });

  it("draws the tokens of each day in the bars, with the same unit on every tick of the vertical axis", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens of each day, for each coding agent"));
    const { traces, layout } = lastDrawing();
    expect(traces.map((trace) => trace.name)).toEqual(["Claude Code", "Codex"]);
    expect(traces[0].y).toEqual([0, 0, 0, 0, 0, 25, 15]);
    expect(traces[1].y).toEqual([0, 0, 0, 0, 5, 20, 0]);
    expect(layout.yaxis.ticksuffix).toBe(" KT");
    expect(layout.yaxis.tickprefix).toBeUndefined();
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe("Bar chart of the tokens of the chats of each coding agent, for each day");
  });

  it("draws a number of tokens under one thousand as it is, and a number of millions with the unit MT", async () => {
    const small = { chats: [{ id: "chat-6", codingAgent: "claude", hours: [{ at: daysAgo(0), costUsd: 1, tokens: 800 }] }] };
    const wrapper = await mountPersonWorkTab(sampleItems(), small);
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens of each day, for each coding agent"));
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 800]);
    expect(lastDrawing().layout.yaxis.ticksuffix).toBe("");
    const large = { chats: [{ id: "chat-7", codingAgent: "claude", hours: [{ at: daysAgo(0), costUsd: 1, tokens: 3_000_000 }] }] };
    const largeWrapper = await mountPersonWorkTab(sampleItems(), large);
    await chooseAiCost(largeWrapper);
    await largeWrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.yaxis.ticksuffix).toBe(" MT"));
    expect(lastDrawing().traces[0].y).toEqual([0, 0, 0, 0, 0, 0, 3]);
  });

  it("shows the day, the total, and the tokens of each coding agent that has tokens, in the chart information card", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    await vi.waitFor(() => expect(lastDrawing().traces[0].name).toBe("Claude Code"));
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    await vi.waitFor(() => expect(lastDrawing().layout.title.text).toBe("Tokens of each day, for each coding agent"));
    await hoverDay(5);
    expect(cardOf(wrapper)?.total).toBe("45.00 KT");
    expect(cardOf(wrapper)?.rows).toEqual([
      ["Claude Code", "25.00 KT"],
      ["Codex", "20.00 KT"],
    ]);
    await hoverDay(4);
    expect(cardOf(wrapper)?.total).toBe("5.00 KT");
    expect(cardOf(wrapper)?.rows).toEqual([["Codex", "5.00 KT"]]);
    await hoverDay(0);
    expect(cardOf(wrapper)?.total).toBe("0");
    expect(cardOf(wrapper)?.rows).toEqual([]);
  });

  it("does not tell about the chats with no known price when the unit is tokens, because a chat with no known price has tokens", async () => {
    const wrapper = await mountPersonWorkTab();
    await chooseAiCost(wrapper);
    expect(wrapper.find('[data-note="without-price"]').exists()).toBe(true);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(wrapper.find('[data-note="without-price"]').exists()).toBe(false);
    await wrapper.get("#statistics-person-unit-dollars").setValue(true);
    expect(wrapper.find('[data-note="without-price"]').exists()).toBe(true);
  });

  it("shows zero tokens, and no chart, when the time range has no chat and the unit is tokens", async () => {
    const wrapper = await mountPersonWorkTab(sampleItems(), { chats: [] });
    await chooseAiCost(wrapper);
    await wrapper.get("#statistics-person-unit-tokens").setValue(true);
    expect(wrapper.text()).toContain("No chat of a coding agent used tokens in the last 30 days.");
    expect(aiCostTotalsOf(wrapper)).toEqual(["0", "0", "0"]);
    expect(plotly.react).toHaveBeenCalledTimes(1);
  });
});
