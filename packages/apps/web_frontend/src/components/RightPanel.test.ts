import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RightPanel from "./RightPanel.vue";
import { settings } from "../stores/settings";

const stubs = {
  Inspector: true,
  NotesPanel: true,
};

describe("RightPanel", () => {
  afterEach(() => {
    settings.rightSidebarSection = "pane";
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
});
