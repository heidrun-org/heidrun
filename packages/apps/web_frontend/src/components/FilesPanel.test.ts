import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import path from "node:path";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import FilesPanel from "./FilesPanel.vue";
import { git, type GitStatus } from "../stores/git";
import { files, filesPanelSelection } from "../stores/files";
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
  filesPanelSelection.path = null;
  filesPanelSelection.isFolder = false;
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

  it("has no button to rename, move, delete, or edit a file", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll("header button").map((button) => button.attributes("aria-label"))).toEqual([
      "New file", "New folder", "Refresh", "Collapse all folders", "More options",
    ]);
  });

  it("folds every folder with the button Collapse all folders", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row")).toHaveLength(4);
    await wrapper.get("[aria-label='Collapse all folders']").trigger("click");
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["src", "README.md"]);
  });

  it("has no button Expand all folders", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.find("[aria-label='Expand all folders']").exists()).toBe(false);
  });

  it("selects the row that was clicked, a folder or a file, and only that row, and keeps it after the Git window closes", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".row.selected")).toHaveLength(0);
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row.selected").map((row) => row.text())).toEqual(["src•"]);
    await wrapper.findAll(".row")[3].trigger("click");
    expect(wrapper.findAll(".row.selected").map((row) => row.text())).toEqual(["README.md"]);
    git.modal.open = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".row.selected")).toHaveLength(1);
  });

  it("keeps the selected row when the sidebar section is shown again", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("click");
    wrapper.unmount();
    const again = await mountPanel();
    expect(again.findAll(".row.selected").map((row) => row.text())).toEqual(["README.md"]);
  });

  it("creates a new file in the selected folder, and opens it in the large Git window", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.get("[aria-label='New file']").trigger("click");
    const input = wrapper.get(".naming input");
    expect((input.element as HTMLInputElement).value).toBe("src/");
    await input.setValue("src/new_file.ts");
    await wrapper.get(".naming").trigger("submit");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: "src/new_file.ts", dir: false }));
    await vi.waitFor(() => expect(git.modal.path).toBe("src/new_file.ts"));
    expect(git.modal.open).toBe(true);
    expect(wrapper.find(".naming").exists()).toBe(false);
  });

  it("creates a new folder at the root when no folder was clicked, and does not open the large Git window", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='New folder']").trigger("click");
    await wrapper.get(".naming input").setValue("assets");
    await wrapper.get(".naming").trigger("submit");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: "assets", dir: true }));
    expect(git.modal.open).toBe(false);
  });

  it("cancels the new name with the key Escape, and creates nothing", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming input").trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".naming").exists()).toBe(false);
    expect(invokeMock).not.toHaveBeenCalledWith("file_create", expect.anything());
  });

  it("keeps the name box open and creates nothing more when the backend refuses the name", async () => {
    const wrapper = await mountPanel();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "file_create") {
        throw new Error("already exists");
      }
      return { root: "/work/heidrun", git: true, files: ["README.md"], status: {}, truncated: false };
    });
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming input").setValue("README.md");
    await wrapper.get(".naming").trigger("submit");
    await vi.waitFor(() => expect(state.toast).toContain("already exists"));
    expect(wrapper.find(".naming").exists()).toBe(true);
    expect(git.modal.open).toBe(false);
  });

  it("gives a row the full width of the sidebar section, so its background is not limited to the file name", () => {
    const source = readFileSync(path.join(import.meta.dirname, "FilesPanel.vue"), "utf8");
    const rule = source.match(/\n\.row \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("width: 100%");
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
    await wrapper.get("[aria-label='More options']").trigger("click");
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
