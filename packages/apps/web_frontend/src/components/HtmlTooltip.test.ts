import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import HtmlTooltip from "./HtmlTooltip.vue";

enableAutoUnmount(afterEach);

/** The template of a button that owns a tooltip: the button receives the properties of the trigger with `v-bind`. */
const BUTTON_SLOT = `<template #default="{ triggerProps }"><button v-bind="triggerProps">Part</button></template>`;

/** Mounts a tooltip around a button, with the text of the tooltip written in HTML. */
function mountTooltip(html = "<p><strong>Title</strong></p><ul><li>First</li><li>Second</li></ul>") {
  return mount(HtmlTooltip, { attachTo: document.body, props: { html }, slots: { default: BUTTON_SLOT } });
}

/** Mounts a tooltip inside a host element, so that a test can see what the tooltip puts around the button, and beside it. */
function mountTooltipInHost() {
  return mount(
    {
      components: { HtmlTooltip },
      template: `<div id="host"><HtmlTooltip html="<p>Text</p>" v-slot="{ triggerProps }"><button v-bind="triggerProps">Part</button></HtmlTooltip></div>`,
    },
    { attachTo: document.body },
  );
}

/** The tooltip in the page. The tooltip is a child of the element `body`, so a wrapper never holds it. */
function tooltipElement(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".tooltip");
}

/** The button of the tooltip. */
function buttonOf(wrapper: VueWrapper) {
  return wrapper.get("button");
}

describe("HtmlTooltip", () => {
  it("draws no element of its own around the button, and shows no tooltip at the start", () => {
    const wrapper = mountTooltipInHost();
    const host = wrapper.get("#host").element;
    expect(Array.from(host.children).map((child) => child.tagName)).toEqual(["BUTTON"]);
    expect(wrapper.text()).toBe("Part");
    expect(tooltipElement()).toBeNull();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBeUndefined();
  });

  it("opens a Bootstrap tooltip below the button when the pointer enters the button, and writes its text as HTML", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await flushPromises();
    const tooltip = tooltipElement();
    expect(tooltip).not.toBeNull();
    expect(Array.from(tooltip?.classList ?? [])).toEqual(expect.arrayContaining(["tooltip", "bs-tooltip-bottom", "show"]));
    expect(tooltip?.getAttribute("role")).toBe("tooltip");
    expect(tooltip?.querySelector(".tooltip-arrow")).not.toBeNull();
    expect(tooltip?.querySelector(".tooltip-inner strong")?.textContent).toBe("Title");
    expect(Array.from(tooltip?.querySelectorAll(".tooltip-inner li") ?? []).map((item) => item.textContent)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("is a child of the element body, so it is never a sibling of the button", async () => {
    const wrapper = mountTooltipInHost();
    await buttonOf(wrapper).trigger("pointerenter");
    await flushPromises();
    expect(tooltipElement()?.parentElement).toBe(document.body);
    expect(wrapper.get("#host").element.querySelector(".tooltip")).toBeNull();
    expect(Array.from(wrapper.get("#host").element.children).map((child) => child.tagName)).toEqual(["BUTTON"]);
  });

  it("opens the tooltip when the button gets the keyboard focus, and gives its identifier to the button", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("focusin");
    await flushPromises();
    const identifier = tooltipElement()?.getAttribute("id");
    expect(identifier).toBeTruthy();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBe(identifier);
  });

  it("closes the tooltip when the pointer leaves the button, and when the keyboard focus leaves it", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await flushPromises();
    await buttonOf(wrapper).trigger("pointerleave");
    expect(tooltipElement()).toBeNull();
    expect(buttonOf(wrapper).attributes("aria-describedby")).toBeUndefined();
    await buttonOf(wrapper).trigger("focusin");
    await flushPromises();
    await buttonOf(wrapper).trigger("focusout");
    expect(tooltipElement()).toBeNull();
  });

  it("removes the tooltip from the page when the component is removed while the tooltip is open", async () => {
    const wrapper = mountTooltip();
    await buttonOf(wrapper).trigger("pointerenter");
    await flushPromises();
    wrapper.unmount();
    expect(tooltipElement()).toBeNull();
  });

  it("removes a script and an event handler from the HTML before it shows the HTML", async () => {
    const wrapper = mountTooltip(`<p onclick="alert(1)">Safe</p><script>alert(2)</script><img src="x" onerror="alert(3)">`);
    await buttonOf(wrapper).trigger("pointerenter");
    await flushPromises();
    const inner = tooltipElement()?.querySelector(".tooltip-inner");
    expect(inner?.textContent).toBe("Safe");
    expect(inner?.querySelector("script")).toBeNull();
    expect(inner?.innerHTML).not.toContain("onclick");
    expect(inner?.innerHTML).not.toContain("onerror");
  });

  it("gives a different identifier to each tooltip of the same application", async () => {
    const parent = mount(
      {
        components: { HtmlTooltip },
        template: `<div><HtmlTooltip html="<p>One</p>" v-slot="{ triggerProps }"><button v-bind="triggerProps">A</button></HtmlTooltip><HtmlTooltip html="<p>Two</p>" v-slot="{ triggerProps }"><button v-bind="triggerProps">B</button></HtmlTooltip></div>`,
      },
      { attachTo: document.body },
    );
    const buttons = parent.findAll("button");
    await buttons[0].trigger("pointerenter");
    await buttons[1].trigger("pointerenter");
    await flushPromises();
    const identifiers = Array.from(document.body.querySelectorAll(".tooltip")).map((tooltip) => tooltip.getAttribute("id"));
    expect(identifiers).toHaveLength(2);
    expect(identifiers[0]).not.toBe(identifiers[1]);
  });
});
