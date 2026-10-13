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
  const wrapper = mount(Sidebar, { global: { stubs: { ActionsPanel: true, GitPanel: true } } });
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
  settings.leftCollapsed = false;
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

describe("Sidebar icon bar of the left sidebar", () => {
  it("shows the buttons Scripts and Git, and not the buttons Needs you, Workspaces, Pane, and Notes", async () => {
    const { wrapper } = await mountSidebar();
    const buttons = wrapper.findAll(".sidebar-icon-bar [role=tab]");
    expect(buttons.map((button) => button.attributes("aria-label"))).toEqual(["Scripts", "Git"]);
    expect(buttons.map((button) => button.attributes("role"))).toEqual(["tab", "tab"]);
    expect(wrapper.get(".sidebar-icon-bar .icons").attributes("aria-label")).toBe("Left sidebar");
  });

  it("shows one icon for each sidebar section: a play button for Scripts, and the Git logo for Git", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab] i.bi").map((icon) => icon.classes()[1])).toEqual(["bi-play-circle", "bi-git"]);
  });

  it("puts the sidebar icon bar at the left edge, before the content of the sidebar section, in the same frame", async () => {
    const { wrapper } = await mountSidebar();
    const children = Array.from(wrapper.get("aside").element.children).map((child) => child.className);
    expect(children).toEqual(["sidebar-icon-bar", "sidebar-section-body"]);
  });

  it("shows the sidebar section Scripts first, and marks its button as active", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.classes("on"))).toEqual([true, false]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("git-panel-stub").exists()).toBe(false);
  });

  it("shows the sidebar section Git after a click on its button, and remembers it", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[1].trigger("click");
    expect(settings.leftSidebarSection).toBe("git");
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.classes("on"))).toEqual([false, true]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(false);
    expect(wrapper.find("git-panel-stub").exists()).toBe(true);
    const restarted = (await mountSidebar()).wrapper;
    expect(restarted.find("git-panel-stub").exists()).toBe(true);
  });

  it("collapses after a click on the icon of the sidebar section that it shows, and then selects no icon", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].trigger("click");
    expect(settings.leftCollapsed).toBe(true);
    expect(wrapper.find(".sidebar-section-body").exists()).toBe(false);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.classes("on"))).toEqual([false, false]);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.attributes("aria-selected"))).toEqual(["false", "false"]);
    expect(wrapper.get("aside").attributes("style")).toContain("width: 48px");
  });

  it("expands to the sidebar section of an icon after a click on the icon", async () => {
    settings.leftCollapsed = true;
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[1].trigger("click");
    expect(settings.leftCollapsed).toBe(false);
    expect(settings.leftSidebarSection).toBe("git");
    expect(wrapper.find("git-panel-stub").exists()).toBe(true);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.classes("on"))).toEqual([false, true]);
  });

  it("expands to the same sidebar section after a click on the icon that collapsed it", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].trigger("click");
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].trigger("click");
    expect(settings.leftCollapsed).toBe(false);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
  });

  it("collapses after a click on the collapse button at the top right of the content, with an arrow toward the left edge", async () => {
    const { wrapper } = await mountSidebar();
    const collapseButton = wrapper.get(".sidebar-section-body > .sidebar-section-header > .collapse-button");
    expect(collapseButton.get("i").classes()).toContain("bi-chevron-bar-left");
    expect(collapseButton.attributes("aria-label")).toBe("Collapse the sidebar to a bar of icons");
    await collapseButton.trigger("click");
    expect(settings.leftCollapsed).toBe(true);
    expect(wrapper.find(".collapse-button").exists()).toBe(false);
  });

  it("shows the expand button above the icons only when collapsed, and expands to the selected sidebar section after a click on it", async () => {
    settings.leftSidebarSection = "git";
    const { wrapper } = await mountSidebar();
    expect(wrapper.find(".expand-button").exists()).toBe(false);
    settings.leftCollapsed = true;
    await wrapper.vm.$nextTick();
    const expandButton = wrapper.get(".sidebar-icon-bar > .expand-button");
    expect(wrapper.get(".sidebar-icon-bar").element.firstElementChild).toBe(expandButton.element);
    expect(expandButton.get("i").classes()).toContain("bi-chevron-bar-right");
    await expandButton.trigger("click");
    expect(settings.leftCollapsed).toBe(false);
    expect(wrapper.find("git-panel-stub").exists()).toBe(true);
  });
});
