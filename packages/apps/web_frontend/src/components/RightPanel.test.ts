import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RightPanel from "./RightPanel.vue";
import { settings } from "../stores/settings";
import { notes } from "../stores/notes";
import { allPanes, dismiss, state } from "../stores/session";
import type { SessionSnapshot } from "../lib/types";

const stubs = {
  NotesPanel: true,
  ChatsPanel: true,
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
    settings.rightSidebarSection = "toHandle";
    settings.rightCollapsed = false;
    notes.list = [];
    settings.notesShowAll = false;
    state.snapshot = null;
    state.selectedWorkspaceId = null;
    for (const paneId of Object.keys(state.dismissed)) {
      delete state.dismissed[paneId];
    }
  });

  it("shows the buttons Needs you, Clipboard, and Past chats in the sidebar icon bar, and not the buttons Pane, Launchers, and Git", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.get(".sidebar-icon-bar .icons").attributes("role")).toBe("tablist");
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.attributes("role"))).toEqual(["tab", "tab", "tab"]);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.attributes("aria-label"))).toEqual(["Needs you", "Clipboard", "Past chats"]);
  });

  it("gives each button the title of its sidebar section as its tooltip, and does not call it a tab", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find(".tabs").exists()).toBe(false);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.attributes("title"))).toEqual(["Needs you", "Clipboard", "Past chats"]);
  });

  it("marks only the selected sidebar section as active", async () => {
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const buttons = wrapper.findAll(".sidebar-icon-bar [role=tab]");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, true, false]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  it("shows the sidebar section Needs you first, and the sidebar section Clipboard after a click on its button", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(true);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(false);
    expect(wrapper.find("chats-panel-stub").exists()).toBe(false);
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[1].trigger("click");
    expect(settings.rightSidebarSection).toBe("notes");
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[1].classes("on")).toBe(true);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(true);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(false);
    expect(wrapper.find("chats-panel-stub").exists()).toBe(false);
  });

  it("shows the sidebar section Needs you after a click on its button, and remembers it", async () => {
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].trigger("click");
    expect(settings.rightSidebarSection).toBe("toHandle");
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.classes("on"))).toEqual([true, false, false]);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(true);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(false);
    const restarted = mount(RightPanel, { global: { stubs } });
    expect(restarted.find("to-handle-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Past chats, and no other sidebar section, after a click on its button", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[2].trigger("click");
    expect(settings.rightSidebarSection).toBe("chats");
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[2].classes("on")).toBe(true);
    expect(wrapper.find("chats-panel-stub").exists()).toBe(true);
    expect(wrapper.find("to-handle-panel-stub").exists()).toBe(false);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(false);
  });

  it("shows no number on the button Past chats", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[2].find(".badge").exists()).toBe(false);
  });

  it("counts on the button Clipboard the notes of the selected workspace, and every note when All workspaces is switched on", async () => {
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
    const badge = () => wrapper.findAll(".sidebar-icon-bar [role=tab]")[1].find(".badge").text();
    expect(badge()).toBe("1");
    settings.notesShowAll = true;
    await wrapper.vm.$nextTick();
    expect(badge()).toBe("2");
  });
});

describe("RightPanel button Needs you", () => {
  it("shows no number when no agent calls", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].find(".badge").exists()).toBe(false);
  });

  it("shows the number of cards, whatever the sidebar section that is shown", () => {
    state.snapshot = snapshotWithCalls();
    state.selectedWorkspaceId = "w1";
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].get(".badge").text()).toBe("2");
  });

  it("shows the number in red when an agent is blocked", () => {
    state.snapshot = snapshotWithCalls();
    state.selectedWorkspaceId = "w1";
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].get(".badge").classes()).toContain("alert");
  });

  it("shows the number in the normal color when every agent that calls has finished", () => {
    const snapshot = snapshotWithCalls();
    snapshot.panes = snapshot.panes.filter((pane) => pane.pane_id !== "p8");
    state.snapshot = snapshot;
    state.selectedWorkspaceId = "w1";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const badge = wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].get(".badge");
    expect(badge.text()).toBe("1");
    expect(badge.classes()).not.toContain("alert");
  });

  it("counts one less after the developer hides a card", async () => {
    state.snapshot = snapshotWithCalls();
    state.selectedWorkspaceId = "w1";
    const wrapper = mount(RightPanel, { global: { stubs } });
    dismiss(allPanes.value.find((pane) => pane.pane_id === "p9")!);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].get(".badge").text()).toBe("1");
  });

  it("shows one icon for each sidebar section: a bell, a note, and a speech bubble", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab] i.bi").map((icon) => icon.classes()[1])).toEqual(["bi-bell", "bi-sticky", "bi-chat-left-text"]);
  });

  it("puts the sidebar icon bar at the right edge, after the content of the sidebar section, in the same frame", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    const children = Array.from(wrapper.get("aside").element.children).map((child) => child.className);
    expect(children).toEqual(["sidebar-section-body", "sidebar-icon-bar"]);
  });

  it("collapses after a click on the icon of the sidebar section that it shows, and then selects no icon", async () => {
    settings.rightSidebarSection = "toHandle";
    settings.rightCollapsed = false;
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[0].trigger("click");
    expect(settings.rightCollapsed).toBe(true);
    expect(wrapper.find(".sidebar-section-body").exists()).toBe(false);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]").map((button) => button.classes("on"))).toEqual([false, false, false]);
    expect(wrapper.get("aside").attributes("style")).toContain("width: 48px");
  });

  it("expands to the sidebar section of an icon after a click on the icon", async () => {
    settings.rightCollapsed = true;
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".sidebar-icon-bar [role=tab]")[2].trigger("click");
    expect(settings.rightCollapsed).toBe(false);
    expect(settings.rightSidebarSection).toBe("chats");
    expect(wrapper.find("chats-panel-stub").exists()).toBe(true);
    expect(wrapper.findAll(".sidebar-icon-bar [role=tab]")[2].classes("on")).toBe(true);
    settings.rightSidebarSection = "toHandle";
  });

  it("collapses after a click on the collapse button, and expands after a click on the expand button, with arrows toward each side", async () => {
    settings.rightSidebarSection = "notes";
    settings.rightCollapsed = false;
    const wrapper = mount(RightPanel, { global: { stubs } });
    const collapseButton = wrapper.get(".sidebar-icon-bar > .collapse-button");
    expect(collapseButton.get("i").classes()).toContain("bi-chevron-bar-right");
    await collapseButton.trigger("click");
    expect(settings.rightCollapsed).toBe(true);
    const expandButton = wrapper.get(".sidebar-icon-bar > .expand-button");
    expect(expandButton.get("i").classes()).toContain("bi-chevron-bar-left");
    await expandButton.trigger("click");
    expect(settings.rightCollapsed).toBe(false);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(true);
    settings.rightSidebarSection = "toHandle";
  });
});
