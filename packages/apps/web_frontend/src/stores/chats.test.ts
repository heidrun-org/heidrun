import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  availableChatAgents,
  canShowMoreChats,
  CHAT_LIMITS,
  chats,
  loadChats,
  nextChatLimit,
  selectedChatAgent,
  shownChats,
  showMoreChats,
  type Chat,
} from "./chats";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** One conversation of the test. */
function chat(id: string, title: string): Chat {
  return {
    id,
    title,
    updated_at: 1,
    meta: { first_at: null, last_at: null, user_messages: 0, folders: [], issues: [], pull_requests: [], files_written: [] },
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
  chats.isLoading = false;
  chats.error = null;
});

describe("loadChats", () => {
  it("asks the Tauri command chats_list for the folder, and keeps the conversations of each coding agent", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [chat("b", "Second")]));
    await loadChats("/work/app");
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app", limit: 5 });
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
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10 });
    expect(chats.claude.length).toBe(2);
    expect(chats.isShowingMore).toBe(false);
    expect(canShowMoreChats.value).toBe(false);
  });

  it("keeps the raised number of chats when it reads the same folder again, and goes back to 5 for another folder", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [], { claude: true }));
    await loadChats("/work/app");
    await showMoreChats();
    await loadChats("/work/app");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/app", limit: 10 });
    await loadChats("/work/website");
    expect(invoke).toHaveBeenLastCalledWith("chats_list", { folder: "/work/website", limit: 5 });
  });

  it("offers Show more only for the selected coding agent that has more chats", async () => {
    vi.mocked(invoke).mockResolvedValue(answerOf([chat("a", "First")], [chat("b", "Second")], { codex: true }));
    await loadChats("/work/app");
    chats.agent = "claude";
    expect(canShowMoreChats.value).toBe(false);
    chats.agent = "codex";
    expect(canShowMoreChats.value).toBe(true);
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
