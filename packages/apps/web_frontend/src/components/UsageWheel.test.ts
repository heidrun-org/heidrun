import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import UsageWheel from "./UsageWheel.vue";
import type { ContextUsage } from "../lib/types";

enableAutoUnmount(afterEach);

function mountUsageWheel(usage: ContextUsage) {
  return mount(UsageWheel, { attachTo: document.body, props: { usage } });
}

/** The length of the ring that the dash of the arc leaves empty, as a share of the whole ring. */
function emptyShare(wrapper: ReturnType<typeof mountUsageWheel>): number {
  const arc = wrapper.get(".arc");
  return Number(arc.attributes("stroke-dashoffset")) / Number(arc.attributes("stroke-dasharray"));
}

describe("UsageWheel", () => {
  it("shows only a ring: no word, no bar, and no number beside it", () => {
    const wrapper = mountUsageWheel({ percent: 7, used: 14_000, size: 200_000 });
    expect(wrapper.find("svg.usage-wheel").exists()).toBe(true);
    expect(wrapper.text()).toBe("");
    expect(wrapper.find(".gauge").exists()).toBe(false);
  });

  it("names the ring with the percent used, for the screen reader", () => {
    const wrapper = mountUsageWheel({ percent: 7.4 });
    expect(wrapper.get("svg").attributes("role")).toBe("img");
    expect(wrapper.get("svg").attributes("aria-label")).toBe("Context window: 7 % used");
  });

  it("fills the ring in proportion to the percent used", () => {
    expect(emptyShare(mountUsageWheel({ percent: 0 }))).toBeCloseTo(1);
    expect(emptyShare(mountUsageWheel({ percent: 25 }))).toBeCloseTo(0.75);
    expect(emptyShare(mountUsageWheel({ percent: 100 }))).toBeCloseTo(0);
  });

  it("never fills the ring more than the whole ring, nor less than nothing", () => {
    expect(emptyShare(mountUsageWheel({ percent: 140 }))).toBeCloseTo(0);
    expect(emptyShare(mountUsageWheel({ percent: -5 }))).toBeCloseTo(1);
  });

  it("keeps the three levels of the usage bar: normal, warning, and critical", () => {
    expect(mountUsageWheel({ percent: 10 }).get("svg").classes()).toContain("lvl-ok");
    expect(mountUsageWheel({ percent: 59 }).get("svg").classes()).toContain("lvl-ok");
    expect(mountUsageWheel({ percent: 60 }).get("svg").classes()).toContain("lvl-warn");
    expect(mountUsageWheel({ percent: 80 }).get("svg").classes()).toContain("lvl-warn");
    expect(mountUsageWheel({ percent: 81 }).get("svg").classes()).toContain("lvl-crit");
  });

  it("shows no card at the start, and opens it below the ring on a click", async () => {
    const wrapper = mountUsageWheel({ percent: 7, used: 14_000, size: 200_000 });
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("click");
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-bottom");
    expect(card.attributes("aria-label")).toBe("Context window");
  });

  it("shows the percent used, the tokens used, and the size of the context window in the card", async () => {
    const wrapper = mountUsageWheel({ percent: 7.4, used: 14_000, size: 200_000 });
    await wrapper.trigger("click");
    expect(wrapper.get("[data-field=percent]").text()).toBe("Used7 %");
    expect(wrapper.get("[data-field=used]").text()).toBe("Tokens used14,000 tokens");
    expect(wrapper.get("[data-field=size]").text()).toBe("Window size200,000 tokens");
  });

  it("leaves out the rows of the numbers that the program does not know", async () => {
    const wrapper = mountUsageWheel({ percent: 7 });
    await wrapper.trigger("click");
    expect(wrapper.find("[data-field=percent]").exists()).toBe(true);
    expect(wrapper.find("[data-field=used]").exists()).toBe(false);
    expect(wrapper.find("[data-field=size]").exists()).toBe(false);
  });

  it("makes the card narrower than the usual card", async () => {
    const wrapper = mountUsageWheel({ percent: 7 });
    await wrapper.trigger("click");
    expect(wrapper.get(".popover").attributes("style")).toContain("width: 20rem");
  });

  it("closes the card on a second click, on the key Escape, on a press outside, and when the focus leaves", async () => {
    const wrapper = mountUsageWheel({ percent: 7 });
    await wrapper.trigger("click");
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);

    await wrapper.trigger("click");
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);

    await wrapper.trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);

    await wrapper.trigger("click");
    await wrapper.trigger("focusout", { relatedTarget: document.body });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("does not open the card when the pointer only moves over the ring", async () => {
    const wrapper = mountUsageWheel({ percent: 7 });
    await wrapper.trigger("pointerenter");
    await wrapper.trigger("mouseover");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});
