import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import InformationCard from "./InformationCard.vue";

enableAutoUnmount(afterEach);

function mountCard() {
  return mount(InformationCard, {
    attachTo: document.body,
    props: { label: "Files written" },
    slots: { default: "<span>chats.rs</span>", card: "<button>Inside the card</button>" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InformationCard", () => {
  it("shows the part and no card at the start", () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toBe("chats.rs");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("opens the card on a click on the part", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
    expect(wrapper.classes()).toContain("is-open");
  });

  it("does not open the card when the pointer only rests on the part", async () => {
    vi.useFakeTimers();
    const wrapper = mountCard();
    await wrapper.trigger("pointerenter");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(wrapper.find(".popover").exists()).toBe(false);
    vi.useRealTimers();
  });

  it("does not open the card when the part only gets the keyboard focus", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("focusin");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("keeps the card open when the pointer leaves the part, and closes it on a second click", async () => {
    vi.useFakeTimers();
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("pointerleave");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(wrapper.classes()).not.toContain("is-open");
    vi.useRealTimers();
  });

  it("tells with the event open each time the card opens, and not when it closes", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("click");
    expect(wrapper.emitted("open")?.length).toBe(1);
    await wrapper.trigger("click");
    expect(wrapper.emitted("open")?.length).toBe(2);
  });

  it("opens the card on the key Enter and on the key Space when the part has the keyboard focus", async () => {
    const wrapper = mountCard();
    expect(wrapper.attributes("tabindex")).toBe("0");
    await wrapper.trigger("keydown", { key: "Enter" });
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("keydown", { key: " " });
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("puts the card inside the part, with the role group and the label", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    const card = wrapper.get(".popover");
    expect(card.attributes("role")).toBe("group");
    expect(card.attributes("aria-label")).toBe("Files written");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-start", "position-fixed"]));
    expect(card.get("button").text()).toBe("Inside the card");
  });

  it("closes the card on the key Escape", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("closes the card when the focus leaves, and keeps it when the focus goes to a button of the card", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.trigger("focusout", { relatedTarget: wrapper.get(".popover button").element });
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("focusout", { relatedTarget: document.body });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("closes the card on a press outside, and keeps it on a press inside", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    wrapper.get(".popover button").element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(true);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("keeps the card open on a click inside the card", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.get(".popover button").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("puts the card at the left of the part, as high as the part", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100, left: 700, right: 800, bottom: 120, width: 100, height: 20, x: 700, y: 100, toJSON: () => ({}),
    });
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const style = wrapper.get(".popover").attributes("style") ?? "";
    expect(style).toContain("top: 100px");
    expect(style).toContain(`right: ${window.innerWidth - 700 + 8}px`);
    expect(style).toContain("left: auto");
  });
});
