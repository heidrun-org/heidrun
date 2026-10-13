import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  return vi.fn();
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import GitModal from "./GitModal.vue";
import { git, type GitStatus } from "../stores/git";
import { settings } from "../stores/settings";
import { state } from "../stores/session";

function makeStatus(): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "dev_jerome",
    upstream: null,
    ahead: 0,
    behind: 0,
    changed: 1,
    untracked: 0,
    files: [{ path: "src/main.ts", status: ".M" }],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

beforeEach(() => {
  state.selectedWorkspaceId = "w1";
  git.status = { w1: makeStatus() };
  settings.diffMode = "unified";
  invokeMock.mockImplementation(async (command: string) => {
    if (command === "git_file") {
      return "first line\nsecond line\n";
    }
    if (command === "git_diff") {
      return "";
    }
    return null;
  });
});

afterEach(() => {
  state.selectedWorkspaceId = null;
  git.status = {};
  git.modal.open = false;
  git.modal.path = null;
  vi.clearAllMocks();
});

describe("GitModal", () => {
  it("shows a file that has no change as a whole file, without asking for a diff", async () => {
    git.modal.path = "README.md";
    const wrapper = mount(GitModal);
    await vi.waitFor(() => expect(wrapper.text()).toContain("second line"));
    expect(invokeMock).not.toHaveBeenCalledWith("git_diff", expect.anything());
    expect(wrapper.text()).toContain("No change since the last commit (HEAD)");
  });

  it("disables the buttons Diff and Side by side for a file that has no change", async () => {
    git.modal.path = "README.md";
    const wrapper = mount(GitModal);
    await vi.waitFor(() => expect(wrapper.text()).toContain("second line"));
    const buttons = wrapper.findAll(".seg button");
    expect(buttons[0].attributes("disabled")).toBeDefined();
    expect(buttons[1].attributes("disabled")).toBeDefined();
    expect(buttons[2].attributes("disabled")).toBeUndefined();
  });

  it("keeps the diff for a changed file", async () => {
    git.modal.path = "src/main.ts";
    const wrapper = mount(GitModal);
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("git_diff", { root: "/work/heidrun", path: "src/main.ts" }));
    expect(wrapper.findAll(".seg button")[0].attributes("disabled")).toBeUndefined();
  });
});
