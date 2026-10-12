import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    sendKeys: vi.fn(async () => ({})),
  };
});

/** Three agents that call, in two workspaces, and one agent that works and does not call. */
function makeSnapshot(): SessionSnapshot {
  return {
    workspaces: [
      { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "blocked" },
      { workspace_id: "w2", number: 2, label: "website", agent_status: "done" },
    ],
    tabs: [
      { tab_id: "t1", workspace_id: "w1", number: 1, label: "build", agent_status: "blocked" },
      { tab_id: "t2", workspace_id: "w2", number: 1, label: "footer", agent_status: "done" },
    ],
    panes: [
      { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "done", title: "Fix the footer", state_change_seq: 5 },
      { pane_id: "p2", workspace_id: "w1", tab_id: "t1", agent: "codex", agent_status: "blocked", title: "Review the pull request", state_change_seq: 3 },
      { pane_id: "p3", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "working", title: "Migrate" },
      { pane_id: "p4", workspace_id: "w2", tab_id: "t2" },
    ],
    agents: [],
    layouts: [],
  } as unknown as SessionSnapshot;
}

async function mountToHandlePanel(snapshot: SessionSnapshot = makeSnapshot()) {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const pinned = await import("../stores/pinned_panes");
  const { default: ToHandlePanel } = await import("./ToHandlePanel.vue");
  session.state.snapshot = snapshot;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = "t1";
  session.state.selectedPaneId = null;
  for (const paneId of Object.keys(session.state.dismissed)) {
    delete session.state.dismissed[paneId];
  }
  for (const paneId of Object.keys(session.state.questions)) {
    delete session.state.questions[paneId];
  }
  for (const paneId of Object.keys(session.state.choices)) {
    delete session.state.choices[paneId];
  }
  const wrapper = mount(ToHandlePanel);
  return { session, api, pinned, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ToHandlePanel cards", () => {
  it("shows one card for each agent that is blocked or has finished, the blocked agent first", async () => {
    const { wrapper } = await mountToHandlePanel();
    const cards = wrapper.findAll(".card");
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.classes())).toEqual([expect.arrayContaining(["blocked"]), expect.arrayContaining(["done"])]);
    expect(cards[0].get(".desc").text()).toContain("Review the pull request");
    expect(cards[1].get(".desc").text()).toContain("Fix the footer");
  });

  it("names the workspace and the tab of the agent, and says its status", async () => {
    const { wrapper } = await mountToHandlePanel();
    const cards = wrapper.findAll(".card");
    expect(cards[0].get(".name").text()).toBe("heidrun – build");
    expect(cards[0].get(".badge").text()).toBe("BLOCKED");
    expect(cards[1].get(".badge").text()).toBe("DONE");
  });

  it("shows no card for an agent that works, and no card for a shell", async () => {
    const { wrapper } = await mountToHandlePanel();
    expect(wrapper.text()).not.toContain("Migrate");
  });

  it("shows a card for an agent that asks a question in its answer, with the label QUESTION", async () => {
    const snapshot = makeSnapshot();
    const { wrapper, session } = await mountToHandlePanel(snapshot);
    session.state.questions["p3"] = { text: "Which color?" } as never;
    await wrapper.vm.$nextTick();
    const cards = wrapper.findAll(".card");
    expect(cards).toHaveLength(3);
    const questionCard = cards.find((card) => card.classes("question"));
    expect(questionCard?.get(".badge").text()).toBe("QUESTION");
    expect(questionCard?.get(".desc").text()).toContain("Which color?");
  });

  it("shows the sentence that says nothing is to handle when no agent calls", async () => {
    const snapshot = makeSnapshot();
    snapshot.panes = snapshot.panes.filter((pane) => pane.pane_id === "p3" || pane.pane_id === "p4");
    const { wrapper } = await mountToHandlePanel(snapshot);
    expect(wrapper.findAll(".card")).toHaveLength(0);
    expect(wrapper.get(".empty").text()).toBe("No agent is blocked, no agent has finished, and no agent asks a question.");
  });

  it("does not show the sentence when a card is shown", async () => {
    const { wrapper } = await mountToHandlePanel();
    expect(wrapper.find(".empty").exists()).toBe(false);
  });

  it("has no heading To handle: the button of the navigation bar says it", async () => {
    const { wrapper } = await mountToHandlePanel();
    expect(wrapper.find(".eyebrow").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("To handle");
  });
});

describe("ToHandlePanel actions", () => {
  it("shows the pane of the agent after a click on the card", async () => {
    const { wrapper, session } = await mountToHandlePanel();
    await wrapper.findAll(".card-main")[1].trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w1");
    expect(session.state.selectedTabId).toBe("t1");
    expect(session.state.selectedPaneId).toBe("p1");
  });

  it("selects the workspace of the agent when the agent is in another workspace", async () => {
    const snapshot = makeSnapshot();
    (snapshot.panes[0] as { workspace_id: string; tab_id: string }).workspace_id = "w2";
    (snapshot.panes[0] as { workspace_id: string; tab_id: string }).tab_id = "t2";
    const { wrapper, session } = await mountToHandlePanel(snapshot);
    await wrapper.findAll(".card-main")[1].trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(session.state.selectedTabId).toBe("t2");
  });

  it("hides the card after a click on the cross, and shows the sentence when it was the last card", async () => {
    const { wrapper } = await mountToHandlePanel();
    await wrapper.findAll(".card-x")[0].trigger("click");
    expect(wrapper.findAll(".card")).toHaveLength(1);
    await wrapper.findAll(".card-x")[0].trigger("click");
    expect(wrapper.findAll(".card")).toHaveLength(0);
    expect(wrapper.find(".empty").exists()).toBe(true);
  });

  it("pins the pane of the agent after a click on the pin, and unpins it after a second click", async () => {
    const { wrapper, pinned } = await mountToHandlePanel();
    expect(pinned.isPinned("p2")).toBe(false);
    await wrapper.findAll(".card-pin")[0].trigger("click");
    expect(pinned.isPinned("p2")).toBe(true);
    expect(wrapper.findAll(".card-pin")[0].classes("on")).toBe(true);
    await wrapper.findAll(".card-pin")[0].trigger("click");
    expect(pinned.isPinned("p2")).toBe(false);
  });

  it("gives the buttons of the pin and the cross an accessible name that holds the name of the pane", async () => {
    const { wrapper } = await mountToHandlePanel();
    expect(wrapper.findAll(".card-pin")[0].attributes("aria-label")).toMatch(/^Pin /);
    expect(wrapper.findAll(".card-x")[0].attributes("aria-label")).toMatch(/^Hide /);
  });

  it("shows the options of the menu of a blocked agent, and answers with the number of the option", async () => {
    const { wrapper, session, api } = await mountToHandlePanel();
    session.state.choices["p2"] = {
      question: "Do you want to continue?",
      detail: "",
      options: [
        { n: 1, label: "Yes", selected: true },
        { n: 2, label: "No", selected: false },
      ],
    } as never;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".choice-q").text()).toBe("Do you want to continue?");
    const options = wrapper.findAll(".choice");
    expect(options.map((option) => option.text())).toEqual(["1Yes", "2No"]);
    await options[1].trigger("click");
    await flushPromises();
    expect(api.sendKeys).toHaveBeenCalledWith("p2", ["2"]);
  });

  it("shows the menu of a blocked agent only on the card of a blocked agent", async () => {
    const { wrapper, session } = await mountToHandlePanel();
    session.state.choices["p1"] = { question: "Which?", detail: "", options: [{ n: 1, label: "One", selected: true }] } as never;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".choices").exists()).toBe(false);
  });
});

describe("ToHandlePanel place in the window", () => {
  it("is a sidebar section of the right sidebar: the file RightPanel.vue shows it, the file Sidebar.vue does not, and the panel has no place of its own at the bottom", () => {
    const rightPanelText = Fs.readFileSync(Path.resolve(import.meta.dirname, "RightPanel.vue"), "utf8");
    const sidebarText = Fs.readFileSync(Path.resolve(import.meta.dirname, "Sidebar.vue"), "utf8");
    expect(rightPanelText).toContain("<ToHandlePanel");
    expect(sidebarText).not.toContain("<ToHandlePanel");
    expect(rightPanelText).not.toContain("margin-top: auto");
    expect(sidebarText).not.toContain("margin-top: auto");
  });
});

describe("ToHandlePanel colors of a blocked card", () => {
  const panelText = Fs.readFileSync(Path.resolve(import.meta.dirname, "ToHandlePanel.vue"), "utf8");
  const stylesText = Fs.readFileSync(Path.resolve(import.meta.dirname, "..", "styles.css"), "utf8");

  /** The rules of the panel that style the card and the rows of the choices of a blocked agent. */
  const blockedRules = panelText
    .split("\n")
    .filter((line) => /^\.(card\.blocked|choice)/.test(line) === true)
    .join("\n");

  it("has no fixed color in the rules of the blocked card and of the choice rows, so that the light theme can change them", () => {
    expect(blockedRules.length).toBeGreaterThan(0);
    expect(blockedRules).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("gives the choice rows a color in the dark theme and in the light theme", () => {
    const lightStart = stylesText.indexOf(':root[data-theme="light"] {');
    expect(lightStart).toBeGreaterThan(0);
    const darkText = stylesText.slice(0, lightStart);
    const lightText = stylesText.slice(lightStart, stylesText.indexOf("}", lightStart));
    for (const name of ["--choice-bg", "--choice-border", "--choice-hover-bg", "--choice-number-bg"]) {
      expect(darkText).toContain(`${name}:`);
      expect(lightText).toContain(`${name}:`);
    }
  });

  it("gives the choice rows the background of the sidebar section in the light theme", () => {
    const lightText = stylesText.slice(stylesText.indexOf(':root[data-theme="light"] {'));
    expect(lightText).toMatch(/--choice-bg:\s*var\(--side\);/);
    expect(lightText).toMatch(/--side:\s*#efefec;/);
  });
});
