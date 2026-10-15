import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("../stores/git", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stores/git")>();
  return { ...original, refreshGit: vi.fn() };
});

import GitBranchPicker from "./GitBranchPicker.vue";
import { git, refreshGit, type GitStatus } from "../stores/git";
import { filterGitBranches, type GitBranch } from "../stores/git_branches";
import { state } from "../stores/session";
import { branchUrl } from "../lib/refs";
import { remoteBranches } from "../stores/git_remote_branches";

function makeStatus(overrides: Partial<GitStatus>): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    changed: 0,
    untracked: 0,
    files: [],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: "git@github.com:heidrun-org/heidrun.git",
    ...overrides,
  };
}

function makeBranch(overrides: Partial<GitBranch>): GitBranch {
  return {
    name: "main",
    is_current: false,
    last_sha: "37118fb",
    last_subject: "Merge pull request",
    last_author: "Jerome Etienne",
    last_time: Math.floor(Date.now() / 1000) - 600,
    has_remote_tracking: true,
    ...overrides,
  };
}

const BRANCHES = [
  makeBranch({ name: "main", is_current: true }),
  makeBranch({ name: "dev_jerome", last_sha: "1c93161", last_subject: "Make the shortcut start the command" }),
  makeBranch({ name: "docs-architecture", last_sha: "7449099", last_author: "Someone Else" }),
];

/** The Tauri commands that the component called, with their arguments, in order. */
let calls: { command: string; args: unknown }[] = [];
let checkoutError: string | null = null;
let remoteNames: string[] = [];
let trackedNames: string[] | null = null;

describe("GitBranchPicker", () => {
  beforeEach(() => {
    calls = [];
    checkoutError = null;
    remoteNames = [];
    trackedNames = null;
    localStorage.clear();
    remoteBranches.namesByRoot = {};
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      if (command === "git_remote_branches") {
        return remoteNames;
      }
      calls.push({ command, args });
      if (command === "git_branches") {
        return BRANCHES.map((branch) => ({
          ...branch,
          has_remote_tracking: trackedNames === null ? true : trackedNames.includes(branch.name),
        }));
      }
      if (command === "git_checkout" && checkoutError !== null) {
        throw checkoutError;
      }
      return "";
    });
    vi.mocked(refreshGit).mockClear();
    vi.mocked(openUrl).mockClear();
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({}) };
  });

  afterEach(() => {
    state.selectedWorkspaceId = null;
    state.toast = "";
    git.status = {};
  });

  it("shows the Git icon and the branch name, with a star when the working folder has a change", async () => {
    git.status = { w1: makeStatus({ untracked: 1 }) };
    const wrapper = mount(GitBranchPicker);
    expect(wrapper.get(".branch").text()).toBe("main*");
    expect(wrapper.find(".bi-git").exists()).toBe(true);
  });

  it("opens the picker with a click, and lists the local branches with the last commit of each", async () => {
    const wrapper = mount(GitBranchPicker);
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("click");
    await flushPromises();
    expect(calls).toEqual([{ command: "git_branches", args: { root: "/work/heidrun" } }]);
    const rows = wrapper.findAll("[data-branch]");
    expect(rows.map((row) => row.attributes("data-branch"))).toEqual(["main", "dev_jerome", "docs-architecture"]);
    expect(rows[1].text()).toContain("Jerome Etienne • 1c93161 • Make the shortcut start the command");
    expect(rows[0].text()).toContain("10 min ago");
  });

  it("marks the current branch", async () => {
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-branch=main]").attributes("aria-selected")).toBe("true");
    expect(wrapper.get("[data-branch=dev_jerome]").attributes("aria-selected")).toBe("false");
  });

  it("filters the branches with the search field", async () => {
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.get("input").setValue("docs");
    expect(wrapper.findAll("[data-branch]").map((row) => row.attributes("data-branch"))).toEqual(["docs-architecture"]);
    await wrapper.get("input").setValue("zzz");
    expect(wrapper.findAll("[data-branch]")).toEqual([]);
    expect(wrapper.find("[data-field=no-branch]").exists()).toBe(true);
  });

  it("checks out a branch with a click on it, closes the picker, and reads the Git status again", async () => {
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.get("[data-branch=dev_jerome]").trigger("click");
    await flushPromises();
    expect(calls[calls.length - 1]).toEqual({ command: "git_checkout", args: { root: "/work/heidrun", branch: "dev_jerome" } });
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(refreshGit).toHaveBeenCalledWith("w1");
  });

  it("checks out the first branch of the list with the key Enter in the search field", async () => {
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.get("input").setValue("docs");
    await wrapper.get("input").trigger("keydown.enter");
    await flushPromises();
    expect(calls[calls.length - 1]).toEqual({ command: "git_checkout", args: { root: "/work/heidrun", branch: "docs-architecture" } });
  });

  it("does nothing but close the picker with a click on the current branch", async () => {
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.get("[data-branch=main]").trigger("click");
    await flushPromises();
    expect(calls.map((call) => call.command)).toEqual(["git_branches"]);
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("shows the message of Git when the checkout fails", async () => {
    checkoutError = "error: Your local changes to the following files would be overwritten by checkout";
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.get("[data-branch=dev_jerome]").trigger("click");
    await flushPromises();
    expect(state.toast).toContain("would be overwritten by checkout");
    expect(state.toastKind).toBe("error");
    expect(refreshGit).toHaveBeenCalledWith("w1");
  });

  it("opens the page of a branch on GitHub from the link of its row, without checking the branch out", async () => {
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.get("[data-link=dev_jerome]").trigger("click");
    await flushPromises();
    expect(openUrl).toHaveBeenCalledWith("https://github.com/heidrun-org/heidrun/tree/dev_jerome");
    expect(calls.map((call) => call.command)).toEqual(["git_branches"]);
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("does not show the title of the zone over the open picker", async () => {
    const wrapper = mount(GitBranchPicker);
    expect(wrapper.attributes("title")).toBe("Switch the Git branch");
    await wrapper.trigger("click");
    expect(wrapper.attributes("title")).toBeUndefined();
  });

  it("disables the link of a branch that is only local, and keeps the others enabled", async () => {
    trackedNames = [];
    remoteNames = ["main", "docs-architecture"];
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-link=main]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-link=docs-architecture]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-link=dev_jerome]").attributes("disabled")).toBeDefined();
    expect(wrapper.get("[data-link=dev_jerome]").attributes("title")).toBe(
      "This branch is only on your computer: push it to see its page",
    );
    await wrapper.get("[data-link=dev_jerome]").trigger("click");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("keeps the link enabled for a branch with a remote-tracking branch, even when the remote list lacks it", async () => {
    trackedNames = ["main"];
    remoteNames = [];
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-link=main]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-link=dev_jerome]").attributes("disabled")).toBeDefined();
  });

  it("keeps the links enabled while nothing is known, for example without network", async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "git_branches") {
        return BRANCHES.map((branch) => ({ ...branch, has_remote_tracking: false }));
      }
      throw "network down";
    });
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.findAll("[data-link]").every((link) => link.attributes("disabled") === undefined)).toBe(true);
  });

  it("keeps the slashes of a branch name in its address, and uses GitLab addresses for a GitLab remote", () => {
    expect(branchUrl("https://github.com/o/r", "github", "fix/a b")).toBe("https://github.com/o/r/tree/fix/a%20b");
    expect(branchUrl("https://gitlab.com/g/r", "gitlab", "main")).toBe("https://gitlab.com/g/r/-/tree/main");
    expect(branchUrl(null, "github", "main")).toBeNull();
  });

  it("shows no link when the repository has no remote", async () => {
    git.status = { w1: makeStatus({ remote: null }) };
    const wrapper = mount(GitBranchPicker);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.findAll("[data-link]")).toEqual([]);
  });

  it("closes the picker with the key Escape and with a second click", async () => {
    const wrapper = mount(GitBranchPicker, { attachTo: document.body });
    await wrapper.trigger("click");
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("filterGitBranches", () => {
  it("keeps every branch for an empty text, and matches the name, the subject, the author, and the hash", () => {
    expect(filterGitBranches(BRANCHES, "  ")).toEqual(BRANCHES);
    expect(filterGitBranches(BRANCHES, "DEV").map((branch) => branch.name)).toEqual(["dev_jerome"]);
    expect(filterGitBranches(BRANCHES, "shortcut").map((branch) => branch.name)).toEqual(["dev_jerome"]);
    expect(filterGitBranches(BRANCHES, "someone").map((branch) => branch.name)).toEqual(["docs-architecture"]);
    expect(filterGitBranches(BRANCHES, "7449099").map((branch) => branch.name)).toEqual(["docs-architecture"]);
    expect(filterGitBranches(BRANCHES, "jerome shortcut").map((branch) => branch.name)).toEqual(["dev_jerome"]);
  });
});
