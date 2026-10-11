import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AgentStatusSummary from "./AgentStatusSummary.vue";

describe("AgentStatusSummary", () => {
  it("shows the three counters, and the card only after a click on the item", async () => {
    const wrapper = mount(AgentStatusSummary);
    expect(wrapper.findAll(".counter")).toHaveLength(3);
    expect(wrapper.find(".card").exists()).toBe(false);
    await wrapper.trigger("mouseenter");
    expect(wrapper.find(".card").exists()).toBe(false);
    await wrapper.trigger("click");
    expect(wrapper.findAll(".group")).toHaveLength(3);
  });

  it("closes the card with the next click, and with the key Escape", async () => {
    const wrapper = mount(AgentStatusSummary, { attachTo: document.body });
    await wrapper.trigger("click");
    await wrapper.trigger("click");
    expect(wrapper.find(".card").exists()).toBe(false);
    await wrapper.trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".card").exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps the card open when the user clicks inside it", async () => {
    const wrapper = mount(AgentStatusSummary);
    await wrapper.trigger("click");
    await wrapper.get(".card").trigger("click");
    expect(wrapper.find(".card").exists()).toBe(true);
  });
});
