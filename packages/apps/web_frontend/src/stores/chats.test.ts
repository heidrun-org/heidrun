import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  availableChatAgents,
  canShowLessChats,
  canShowMoreChats,
  CHAT_LIMITS,
  chats,
  chooseChatAgent,
  chooseChatSortKey,
  chooseChatSortOrder,
  loadChats,
  nextChatLimit,
  previousChatLimit,
  selectedChatAgent,
  shownChats,
  showLessChats,
  showMoreChats,
  type Chat,
} from "./chats";
import { settings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** One conversation of the test. */
function chat(id: string, title: string): Chat {
  return {
    id,
    title,
    updated_at: 1,
    meta: { first_at: null, last_at: null, user_messages: 0, first_messages: [], folders: [], issues: [], pull_requests: [], files_written: [] },
  };
}

/** What the Tauri command `chats_list` answers. */
function answerOf(claude: Chat[], codex: Chat[] = [], hasMore: { claude?: boolean; codex?: boolean } = {}) {
  return {
    claude: { chats: claude, has_more: hasMore.claude ?? false },
    codex: { chats: codex, has_more: hasMore.codex ?? false },
  };
}

/** Stops the test until the answer of a Tauri command is given by hand. */
function answerByHand<T>() {
  let answer: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    answer = resolve;
  });
  return { promise, answer };
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  chats.folder = null;
  chats.claude = [];
  chats.codex = [];
  chats.agent = "claude";
  chats.hasMore = { claude: false, codex: false };
  chats.limit = CHAT_LIMITS[0];
  chats.isShowingMore = false;
  chats.isSorting = false;
  chats.isLoading = false;
  chats.error = null;
  settings.chatsSortKey = "last_updated";
  settings.chatsOrder = "newest";
});

describe("loadChats", () => {
  it("asks the Tauri command chats_list for the folder, and keeps the conversations of each coding agent", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [chat("b", "Second")]));
    await loadChats("/work/app");
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app", limit: 5, sortKey: "last_updated", order: "newest" });
    expect(chats.folder).toBe("/work/app");
    expect(chats.claude).toEqual([chat("a", "First")]);
    expect(chats.codex).toEqual([chat("b", "Second")]);
    expect(chats.isLoading).toBe(false);
    expect(chats.error).toBeNull();
  });

  it("asks for nothing and shows nothing when no workspace is selected", async () => {
    chats.claude = [chat("a", "First")];
    chats.folder = "/work/app";
    await loadChats(null);
    expect(invoke).not.toHaveBeenCalled();
    expect(chats.claude).toEqual([]);
    expect(chats.isLoading).toBe(false);
  });

  it("empties the lists at once when the folder changes, so that no conversation of another workspace shows", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const second = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(second.promise);
    const loading = loadChats("/work/website");
    expect(chats.claude).toEqual([]);
    expect(chats.isLoading).toBe(true);
    second.answer(answerOf([chat("c", "Third")]));
    await loading;
    expect(chats.claude).toEqual([chat("c", "Third")]);
  });

  it("keeps the lists on the screen while it reads the same folder again", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const again = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(again.promise);
    const loading = loadChats("/work/app");
    expect(chats.claude).toEqual([chat("a", "First")]);
    expect(chats.isLoading).toBe(false);
    again.answer(answerOf([chat("a", "First"), chat("d", "Fourth")]));
    await loading;
    expect(chats.claude.length).toBe(2);
  });

  it("drops the answer for a folder that is no longer the current one", async () => {
    const slow = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(slow.promise);
    const loadingOld = loadChats("/work/app");
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("c", "New workspace")]));
    await loadChats("/work/website");
    slow.answer(answerOf([chat("a", "Old workspace")]));
    await loadingOld;
    expect(chats.folder).toBe("/work/website");
    expect(chats.claude).toEqual([chat("c", "New workspace")]);
  });

  it("keeps the reason when the command fails", async () => {
    vi.mocked(invoke).mockRejectedValue("boom");
    await loadChats("/work/app");
    expect(chats.error).toBe("boom");
    expect(chats.isLoading).toBe(false);
  });
});

describe("the number of chats", () => {
  it("starts with 5 chats, then asks for 10, 20, and 50, then adds 50 for each click", () => {
    expect(CHAT_LIMITS[0]).toBe(5);
    expect([5, 10, 20, 50, 100, 150].map(nextChatLimit)).toEqual([10, 20, 50, 100, 150, 200]);
  });

  it("asks for the next number of chats after a click on Show more, and keeps the lists on the screen meanwhile", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    expect(canShowMoreChats.value).toBe(true);
    const more = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(more.promise);
    const showing = showMoreChats();
    expect(chats.isShowingMore).toBe(true);
    expect(chats.claude).toEqual([chat("a", "First")]);
    more.answer(answerOf([chat("a", "First"), chat("b", "Second")]));
    await showing;
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10, sortKey: "last_updated", order: "newest" });
    expect(chats.claude.length).toBe(2);
    expect(chats.isShowingMore).toBe(false);
    expect(canShowMoreChats.value).toBe(false);
  });

  it("keeps the raised number of chats when it reads the same folder again, and goes back to 5 for another folder", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    await showMoreChats();
    await loadChats("/work/app");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10, sortKey: "last_updated", order: "newest" });
    await loadChats("/work/website");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/website", limit: 5, sortKey: "last_updated", order: "newest" });
  });

  it("offers Show more only for the selected coding agent that has more chats", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [chat("b", "Second")], { codex: true }));
    await loadChats("/work/app");
    chats.agent = "claude";
    expect(canShowMoreChats.value).toBe(false);
    chats.agent = "codex";
    expect(canShowMoreChats.value).toBe(true);
  });

  it("goes back one step for each click on Show less, and never below 5", () => {
    expect([200, 150, 100, 50, 20, 10, 5].map(previousChatLimit)).toEqual([150, 100, 50, 20, 10, 5, 5]);
  });

  it("cuts the lists to the lower number of chats at once, and tells that the coding agent has more chats", async () => {
    const claude = ["a", "b", "c", "d", "e", "f", "g"].map((id) => chat(id, id));
    vi.mocked(invoke).mockResolvedValue(answerOf(claude));
    await loadChats("/work/app");
    chats.limit = 10;
    expect(canShowLessChats.value).toBe(true);
    expect(canShowMoreChats.value).toBe(false);
    vi.mocked(invoke).mockClear();
    showLessChats();
    expect(invoke).not.toHaveBeenCalled();
    expect(chats.limit).toBe(5);
    expect(chats.claude.map((item) => item.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(canShowMoreChats.value).toBe(true);
    expect(canShowLessChats.value).toBe(false);
    showLessChats();
    expect(chats.limit).toBe(5);
  });

  it("does not offer Show less when the list shows no more chats than the lower number allows", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First"), chat("b", "Second")]));
    await loadChats("/work/app");
    chats.limit = 20;
    expect(canShowLessChats.value).toBe(false);
  });

  it("drops an answer that was asked before a click on Show less, so the chats that were cut do not come back", async () => {
    const claude = ["a", "b", "c", "d", "e", "f", "g"].map((id) => chat(id, id));
    vi.mocked(invoke).mockResolvedValueOnce(answerOf(claude));
    await loadChats("/work/app");
    chats.limit = 10;
    const slow = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(slow.promise);
    const reading = loadChats("/work/app");
    showLessChats();
    slow.answer(answerOf(claude));
    await reading;
    expect(chats.claude.length).toBe(5);
  });

  it("does not ask twice when Show more is clicked twice at once", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    vi.mocked(invoke).mockClear();
    await Promise.all([showMoreChats(), showMoreChats()]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("the coding agents of the selector", () => {
  it("offers only the coding agents that have a conversation", () => {
    expect(availableChatAgents.value).toEqual([]);
    chats.codex = [chat("b", "Second")];
    expect(availableChatAgents.value).toEqual(["codex"]);
    chats.claude = [chat("a", "First")];
    expect(availableChatAgents.value).toEqual(["claude", "codex"]);
  });

  it("shows the coding agent that the developer chose", () => {
    chats.claude = [chat("a", "First")];
    chats.codex = [chat("b", "Second")];
    chats.agent = "codex";
    expect(selectedChatAgent.value).toBe("codex");
    expect(shownChats.value).toEqual([chat("b", "Second")]);
  });

  it("shows the first coding agent that has a conversation when the chosen one has none", () => {
    chats.codex = [chat("b", "Second")];
    chats.agent = "claude";
    expect(selectedChatAgent.value).toBe("codex");
    expect(shownChats.value).toEqual([chat("b", "Second")]);
  });

  it("shows no coding agent and no conversation when there is none", () => {
    expect(selectedChatAgent.value).toBeNull();
    expect(shownChats.value).toEqual([]);
  });
});

describe("the coding agent that the developer chose", () => {
  afterEach(() => {
    localStorage.removeItem("heidrun.settings");
    vi.resetModules();
  });

  it("is saved in the settings when the developer chooses it", () => {
    chooseChatAgent("codex");
    expect(chats.agent).toBe("codex");
    expect(settings.chatsAgent).toBe("codex");
  });

  it("is the coding agent of the next start, and Claude when the saved value is not a coding agent", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ chatsAgent: "codex" }));
    vi.resetModules();
    expect((await import("./chats")).chats.agent).toBe("codex");
    localStorage.setItem("heidrun.settings", JSON.stringify({ chatsAgent: "unknown" }));
    vi.resetModules();
    expect((await import("./chats")).chats.agent).toBe("claude");
  });
});

describe("the sort of the chats", () => {
  it("asks the Tauri command chats_list for the saved sort key and the saved order", async () => {
    settings.chatsSortKey = "messages";
    settings.chatsOrder = "oldest";
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app", limit: 5, sortKey: "messages", order: "oldest" });
  });

  it("starts with the sort key last_updated and the order newest, which is the order before the dropdown menu existed", () => {
    expect(settings.chatsSortKey).toBe("last_updated");
    expect(settings.chatsOrder).toBe("newest");
  });

  it("saves the sort key, and reads the chats again in the new order with the same number of chats", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    await showMoreChats();
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("b", "Second")]));
    await chooseChatSortKey("issues");
    expect(settings.chatsSortKey).toBe("issues");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10, sortKey: "issues", order: "newest" });
    expect(chats.claude).toEqual([chat("b", "Second")]);
  });

  it("saves the order, and reads the chats again from the other end", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("z", "Last")]));
    await chooseChatSortOrder("oldest");
    expect(settings.chatsOrder).toBe("oldest");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 5, sortKey: "last_updated", order: "oldest" });
    expect(chats.claude).toEqual([chat("z", "Last")]);
  });

  it("tells while the new order waits for its answer, and keeps the list on the screen meanwhile", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const waiting = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(waiting.promise);
    const sorting = chooseChatSortOrder("oldest");
    expect(chats.isSorting).toBe(true);
    expect(chats.claude).toEqual([chat("a", "First")]);
    waiting.answer(answerOf([chat("b", "Second")]));
    await sorting;
    expect(chats.isSorting).toBe(false);
    expect(chats.claude).toEqual([chat("b", "Second")]);
  });

  it("drops the answer of an earlier sort when the developer chose another sort meanwhile", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    const slow = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(slow.promise);
    const first = chooseChatSortKey("messages");
    vi.mocked(invoke).mockResolvedValueOnce(answerOf([chat("c", "Third")]));
    await chooseChatSortKey("issues");
    expect(chats.claude).toEqual([chat("c", "Third")]);
    expect(chats.isSorting).toBe(false);
    slow.answer(answerOf([chat("b", "Second")]));
    await first;
    expect(chats.claude).toEqual([chat("c", "Third")]);
    expect(chats.isSorting).toBe(false);
  });

  it("keeps the sort key and the order when the developer selects another workspace", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")]));
    await loadChats("/work/app");
    await chooseChatSortKey("files_written");
    await loadChats("/work/website");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/website", limit: 5, sortKey: "files_written", order: "newest" });
  });
});
