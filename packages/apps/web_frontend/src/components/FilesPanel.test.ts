import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import path from "node:path";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import FilesPanel from "./FilesPanel.vue";
import { git, type GitStatus } from "../stores/git";
import { files } from "../stores/files";
import { state } from "../stores/session";
import { settings } from "../stores/settings";

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
  settings.filesPanelIndent = "medium";
  settings.filesPanelRowHeight = "comfortable";
  settings.filesPanelIndentGuides = true;
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

  it("has no button to create, rename, move, delete, or edit a file: only the buttons Refresh and More options", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll("header button").map((button) => button.attributes("aria-label"))).toEqual(["Refresh", "More options"]);
  });

  it("keeps the header at the top while the rows scroll: the rule of the header sticks it, with its own background", () => {
    const source = readFileSync(path.join(import.meta.dirname, "FilesPanel.vue"), "utf8");
    const rule = source.match(/\.panel-header \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("top: 0");
    expect(rule).toContain("background:");
  });

  it("gives a file and a folder of the same level the same space at the left, so their names line up", async () => {
    const wrapper = await mountPanel();
    const folderRow = wrapper.findAll(".row")[0];
    const fileRow = wrapper.findAll(".row")[1];
    expect(folderRow.findAll(".arrow")).toHaveLength(1);
    expect(fileRow.findAll(".arrow")).toHaveLength(1);
    expect(fileRow.get(".arrow").findAll("i")).toHaveLength(0);
  });

  it("draws one indent guide for each level of depth, and none when the guides are hidden", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.findAll(".row")[1].trigger("click");
    expect(wrapper.findAll(".row")[0].findAll(".guide")).toHaveLength(0);
    expect(wrapper.findAll(".row")[1].findAll(".guide")).toHaveLength(1);
    expect(wrapper.findAll(".row")[2].findAll(".guide")).toHaveLength(2);
    settings.filesPanelIndentGuides = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".guide")).toHaveLength(0);
  });

  it("sets the space of each level and the height of a row from the options", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.get(".rows").attributes("style")).toContain("--indent-width: 20px");
    expect(wrapper.get(".rows").attributes("style")).toContain("--row-height: 30px");
    settings.filesPanelIndent = "small";
    settings.filesPanelRowHeight = "compact";
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".rows").attributes("style")).toContain("--indent-width: 12px");
    expect(wrapper.get(".rows").attributes("style")).toContain("--row-height: 24px");
  });

  it("changes the options with the menu of the three dots, and marks the choice that is on", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll("header button")[1].trigger("click");
    const items = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    expect(items().map((item) => item.textContent?.trim())).toEqual([
      "Indentation", "Small", "✓ Medium", "Large", "Row height", "Compact", "✓ Comfortable", "Indent guides", "✓ Show", "Hide",
    ]);
    items()[3].click();
    expect(settings.filesPanelIndent).toBe("large");
    wrapper.unmount();
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
