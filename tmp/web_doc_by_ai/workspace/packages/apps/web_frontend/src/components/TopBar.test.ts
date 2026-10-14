import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

let TopBar: typeof import("./TopBar.vue").default;

beforeAll(async () => {
  // The theme store follows the colour scheme of the system, which jsdom does not know.
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  TopBar = (await import("./TopBar.vue")).default;
});

describe("TopBar", () => {
  it("does not show the name Heidrun", () => {
    const wrapper = mount(TopBar);
    expect(wrapper.text()).not.toContain("Heidrun");
  });

  it("shows the buttons Back and Forward, in this order, just on the left of the search button", () => {
    const wrapper = mount(TopBar);
    const back = wrapper.get('[data-direction="back"]').element;
    const forward = wrapper.get('[data-direction="forward"]').element;
    const search = wrapper.get(".search").element;
    expect(back.compareDocumentPosition(forward) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(forward.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(forward.parentElement?.nextElementSibling).toBe(search);
  });

  it("still shows the button of the left sidebar and the search button", () => {
    const wrapper = mount(TopBar);
    expect(wrapper.find(".icon-btn").exists()).toBe(true);
    expect(wrapper.find(".search").exists()).toBe(true);
  });
});
