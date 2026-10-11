import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { availableChatAgents, chats, loadChats, selectedChatAgent, shownChats, type Chat } from "./chats";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** One conversation of the test. */
function chat(id: string, title: string): Chat {
  return { id, title, updated_at: 1 };
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
  chats.isLoading = false;
  chats.error = null;
});

describe("loadChats", () => {
  it("asks the Tauri command chats_list for the folder, and keeps the conversations of each coding agent", async () => {
    vi.mocked(invoke).mockResolvedValue({ claude: [chat("a", "First")], codex: [chat("b", "Second")] });
    await loadChats("/work/app");
    expect(invoke).toHaveBeenCalledWith("chats_list", { folder: "/work/app" });
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
    vi.mocked(invoke).mockResolvedValueOnce({ claude: [chat("a", "First")], codex: [] });
    await loadChats("/work/app");
    const second = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(second.promise);
    const loading = loadChats("/work/website");
    expect(chats.claude).toEqual([]);
    expect(chats.isLoading).toBe(true);
    second.answer({ claude: [chat("c", "Third")], codex: [] });
    await loading;
    expect(chats.claude).toEqual([chat("c", "Third")]);
  });

  it("keeps the lists on the screen while it reads the same folder again", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ claude: [chat("a", "First")], codex: [] });
    await loadChats("/work/app");
    const again = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(again.promise);
    const loading = loadChats("/work/app");
    expect(chats.claude).toEqual([chat("a", "First")]);
    expect(chats.isLoading).toBe(false);
    again.answer({ claude: [chat("a", "First"), chat("d", "Fourth")], codex: [] });
    await loading;
    expect(chats.claude.length).toBe(2);
  });

  it("drops the answer for a folder that is no longer the current one", async () => {
    const slow = answerByHand<unknown>();
    vi.mocked(invoke).mockReturnValueOnce(slow.promise);
    const loadingOld = loadChats("/work/app");
    vi.mocked(invoke).mockResolvedValueOnce({ claude: [chat("c", "New workspace")], codex: [] });
    await loadChats("/work/website");
    slow.answer({ claude: [chat("a", "Old workspace")], codex: [] });
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
