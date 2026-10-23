import { afterEach, describe, expect, it, vi } from "vitest";
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

  describe("keeps its card inside the viewport, never under the right sidebar (issue #586)", () => {
    /** The width of the card: 20rem. */
    const CARD_WIDTH = 320;
    /** The width of the part of the usage wheel. */
    const PART_WIDTH = 30;

    /**
     * Opens the card of a usage wheel at 40 pixels from the right edge of the viewport. Without `viewportRight`, the usage
     * wheel is not inside a viewport, and the right edge of the window is the limit.
     */
    async function openNearTheRightEdge(viewportRight: number | null) {
      const right = viewportRight ?? window.innerWidth;
      const partLeft = right - 40 - PART_WIDTH;
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        if (this.hasAttribute("data-information-card-boundary")) {
          return { top: 0, left: 200, right, bottom: 700, width: right - 200, height: 700, x: 200, y: 0, toJSON: () => ({}) };
        }
        return this.classList.contains("popover")
          ? { top: 0, left: 0, right: CARD_WIDTH, bottom: 150, width: CARD_WIDTH, height: 150, x: 0, y: 0, toJSON: () => ({}) }
          : { top: 100, left: partLeft, right: partLeft + PART_WIDTH, bottom: 122, width: PART_WIDTH, height: 22, x: partLeft, y: 100, toJSON: () => ({}) };
      });
      const viewport = document.createElement("main");
      if (viewportRight !== null) {
        viewport.setAttribute("data-information-card-boundary", "");
      }
      document.body.appendChild(viewport);
      const wrapper = mount(UsageWheel, { attachTo: viewport, props: { usage: { percent: 13, used: 130_000, size: 1_000_000 } } });
      await wrapper.trigger("click");
      await wrapper.vm.$nextTick();
      const card = wrapper.get(".popover");
      const cardLeft = Number(/left: (-?[\d.]+)px/.exec(card.attributes("style") ?? "")?.[1]);
      const arrowLeft = Number(/left: (-?[\d.]+)px/.exec(wrapper.get(".popover-arrow").attributes("style") ?? "")?.[1]);
      return { cardLeft, arrowLeft, partMiddle: partLeft + PART_WIDTH / 2 };
    }

    afterEach(() => {
      vi.restoreAllMocks();
      document.querySelectorAll("main").forEach((element) => element.remove());
    });

    it("ends the card at the left of the right sidebar, with the arrow still under the usage wheel", async () => {
      const { cardLeft, arrowLeft, partMiddle } = await openNearTheRightEdge(window.innerWidth - 320);
      expect(cardLeft + CARD_WIDTH).toBeLessThanOrEqual(window.innerWidth - 320 - 8);
      expect(cardLeft + arrowLeft + 8).toBe(partMiddle);
    });

    it("ends the card at the left of the sidebar icon bar when the right sidebar is collapsed", async () => {
      const { cardLeft, arrowLeft, partMiddle } = await openNearTheRightEdge(window.innerWidth - 48);
      expect(cardLeft + CARD_WIDTH).toBeLessThanOrEqual(window.innerWidth - 48 - 8);
      expect(cardLeft + arrowLeft + 8).toBe(partMiddle);
    });

    it("ends the card inside the window when the right sidebar is hidden", async () => {
      const { cardLeft, arrowLeft, partMiddle } = await openNearTheRightEdge(null);
      expect(cardLeft + CARD_WIDTH).toBeLessThanOrEqual(window.innerWidth - 8);
      expect(cardLeft + arrowLeft + 8).toBe(partMiddle);
    });

    it("never puts the card at the left of the viewport, under the left sidebar", async () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        if (this.hasAttribute("data-information-card-boundary")) {
          return { top: 0, left: 300, right: 500, bottom: 700, width: 200, height: 700, x: 300, y: 0, toJSON: () => ({}) };
        }
        return this.classList.contains("popover")
          ? { top: 0, left: 0, right: CARD_WIDTH, bottom: 150, width: CARD_WIDTH, height: 150, x: 0, y: 0, toJSON: () => ({}) }
          : { top: 100, left: 420, right: 450, bottom: 122, width: 30, height: 22, x: 420, y: 100, toJSON: () => ({}) };
      });
      const viewport = document.createElement("main");
      viewport.setAttribute("data-information-card-boundary", "");
      document.body.appendChild(viewport);
      const wrapper = mount(UsageWheel, { attachTo: viewport, props: { usage: { percent: 13 } } });
      await wrapper.trigger("click");
      await wrapper.vm.$nextTick();
      const style = wrapper.get(".popover").attributes("style");
      expect(style).toContain("left: 308px");
      expect(style).toContain("--popover-max-width: 184px");
    });
  });

  it("does not open the card when the pointer only moves over the ring", async () => {
    const wrapper = mountUsageWheel({ percent: 7 });
    await wrapper.trigger("pointerenter");
    await wrapper.trigger("mouseover");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});
