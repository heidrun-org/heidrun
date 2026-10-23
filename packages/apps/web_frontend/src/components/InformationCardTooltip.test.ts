import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import InformationCardTooltip from "./InformationCardTooltip.vue";

enableAutoUnmount(afterEach);

/** The delay of the tooltip, in milliseconds. The tests move a fake clock by this time. */
const OPEN_DELAY = 1500;

/** The clock is fake for the timers only: `flushPromises` of Vue Test Utils needs the real `setImmediate`. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Moves the fake clock by the delay of the tooltip, and waits for the tooltip to be drawn. */
async function waitForDelay(milliseconds = OPEN_DELAY): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await flushPromises();
}

/** The template of a button that owns a tooltip: the button receives the properties of the trigger with `v-bind`. */
const BUTTON_SLOT = `<template #default="{ triggerProps }"><button v-bind="triggerProps">Part</button></template>`;

/** The blocks of a card: a title and a text for each one. */
const BLOCKS = [
  { title: "What it is", text: "First text" },
  { title: "How it works", text: "Second text" },
];

/** Mounts a card around a button, with a heading and two blocks. */
function mountTooltip(title = "Heading", blocks = BLOCKS) {
  return mount(InformationCardTooltip, { attachTo: document.body, props: { title, blocks }, slots: { default: BUTTON_SLOT } });
}

/** Mounts a tooltip inside a host element, so that a test can see what the tooltip puts around the button, and beside it. */
function mountTooltipInHost() {
  return mount(
    {
      components: { InformationCardTooltip },
      template: `<div id="host"><InformationCardTooltip title="Heading" :blocks="[]" v-slot="{ triggerProps }"><button v-bind="triggerProps">Part</button></InformationCardTooltip></div>`,
    },
    { attachTo: document.body },
  );
}

/** The tooltip in the page. The tooltip is a child of the element `body`, so a wrapper never holds it. */
function tooltipElement(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".popover");
}

/** The button of the tooltip. */
function buttonOf(wrapper: VueWrapper) {
  return wrapper.get("button");
}

describe("InformationCardTooltip", () => {
  it("draws no element of its own around the button, and shows no tooltip at the start", () => {
    const wrapper = mountTooltipInHost();
    const host = wrapper.get("#host").element;
    expect(Array.from(host.children).map((child) => child.tagName)).toEqual(["BUTTON"]);
    expect(wrapper.text()).toBe("Part");
    expect(tooltipElement()).toBeNull();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBeUndefined();
  });

  it("opens a Bootstrap popover below the button when the pointer enters the button, with the layout of an information card", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay();
    const tooltip = tooltipElement();
    expect(tooltip).not.toBeNull();
    expect(Array.from(tooltip?.classList ?? [])).toEqual(expect.arrayContaining(["popover", "bs-popover-bottom", "show"]));
    expect(tooltip?.getAttribute("role")).toBe("tooltip");
    expect(tooltip?.querySelector(".popover-arrow")).not.toBeNull();
    const items = Array.from(tooltip?.querySelectorAll(".list-group.list-group-flush > .list-group-item") ?? []);
    expect(items).toHaveLength(3);
    expect(items[0].textContent?.trim()).toBe("Heading");
    expect(items[0].querySelector(".bi-question-circle")).not.toBeNull();
    expect(items.slice(1).map((item) => [item.querySelector(".fw-medium")?.textContent, item.querySelector(".text-body-secondary")?.textContent])).toEqual([
      ["What it is", "First text"],
      ["How it works", "Second text"],
    ]);
  });

  it("is a child of the element body, so it is never a sibling of the button", async () => {
    const wrapper = mountTooltipInHost();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay();
    expect(tooltipElement()?.parentElement).toBe(document.body);
    expect(wrapper.get("#host").element.querySelector(".popover")).toBeNull();
    expect(Array.from(wrapper.get("#host").element.children).map((child) => child.tagName)).toEqual(["BUTTON"]);
  });

  it("opens the tooltip when the button gets the keyboard focus, and gives its identifier to the button", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("focusin");
    await waitForDelay();
    const identifier = tooltipElement()?.getAttribute("id");
    expect(identifier).toBeTruthy();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBe(identifier);
  });

  it("closes the tooltip when the pointer leaves the button, and when the keyboard focus leaves it", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay();
    await buttonOf(wrapper).trigger("pointerleave");
    expect(tooltipElement()).toBeNull();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBeUndefined();
    await buttonOf(wrapper).trigger("focusin");
    await waitForDelay();
    await buttonOf(wrapper).trigger("focusout");
    expect(tooltipElement()).toBeNull();
  });

  it("opens the tooltip only after the delay, as the tooltip of the HTML attribute title does", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay(OPEN_DELAY - 1);
    expect(tooltipElement()).toBeNull();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBeUndefined();
    await waitForDelay(1);
    expect(tooltipElement()).not.toBeNull();
  });

  it("opens nothing when the pointer leaves before the delay ends, and the delay starts again at the next entry", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay(OPEN_DELAY - 100);
    await buttonOf(wrapper).trigger("pointerleave");
    await waitForDelay(OPEN_DELAY);
    expect(tooltipElement()).toBeNull();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay(OPEN_DELAY - 1);
    expect(tooltipElement()).toBeNull();
    await waitForDelay(1);
    expect(tooltipElement()).not.toBeNull();
  });

  it("opens the tooltip after the delay when the button keeps the keyboard focus, and not before", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("focusin");
    await waitForDelay(OPEN_DELAY - 1);
    expect(tooltipElement()).toBeNull();
    await waitForDelay(1);
    expect(tooltipElement()).not.toBeNull();
  });

  it("starts one timer only, when the pointer and the keyboard focus both arrive", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay(OPEN_DELAY - 100);
    await buttonOf(wrapper).trigger("focusin");
    await waitForDelay(100);
    expect(tooltipElement()).not.toBeNull();
  });

  it("opens nothing when the component is removed before the delay ends", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    wrapper.unmount();
    await waitForDelay();
    expect(tooltipElement()).toBeNull();
  });

  it("removes the tooltip from the page when the component is removed while the tooltip is open", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay();
    wrapper.unmount();
    expect(tooltipElement()).toBeNull();
  });

  it("writes a title and a text as text, never as markup", async () => {
    const wrapper = mountTooltip("<b>Heading</b>", [{ title: "<i>Title</i>", text: `<img src="x" onerror="alert(1)">Text` }]);
    await buttonOf(wrapper).trigger("pointerenter");
    await waitForDelay();
    const tooltip = tooltipElement();
    expect(tooltip?.querySelector("b")).toBeNull();
    expect(Array.from(tooltip?.querySelectorAll("i") ?? []).every((element) => element.classList.contains("bi"))).toBe(true);
    expect(tooltip?.querySelector("img")).toBeNull();
    expect(tooltip?.textContent).toContain("<b>Heading</b>");
  });

  it("gives a different identifier to each tooltip of the same application", async () => {
    const parent = mount(
      {
        components: { InformationCardTooltip },
        template: `<div><InformationCardTooltip title="One" :blocks="[]" v-slot="{ triggerProps }"><button v-bind="triggerProps">A</button></InformationCardTooltip><InformationCardTooltip title="Two" :blocks="[]" v-slot="{ triggerProps }"><button v-bind="triggerProps">B</button></InformationCardTooltip></div>`,
      },
      { attachTo: document.body },
    );
    const buttons = parent.findAll("button");
    await buttons[0].trigger("pointerenter");
    await buttons[1].trigger("pointerenter");
    await waitForDelay();
    const identifiers = Array.from(document.body.querySelectorAll(".popover")).map((tooltip) => tooltip.getAttribute("id"));
    expect(identifiers).toHaveLength(2);
    expect(identifiers[0]).not.toBe(identifiers[1]);
  });
});
