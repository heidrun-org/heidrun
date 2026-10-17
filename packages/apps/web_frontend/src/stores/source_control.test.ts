import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./git", async (importOriginal) => {
  const original = await importOriginal<typeof import("./git")>();
  return { ...original, refreshGit: vi.fn() };
});

import { commit, discardFiles, sourceControl, splitFiles, stageFiles, writeCommitMessage } from "./source_control";
import { git, type GitStatus } from "./git";
import { answerConfirm, confirmDialog } from "./confirm";
import { state } from "./session";

/** The Tauri commands that the store called, with their arguments, in order. */
let calls: { command: string; args: unknown }[] = [];

function makeStatus(files: { status: string; path: string }[]): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    changed: files.length,
    untracked: 0,
    files,
    last_sha: "abc1234",
    last_subject: "first",
    last_time: null,
    remote: null,
  };
}

/** Waits until the confirmation modal dialog opens, then answers it. */
async function answerWhenAsked(isConfirmed: boolean) {
  await vi.waitFor(() => expect(confirmDialog.open).toBe(true));
  answerConfirm(isConfirmed);
}

beforeEach(() => {
  calls = [];
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    calls.push({ command, args });
    if (command === "git_commit_diff") {
      return "diff --git a/README.md b/README.md\n+new line\n";
    }
    if (command === "coding_agent_ask") {
      return { agent: "codex", text: "  Add a line to the README\n" };
    }
    return null;
  });
  state.selectedWorkspaceId = "w1";
});

afterEach(() => {
  state.selectedWorkspaceId = null;
  git.status = {};
  sourceControl.messages = {};
  vi.clearAllMocks();
});

describe("splitFiles", () => {
  it("puts a staged file in Staged Changes, a changed file in Changes, and a file changed twice in both groups", () => {
    const groups = splitFiles(
      makeStatus([
        { status: "M.", path: "src/staged.ts" },
        { status: ".M", path: "README.md" },
        { status: "MM", path: "docs/both.md" },
        { status: "A.", path: "new_staged.ts" },
        { status: ".D", path: "gone.ts" },
      ]),
    );
    expect(groups.staged.map((file) => [file.path, file.letter])).toEqual([
      ["src/staged.ts", "M"],
      ["docs/both.md", "M"],
      ["new_staged.ts", "A"],
    ]);
    expect(groups.changes.map((file) => [file.path, file.letter])).toEqual([
      ["README.md", "M"],
      ["docs/both.md", "M"],
      ["gone.ts", "D"],
    ]);
  });

  it("shows a new file that Git does not know as U, and a file in conflict as !, in Changes", () => {
    const groups = splitFiles(
      makeStatus([
        { status: "??", path: "untracked.txt" },
        { status: "UU", path: "conflict.txt" },
      ]),
    );
    expect(groups.staged).toEqual([]);
    expect(groups.changes.map((file) => file.letter)).toEqual(["U", "!"]);
  });

  it("splits the path into the file name and its folders, with no folder at the root of the repository", () => {
    const [nested, root] = splitFiles(
      makeStatus([
        { status: ".M", path: "docs/agents_rules/user_interface.md" },
        { status: ".M", path: "CHANGELOG.md" },
      ]),
    ).changes;
    expect([nested.name, nested.folder]).toEqual(["user_interface.md", "docs/agents_rules"]);
    expect([root.name, root.folder]).toEqual(["CHANGELOG.md", ""]);
  });
});

describe("Git actions", () => {
  it("stages the files on the root of the repository", async () => {
    git.status = { w1: makeStatus([{ status: ".M", path: "README.md" }]) };
    await stageFiles(["README.md"]);
    expect(calls).toEqual([{ command: "git_stage", args: { root: "/work/heidrun", paths: ["README.md"] } }]);
  });

  it("discards the changes only after the user confirms it", async () => {
    git.status = { w1: makeStatus([{ status: ".M", path: "README.md" }]) };
    const refused = discardFiles(["README.md"]);
    await answerWhenAsked(false);
    await refused;
    expect(calls).toEqual([]);
    const accepted = discardFiles(["README.md"]);
    await answerWhenAsked(true);
    await accepted;
    expect(calls).toEqual([{ command: "git_discard", args: { root: "/work/heidrun", paths: ["README.md"] } }]);
  });

  it("commits the staged files with the message, then empties the message box", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    sourceControl.messages.w1 = "Add a line";
    await commit("commit");
    expect(calls).toEqual([{ command: "git_commit", args: { root: "/work/heidrun", message: "Add a line", amend: false } }]);
    expect(sourceControl.messages.w1).toBe("");
  });

  it("stages every change with no question when nothing is staged, then commits", async () => {
    git.status = {
      w1: makeStatus([
        { status: ".M", path: "README.md" },
        { status: "??", path: "NEW.md" },
      ]),
    };
    sourceControl.messages.w1 = "Add a line";
    await commit("commit");
    expect(confirmDialog.open).toBe(false);
    expect(calls).toEqual([
      { command: "git_stage", args: { root: "/work/heidrun", paths: ["README.md", "NEW.md"] } },
      { command: "git_commit", args: { root: "/work/heidrun", message: "Add a line", amend: false } },
    ]);
    expect(sourceControl.messages.w1).toBe("");
  });

  it("does not stage anything and does not commit when nothing changed", async () => {
    git.status = { w1: makeStatus([]) };
    sourceControl.messages.w1 = "Add a line";
    await commit("commit");
    expect(calls).toEqual([]);
  });

  it("does not commit without a message", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    await commit("commit");
    expect(calls).toEqual([]);
  });

  it("pushes after the commit with the mode commit and push", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    sourceControl.messages.w1 = "Add a line";
    await commit("commitAndPush");
    expect(calls.map((call) => call.command)).toEqual(["git_commit", "git_sync"]);
    expect(calls[1].args).toEqual({ root: "/work/heidrun", action: "push" });
  });

  it("puts the commit message that the coding agent wrote from the diff in the message box", async () => {
    git.status = { w1: makeStatus([{ status: "M.", path: "README.md" }]) };
    await writeCommitMessage();
    expect(calls.map((call) => call.command)).toEqual(["git_commit_diff", "coding_agent_ask"]);
    expect((calls[1].args as { prompt: string }).prompt).toContain("+new line");
    expect(sourceControl.messages.w1).toBe("Add a line to the README");
  });
});
