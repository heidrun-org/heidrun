import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import {
  isOnRemote,
  loadRemoteBranchNames,
  REMOTE_BRANCHES_LIFETIME_MS,
  remoteBranches,
} from "./git_remote_branches";

const ROOT = "/work/heidrun";
const NOW = 1_800_000_000_000;

/** The Tauri commands that the store called, in order. */
let calls: string[] = [];

describe("git_remote_branches", () => {
  beforeEach(() => {
    calls = [];
    localStorage.clear();
    remoteBranches.namesByRoot = {};
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      calls.push(command);
      return ["main", "dev_jerome"];
    });
  });

  it("asks the remote repository, and keeps the names", async () => {
    await loadRemoteBranchNames(ROOT, NOW);
    expect(calls).toEqual(["git_remote_branches"]);
    expect(remoteBranches.namesByRoot[ROOT]).toEqual(["main", "dev_jerome"]);
  });

  it("does not ask again during one day, even after a restart that empties the memory", async () => {
    await loadRemoteBranchNames(ROOT, NOW);
    remoteBranches.namesByRoot = {};
    await loadRemoteBranchNames(ROOT, NOW + REMOTE_BRANCHES_LIFETIME_MS - 1);
    expect(calls).toEqual(["git_remote_branches"]);
    expect(remoteBranches.namesByRoot[ROOT]).toEqual(["main", "dev_jerome"]);
  });

  it("asks again after one day", async () => {
    await loadRemoteBranchNames(ROOT, NOW);
    await loadRemoteBranchNames(ROOT, NOW + REMOTE_BRANCHES_LIFETIME_MS);
    expect(calls).toEqual(["git_remote_branches", "git_remote_branches"]);
  });

  it("asks once for two openings that overlap", async () => {
    await Promise.all([loadRemoteBranchNames(ROOT, NOW), loadRemoteBranchNames(ROOT, NOW)]);
    expect(calls).toEqual(["git_remote_branches"]);
  });

  it("uses the older answer when the remote repository cannot answer, and keeps nothing when there is none", async () => {
    await loadRemoteBranchNames(ROOT, NOW);
    remoteBranches.namesByRoot = {};
    vi.mocked(invoke).mockRejectedValue("network down");
    await loadRemoteBranchNames(ROOT, NOW + 2 * REMOTE_BRANCHES_LIFETIME_MS);
    expect(remoteBranches.namesByRoot[ROOT]).toEqual(["main", "dev_jerome"]);
    await loadRemoteBranchNames("/work/other", NOW);
    expect(remoteBranches.namesByRoot["/work/other"]).toBeUndefined();
  });

  it("does not keep a failed answer", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("network down");
    await loadRemoteBranchNames(ROOT, NOW);
    await loadRemoteBranchNames(ROOT, NOW + 1000);
    expect(calls).toEqual(["git_remote_branches"]);
    expect(remoteBranches.namesByRoot[ROOT]).toEqual(["main", "dev_jerome"]);
  });

  it("says a branch is only local only when it is known", () => {
    expect(isOnRemote(ROOT, "x", false)).toBe(true);
    remoteBranches.namesByRoot[ROOT] = ["main"];
    expect(isOnRemote(ROOT, "main", false)).toBe(true);
    expect(isOnRemote(ROOT, "x", false)).toBe(false);
    expect(isOnRemote(ROOT, "x", true)).toBe(true);
    expect(isOnRemote(null, "x", false)).toBe(true);
  });
});
