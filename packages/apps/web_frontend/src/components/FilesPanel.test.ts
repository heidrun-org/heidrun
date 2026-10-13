import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import FilesPanel from "./FilesPanel.vue";
import { git, type GitStatus } from "../stores/git";
import { files } from "../stores/files";
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

async function mountPanel() {
  state.selectedWorkspaceId = "w1";
  git.status = { w1: makeStatus() };
  const wrapper = mount(FilesPanel);
  await vi.waitFor(() => expect(files.root).toBe("/work/heidrun"));
  await wrapper.vm.$nextTick();
  return wrapper;
}

beforeEach(() => {
  invokeMock.mockImplementation(async (command: string) => {
    if (command === "files_list") {
      return {
        root: "/work/heidrun",
        git: true,
        files: ["README.md", "src/main.ts", "src/lib/util.ts"],
        status: { "src/main.ts": "M" },
        truncated: false,
      };
    }
    return null;
  });
});

afterEach(() => {
  state.selectedWorkspaceId = null;
  git.status = {};
  git.modal.open = false;
  git.modal.path = null;
  files.root = "";
  files.expanded = new Set();
  vi.clearAllMocks();
});

describe("FilesPanel", () => {
  it("shows the title and the folders first, then the files, and folds the folders at the start", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.get(".title").text()).toBe("Files");
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["src", "README.md"]);
  });

  it("unfolds a folder after a click on it, and does not open the large Git window", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["src", "lib", "main.ts", "README.md"]);
    expect(git.modal.open).toBe(false);
  });

  it("opens a file in the large Git window after a click on it", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("click");
    expect(git.modal.open).toBe(true);
    expect(git.modal.path).toBe("README.md");
  });

  it("shows a status letter on a changed file", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    const row = wrapper.findAll(".row").find((candidate) => candidate.text().includes("main.ts"));
    expect(row?.get(".letter").text()).toBe("M");
  });

  it("has no button to create, rename, move, delete, or edit a file", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll("header button")).toHaveLength(1);
    expect(wrapper.get("header button").attributes("aria-label")).toBe("Refresh");
  });

  it("tells the developer to select a workspace when none is selected", () => {
    state.selectedWorkspaceId = null;
    const wrapper = mount(FilesPanel);
    expect(wrapper.text()).toBe("Select a workspace.");
  });

  it("tells the developer when the workspace is not a Git repository", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: null };
    const wrapper = mount(FilesPanel);
    expect(wrapper.text()).toBe("This workspace is not a Git repository.");
  });
});
