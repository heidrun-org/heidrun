import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import ChatsPanel from "./ChatsPanel.vue";
import { chats } from "../stores/chats";
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
function answer(claudeTitles: string[], codexTitles: string[]) {
  const toChats = (prefix: string, titles: string[]) => titles.map((title, index) => ({ id: `${prefix}${index}`, title, updated_at: 1 }));
  vi.mocked(invoke).mockResolvedValue({ claude: toChats("c", claudeTitles), codex: toChats("x", codexTitles) });
}

/** The titles that the list shows. */
function shownTitles(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll(".list-group-item").map((item) => item.text());
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  chats.folder = null;
  chats.claude = [];
  chats.codex = [];
  chats.agent = "claude";
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
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app" });
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

  it("uses Bootstrap classes for the selector and the list", async () => {
    answer(["Fix the tab bar"], []);
    const wrapper = mount(ChatsPanel);
    await flushPromises();
    expect(wrapper.get("select").classes()).toContain("form-select");
    expect(wrapper.get("ul").classes()).toEqual(expect.arrayContaining(["list-group", "list-group-flush"]));
  });
});
