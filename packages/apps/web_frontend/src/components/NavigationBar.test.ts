import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import NavigationBar from "./NavigationBar.vue";

const sidebarSections = [
  { id: "first", label: "First", icon: "bell", badge: 0 },
  { id: "second", label: "Second", icon: "sticky", badge: 3, isLive: true },
  { id: "third", label: "Third", icon: "git", badge: 5, isAlert: true },
];

function mountNavigationBar(selectedId = "first", side: "left" | "right" = "left") {
  return mount(NavigationBar, { props: { sidebarSections, selectedId, label: "Test sidebar", side } });
}

describe("NavigationBar", () => {
  it("has the accessible name that its sidebar gives", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.get(".navigation-bar").attributes("aria-label")).toBe("Test sidebar");
  });

  it("shows one button for each sidebar section, in the given order", () => {
    const wrapper = mountNavigationBar();
    const labels = wrapper.findAll(".navigation-bar button").map((button) => button.get(".sidebar-section-label").text());
    expect(labels).toEqual(["First", "Second", "Third"]);
  });

  it("shows a number on a button only when the badge is not 0", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.findAll(".navigation-bar button").map((button) => button.find(".badge").exists())).toEqual([false, true, true]);
  });

  it("gives the color of the working status to the number of a live button only", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.findAll(".badge").map((badge) => badge.classes("live"))).toEqual([true, false]);
  });

  it("gives the color of the blocked status to the number of an alert button only", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.findAll(".badge").map((badge) => badge.classes("alert"))).toEqual([false, true]);
  });

  it("marks only the selected sidebar section as active", () => {
    const wrapper = mountNavigationBar("second");
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, true, false]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  it("says the identifier of the sidebar section when the person clicks its button", async () => {
    const wrapper = mountNavigationBar();
    await wrapper.findAll(".navigation-bar button")[2].trigger("click");
    await wrapper.findAll(".navigation-bar button")[0].trigger("click");
    expect(wrapper.emitted("select")).toEqual([["third"], ["first"]]);
  });

  it("shows the icon of each sidebar section before its title", () => {
    const wrapper = mountNavigationBar();
    const buttons = wrapper.findAll(".navigation-bar button");
    expect(buttons.map((button) => button.get("i.bi").classes())).toEqual([
      expect.arrayContaining(["bi-bell"]),
      expect.arrayContaining(["bi-sticky"]),
      expect.arrayContaining(["bi-git"]),
    ]);
    expect(buttons.map((button) => button.element.firstElementChild?.tagName.toLowerCase())).toEqual(["i", "i", "i"]);
  });

  it("shows the title of every sidebar section, selected or not", () => {
    const wrapper = mountNavigationBar("second");
    expect(wrapper.findAll(".navigation-bar button .sidebar-section-label").map((label) => label.text())).toEqual(["First", "Second", "Third"]);
  });

  it("has a collapse button after the buttons of the sidebar sections, outside the list of sidebar sections", () => {
    const wrapper = mountNavigationBar();
    const collapseButton = wrapper.get(".navigation-row > .collapse-button");
    expect(collapseButton.attributes("role")).toBeUndefined();
    expect(collapseButton.attributes("aria-label")).toBe("Collapse the sidebar to a bar of icons");
  });

  it.each([
    ["left", "bi-chevron-bar-left"],
    ["right", "bi-chevron-bar-right"],
  ] as const)("shows on the collapse button of the %s sidebar an arrow toward the edge of the window", (side, iconClass) => {
    const wrapper = mountNavigationBar("first", side);
    expect(wrapper.get(".collapse-button i").classes()).toContain(iconClass);
  });

  it("says that the person wants to collapse the sidebar when the person clicks the collapse button", async () => {
    const wrapper = mountNavigationBar();
    await wrapper.get(".collapse-button").trigger("click");
    expect(wrapper.emitted("collapse")).toEqual([[]]);
    expect(wrapper.emitted("select")).toBeUndefined();
  });
});
