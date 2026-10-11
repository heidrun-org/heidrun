import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import ChatDatesLine from "./ChatDatesLine.vue";
import { settings } from "../stores/settings";
import type { ChatMeta } from "../stores/chats";

enableAutoUnmount(afterEach);

function metaWith(changes: Partial<ChatMeta> = {}): ChatMeta {
  return {
    first_at: new Date(2026, 9, 11, 21, 23).getTime(),
    last_at: new Date(2026, 9, 11, 21, 36).getTime(),
    user_messages: 4,
    first_messages: ["Fix the issue 250", "Make the card wider", "Thanks"],
    folders: ["/work/app", "/work/app/sub"],
    issues: [],
    pull_requests: [],
    files_written: [],
    ...changes,
  };
}

function mountLine(meta: ChatMeta = metaWith()) {
  return mount(ChatDatesLine, {
    attachTo: document.body,
    props: { text: "Oct 11, 21:23 → 21:36 · 4 messages from you", meta },
  });
}

beforeEach(() => {
  settings.language = "en";
  settings.timeFormat = "24h";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 13, 22, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatDatesLine", () => {
  it("shows the clock icon and the text of the line, and no card before a click", () => {
    const wrapper = mountLine();
    expect(wrapper.find(".bi-clock").exists()).toBe(true);
    expect(wrapper.text()).toBe("Oct 11, 21:23 → 21:36 · 4 messages from you");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("opens the card on a click on the line, with the facts of the chat", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    const facts = wrapper
      .findAll("[data-fact]")
      .map((fact) => [fact.find(".fact-label").text(), fact.find("[data-value]").text()]);
    expect(facts).toEqual([
      ["Started", "2 days ago"],
      ["Last activity", "2 days ago"],
      ["Duration", "13 minutes"],
      ["Messages from you", "4"],
    ]);
  });

  it("gives the full date in the title of a question mark after each of the two dates, and after nothing else", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    const marks = wrapper.findAll("[data-fact] [title]");
    expect(marks.map((mark) => mark.attributes("title"))).toEqual([
      "Sun, Oct 11, 2026, 21:23",
      "Sun, Oct 11, 2026, 21:36",
    ]);
    expect(marks[0].find(".bi-question-circle").exists()).toBe(true);
    expect(marks[0].attributes("aria-label")).toBe("Sun, Oct 11, 2026, 21:23");
  });

  it("reads the present time again each time the card opens", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    expect(wrapper.find("[data-value]").text()).toBe("2 days ago");
    await wrapper.trigger("click");
    vi.setSystemTime(new Date(2026, 9, 14, 22, 0));
    await wrapper.trigger("click");
    expect(wrapper.find("[data-value]").text()).toBe("3 days ago");
  });

  it("lists the first messages of the developer, in order, and no folder and no file", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    expect(wrapper.text()).toContain("Your first messages");
    expect(wrapper.findAll("[data-message]").map((message) => message.text())).toEqual([
      "Fix the issue 250",
      "Make the card wider",
      "Thanks",
    ]);
    expect(wrapper.find("[data-message] .bi-chat-left-text").exists()).toBe(true);
    expect(wrapper.find("[data-folder]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Folders where the coding agent ran");
  });

  it("leaves out a fact that the chat does not have", async () => {
    const wrapper = mountLine(metaWith({ first_at: null, last_at: null, first_messages: [] }));
    await wrapper.trigger("click");
    expect(wrapper.findAll("[data-fact]").map((fact) => fact.find(".fact-label").text())).toEqual(["Messages from you"]);
    expect(wrapper.find("[data-message]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Your first messages");
  });

  it("closes the card on the key Escape", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});
