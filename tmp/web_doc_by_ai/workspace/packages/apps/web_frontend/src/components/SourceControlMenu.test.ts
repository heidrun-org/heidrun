import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SourceControlMenu from "./SourceControlMenu.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SourceControlMenu", () => {
  it("lines up the right edge of the dropdown menu with the right edge of the button, whatever the width of the menu", async () => {
    const wrapper = mount(SourceControlMenu, {
      attachTo: document.body,
      props: { items: [{ id: "a", label: "A" }], icon: "three-dots", label: "More", buttonClass: "btn" },
    });
    const button = wrapper.get("button").element;
    button.getBoundingClientRect = () => ({ right: 500, bottom: 40, left: 480, top: 20, width: 20, height: 20, x: 480, y: 20, toJSON: () => ({}) });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 320 });
    await wrapper.get("button").trigger("click");
    await wrapper.vm.$nextTick();
    const menu = document.body.querySelector<HTMLElement>("[role=menu]");
    expect(menu?.style.left).toBe("180px");
    wrapper.unmount();
    delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  });

  it("keeps the dropdown menu inside the window when the menu is wider than the space at the left of the button", async () => {
    const wrapper = mount(SourceControlMenu, {
      attachTo: document.body,
      props: { items: [{ id: "a", label: "A" }], icon: "three-dots", label: "More", buttonClass: "btn" },
    });
    wrapper.get("button").element.getBoundingClientRect = () => ({ right: 100, bottom: 40, left: 80, top: 20, width: 20, height: 20, x: 80, y: 20, toJSON: () => ({}) });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 320 });
    await wrapper.get("button").trigger("click");
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector<HTMLElement>("[role=menu]")?.style.left).toBe("8px");
    wrapper.unmount();
    delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  });
});
