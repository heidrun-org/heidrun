import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RightPanel from "./RightPanel.vue";
import { settings } from "../stores/settings";

const stubs = {
  Inspector: true,
  ActionsPanel: true,
  GitPanel: true,
  NotesPanel: true,
};

describe("RightPanel", () => {
  afterEach(() => {
    settings.rightTab = "pane";
  });

  it("shows one tab for each view, in a tab list", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.get(".tabs").attributes("role")).toBe("tablist");
    expect(wrapper.findAll(".tabs button").map((tab) => tab.attributes("role"))).toEqual(["tab", "tab", "tab", "tab"]);
    expect(wrapper.findAll(".tabs button").map((tab) => tab.text())).toEqual(["Pane", "Scripts", "Git", "Notes"]);
  });

  it("marks only the selected tab as active", async () => {
    settings.rightTab = "git";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const tabs = wrapper.findAll(".tabs button");
    expect(tabs.map((tab) => tab.classes("on"))).toEqual([false, false, true, false]);
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual(["false", "false", "true", "false"]);
  });

  it("selects a tab when the person clicks it", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".tabs button")[3].trigger("click");
    expect(settings.rightTab).toBe("notes");
    expect(wrapper.findAll(".tabs button")[3].classes("on")).toBe(true);
  });
});
