import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import ChatsPanel from "./ChatsPanel.vue";
import { CHAT_LIMITS, chats } from "../stores/chats";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import { keywordEntries } from "../stores/dynamic_topics";
import { launchAgent } from "../stores/agents";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("../stores/agents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stores/agents")>()),
  launchAgent: vi.fn(async () => "ok"),
}));
vi.mock("../lib/refs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/refs")>()),
  refContext: vi.fn(async () => ({
    base: "https://github.com/heidrun-org/heidrun",
    origin: "https://github.com",
    forge: "github",
    ticketUrl: null,
    ticketPrefixes: [],
    enabled: true,
  })),
}));

// A panel that stays mounted keeps its refresh timer, and the timer calls the Tauri command in the next test.
enableAutoUnmount(afterEach);

/** A Herdr session with one workspace whose folder is `folder`. */
function snapshotWith(folder: string) {
  return {
    version: "test",
    protocol: 1,
    workspaces: [
      { workspace_id: "w1", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "w1:t1", agent_status: "unknown", worktree: { path: folder } },
    ],
    tabs: [],
    panes: [],
    layouts: [],
    agents: [],
  } as never;
}

/** What the command chats_list answers. */
function answer(claudeTitles: string[], codexTitles: string[], hasMore: { claude?: boolean; codex?: boolean } = {}) {
  const meta = { first_at: null, last_at: null, user_messages: 0, first_messages: [], folders: [], issues: [], pull_requests: [], files_written: [] };
  const toChats = (prefix: string, titles: string[]) => titles.map((title, index) => ({ id: `${prefix}${index}`, title, updated_at: 1, meta }));
  vi.mocked(invoke).mockResolvedValue({
    root: "/work/app",
    claude: { chats: toChats("c", claudeTitles), has_more: hasMore.claude ?? false },
    codex: { chats: toChats("x", codexTitles), has_more: hasMore.codex ?? false },
  });
}

/** The titles that the list shows. */
function shownTitles(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll(".list-group-item").map((item) => item.get("div").text());
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  localStorage.clear();
  for (const id of Object.keys(keywordEntries)) {
    delete keywordEntries[id];
  }
  settings.dynamicTopicExtraction = "keyword";
  chats.folder = null;
  chats.claude = [];
  chats.codex = [];
  chats.agent = "claude";
  settings.chatsAgent = "claude";
  settings.chatsView = "compact";
  chats.hasMore = { claude: false, codex: false };
  chats.limit = CHAT_LIMITS[0];
  chats.error = null;
  state.snapshot = snapshotWith("/work/app");
  state.selectedWorkspaceId = "w1";
});

afterEach(() => {
  vi.useRealTimers();
  state.snapshot = null;
  state.selectedWorkspaceId = null;
});

describe("ChatsPanel", () => {
  it("asks for the conversations of the folder of the selected workspace", async () => {
    answer([], []);
    mount(ChatsPanel);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app", limit: 5 });
  });

  it("shows the header first, with the two groups of radio buttons and then a separator, and then the title of each conversation of Claude", async () => {
    answer(["Fix the tab bar", "Add the Chats sidebar section"], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const header = wrapper.element.firstElementChild as HTMLElement;
    expect(header.classList.contains("chats-header")).toBe(true);
    const groups = header.firstElementChild as HTMLElement;
    expect([...groups.children].map((child) => child.getAttribute("role"))).toEqual(["group", "group"]);
    expect(header.lastElementChild?.getAttribute("role")).toBe("separator");
    expect(header.nextElementSibling?.tagName).toBe("UL");
    expect(shownTitles(wrapper)).toEqual(["Fix the tab bar", "Add the Chats sidebar section"]);
  });

  it("offers every coding agent in a group of radio buttons, checks Claude, and shows the titles of Codex after the choice", async () => {
    answer(["Fix the tab bar"], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const group = wrapper.get('[aria-label="Coding agent"]');
    expect(group.classes()).toContain("btn-group");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Claude", "Codex"]);
    const inputs = group.findAll("input");
    expect(inputs.map((input) => input.attributes("type"))).toEqual(["radio", "radio"]);
    expect(inputs.map((input) => (input.element as HTMLInputElement).checked)).toEqual([true, false]);
    await inputs[1].setValue();
    expect(shownTitles(wrapper)).toEqual(["Describe image"]);
    expect(inputs.map((input) => (input.element as HTMLInputElement).checked)).toEqual([false, true]);
  });

  it("saves the coding agent that the developer chose, and starts with it the next time", async () => {
    answer(["Fix the tab bar"], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    await wrapper.get("#chats-agent-codex").setValue();
    expect(settings.chatsAgent).toBe("codex");
    expect(chats.agent).toBe("codex");
  });

  it("shows both coding agents, and disables the one that has no conversation, when only Codex has conversations", async () => {
    answer([], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const inputs = wrapper.get('[aria-label="Coding agent"]').findAll("input");
    expect(inputs.map((input) => input.attributes("disabled") !== undefined)).toEqual([true, false]);
    expect(inputs.map((input) => (input.element as HTMLInputElement).checked)).toEqual([false, true]);
    expect(wrapper.get('label[for="chats-agent-claude"]').attributes("title")).toBe(
      "No chat of this coding agent in this workspace.",
    );
    expect(shownTitles(wrapper)).toEqual(["Describe image"]);
  });

  it("offers the expanded view and the compact view in a group of radio buttons with an icon each, and starts compact", async () => {
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const group = wrapper.get('[aria-label="View of the list"]');
    expect(group.classes()).toContain("btn-group");
    const inputs = group.findAll("input");
    expect(inputs.map((input) => input.attributes("aria-label"))).toEqual(["Expanded view", "Compact view"]);
    expect(group.findAll("label").map((label) => label.attributes("title"))).toEqual(["Expanded view", "Compact view"]);
    expect(group.findAll("label .bi").map((icon) => icon.classes()[1])).toEqual(["bi-view-stacked", "bi-list"]);
    expect(inputs.map((input) => (input.element as HTMLInputElement).checked)).toEqual([false, true]);
    expect(wrapper.get("ul").classes()).not.toContain("is-expanded");
  });

  it("gives more air to the rows in the expanded view, and saves the view", async () => {
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    await wrapper.get("#chats-view-expanded").setValue();
    expect(wrapper.get("ul").classes()).toContain("is-expanded");
    expect(settings.chatsView).toBe("expanded");
    await wrapper.get("#chats-view-compact").setValue();
    expect(wrapper.get("ul").classes()).not.toContain("is-expanded");
    expect(settings.chatsView).toBe("compact");
  });

  it("starts in the expanded view when the developer left it there, and in the compact view for a value that is not valid", async () => {
    answer(["Fix the tab bar"], []);
    settings.chatsView = "expanded";
    const expanded = mount(ChatsPanel);
    await flushPromises();
    expect(expanded.get("ul").classes()).toContain("is-expanded");
    expect((expanded.get("#chats-view-expanded").element as HTMLInputElement).checked).toBe(true);
    expanded.unmount();
    (settings as { chatsView: string }).chatsView = "wide";
    const invalid = mount(ChatsPanel);
    await flushPromises();
    expect(invalid.get("ul").classes()).not.toContain("is-expanded");
  });

  it("tells that no chat was found, and shows no group of radio buttons, when neither coding agent has a conversation", async () => {
    answer([], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.find(".btn-group").exists()).toBe(false);
    expect(wrapper.text()).toBe("No chat of Claude or Codex was found for this workspace.");
  });

  it("asks for nothing and tells to select a workspace when no workspace is selected", async () => {
    state.selectedWorkspaceId = null;
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(invoke).not.toHaveBeenCalled();
    expect(wrapper.text()).toBe("Select a workspace to see its chats.");
  });

  it("shows the reason in an alert when the conversations cannot be read", async () => {
    vi.mocked(invoke).mockRejectedValue("boom");
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.get(".alert-danger").text()).toBe("boom");
    expect(wrapper.find(".btn-group").exists()).toBe(false);
  });

  it("reads the files again every 10 seconds while it is on the screen, and stops when it leaves the screen", async () => {
    vi.useFakeTimers();
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(invoke).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(invoke).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  /** The two buttons under the list: Show more, then Show less. */
  function pagerButtons(wrapper: ReturnType<typeof mount>) {
    const buttons = wrapper.get("ul + div").findAll("button");
    return { more: buttons[0], less: buttons[1] };
  }

  it("always shows the buttons Show more and Show less under the list, and disables the one that cannot act", async () => {
    answer(["Fix the tab bar"], ["Describe image"], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    let { less, more } = pagerButtons(wrapper);
    expect([more.text(), less.text()]).toEqual(["Show more", "Show less"]);
    expect(less.classes()).toContain("btn");
    expect(more.classes()).toContain("btn");
    expect(less.attributes("disabled")).toBeDefined();
    expect(more.attributes("disabled")).toBeUndefined();
    await wrapper.get("#chats-agent-codex").setValue();
    ({ less, more } = pagerButtons(wrapper));
    expect(less.attributes("disabled")).toBeDefined();
    expect(more.attributes("disabled")).toBeDefined();
  });

  it("shows a spinning wheel in the button Show more while the chats load, and not before or after", async () => {
    answer(["Fix the tab bar"], [], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.find(".spinner-border").exists()).toBe(false);
    const classesBefore = [pagerButtons(wrapper).more.classes().join(" "), pagerButtons(wrapper).less.classes().join(" ")];
    let finish: (value: unknown) => void = () => {};
    vi.mocked(invoke).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    await pagerButtons(wrapper).more.trigger("click");
    const { less, more } = pagerButtons(wrapper);
    expect(more.get(".spinner-border").attributes("aria-hidden")).toBe("true");
    expect(more.attributes("disabled")).toBeDefined();
    expect(more.attributes("aria-busy")).toBe("true");
    expect(less.find(".spinner-border").exists()).toBe(false);
    expect(more.get(".spinner-border").classes()).toEqual(
      expect.arrayContaining(["position-absolute", "end-0", "top-0", "bottom-0", "my-auto"]),
    );
    expect(more.get(".spinner-border").classes()).not.toContain("translate-middle-y");
    expect(more.classes()).toContain("justify-content-center");
    expect(less.classes()).toContain("justify-content-center");
    expect(more.text()).toBe("Show more");
    expect([more.classes().join(" "), less.classes().join(" ")]).toEqual(classesBefore);
    finish({ root: "/work/app", claude: { chats: [], has_more: true }, codex: { chats: [], has_more: false } });
    await flushPromises();
    expect(wrapper.find(".spinner-border").exists()).toBe(false);
  });

  it("asks for 10 chats after a click on Show more, and disables the button when there is no more chat", async () => {
    answer(["Fix the tab bar"], [], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    answer(["Fix the tab bar", "Add the Chats sidebar section"], [], { claude: false });
    await pagerButtons(wrapper).more.trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10 });
    expect(shownTitles(wrapper)).toEqual(["Fix the tab bar", "Add the Chats sidebar section"]);
    expect(pagerButtons(wrapper).more.attributes("disabled")).toBeDefined();
  });

  it("goes back to 5 chats after a click on Show less, without asking again, and then disables the button", async () => {
    const titles = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    answer(titles.slice(0, 5), [], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    answer(titles, [], { claude: false });
    await pagerButtons(wrapper).more.trigger("click");
    await flushPromises();
    expect(shownTitles(wrapper)).toEqual(titles);
    expect(pagerButtons(wrapper).less.attributes("disabled")).toBeUndefined();
    vi.mocked(invoke).mockClear();
    await pagerButtons(wrapper).less.trigger("click");
    expect(invoke).not.toHaveBeenCalled();
    expect(shownTitles(wrapper)).toEqual(titles.slice(0, 5));
    expect(pagerButtons(wrapper).less.attributes("disabled")).toBeDefined();
    expect(pagerButtons(wrapper).more.attributes("disabled")).toBeUndefined();
  });

  it("shows the summary of a chat in three lines under the title, each with its icon, and nothing under a chat that has nothing", async () => {
    settings.language = "en";
    settings.timeFormat = "24h";
    const year = new Date().getFullYear();
    const meta = {
      first_at: new Date(year, 9, 11, 17, 55).getTime(),
      last_at: new Date(year, 9, 11, 18, 20).getTime(),
      user_messages: 4,
      first_messages: [],
      folders: [],
      issues: [250],
      pull_requests: [249],
      files_written: ["/work/app/chats.rs", "/work/app/chats_scan.rs", "/work/app/a.ts"],
    };
    const emptyMeta = { ...meta, first_at: null, last_at: null, user_messages: 0, issues: [], pull_requests: [], files_written: [] };
    vi.mocked(invoke).mockResolvedValue({
      root: "/work/app",
      claude: {
        chats: [
          { id: "a", title: "Fix the tab bar", updated_at: 1, meta },
          { id: "b", title: "Nothing found", updated_at: 1, meta: emptyMeta },
        ],
        has_more: false,
      },
      codex: { chats: [], has_more: false },
    });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const rows = wrapper.findAll(".list-group-item");
    const lines = rows[0].get(".chat-summary");
    expect(lines.classes()).toEqual(expect.arrayContaining(["text-body-secondary"]));
    expect(lines.classes()).not.toContain("ms-3");
    expect(lines.element.children.length).toBe(3);
    expect(lines.element.children[0].textContent).toBe("Oct 11, 17:55 → 18:20 · 4 messages from you");
    expect(lines.element.children[0].querySelector(".bi-clock")).not.toBeNull();
    expect(lines.element.children[1].textContent).toBe("Issue #250 · Pull request #249");
    expect(lines.element.children[1].querySelector(".bi-github")).not.toBeNull();
    expect(lines.element.children[2].textContent).toBe("chats.rs, chats_scan.rs, +1");
    expect(lines.element.children[2].querySelector(".bi-file-earmark")).not.toBeNull();
    expect(rows[1].get(".chat-summary").element.children.length).toBe(0);
  });

  it("opens a card with the files of a chat, each one once, with its folders below the root of the repository, when the files line is clicked", async () => {
    const meta = { first_at: null, last_at: null, user_messages: 0, first_messages: [], folders: [], issues: [], pull_requests: [], files_written: ["/work/app/.claude/worktrees/fix/src/chats.rs", "/work/app/src/chats.rs"] };
    vi.mocked(invoke).mockResolvedValue({
      root: "/work/app",
      claude: { chats: [{ id: "a", title: "Fix the tab bar", updated_at: 1, meta }], has_more: false },
      codex: { chats: [], has_more: false },
    });
    const wrapper = mount(ChatsPanel, { attachTo: document.body });
    await flushPromises();
    await wrapper.get(".information-card-part").trigger("click");
    expect(wrapper.findAll("[data-file]").length).toBe(1);
    const row = wrapper.get("[data-file]");
    expect(row.get(".fw-medium").text()).toBe("chats.rs");
    expect(row.get(".folder").text()).toBe("src");
    expect(row.findAll("button").map((button) => button.attributes("title"))).toEqual([
      "Open in VS Code",
      "Open in GitHub",
    ]);
  });

  it("uses Bootstrap classes for the radio button groups and the list", async () => {
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.findAll(".btn-group > input.btn-check + label.btn")).toHaveLength(4);
    expect(wrapper.get("ul").classes()).toEqual(expect.arrayContaining(["list-group", "list-group-flush"]));
    expect(wrapper.get("li").classes()).toEqual(expect.arrayContaining(["list-group-item", "list-group-item-action"]));
  });

  it("gives each chat two buttons at the right of its title: open in the application of the coding agent, and open in Heidrun", async () => {
    answer(["Fix the tab bar", "Add the Chats sidebar section"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const groups = wrapper.findAll("li .chat-actions");
    expect(groups).toHaveLength(2);
    expect(groups[0].classes()).toContain("btn-group");
    const buttons = groups[0].findAll("button");
    expect(buttons.map((button) => button.attributes("title"))).toEqual(["Open in the Claude app", "Open in Heidrun"]);
    expect(buttons.map((button) => button.find(".bi").classes()[1])).toEqual(["bi-claude", "bi-heidrun-goat-only"]);
    expect(wrapper.get("li").get(".chat-title").text()).toBe("Fix the tab bar");
  });

  it("opens the address of the application of Claude, then of Codex, with the session identifier of the chat", async () => {
    answer(["Fix the tab bar"], ["Describe image"]);
    vi.mocked(openUrl).mockClear();
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    await wrapper.get("li .chat-actions button").trigger("click");
    expect(openUrl).toHaveBeenLastCalledWith("claude://code/c0");
    await wrapper.get("#chats-agent-codex").setValue();
    expect(wrapper.get("li .chat-actions button").attributes("title")).toBe("Open in the Codex app");
    expect(wrapper.get("li .chat-actions button .bi").classes()).toContain("bi-openai");
    await wrapper.get("li .chat-actions button").trigger("click");
    expect(openUrl).toHaveBeenLastCalledWith("codex://threads/x0");
  });

  it("starts a new tab of the selected workspace that resumes the chat, for Claude and for Codex", async () => {
    answer(["Fix the tab bar"], ["Describe image"]);
    vi.mocked(launchAgent).mockClear();
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    await wrapper.get('li .chat-actions button[title="Open in Heidrun"]').trigger("click");
    expect(launchAgent).toHaveBeenLastCalledWith({
      workspaceId: "w1",
      cwd: "/work/app",
      tool: "claude",
      agent: null,
      model: null,
      label: "Fix the tab bar",
      prompt: "",
      resumeId: "c0",
    });
    await wrapper.get("#chats-agent-codex").setValue();
    await wrapper.get('li .chat-actions button[title="Open in Heidrun"]').trigger("click");
    expect(launchAgent).toHaveBeenLastCalledWith(expect.objectContaining({ tool: "codex", label: "Describe image", resumeId: "x0" }));
  });

  it("shows the dynamic topics of each chat on one single line under its title, from the words that the other chats do not hold", async () => {
    answer(["Sidebar cache", "Sidebar tabs"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    const lines = wrapper.findAll(".list-group-item .chat-topics");
    expect(lines).toHaveLength(2);
    expect(lines[0].findAll(".badge").map((badge) => badge.text())).toEqual(["cache"]);
    expect(lines[1].findAll(".badge").map((badge) => badge.text())).toEqual(["tab"]);
    expect(lines[0].attributes("aria-label")).toBe("Dynamic topics of this chat");
    expect(lines[0].element.previousElementSibling?.querySelector(".chat-title")).not.toBeNull();
  });

  it("shows no line of topics for a chat that has no topic", async () => {
    answer(["Please"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.find(".chat-topics").exists()).toBe(false);
  });

  it("shows no topic when the method is Language model, which is not ready yet", async () => {
    settings.dynamicTopicExtraction = "languageModel";
    answer(["Sidebar cache", "Sidebar tabs"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.find(".chat-topics").exists()).toBe(false);
    expect(Object.keys(keywordEntries)).toEqual([]);
  });

  it("shows the topics when the developer changes the method back to Keyword", async () => {
    settings.dynamicTopicExtraction = "languageModel";
    answer(["Sidebar cache", "Sidebar tabs"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    settings.dynamicTopicExtraction = "keyword";
    await flushPromises();
    expect(wrapper.findAll(".chat-topics")).toHaveLength(2);
  });

  it("reads the titles of the issues of a chat on the forge, and shows their words as topics", async () => {
    const meta = { first_at: null, last_at: 100, user_messages: 0, first_messages: [], folders: [], issues: [260], pull_requests: [], files_written: [] };
    const plain = { ...meta, issues: [] };
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "forge_cli_cached") {
        return JSON.stringify({ title: "Zebra", state: "OPEN", body: "", labels: [], author: { login: "me" }, createdAt: "2026-10-11T10:00:00Z" });
      }
      return {
        root: "/work/app",
        claude: {
          chats: [
            { id: "c0", title: "Sidebar", updated_at: 1, meta },
            { id: "c1", title: "Cache", updated_at: 1, meta: plain },
          ],
          has_more: false,
        },
        codex: { chats: [], has_more: false },
      };
    });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.findAll(".chat-topics")[0].findAll(".badge").map((badge) => badge.text())).toEqual(["sidebar", "zebra"]);
  });

  describe("the dynamic topic bar", () => {
    /** Three chats whose titles give these topics: a "sidebar" chat and a "tabs" chat share "panel". */
    function answerWithSharedTopics() {
      answer(["Sidebar panel", "Tabs panel", "Cache"], []);
    }

    /** The texts of the buttons of the dynamic topic bar. */
    function barButtons(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll(".topic-chip").map((button) => button.text());
    }

    it("shows the button All first, then the topics, the topic that most chats have first, at the bottom of the header", async () => {
      answerWithSharedTopics();
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      expect(barButtons(wrapper)).toEqual(["All", "panel", "cache", "sidebar", "tab"]);
      const header = wrapper.get(".chats-header").element;
      const children = [...header.children];
      const bar = wrapper.get(".topic-bar").element;
      expect(children.indexOf(bar)).toBe(children.length - 2);
      expect(children[children.length - 1].getAttribute("role")).toBe("separator");
    });

    it("selects the button All at first, and shows every chat", async () => {
      answerWithSharedTopics();
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      expect(wrapper.findAll(".topic-chip").map((button) => button.attributes("aria-pressed"))).toEqual(["true", "false", "false", "false", "false"]);
      expect(shownTitles(wrapper)).toEqual(["Sidebar panel", "Tabs panel", "Cache"]);
    });

    it("shows only the chats of a topic after a click on the topic, and every chat again after a click on All", async () => {
      answerWithSharedTopics();
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      await wrapper.findAll(".topic-chip")[1].trigger("click");
      expect(shownTitles(wrapper)).toEqual(["Sidebar panel", "Tabs panel"]);
      expect(wrapper.findAll(".topic-chip").map((button) => button.attributes("aria-pressed"))).toEqual(["false", "true", "false", "false", "false"]);
      await wrapper.findAll(".topic-chip")[2].trigger("click");
      expect(shownTitles(wrapper)).toEqual(["Cache"]);
      await wrapper.findAll(".topic-chip")[0].trigger("click");
      expect(shownTitles(wrapper)).toEqual(["Sidebar panel", "Tabs panel", "Cache"]);
    });

    it("keeps the bar and its buttons while a topic filters the list", async () => {
      answerWithSharedTopics();
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      await wrapper.findAll(".topic-chip")[2].trigger("click");
      expect(barButtons(wrapper)).toEqual(["All", "panel", "cache", "sidebar", "tab"]);
    });

    it("forgets the topic when the developer chooses the other coding agent", async () => {
      answer(["Sidebar panel", "Tabs panel", "Cache"], ["Sidebar panel", "Zebra crossing"]);
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      await wrapper.findAll(".topic-chip")[2].trigger("click");
      expect(shownTitles(wrapper)).toEqual(["Cache"]);
      await wrapper.get("#chats-agent-codex").setValue();
      await flushPromises();
      expect(shownTitles(wrapper)).toEqual(["Sidebar panel", "Zebra crossing"]);
      expect(wrapper.findAll(".topic-chip")[0].attributes("aria-pressed")).toBe("true");
    });

    it("forgets a topic that the chats of the list do not have any more, so it does not filter again when it comes back", async () => {
      answerWithSharedTopics();
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      const original = [...chats.claude];
      await wrapper.findAll(".topic-chip")[1].trigger("click");
      expect(shownTitles(wrapper)).toEqual(["Sidebar panel", "Tabs panel"]);
      chats.claude = original.filter((chat) => chat.title === "Cache");
      await flushPromises();
      expect(shownTitles(wrapper)).toEqual(["Cache"]);
      chats.claude = original;
      await flushPromises();
      expect(shownTitles(wrapper)).toEqual(["Sidebar panel", "Tabs panel", "Cache"]);
      expect(wrapper.findAll(".topic-chip")[0].attributes("aria-pressed")).toBe("true");
    });

    it("shows no bar when no chat has a topic", async () => {
      answer(["Please"], []);
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      expect(wrapper.find(".topic-bar").exists()).toBe(false);
    });

    it("shows no bar when the method is Language model", async () => {
      settings.dynamicTopicExtraction = "languageModel";
      answerWithSharedTopics();
      const wrapper = mount(ChatsPanel);
      await flushPromises();
      expect(wrapper.find(".topic-bar").exists()).toBe(false);
    });
  });
});
