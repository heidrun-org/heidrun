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

async function mountSidebar() {
  const session = await import("../stores/session");
  const { default: Sidebar } = await import("./Sidebar.vue");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  const wrapper = mount(Sidebar, { global: { stubs: { ActionsPanel: true, GitPanel: true } } });
  return { session, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  settings.leftSidebarSection = "actions";
});

describe("Sidebar without the list of workspaces", () => {
  it("shows no workspace, no heading Workspaces, and no plus button for a new workspace: the workspace button of the tab bar has them", async () => {
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
});

describe("Sidebar navigation bar", () => {
  it("shows the buttons Scripts and Git, and not the buttons Workspaces, Pane, and Notes", async () => {
    const { wrapper } = await mountSidebar();
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.text())).toEqual(["Scripts", "Git"]);
    expect(buttons.map((button) => button.attributes("role"))).toEqual(["tab", "tab"]);
    expect(wrapper.get(".navigation-bar").attributes("aria-label")).toBe("Left sidebar");
  });

  it("shows the sidebar section Scripts first, and marks its button as active", async () => {
    const { wrapper } = await mountSidebar();
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([true, false]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("git-panel-stub").exists()).toBe(false);
  });

  it("shows the sidebar section Git after a click on its button, and remembers it", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[1].trigger("click");
    expect(settings.leftSidebarSection).toBe("git");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([false, true]);
    expect(wrapper.find("actions-panel-stub").exists()).toBe(false);
    expect(wrapper.find("git-panel-stub").exists()).toBe(true);
    const restarted = (await mountSidebar()).wrapper;
    expect(restarted.find("git-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Scripts again after a click on its button", async () => {
    settings.leftSidebarSection = "git";
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".navigation-bar button")[0].trigger("click");
    expect(settings.leftSidebarSection).toBe("actions");
    expect(wrapper.find("actions-panel-stub").exists()).toBe(true);
    expect(wrapper.find("git-panel-stub").exists()).toBe(false);
  });
});
