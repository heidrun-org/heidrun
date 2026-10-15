import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import InlineRename from "./InlineRename.vue";

const mountRename = (props: { value: string; allowEmpty?: boolean }) =>
  mount(InlineRename, { props: { label: "Rename", ...props } });

describe("InlineRename", () => {
  it("starts with the current value", () => {
    expect(mountRename({ value: "Old" }).get("input").element.value).toBe("Old");
  });

  it("saves the trimmed new value on Enter", async () => {
    const wrapper = mountRename({ value: "Old" });
    await wrapper.get("input").setValue("  New  ");
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("save")).toEqual([["New"]]);
  });

  it("cancels on Escape", async () => {
    const wrapper = mountRename({ value: "Old" });
    await wrapper.get("input").setValue("New");
    await wrapper.get("input").trigger("keydown.esc");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("cancels when the value did not change", async () => {
    const wrapper = mountRename({ value: "Same" });
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("cancels an empty value unless an empty value is allowed", async () => {
    const wrapper = mountRename({ value: "Old" });
    await wrapper.get("input").setValue("");
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("cancel")).toHaveLength(1);

    const allowing = mountRename({ value: "Old", allowEmpty: true });
    await allowing.get("input").setValue("");
    await allowing.get("input").trigger("keydown.enter");
    expect(allowing.emitted("save")).toEqual([[""]]);
  });

  it("saves only once when Enter is followed by a blur", async () => {
    const wrapper = mountRename({ value: "Old" });
    await wrapper.get("input").setValue("New");
    await wrapper.get("input").trigger("keydown.enter");
    await wrapper.get("input").trigger("blur");
    expect(wrapper.emitted("save")).toHaveLength(1);
  });

  it("saves when the field loses the focus", async () => {
    const wrapper = mountRename({ value: "Old" });
    await wrapper.get("input").setValue("New");
    await wrapper.get("input").trigger("blur");
    expect(wrapper.emitted("save")).toEqual([["New"]]);
  });
});
