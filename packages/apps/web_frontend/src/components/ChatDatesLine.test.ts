import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import ChatDatesLine from "./ChatDatesLine.vue";
import { settings } from "../stores/settings";
import type { ChatMeta, ChatUsage } from "../stores/chats";

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

function mountLine(meta: ChatMeta = metaWith(), usage: ChatUsage | null = null) {
  return mount(ChatDatesLine, {
    attachTo: document.body,
    props: { text: "Oct 11, 21:23 → 21:36 · 4 messages from you", meta, usage },
  });
}

function usageWith(changes: Partial<ChatUsage> = {}): ChatUsage {
  return { input_tokens: 3_218_500, cached_input_tokens: 3_035_392, output_tokens: 3_287, cost_usd: 4.5, ...changes };
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

  it("gives the input tokens, the cached input tokens, the output tokens, and the estimated cost after the messages", async () => {
    const wrapper = mountLine(metaWith(), usageWith());
    await wrapper.trigger("click");
    const facts = wrapper
      .findAll("[data-fact]")
      .map((fact) => [fact.find(".fact-label").text(), fact.find("[data-value]").text()]);
    expect(facts.slice(3)).toEqual([
      ["Messages from you", "4"],
      ["Input tokens", "3.22 MT"],
      ["Cached input tokens", "3.04 MT"],
      ["Output tokens", "3.29 KT"],
      ["Estimated cost", "$4.50"],
    ]);
  });

  it("gives the full number in the title of a question mark after each number of tokens that is short", async () => {
    const wrapper = mountLine(metaWith(), usageWith({ output_tokens: 84 }));
    await wrapper.trigger("click");
    const marks = wrapper.findAll("[data-fact] [title]").map((mark) => mark.attributes("title"));
    expect(marks.slice(2)).toEqual(["3,218,500 tokens", "3,035,392 tokens"]);
    const outputFact = wrapper.findAll("[data-fact]").find((fact) => fact.find(".fact-label").text() === "Output tokens");
    expect(outputFact?.find("[data-value]").text()).toBe("84");
    expect(outputFact?.find("[title]").exists()).toBe(false);
  });

  it("shows the numbers of tokens in a monospace font, and nothing else", async () => {
    const wrapper = mountLine(metaWith(), usageWith());
    await wrapper.trigger("click");
    const monospace = wrapper
      .findAll("[data-fact]")
      .filter((fact) => fact.find("[data-value]").classes().includes("font-monospace"))
      .map((fact) => fact.find(".fact-label").text());
    expect(monospace).toEqual(["Input tokens", "Cached input tokens", "Output tokens"]);
  });

  it("says on the screen that the cost is an estimate", async () => {
    const wrapper = mountLine(metaWith(), usageWith());
    await wrapper.trigger("click");
    const note = wrapper.find("[data-cost-note]");
    expect(note.text()).toContain("The cost is an estimate");
    expect(note.text()).toContain("A fixed subscription pays something else.");
  });

  it("shows the tokens without the cost and without the note when no price is known for a model of the chat", async () => {
    const wrapper = mountLine(metaWith(), usageWith({ cost_usd: null, cached_input_tokens: 0 }));
    await wrapper.trigger("click");
    const labels = wrapper.findAll("[data-fact]").map((fact) => fact.find(".fact-label").text());
    expect(labels).toEqual(["Started", "Last activity", "Duration", "Messages from you", "Input tokens", "Output tokens"]);
    expect(wrapper.find("[data-cost-note]").exists()).toBe(false);
  });

  it("shows no row about tokens for a chat that used no token", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    expect(wrapper.text()).not.toContain("Input tokens");
    expect(wrapper.find("[data-cost-note]").exists()).toBe(false);
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

  it("gives every fact and every first message the highlight of a row of the other information cards", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    const rows = [...wrapper.findAll("[data-fact]"), ...wrapper.findAll("[data-message]")];
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.classes()).toContain("list-group-item-action");
    }
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
