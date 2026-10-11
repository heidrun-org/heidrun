import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Resizer from "./Resizer.vue";

const props = { side: "left" as const, width: 280, min: 200, max: 520, defaultWidth: 280 };

describe("Resizer", () => {
  it("draws its line in colour when a corner of the panes that touches it is under the pointer", () => {
    const wrapper = mount(Resizer, { props: { ...props, highlighted: true } });
    expect(wrapper.classes()).toContain("highlighted");
  });

  it("draws its line without colour when nothing touches it", () => {
    const wrapper = mount(Resizer, { props });
    expect(wrapper.classes()).not.toContain("highlighted");
  });
});
