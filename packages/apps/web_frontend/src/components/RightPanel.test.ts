import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RightPanel from "./RightPanel.vue";
import { settings } from "../stores/settings";
import { notes } from "../stores/notes";
import { state } from "../stores/session";

const stubs = {
  Inspector: true,
  NotesPanel: true,
};

describe("RightPanel", () => {
  afterEach(() => {
    settings.rightSidebarSection = "pane";
    notes.list = [];
    notes.showAll = false;
    state.snapshot = null;
    state.selectedWorkspaceId = null;
  });

  it("shows the buttons Pane and Notes in the navigation bar, and not the buttons Scripts and Git", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.get(".navigation-bar").attributes("role")).toBe("tablist");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.attributes("role"))).toEqual(["tab", "tab"]);
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.text())).toEqual(["Pane", "Notes"]);
  });

  it("does not call a button of the navigation bar a tab", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find(".tabs").exists()).toBe(false);
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.attributes("title"))).toEqual(
      Array(2).fill("Show this sidebar section"),
    );
  });

  it("marks only the selected sidebar section as active", async () => {
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, true]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "true"]);
  });

  it("shows the sidebar section Pane first, and the sidebar section Notes after a click on its button", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find("inspector-stub").exists()).toBe(true);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(false);
    await wrapper.findAll(".navigation-bar button")[1].trigger("click");
    expect(settings.rightSidebarSection).toBe("notes");
    expect(wrapper.findAll(".navigation-bar button")[1].classes("on")).toBe(true);
    expect(wrapper.find("inspector-stub").exists()).toBe(false);
    expect(wrapper.find("notes-panel-stub").exists()).toBe(true);
  });

  it("shows the sidebar section Pane again after a click on its button", async () => {
    settings.rightSidebarSection = "notes";
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".navigation-bar button")[0].trigger("click");
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
    const badge = () => wrapper.findAll(".navigation-bar button")[1].find(".badge").text();
    expect(badge()).toBe("1");
    notes.showAll = true;
    await wrapper.vm.$nextTick();
    expect(badge()).toBe("2");
  });
});
