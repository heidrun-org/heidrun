import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../stores/git", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stores/git")>();
  return { ...original, refreshGit: vi.fn() };
});

import GitPanel from "./GitPanel.vue";
import { git, refreshGit, type GitStatus } from "../stores/git";
import { state } from "../stores/session";

function makeStatus(overrides: Partial<GitStatus>): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    changed: 1,
    untracked: 0,
    files: [{ path: "README.md", status: ".M" }],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
    ...overrides,
  };
}

describe("GitPanel", () => {
  afterEach(() => {
    state.selectedWorkspaceId = null;
    git.status = {};
    git.loading = false;
    vi.clearAllMocks();
  });

  it("shows the Refresh button as an icon with an accessible name and a tooltip", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({}) };
    const refresh = mount(GitPanel).get('button[aria-label="Refresh"]');
    expect(refresh.classes()).toContain("icon-btn");
    expect(refresh.attributes("title")).toBe("Refresh");
    expect(refresh.text()).toBe("");
    expect(refresh.find("i.bi-arrow-clockwise").exists()).toBe(true);
  });

  it("shows the Expand button as an icon with an accessible name and a tooltip", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({}) };
    const expand = mount(GitPanel).get('button[aria-label="Expand"]');
    expect(expand.classes()).toContain("icon-btn");
    expect(expand.attributes("title")).not.toBe("");
    expect(expand.text()).toBe("");
    expect(expand.find("i.bi-fullscreen").exists()).toBe(true);
  });

  it("writes the number of changes in parentheses", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({ changed: 3, untracked: 1 }) };
    expect(mount(GitPanel).get(".count").text()).toBe("(4)");
  });

  it("hides the Expand button when no file changed", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({ changed: 0, files: [] }) };
    expect(mount(GitPanel).find('button[aria-label="Expand"]').exists()).toBe(false);
  });

  it("refreshes the Git status when the person clicks the Refresh button", async () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({}) };
    await mount(GitPanel).get('button[aria-label="Refresh"]').trigger("click");
    expect(refreshGit).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner and disables the Refresh button while the Git status loads", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({}) };
    git.loading = true;
    const refresh = mount(GitPanel).get('button[aria-label="Refresh"]');
    expect(refresh.attributes("disabled")).toBeDefined();
    expect(refresh.find(".spinner-border").exists()).toBe(true);
  });
});
