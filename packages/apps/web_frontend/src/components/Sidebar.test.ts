import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { SessionSnapshot } from "../lib/types";
import { settings } from "../stores/settings";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

const SNAPSHOT = {
  workspaces: [
    { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" },
    { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "idle" },
  ],
  panes: [
    { pane_id: "p1", workspace_id: "w1", agent: "claude", agent_status: "idle" },
    { pane_id: "p2", workspace_id: "w1", agent: "codex", agent_status: "idle" },
    { pane_id: "p3", workspace_id: "w1" },
  ],
  agents: [],
  tabs: [],
  layouts: [],
} as unknown as SessionSnapshot;

/** The agents of the snapshot run, and none of them calls. */
async function mountSidebar(snapshot: SessionSnapshot = SNAPSHOT) {
  const session = await import("../stores/session");
  const { default: Sidebar } = await import("./Sidebar.vue");
  session.state.snapshot = snapshot;
  session.state.selectedWorkspaceId = "w1";
  for (const paneId of Object.keys(session.state.dismissed)) {
    delete session.state.dismissed[paneId];
  }
  const wrapper = mount(Sidebar, { global: { stubs: { ActionsPanel: true, GitPanel: true, ToHandlePanel: true } } });
  return { session, wrapper };
}

/** The snapshot, with one agent that is blocked and one agent that has finished. */
function snapshotWithCalls(): SessionSnapshot {
  return {
    ...SNAPSHOT,
    panes: [
      ...SNAPSHOT.panes,
      { pane_id: "p8", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "blocked" },
      { pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent: "codex", agent_status: "done" },
    ],
  } as unknown as SessionSnapshot;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  settings.leftSidebarSection = "actions";
});

describe("Sidebar without the list of workspaces", () => {
  it("shows no workspace, no heading Workspaces, and no plus button for a new workspace: the workspace status bar section has them", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.text()).not.toContain("heidrun");
    expect(wrapper.text()).not.toContain("teamwright");
    expect(wrapper.find(".ws-row").exists()).toBe(false);
    expect(wrapper.find(".heading").exists()).toBe(false);
    expect(wrapper.find("button.add").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Workspaces");
  });

  it("shows no tab and no pane either", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".item")).toHaveLength(0);
  });

  it("does not show the cards of the agents at the bottom of the sidebar: the sidebar section To handle holds them", async () => {
    const { wrapper } = await mountSidebar(snapshotWithCalls());
    expect(wrapper.find(".attention").exists()).toBe(false);
    expect(wrapper.find(".card").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("BLOCKED");
  });
});

describe("Sidebar navigation bar", () => {
  it("shows the buttons To handle, Scripts, and Git, and not the buttons Workspaces, Pane, and Notes", async () => {
    const { wrapper } = await mountSidebar();
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.text())).toEqual(["To handle", "Scripts", "Git"]);
    expect(buttons.map((button) => button.attributes("role"))).toEqual(["tab", "tab", "tab"]);
    expect(wrapper.get(".navigation-bar").attributes("aria-label")).toBe("Left sidebar");
  });

  it("shows the sidebar section Scripts first, and marks its button as active", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([false, true, false]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("git-panel-stub").exists()).toBe(false);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(false);
  });

  it("shows the sidebar section To handle after a click on its button, and remembers it", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[0].trigger("click");
    expect(settings.leftSidebarSection).toBe("toHandle");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([true, false, false]);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(true);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(false);
    expect(wrapper.find("git-panel-stub").exists()).toBe(false);
    const restarted = (await mountSidebar()).wrapper;
    expect(restarted.find("to-handle-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Git after a click on its button, and remembers it", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[2].trigger("click");
    expect(settings.leftSidebarSection).toBe("git");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([false, false, true]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(false);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(false);
    expect(wrapper.find("git-panel-stub").exists()).toBe(true);
    const restarted = (await mountSidebar()).wrapper;
    expect(restarted.find("git-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Scripts again after a click on its button", async () => {
    settings.leftSidebarSection = "git";
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[1].trigger("click");
    expect(settings.leftSidebarSection).toBe("actions");
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("git-panel-stub").exists()).toBe(false);
  });
});

describe("Sidebar button To handle", () => {
  it("shows no number when no agent calls", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".navigation-bar button")[0].find(".badge").exists()).toBe(false);
  });

  it("shows the number of cards, whatever the sidebar section that is shown", async () => {
    settings.leftSidebarSection = "git";
    const { wrapper } = await mountSidebar(snapshotWithCalls());
    expect(wrapper.findAll(".navigation-bar button")[0].get(".badge").text()).toBe("2");
  });

  it("shows the number in red when an agent is blocked", async () => {
    const { wrapper } = await mountSidebar(snapshotWithCalls());
    expect(wrapper.findAll(".navigation-bar button")[0].get(".badge").classes()).toContain("alert");
  });

  it("shows the number in the normal color when every agent that calls has finished", async () => {
    const snapshot = snapshotWithCalls();
    snapshot.panes = snapshot.panes.filter((pane) => pane.pane_id !== "p8");
    const { wrapper } = await mountSidebar(snapshot);
    const badge = wrapper.findAll(".navigation-bar button")[0].get(".badge");
    expect(badge.text()).toBe("1");
    expect(badge.classes()).not.toContain("alert");
  });

  it("counts one less after the developer hides a card", async () => {
    const { wrapper, session } = await mountSidebar(snapshotWithCalls());
    session.dismiss(session.allPanes.value.find((pane) => pane.pane_id === "p9")!);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".navigation-bar button")[0].get(".badge").text()).toBe("1");
  });
});
