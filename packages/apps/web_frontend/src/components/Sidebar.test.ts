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
  const wrapper = mount(Sidebar, { global: { stubs: { ActionsPanel: true, SourceControlPanel: true } } });
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

  it("does not show the cards of the agents at the bottom of the sidebar: the right sidebar holds them", async () => {
    const { wrapper } = await mountSidebar(snapshotWithCalls());
    expect(wrapper.find(".attention").exists()).toBe(false);
    expect(wrapper.find(".card").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("BLOCKED");
  });
});

describe("Sidebar navigation bar", () => {
  it("shows the buttons Scripts and Source Control, and not the buttons To handle, Workspaces, Pane, and Notes", async () => {
    const { wrapper } = await mountSidebar();
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.text())).toEqual(["Scripts", "Source Control"]);
    expect(buttons.map((button) => button.attributes("role"))).toEqual(["tab", "tab"]);
    expect(wrapper.get(".navigation-bar").attributes("aria-label")).toBe("Left sidebar");
  });

  it("shows the sidebar section Scripts first, and marks its button as active", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([true, false]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("source-control-panel-stub").exists()).toBe(false);
  });

  it("shows the sidebar section Source control after a click on its button, and remembers it", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[1].trigger("click");
    expect(settings.leftSidebarSection).toBe("sourceControl");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([false, true]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(false);
    expect(wrapper.find("source-control-panel-stub").exists()).toBe(true);
    const restarted = (await mountSidebar()).wrapper;
    expect(restarted.find("source-control-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Scripts again after a click on its button", async () => {
    settings.leftSidebarSection = "sourceControl";
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[0].trigger("click");
    expect(settings.leftSidebarSection).toBe("actions");
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("source-control-panel-stub").exists()).toBe(false);
  });

  it("shows the number of changed files on the button of the Source control sidebar section", async () => {
    const { git } = await import("../stores/git");
    git.status = {
      w1: {
        root: "/work/heidrun",
        branch: "main",
        upstream: null,
        ahead: 0,
        behind: 0,
        changed: 1,
        untracked: 1,
        files: [
          { path: "CHANGELOG.md", status: ".M" },
          { path: "new.txt", status: "??" },
        ],
        last_sha: null,
        last_subject: null,
        last_time: null,
        remote: null,
      },
    };
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".navigation-bar button")[1].text()).toBe("Source Control2");
    git.status = {};
  });
});
