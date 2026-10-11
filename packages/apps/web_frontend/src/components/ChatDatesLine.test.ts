import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    props: { text: "Oct 11, 21:23 → 21:36 · 4 messages from you", meta, root: "/work/app" },
  });
}

beforeEach(() => {
  settings.language = "en";
  settings.timeFormat = "24h";
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
    const facts = wrapper.findAll("[data-fact]").map((fact) => fact.findAll("span").map((span) => span.text()));
    expect(facts).toEqual([
      ["Started", "Sun, Oct 11, 2026, 21:23"],
      ["Last activity", "Sun, Oct 11, 2026, 21:36"],
      ["Duration", "13 minutes"],
      ["Messages from you", "4"],
    ]);
  });

  it("lists the folders where the coding agent ran, below the root of the repository", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    expect(wrapper.text()).toContain("Folders where the coding agent ran");
    expect(wrapper.findAll("[data-folder]").map((folder) => folder.text())).toEqual(["./", "sub"]);
    expect(wrapper.find("[data-folder] .bi-folder2").exists()).toBe(true);
  });

  it("leaves out a fact that the chat does not have", async () => {
    const wrapper = mountLine(metaWith({ first_at: null, last_at: null, folders: [] }));
    await wrapper.trigger("click");
    expect(wrapper.findAll("[data-fact]").map((fact) => fact.find("span").text())).toEqual(["Messages from you"]);
    expect(wrapper.find("[data-folder]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Folders where the coding agent ran");
  });

  it("closes the card on the key Escape", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});
