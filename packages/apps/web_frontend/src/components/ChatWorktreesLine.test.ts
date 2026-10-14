import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import ChatWorktreesLine from "./ChatWorktreesLine.vue";
import { openFolderAsWorkspace, toast } from "../stores/session";
import { settings } from "../stores/settings";
import type { ChatWorktree } from "../lib/chat_worktrees";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn(async () => {}) }));
vi.mock("../stores/session", () => ({ openFolderAsWorkspace: vi.fn(async () => undefined), toast: vi.fn() }));

enableAutoUnmount(afterEach);

const WORKTREES: ChatWorktree[] = [
  { name: "fix-tab-35", folder: "/work/app/.claude/worktrees/fix-tab-35" },
  { name: "add-icon-36", folder: "/work/app/.claude/worktrees/add-icon-36" },
  { name: "c41f", folder: "/Users/jerome/.codex/worktrees/c41f/app" },
];

/**
 * What the Tauri commands answer: `chats_worktrees_exist` gives the folders in `branches`, and `chats_worktrees_branches`
 * gives each of them with its branch. A worktree that is not in `branches` was removed.
 */
function answerWorktrees(branches: Record<string, string | null>) {
  vi.mocked(invoke).mockImplementation(async (command, payload) => {
    const folders = (payload as { folders?: string[] } | undefined)?.folders ?? [];
    if (command === "chats_worktrees_exist") {
      return folders.filter((folder) => folder in branches);
    }
    if (command === "chats_worktrees_branches") {
      return folders.filter((folder) => folder in branches).map((folder) => ({ folder, branch: branches[folder] }));
    }
    return null;
  });
}

const FIX_TAB = "/work/app/.claude/worktrees/fix-tab-35";

async function mountLine(entries: ChatWorktree[] = WORKTREES) {
  const wrapper = mount(ChatWorktreesLine, { attachTo: document.body, props: { entries } });
  await flushPromises();
  return wrapper;
}

/** Opens the card, and waits for the answer about the worktrees. */
async function openCard(wrapper: Awaited<ReturnType<typeof mountLine>>) {
  await wrapper.trigger("click");
  await flushPromises();
}

/** The rows of the open card: the name, the branch line, the folder, and the disabled state of the three buttons. */
function cardRows(wrapper: Awaited<ReturnType<typeof mountLine>>) {
  return wrapper.findAll("[data-worktree-row]").map((row) => ({
    name: row.get(".fw-medium").text(),
    branch: row.get("[data-branch]").text(),
    folder: row.get("[data-folder]").text(),
    disabled: row.findAll("button").map((button) => button.attributes("disabled") !== undefined),
  }));
}

beforeEach(() => {
  settings.language = "en";
  vi.mocked(invoke).mockReset();
  vi.mocked(openFolderAsWorkspace).mockClear();
  vi.mocked(revealItemInDir).mockClear();
  vi.mocked(toast).mockClear();
});

describe("the line", () => {
  it("writes the first two names, then how many more", async () => {
    answerWorktrees({});
    const wrapper = await mountLine();
    expect(wrapper.text().replace(/\s+/g, " ")).toBe("fix-tab-35, add-icon-36, +1");
  });

  it("asks about the listed worktrees only", async () => {
    answerWorktrees({});
    await mountLine();
    expect(invoke).toHaveBeenCalledWith("chats_worktrees_exist", {
      folders: [FIX_TAB, "/work/app/.claude/worktrees/add-icon-36"],
    });
  });

  it("puts the icon of a circle with a slash after the name of a removed worktree only", async () => {
    answerWorktrees({ [FIX_TAB]: "fix-tab-35" });
    const wrapper = await mountLine();
    const names = wrapper.findAll("span[data-worktree]");
    expect(names.map((name) => name.text())).toEqual(["fix-tab-35", "add-icon-36"]);
    expect(names[0]?.find("i.bi-slash-circle").exists()).toBe(false);
    expect(names[1]?.find("i.bi-slash-circle").exists()).toBe(true);
    expect(names[1]?.attributes("title")).toBe("The worktree add-icon-36 no longer exists on this Mac.");
  });

  it("shows no icon when the program cannot answer", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("no answer"));
    const wrapper = await mountLine();
    expect(wrapper.findAll("span[data-worktree]")).toHaveLength(2);
    expect(wrapper.find("i.bi-slash-circle").exists()).toBe(false);
  });

  it("shows no icon before the program has answered", async () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
    const wrapper = await mountLine();
    expect(wrapper.findAll("span[data-worktree]")).toHaveLength(2);
    expect(wrapper.find("i.bi-slash-circle").exists()).toBe(false);
  });

  it("asks again when the worktrees of the chat change", async () => {
    answerWorktrees({ "/Users/jerome/.codex/worktrees/c41f/app": "main" });
    const wrapper = await mountLine(WORKTREES.slice(0, 1));
    expect(wrapper.find("i.bi-slash-circle").exists()).toBe(true);
    await wrapper.setProps({ entries: WORKTREES.slice(2) });
    await flushPromises();
    expect(wrapper.find("i.bi-slash-circle").exists()).toBe(false);
  });
});

describe("the information card", () => {
  it("is closed until the line is clicked", async () => {
    answerWorktrees({});
    const wrapper = await mountLine();
    expect(wrapper.find("[data-worktree-row]").exists()).toBe(false);
  });

  it("lists every worktree of the chat, not only the two of the line, with its branch and its folder", async () => {
    answerWorktrees({ [FIX_TAB]: "fix-tab-35", "/Users/jerome/.codex/worktrees/c41f/app": null });
    const wrapper = await mountLine();
    await openCard(wrapper);
    expect(cardRows(wrapper)).toEqual([
      { name: "fix-tab-35", branch: "Branch fix-tab-35", folder: FIX_TAB, disabled: [false, false, false] },
      {
        name: "add-icon-36",
        branch: "No longer exists on this Mac",
        folder: "/work/app/.claude/worktrees/add-icon-36",
        disabled: [true, true, true],
      },
      { name: "c41f", branch: "Detached head", folder: "/Users/jerome/.codex/worktrees/c41f/app", disabled: [false, false, false] },
    ]);
  });

  it("has a title with the number of worktrees", async () => {
    answerWorktrees({});
    const wrapper = await mountLine();
    await openCard(wrapper);
    expect(wrapper.get(".worktrees-list .fw-medium").text()).toBe("3 worktrees");
  });

  it("asks about all the worktrees of the chat each time it opens", async () => {
    answerWorktrees({ [FIX_TAB]: "main" });
    const wrapper = await mountLine();
    await openCard(wrapper);
    expect(invoke).toHaveBeenCalledWith("chats_worktrees_branches", { folders: WORKTREES.map((worktree) => worktree.folder) });
  });

  it("leaves the buttons on when the program cannot answer", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("no answer"));
    const wrapper = await mountLine();
    await openCard(wrapper);
    expect(cardRows(wrapper).map((row) => row.disabled)).toEqual([
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ]);
  });

  it("opens the folder of the worktree as a workspace named after the worktree, selects it, and closes the card", async () => {
    answerWorktrees({ [FIX_TAB]: "main" });
    const wrapper = await mountLine();
    await openCard(wrapper);
    await wrapper.get("[data-worktree-row] [data-action=workspace]").trigger("click");
    expect(openFolderAsWorkspace).toHaveBeenCalledWith(FIX_TAB, "fix-tab-35");
    expect(wrapper.find("[data-worktree-row]").exists()).toBe(false);
  });

  it("opens the folder of the worktree in VS Code", async () => {
    answerWorktrees({ [FIX_TAB]: "main" });
    const wrapper = await mountLine();
    await openCard(wrapper);
    await wrapper.get("[data-worktree-row] [data-action=vscode]").trigger("click");
    expect(invoke).toHaveBeenCalledWith("chats_worktree_open_in_vscode", { folder: FIX_TAB });
  });

  it("shows the folder of the worktree in the Finder", async () => {
    answerWorktrees({ [FIX_TAB]: "main" });
    const wrapper = await mountLine();
    await openCard(wrapper);
    await wrapper.get("[data-worktree-row] [data-action=finder]").trigger("click");
    expect(revealItemInDir).toHaveBeenCalledWith(FIX_TAB);
  });

  it("shows a toast when VS Code cannot open the folder", async () => {
    answerWorktrees({ [FIX_TAB]: "main" });
    const wrapper = await mountLine();
    await openCard(wrapper);
    vi.mocked(invoke).mockRejectedValue("The folder cannot be opened.");
    await wrapper.get("[data-worktree-row] [data-action=vscode]").trigger("click");
    await flushPromises();
    expect(toast).toHaveBeenCalledWith("The folder cannot be opened.", "error");
  });

  it("gives each button a title that says what it does, or why it cannot", async () => {
    answerWorktrees({ [FIX_TAB]: "main" });
    const wrapper = await mountLine();
    await openCard(wrapper);
    const rows = wrapper.findAll("[data-worktree-row]");
    expect(rows[0]?.findAll("button").map((button) => button.attributes("title"))).toEqual([
      "Open the worktree fix-tab-35 as a workspace",
      "Open in VS Code",
      "Open the worktree fix-tab-35 in the Finder",
    ]);
    expect(rows[1]?.findAll("button").map((button) => button.attributes("title"))).toEqual([
      "Cannot open: the worktree no longer exists on this Mac.",
      "Cannot open: the worktree no longer exists on this Mac.",
      "Cannot open: the worktree no longer exists on this Mac.",
    ]);
  });
});
