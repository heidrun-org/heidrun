import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../stores/git", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stores/git")>();
  return { ...original, refreshGit: vi.fn() };
});

import GitBranchPicker from "./GitBranchPicker.vue";
import { git, refreshGit, type GitStatus } from "../stores/git";
import { filterGitBranches, type GitBranch } from "../stores/git_branches";
import { state } from "../stores/session";

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
    remote: null,
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

describe("GitBranchPicker", () => {
  beforeEach(() => {
    calls = [];
    checkoutError = null;
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      calls.push({ command, args });
      if (command === "git_branches") {
        return BRANCHES;
      }
      if (command === "git_checkout" && checkoutError !== null) {
        throw checkoutError;
      }
      return "";
    });
    vi.mocked(refreshGit).mockClear();
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
