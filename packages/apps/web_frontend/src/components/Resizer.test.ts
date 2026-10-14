import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Resizer from "./Resizer.vue";

const props = { side: "left" as const, width: 280, min: 200, defaultWidth: 280 };

describe("Resizer", () => {
  it("draws its line in colour when a corner of the panes that touches it is under the pointer", () => {
    const wrapper = mount(Resizer, { props: { ...props, highlighted: true } });
    expect(wrapper.classes()).toContain("highlighted");
  });

  it("draws its line without colour when nothing touches it", () => {
    const wrapper = mount(Resizer, { props });
    expect(wrapper.classes()).not.toContain("highlighted");
  });

  it("takes no room, because the border of the panes is its line, when it is inside", () => {
    const wrapper = mount(Resizer, { props: { ...props, inside: true } });
    expect(wrapper.classes()).toContain("inside");
  });

  it("takes its own room when it is not inside", () => {
    const wrapper = mount(Resizer, { props });
    expect(wrapper.classes()).not.toContain("inside");
  });
});
