import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import HtmlTooltip from "./HtmlTooltip.vue";

enableAutoUnmount(afterEach);

/** Mounts a tooltip around a button, with the text of the tooltip written in HTML. */
function mountTooltip(html = "<p><strong>Title</strong></p><ul><li>First</li><li>Second</li></ul>") {
  return mount(HtmlTooltip, {
    attachTo: document.body,
    props: { html },
    slots: { default: `<template #default="{ describedBy }"><button :aria-describedby="describedBy">Part</button></template>` },
  });
}

describe("HtmlTooltip", () => {
  it("shows the part and no tooltip at the start", () => {
    const wrapper = mountTooltip();
    expect(wrapper.text()).toBe("Part");
    expect(wrapper.find(".tooltip").exists()).toBe(false);
    expect(wrapper.get("button").attributes("aria-describedby")).toBeUndefined();
  });

  it("opens a Bootstrap tooltip below the part when the pointer enters the part, and writes its text as HTML", async () => {
    const wrapper = mountTooltip();
    await wrapper.trigger("pointerenter");
    await flushPromises();
    const tooltip = wrapper.get(".tooltip");
    expect(tooltip.classes()).toEqual(expect.arrayContaining(["bs-tooltip-bottom", "show"]));
    expect(tooltip.attributes("role")).toBe("tooltip");
    expect(tooltip.find(".tooltip-arrow").exists()).toBe(true);
    expect(tooltip.get(".tooltip-inner strong").text()).toBe("Title");
    expect(tooltip.findAll(".tooltip-inner li").map((item) => item.text())).toEqual(["First", "Second"]);
  });

  it("opens the tooltip when the part gets the keyboard focus, and gives its identifier to the button", async () => {
    const wrapper = mountTooltip();
    await wrapper.trigger("focusin");
    await flushPromises();
    const tooltip = wrapper.get(".tooltip");
    expect(tooltip.attributes("id")).not.toBe("");
    expect(wrapper.get("button").attributes("aria-describedby")).toBe(tooltip.attributes("id"));
  });

  it("closes the tooltip when the pointer leaves the part, and when the keyboard focus leaves it", async () => {
    const wrapper = mountTooltip();
    await wrapper.trigger("pointerenter");
    await flushPromises();
    await wrapper.trigger("pointerleave");
    expect(wrapper.find(".tooltip").exists()).toBe(false);
    expect(wrapper.get("button").attributes("aria-describedby")).toBeUndefined();
    await wrapper.trigger("focusin");
    await flushPromises();
    await wrapper.trigger("focusout");
    expect(wrapper.find(".tooltip").exists()).toBe(false);
  });

  it("removes a script and an event handler from the HTML before it shows the HTML", async () => {
    const wrapper = mountTooltip(`<p onclick="alert(1)">Safe</p><script>alert(2)</script><img src="x" onerror="alert(3)">`);
    await wrapper.trigger("pointerenter");
    await flushPromises();
    const inner = wrapper.get(".tooltip-inner");
    expect(inner.text()).toBe("Safe");
    expect(inner.find("script").exists()).toBe(false);
    expect(inner.html()).not.toContain("onclick");
    expect(inner.html()).not.toContain("onerror");
  });

  it("gives a different identifier to each tooltip of the same application", async () => {
    const parent = mount(
      {
        components: { HtmlTooltip },
        template: `<div><HtmlTooltip html="<p>One</p>"><button>A</button></HtmlTooltip><HtmlTooltip html="<p>Two</p>"><button>B</button></HtmlTooltip></div>`,
      },
      { attachTo: document.body },
    );
    const parts = parent.findAll("span");
    await parts[0].trigger("pointerenter");
    await parts[1].trigger("pointerenter");
    await flushPromises();
    const identifiers = parent.findAll(".tooltip").map((tooltip) => tooltip.attributes("id"));
    expect(identifiers).toHaveLength(2);
    expect(identifiers[0]).not.toBe(identifiers[1]);
  });
});
