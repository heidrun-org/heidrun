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
    settings.rightSidebarSection = "pane";
  });

  it("shows one button for each sidebar section, in the navigation bar", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.get(".navigation-bar").attributes("role")).toBe("tablist");
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.attributes("role"))).toEqual(["tab", "tab", "tab", "tab"]);
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.text())).toEqual(["Pane", "Scripts", "Git", "Notes"]);
  });

  it("does not call a button of the navigation bar a tab", () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    expect(wrapper.find(".tabs").exists()).toBe(false);
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.attributes("title"))).toEqual(
      Array(4).fill("Show this sidebar section"),
    );
  });

  it("marks only the selected sidebar section as active", async () => {
    settings.rightSidebarSection = "git";
    const wrapper = mount(RightPanel, { global: { stubs } });
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, false, true, false]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "false", "true", "false"]);
  });

  it("selects a sidebar section when the person clicks its button", async () => {
    const wrapper = mount(RightPanel, { global: { stubs } });
    await wrapper.findAll(".navigation-bar button")[3].trigger("click");
    expect(settings.rightSidebarSection).toBe("notes");
    expect(wrapper.findAll(".navigation-bar button")[3].classes("on")).toBe(true);
  });
});
