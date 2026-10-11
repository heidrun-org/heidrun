import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import NavigationBar from "./NavigationBar.vue";

const sidebarSections = [
  { id: "first", label: "First", badge: 0 },
  { id: "second", label: "Second", badge: 3, isLive: true },
  { id: "third", label: "Third", badge: 5 },
];

function mountNavigationBar(selectedId = "first") {
  return mount(NavigationBar, { props: { sidebarSections, selectedId, label: "Test sidebar" } });
}

describe("NavigationBar", () => {
  it("has the accessible name that its sidebar gives", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.get(".navigation-bar").attributes("aria-label")).toBe("Test sidebar");
  });

  it("shows one button for each sidebar section, in the given order", () => {
    const wrapper = mountNavigationBar();
    const labels = wrapper.findAll("button").map((button) => button.element.firstChild?.textContent?.trim());
    expect(labels).toEqual(["First", "Second", "Third"]);
  });

  it("shows a number on a button only when the badge is not 0", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.findAll("button").map((button) => button.find(".badge").exists())).toEqual([false, true, true]);
  });

  it("gives the color of the working status to the number of a live button only", () => {
    const wrapper = mountNavigationBar();
    expect(wrapper.findAll(".badge").map((badge) => badge.classes("live"))).toEqual([true, false]);
  });

  it("marks only the selected sidebar section as active", () => {
    const wrapper = mountNavigationBar("second");
    const buttons = wrapper.findAll("button");
    expect(buttons.map((button) => button.classes("on"))).toEqual([false, true, false]);
    expect(buttons.map((button) => button.attributes("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  it("says the identifier of the sidebar section when the person clicks its button", async () => {
    const wrapper = mountNavigationBar();
    await wrapper.findAll("button")[2].trigger("click");
    await wrapper.findAll("button")[0].trigger("click");
    expect(wrapper.emitted("select")).toEqual([["third"], ["first"]]);
  });
});
