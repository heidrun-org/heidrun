import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SidebarIconBar from "./SidebarIconBar.vue";

const sidebarSections = [
  { id: "first", label: "First", icon: "bell", badge: 0 },
  { id: "second", label: "Second", icon: "sticky", badge: 3, isLive: true },
  { id: "third", label: "Third", icon: "git", badge: 5, isAlert: true },
];

function mountSidebarIconBar(selectedId = "first", side: "left" | "right" = "left") {
  return mount(SidebarIconBar, { props: { sidebarSections, selectedId, label: "Test sidebar", side } });
}

describe("SidebarIconBar", () => {
  it("shows one icon for each sidebar section, in the given order, without its title", () => {
    const wrapper = mountSidebarIconBar();
    const buttons = wrapper.findAll(".icons button");
    expect(buttons.map((button) => button.get("i.bi").classes())).toEqual([
      expect.arrayContaining(["bi-bell"]),
      expect.arrayContaining(["bi-sticky"]),
      expect.arrayContaining(["bi-git"]),
    ]);
    expect(buttons.map((button) => button.text())).toEqual(["", "3", "5"]);
  });

  it("gives each icon the title of its sidebar section, as a tooltip and as an accessible name", () => {
    const wrapper = mountSidebarIconBar();
    const buttons = wrapper.findAll(".icons button");
    expect(buttons.map((button) => button.attributes("title"))).toEqual(["First", "Second", "Third"]);
    expect(buttons.map((button) => button.attributes("aria-label"))).toEqual(["First", "Second", "Third"]);
  });

  it("is a vertical list of tabs with the accessible name that its sidebar gives", () => {
    const wrapper = mountSidebarIconBar();
    const icons = wrapper.get(".icons");
    expect(icons.attributes("role")).toBe("tablist");
    expect(icons.attributes("aria-orientation")).toBe("vertical");
    expect(icons.attributes("aria-label")).toBe("Test sidebar");
  });

  it("marks only the selected sidebar section as active", () => {
    const wrapper = mountSidebarIconBar("third");
    const buttons = wrapper.findAll(".icons button");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, false, true]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "false", "true"]);
  });

  it("keeps the colors of the numbers of the navigation bar", () => {
    const wrapper = mountSidebarIconBar();
    expect(wrapper.findAll(".badge").map((badge) => [badge.classes("live"), badge.classes("alert")])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it("says the identifier of the sidebar section when the person clicks its icon", async () => {
    const wrapper = mountSidebarIconBar();
    await wrapper.findAll(".icons button")[1].trigger("click");
    expect(wrapper.emitted("select")).toEqual([["second"]]);
  });

  it("has an expand button first, above the icons", async () => {
    const wrapper = mountSidebarIconBar();
    const expandButton = wrapper.get(".sidebar-icon-bar > .expand-button");
    expect(wrapper.get(".sidebar-icon-bar").element.firstElementChild).toBe(expandButton.element);
    expect(expandButton.attributes("aria-label")).toBe("Expand the sidebar");
    await expandButton.trigger("click");
    expect(wrapper.emitted("expand")).toEqual([[]]);
  });

  it.each([
    ["left", "bi-chevron-bar-right"],
    ["right", "bi-chevron-bar-left"],
  ] as const)("shows on the expand button of the %s sidebar an arrow toward the viewport", (side, iconClass) => {
    const wrapper = mountSidebarIconBar("first", side);
    expect(wrapper.get(".expand-button i").classes()).toContain(iconClass);
  });
});
