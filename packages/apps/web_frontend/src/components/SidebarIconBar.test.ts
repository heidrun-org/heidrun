import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SidebarIconBar from "./SidebarIconBar.vue";

const sidebarSections = [
  { id: "first", label: "First", icon: "bell", badge: 0 },
  { id: "second", label: "Second", icon: "sticky", badge: 3, isLive: true },
  { id: "third", label: "Third", icon: "git", badge: 5, isAlert: true },
];

function mountSidebarIconBar(selectedId: string | null = "first", isCollapsed = false, side: "left" | "right" = "left") {
  return mount(SidebarIconBar, { props: { sidebarSections, selectedId, label: "Test sidebar", side, isCollapsed } });
}

describe("SidebarIconBar", () => {
  it("shows one icon for each sidebar section, in the given order, without its title", () => {
    const wrapper = mountSidebarIconBar();
    const buttons = wrapper.findAll("[role=tab]");
    expect(buttons.map((button) => button.get("i.bi").classes())).toEqual([
      expect.arrayContaining(["bi-bell"]),
      expect.arrayContaining(["bi-sticky"]),
      expect.arrayContaining(["bi-git"]),
    ]);
    expect(buttons.map((button) => button.text())).toEqual(["", "3", "5"]);
  });

  it("gives each icon the title of its sidebar section, as a tooltip and as an accessible name", () => {
    const wrapper = mountSidebarIconBar();
    const buttons = wrapper.findAll("[role=tab]");
    expect(buttons.map((button) => button.attributes("title"))).toEqual(["First", "Second", "Third"]);
    expect(buttons.map((button) => button.attributes("aria-label"))).toEqual(["First", "Second", "Third"]);
  });

  it("is a vertical list of tabs with the accessible name that its sidebar gives", () => {
    const wrapper = mountSidebarIconBar();
    const bar = wrapper.get(".sidebar-icon-bar .icons");
    expect(bar.attributes("role")).toBe("tablist");
    expect(bar.attributes("aria-orientation")).toBe("vertical");
    expect(bar.attributes("aria-label")).toBe("Test sidebar");
  });

  it("marks only the selected sidebar section as active", () => {
    const wrapper = mountSidebarIconBar("third");
    const buttons = wrapper.findAll("[role=tab]");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, false, true]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "false", "true"]);
  });

  it("marks no sidebar section as active when nothing is selected", () => {
    const wrapper = mountSidebarIconBar(null);
    expect(wrapper.findAll("[role=tab]").map((button) => button.classes("on"))).toEqual([false, false, false]);
  });

  it("gives the color of the working status to a live number, and the color of the blocked status to an alert number", () => {
    const wrapper = mountSidebarIconBar();
    expect(wrapper.findAll(".badge").map((badge) => [badge.classes("live"), badge.classes("alert")])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it("says the identifier of the sidebar section when the person clicks its icon", async () => {
    const wrapper = mountSidebarIconBar();
    await wrapper.findAll("[role=tab]")[1].trigger("click");
    await wrapper.findAll("[role=tab]")[0].trigger("click");
    expect(wrapper.emitted("select")).toEqual([["second"], ["first"]]);
  });

  it.each([
    ["left", "bi-chevron-bar-left"],
    ["right", "bi-chevron-bar-right"],
  ] as const)("shows above the icons of the expanded %s sidebar a collapse button with an arrow toward the edge", async (side, iconClass) => {
    const wrapper = mountSidebarIconBar("first", false, side);
    expect(wrapper.find(".expand-button").exists()).toBe(false);
    const collapseButton = wrapper.get(".sidebar-icon-bar > .collapse-button");
    expect(wrapper.get(".sidebar-icon-bar").element.firstElementChild).toBe(collapseButton.element);
    expect(collapseButton.get("i").classes()).toContain(iconClass);
    expect(collapseButton.attributes("aria-label")).toBe("Collapse the sidebar to a bar of icons");
    await collapseButton.trigger("click");
    expect(wrapper.emitted("toggle")).toEqual([[]]);
  });

  it.each([
    ["left", "bi-chevron-bar-right"],
    ["right", "bi-chevron-bar-left"],
  ] as const)("shows above the icons of the collapsed %s sidebar an expand button with an arrow toward the viewport", async (side, iconClass) => {
    const wrapper = mountSidebarIconBar(null, true, side);
    const expandButton = wrapper.get(".sidebar-icon-bar > .expand-button");
    expect(wrapper.get(".sidebar-icon-bar").element.firstElementChild).toBe(expandButton.element);
    expect(expandButton.get("i").classes()).toContain(iconClass);
    expect(expandButton.attributes("aria-label")).toBe("Expand the sidebar");
    expect(wrapper.find(".collapse-button").exists()).toBe(false);
    await expandButton.trigger("click");
    expect(wrapper.emitted("toggle")).toEqual([[]]);
  });
});
