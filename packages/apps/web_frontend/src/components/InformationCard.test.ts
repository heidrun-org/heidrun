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

  it("places the card again when its height changes, so that it stays inside the window", async () => {
    let cardHeight = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return {
        top: 500, left: 700, right: 800, bottom: 520, width: 100, height: isCard ? cardHeight : 20, x: 700, y: 500, toJSON: () => ({}),
      };
    });
    let sizeChanged: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          sizeChanged = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain("top: 500px");
    cardHeight = 400;
    sizeChanged();
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain(`top: ${window.innerHeight - 400 - 8}px`);
    vi.unstubAllGlobals();
  });

  it("places the card again when the window changes its size", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100, left: 700, right: 800, bottom: 120, width: 100, height: 20, x: 700, y: 100, toJSON: () => ({}),
    });
    const wrapper = mountCard();
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const before = wrapper.get(".popover").attributes("style");
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth + 200 });
    window.dispatchEvent(new Event("resize"));
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).not.toBe(before);
    expect(wrapper.get(".popover").attributes("style")).toContain(`right: ${originalWidth + 200 - 700 + 8}px`);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
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

  it("puts the card at the right of the part, as high as the part, when the placement is end", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: 40, right: 240, bottom: 160, width: 200, height: 60, x: 40, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Issue", placement: "end" },
      slots: { default: "<span>Row</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const card = wrapper.get(".popover");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-end", "position-fixed"]));
    expect(card.classes()).not.toContain("bs-popover-start");
    expect(card.attributes("style")).toContain("top: 100px");
    expect(card.attributes("style")).toContain("left: 248px");
    expect(card.attributes("style")).toContain("right: auto");
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain("top: 22px");
  });

  it("puts the card below the part, with its arrow under the middle of the part, when the placement is bottom", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: 40, right: 60, bottom: 120, width: 20, height: 20, x: 40, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Help", placement: "bottom" },
      slots: { default: "<span>?</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    const card = wrapper.get(".popover");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-bottom", "position-fixed"]));
    expect(card.classes()).not.toContain("bs-popover-start");
    expect(card.attributes("style")).toContain("top: 128px");
    expect(card.attributes("style")).toContain("left: 40px");
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain("left: 8px");
  });

  it("keeps a card below the part inside the window, at the right edge", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isCard = this.classList.contains("popover");
      return isCard
        ? { top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 100, left: window.innerWidth - 30, right: window.innerWidth - 10, bottom: 120, width: 20, height: 20, x: 0, y: 100, toJSON: () => ({}) };
    });
    const wrapper = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Help", placement: "bottom" },
      slots: { default: "<span>?</span>", card: "<p>Text</p>" },
    });
    await wrapper.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".popover").attributes("style")).toContain(`left: ${window.innerWidth - 300 - 8}px`);
    expect(wrapper.get(".popover-arrow").attributes("style")).toContain(`left: ${window.innerWidth - 20 - (window.innerWidth - 308) - 8}px`);
  });
});

describe("InformationCard width", () => {
  it("gives the card the width of the property width, and the usual width without it", async () => {
    const narrow = mount(InformationCard, {
      attachTo: document.body,
      props: { label: "Context window", width: "16rem" },
      slots: { default: "<span>ring</span>", card: "<span>Inside the card</span>" },
    });
    await narrow.trigger("click");
    expect(narrow.get(".popover").attributes("style")).toContain("width: 16rem");

    const usual = mountCard();
    await usual.trigger("click");
    expect(usual.get(".popover").attributes("style") ?? "").not.toContain("width: 16rem");
  });
});
