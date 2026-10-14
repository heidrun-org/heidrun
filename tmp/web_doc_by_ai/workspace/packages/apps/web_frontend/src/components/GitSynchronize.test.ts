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

import GitSynchronize from "./GitSynchronize.vue";
import { git, refreshGit, type GitStatus } from "../stores/git";
import { synchronize, type SynchronizeResult } from "../stores/git_synchronize";
import { state } from "../stores/session";

function makeStatus(overrides: Partial<GitStatus>): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "dev_jerome",
    upstream: "origin/dev_jerome",
    ahead: 0,
    behind: 2,
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

/** The Tauri commands that the component called, with their arguments, in order. */
let calls: { command: string; args: unknown }[] = [];
/** What the next call of `git_synchronize` gives: a result, or a text that makes it fail. */
let answer: SynchronizeResult | string = { outcome: "merged", upstream: "origin/dev_jerome", conflicts: [], pushed: 0, push_error: null };
/** A function that lets the test finish a merge that waits. */
let finishMerge: (() => void) | null = null;

describe("GitSynchronize", () => {
  beforeEach(() => {
    calls = [];
    answer = { outcome: "merged", upstream: "origin/dev_jerome", conflicts: [], pushed: 0, push_error: null };
    finishMerge = null;
    synchronize.isBusy = false;
    synchronize.result = null;
    synchronize.error = null;
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      calls.push({ command, args });
      if (finishMerge !== null) {
        await new Promise<void>((resolve) => {
          finishMerge = resolve;
        });
      }
      if (typeof answer === "string") {
        throw answer;
      }
      return answer;
    });
    vi.mocked(refreshGit).mockClear();
    vi.mocked(openUrl).mockClear();
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({}) };
  });

  afterEach(() => {
    state.selectedWorkspaceId = null;
    git.status = {};
  });

  it("shows the turning-arrows icon, and nothing else, until it is clicked", () => {
    const wrapper = mount(GitSynchronize);
    expect(wrapper.find(".bi-arrow-repeat").exists()).toBe(true);
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(wrapper.classes()).toContain("status-section");
    expect(wrapper.classes()).not.toContain("git-synchronize-zone-disabled");
  });

  it("starts the merge with a click, opens the card, and reads the Git status again", async () => {
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(calls).toEqual([{ command: "git_synchronize", args: { root: "/work/heidrun" } }]);
    expect(wrapper.get("[data-field=synchronize-merged]").text()).toBe("Merged origin/dev_jerome into dev_jerome.");
    expect(refreshGit).toHaveBeenCalledWith("w1");
  });

  it("shows a spinner and the state of the work while the merge runs", async () => {
    finishMerge = () => {};
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find(".spinner-border").exists()).toBe(true);
    expect(wrapper.find(".bi-arrow-repeat").exists()).toBe(false);
    expect(wrapper.get("[data-field=synchronize-busy]").text()).toBe("Synchronizing with origin/dev_jerome…");
    finishMerge?.();
    await flushPromises();
    expect(wrapper.find(".spinner-border").exists()).toBe(false);
  });

  it("says the branch is already up to date", async () => {
    answer = { outcome: "up_to_date", upstream: "origin/dev_jerome", conflicts: [], pushed: 0, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-up-to-date]").text()).toBe("Already up to date with origin/dev_jerome.");
  });

  it("lists the files in conflict", async () => {
    answer = { outcome: "conflict", upstream: "origin/dev_jerome", conflicts: ["a.ts", "docs/b.md"], pushed: 0, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-conflict]").text()).toBe("origin/dev_jerome conflicts in 2 files:");
    expect(wrapper.findAll("[data-field=synchronize-conflict-files] li").map((item) => item.text())).toEqual(["a.ts", "docs/b.md"]);
  });

  it("says one file for one conflict", async () => {
    answer = { outcome: "conflict", upstream: "origin/dev_jerome", conflicts: ["a.ts"], pushed: 0, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-conflict]").text()).toBe("origin/dev_jerome conflicts in 1 file:");
  });

  it("says how many commits were sent after the merge, with the name of the upstream branch as a link", async () => {
    answer = { outcome: "up_to_date", upstream: "origin/dev_jerome", conflicts: [], pushed: 2, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-up-to-date]").text()).toBe("Already up to date with origin/dev_jerome.");
    expect(wrapper.get("[data-field=synchronize-pushed]").text()).toBe("Sent 2 commits to origin/dev_jerome.");
    expect(wrapper.get("[data-field=synchronize-pushed] [data-field=synchronize-upstream-link]").text()).toBe("origin/dev_jerome");
  });

  it("says one commit for one commit sent, and says nothing about the push when nothing was sent", async () => {
    answer = { outcome: "merged", upstream: "origin/dev_jerome", conflicts: [], pushed: 1, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-pushed]").text()).toBe("Sent 1 commit to origin/dev_jerome.");
    await wrapper.trigger("click");
    answer = { outcome: "merged", upstream: "origin/dev_jerome", conflicts: [], pushed: 0, push_error: null };
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-field=synchronize-pushed]").exists()).toBe(false);
  });

  it("shows why the push failed, and keeps the sentence of the merge", async () => {
    answer = { outcome: "merged", upstream: "origin/dev_jerome", conflicts: [], pushed: 0, push_error: "remote: refused" };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-field=synchronize-merged]").exists()).toBe(true);
    expect(wrapper.get("[data-field=synchronize-push-error]").text()).toBe(
      "The merge is done, but the commits could not be sent: remote: refused",
    );
  });

  it("sends nothing when the merge is in conflict, so the card has no sentence about the push", async () => {
    answer = { outcome: "conflict", upstream: "origin/dev_jerome", conflicts: ["a.ts"], pushed: 0, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-field=synchronize-pushed]").exists()).toBe(false);
  });

  it("shows the message of Git when the merge fails", async () => {
    answer = "error: Your local changes would be overwritten by merge";
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-error]").text()).toContain("would be overwritten by merge");
  });

  it("is faded and starts nothing when the branch has no upstream branch, and the card says why", async () => {
    git.status = { w1: makeStatus({ upstream: null }) };
    const wrapper = mount(GitSynchronize);
    expect(wrapper.classes()).toContain("git-synchronize-zone-disabled");
    expect(wrapper.attributes("aria-disabled")).toBe("true");
    await wrapper.trigger("click");
    await flushPromises();
    expect(calls).toEqual([]);
    expect(wrapper.get("[data-field=synchronize-no-upstream]").text()).toBe(
      "This branch has no upstream branch. Push it first, so it has one.",
    );
  });

  it("makes the name of the upstream branch a link to its page on GitHub, without the name of the remote", async () => {
    answer = { outcome: "up_to_date", upstream: "origin/dev_jerome", conflicts: [], pushed: 0, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    const link = wrapper.get("[data-field=synchronize-upstream-link]");
    expect(link.text()).toBe("origin/dev_jerome");
    expect(link.attributes("href")).toBe("https://github.com/heidrun-org/heidrun/tree/dev_jerome");
    await link.trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://github.com/heidrun-org/heidrun/tree/dev_jerome");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("makes the name of the upstream branch a link in the sentence of the conflicts too", async () => {
    answer = { outcome: "conflict", upstream: "origin/dev_jerome", conflicts: ["a.ts"], pushed: 0, push_error: null };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-field=synchronize-conflict] [data-field=synchronize-upstream-link]").text()).toBe("origin/dev_jerome");
  });

  it("shows the name of the upstream branch as plain text when the repository has no known remote", async () => {
    git.status = { w1: makeStatus({ remote: null }) };
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-field=synchronize-upstream-link]").exists()).toBe(false);
    expect(wrapper.get("[data-field=synchronize-merged]").text()).toBe("Merged origin/dev_jerome into dev_jerome.");
  });

  it("is 408 pixels wide, like the cards of the usage, so the sentences have room", async () => {
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    const card = wrapper.get(".popover").element as HTMLElement;
    expect(card.style.width).toBe("408px");
    expect(card.style.getPropertyValue("--popover-max-width")).toBe("408px");
  });

  it("closes the card with the next click, without starting a second merge", async () => {
    const wrapper = mount(GitSynchronize);
    await wrapper.trigger("click");
    await flushPromises();
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(calls.length).toBe(1);
  });

  it("closes the card with the key Escape", async () => {
    const wrapper = mount(GitSynchronize, { attachTo: document.body });
    await wrapper.trigger("click");
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
    wrapper.unmount();
  });
});
