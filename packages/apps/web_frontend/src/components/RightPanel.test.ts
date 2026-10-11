import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RightPanel from "./RightPanel.vue";
import { settings } from "../stores/settings";
import { notes } from "../stores/notes";
import { allPanes, dismiss, state } from "../stores/session";
import type { SessionSnapshot } from "../lib/types";

const stubs = {
  Inspector: true,
  NotesPanel: true,
  ToHandlePanel: true,
};

/** A snapshot with one agent that is blocked and one agent that has finished, in a workspace that is not selected. */
function snapshotWithCalls(): SessionSnapshot {
  return {
    version: "test",
    protocol: 1,
    workspaces: [
      { workspace_id: "w1", number: 1, label: "heidrun", focused: false, pane_count: 1, tab_count: 1, active_tab_id: "w1:t1", agent_status: "unknown" },
      { workspace_id: "w2", number: 2, label: "teamwright", focused: false, pane_count: 2, tab_count: 1, active_tab_id: "w2:t1", agent_status: "blocked" },
    ],
    tabs: [],
    panes: [
      { pane_id: "p1", workspace_id: "w1", agent: "claude", agent_status: "idle" },
      { pane_id: "p8", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "blocked" },
      { pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent: "codex", agent_status: "done" },
    ],
    layouts: [],
    agents: [],
  } as unknown as SessionSnapshot;
}

describe("RightPanel", () => {
  afterEach(() => {
    settings.rightSidebarSection = "pane";
    notes.list = [];
    settings.notesShowAll = false;
    state.snapshot = null;
    state.selectedWorkspaceId = null;
    for (const paneId of Object.keys(state.dismissed)) {
      delete state.dismissed[paneId];
    }
  });

  it("shows the buttons To handle, Pane, and Notes in the navigation bar, and not the buttons Scripts and Git", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.get(".navigation-bar").attributes("role")).toBe("tablist");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.attributes("role"))).toEqual(["tab", "tab", "tab"]);
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.text())).toEqual(["To handle", "Pane", "Notes"]);
  });

  it("does not call a button of the navigation bar a tab", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find(".tabs").exists()).toBe(false);
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.attributes("title"))).toEqual(
      Array(3).fill("Show this sidebar section"),
    );
  });

  it("marks only the selected sidebar section as active", async () => {
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, false, true]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "false", "true"]);
  });

  it("shows the sidebar section Pane first, and the sidebar section Notes after a click on its button", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find("inspector-stub").exists()).toBe(true);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(false);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(false);
    await wrapper.findAll(".navigation-bar button")[2].trigger("click");
    expect(settings.rightSidebarSection).toBe("notes");
    expect(wrapper.findAll(".navigation-bar button")[2].classes("on")).toBe(true);
    expect(wrapper.find("inspector-stub").exists()).toBe(false);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(true);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(false);
  });

  it("shows the sidebar section To handle after a click on its button, and remembers it", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".navigation-bar button")[0].trigger("click");
    expect(settings.rightSidebarSection).toBe("toHandle");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.classes("on"))).toEqual([true, false, false]);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(true);
    expect(wrapper.find("inspector-stub").exists()).toBe(false);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(false);
    const restarted = mount(RightPanel, { global: { stubs } });
    expect(restarted.find("to-handle-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Pane again after a click on its button", async () => {
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".navigation-bar button")[1].trigger("click");
    expect(settings.rightSidebarSection).toBe("pane");
    expect(wrapper.find("inspector-stub").exists()).toBe(true);
  });

  it("counts on the button Notes the notes of the selected workspace, and every note when All workspaces is checked", async () => {
    state.snapshot = {
      version: "test",
      protocol: 1,
      workspaces: [{ workspace_id: "w3", number: 3, label: "heidrun", focused: false, pane_count: 1, tab_count: 1, active_tab_id: "w3:t1", agent_status: "unknown" }],
      tabs: [],
      panes: [],
      layouts: [],
      agents: [],
    };
    state.selectedWorkspaceId = "w3";
    const note = { id: "n1", title: "a", text: "a", workspaceLabel: "heidrun", origin: "heidrun – codex · heidrun", createdAt: 1 };
    notes.list = [note, { ...note, id: "n2", workspaceLabel: "teamwright" }];
    const wrapper = mount(RightPanel, { global: { stubs } });
    const badge = () => wrapper.findAll(".navigation-bar button")[2].find(".badge").text();
    expect(badge()).toBe("1");
    settings.notesShowAll = true;
    await wrapper.vm.$nextTick();
    expect(badge()).toBe("2");
  });
});

describe("RightPanel button To handle", () => {
  it("shows no number when no agent calls", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".navigation-bar button")[0].find(".badge").exists()).toBe(false);
  });

  it("shows the number of cards, whatever the sidebar section that is shown", () => {
    state.snapshot = snapshotWithCalls();
    state.selectedWorkspaceId = "w1";
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".navigation-bar button")[0].get(".badge").text()).toBe("2");
  });

  it("shows the number in red when an agent is blocked", () => {
    state.snapshot = snapshotWithCalls();
    state.selectedWorkspaceId = "w1";
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".navigation-bar button")[0].get(".badge").classes()).toContain("alert");
  });

  it("shows the number in the normal color when every agent that calls has finished", () => {
    const snapshot = snapshotWithCalls();
    snapshot.panes = snapshot.panes.filter((pane) => pane.pane_id !== "p8");
    state.snapshot = snapshot;
    state.selectedWorkspaceId = "w1";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const badge = wrapper.findAll(".navigation-bar button")[0].get(".badge");
    expect(badge.text()).toBe("1");
    expect(badge.classes()).not.toContain("alert");
  });

  it("counts one less after the developer hides a card", async () => {
    state.snapshot = snapshotWithCalls();
    state.selectedWorkspaceId = "w1";
    const wrapper = mount(RightPanel, { global: { stubs } });
    dismiss(allPanes.value.find((pane) => pane.pane_id === "p9")!);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".navigation-bar button")[0].get(".badge").text()).toBe("1");
  });
});
