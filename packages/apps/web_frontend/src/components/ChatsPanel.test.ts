import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import ChatsPanel from "./ChatsPanel.vue";
import { CHAT_LIMITS, chats } from "../stores/chats";
import { state } from "../stores/session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

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

  it("shows the button Show more under the list only when the coding agent has more chats", async () => {
    answer(["Fix the tab bar"], ["Describe image"], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.get("ul + button").text()).toBe("Show more");
    expect(wrapper.get("ul + button").classes()).toContain("btn");
    await wrapper.get("select").setValue("codex");
    expect(wrapper.find("ul + button").exists()).toBe(false);
  });

  it("asks for 10 chats after a click on Show more, and hides the button when there is no more chat", async () => {
    answer(["Fix the tab bar"], [], { claude: true });
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    answer(["Fix the tab bar", "Add the Chats sidebar section"], [], { claude: false });
    await wrapper.get("ul + button").trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10 });
    expect(shownTitles(wrapper)).toEqual(["Fix the tab bar", "Add the Chats sidebar section"]);
    expect(wrapper.find("ul + button").exists()).toBe(false);
  });

  it("shows a small summary under the title of a chat that has meta information, and nothing under the others", async () => {
    const meta = { first_at: null, last_at: null, user_messages: 4, folders: [], issues: [250], pull_requests: [249], files_written: ["/a"] };
    const emptyMeta = { ...meta, user_messages: 0, issues: [], pull_requests: [], files_written: [] };
    vi.mocked(invoke).mockResolvedValue({
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
    expect(rows[0].get(".chat-summary").text()).toBe("4 messages from you · Issue #250 · Pull request #249 · 1 file written");
    expect(rows[0].get(".chat-summary").classes()).toContain("text-body-secondary");
    expect(rows[1].find(".chat-summary").exists()).toBe(false);
  });

  it("uses Bootstrap classes for the selector and the list", async () => {
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.get("select").classes()).toContain("form-select");
    expect(wrapper.get("ul").classes()).toEqual(expect.arrayContaining(["list-group", "list-group-flush"]));
  });
});
