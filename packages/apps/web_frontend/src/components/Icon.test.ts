import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "./Icon.vue";

describe("Icon", () => {
  it("renders the Bootstrap Icons class of the name", () => {
    const wrapper = mount(Icon, { props: { name: "moon-stars" } });
    expect(wrapper.classes()).toEqual(["bi", "bi-moon-stars"]);
  });

  it("is hidden from screen readers", () => {
    expect(mount(Icon, { props: { name: "x" } }).attributes("aria-hidden")).toBe("true");
  });
});
