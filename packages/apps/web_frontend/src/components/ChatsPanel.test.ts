import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import ChatsPanel from "./ChatsPanel.vue";
import { CHAT_LIMITS, chats } from "../stores/chats";
import { state } from "../stores/session";
import { settings } from "../stores/settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
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
  const meta = { first_at: null, last_at: null, user_messages: 0, folders: [], issues: [], pull_requests: [], files_written: [] };
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
  chats.folder = null;
  chats.claude = [];
  chats.codex = [];
  chats.agent = "claude";
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

  it("shows the selector of the coding agent first, then the title of each conversation of Claude", async () => {
    answer(["Fix the tab bar", "Add the Chats sidebar section"], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.element.firstElementChild?.tagName).toBe("SELECT");
    expect(shownTitles(wrapper)).toEqual(["Fix the tab bar", "Add the Chats sidebar section"]);
  });

  it("offers Claude and Codex when both have conversations, and shows the titles of Codex after the choice", async () => {
    answer(["Fix the tab bar"], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.findAll("option").map((option) => option.text())).toEqual(["Claude", "Codex"]);
    await wrapper.get("select").setValue("codex");
    expect(shownTitles(wrapper)).toEqual(["Describe image"]);
  });

  it("offers only Codex when only Codex has conversations", async () => {
    answer([], ["Describe image"]);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.findAll("option").map((option) => option.text())).toEqual(["Codex"]);
    expect(shownTitles(wrapper)).toEqual(["Describe image"]);
  });

  it("tells that no chat was found, and shows no selector, when neither coding agent has a conversation", async () => {
    answer([], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.find("select").exists()).toBe(false);
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
    expect(wrapper.find("select").exists()).toBe(false);
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
    await wrapper.get("select").setValue("codex");
    ({ less, more } = pagerButtons(wrapper));
    expect(less.attributes("disabled")).toBeDefined();
    expect(more.attributes("disabled")).toBeDefined();
  });

  it("shows a spinning wheel in the button Show more while the chats load, and not before or after", async () => {
    answer(["Fix the tab bar"], [], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.find(".spinner-border").exists()).toBe(false);
    let finish: (value: unknown) => void = () => {};
    vi.mocked(invoke).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    await pagerButtons(wrapper).more.trigger("click");
    const { less, more } = pagerButtons(wrapper);
    expect(more.get(".spinner-border").attributes("aria-hidden")).toBe("true");
    expect(more.attributes("disabled")).toBeDefined();
    expect(more.attributes("aria-busy")).toBe("true");
    expect(less.find(".spinner-border").exists()).toBe(false);
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
    const meta = { first_at: null, last_at: null, user_messages: 0, folders: [], issues: [], pull_requests: [], files_written: ["/work/app/.claude/worktrees/fix/src/chats.rs", "/work/app/src/chats.rs"] };
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

  it("uses Bootstrap classes for the selector and the list", async () => {
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.get("select").classes()).toContain("form-select");
    expect(wrapper.get("ul").classes()).toEqual(expect.arrayContaining(["list-group", "list-group-flush"]));
    expect(wrapper.get("li").classes()).toEqual(expect.arrayContaining(["list-group-item", "list-group-item-action"]));
  });
});
