import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import type { SessionSnapshot } from "../lib/types";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { answerConfirm, confirmDialog } from "../stores/confirm";
import { onNewPaneClick } from "../stores/newPane";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../stores/newPane", () => ({ onNewPaneClick: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    closeWorkspace: vi.fn(async () => ({})),
    renameWorkspace: vi.fn(async () => ({})),
  };
});

const SNAPSHOT = {
  workspaces: [
    { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" },
    { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "idle" },
  ],
  panes: [
    { pane_id: "p1", workspace_id: "w1", agent: "claude", agent_status: "idle" },
    { pane_id: "p2", workspace_id: "w1", agent: "codex", agent_status: "idle" },
    { pane_id: "p3", workspace_id: "w1" },
  ],
  agents: [],
  tabs: [],
  layouts: [],
} as unknown as SessionSnapshot;

async function mountSidebar() {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const { default: Sidebar } = await import("./Sidebar.vue");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  const wrapper = mount(Sidebar);
  return { session, api, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  confirmDialog.open = false;
});

describe("Sidebar workspace rows", () => {
  it("does not show the keyboard shortcut, the agent badges, or the number of terminals", async () => {
    const { wrapper } = await mountSidebar();
    const row = wrapper.get(".ws-row");
    expect(row.find(".key").exists()).toBe(false);
    expect(row.find(".agent-tag").exists()).toBe(false);
    expect(row.find(".count").exists()).toBe(false);
    expect(row.text()).toBe("heidrun");
  });

  it("has a menu with the entry Rename", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.get(".ws-row .row-btn").trigger("click");
    const entries = wrapper.findAll(".ws-row .row-menu-item");
    expect(entries.map((entry) => entry.text())).toEqual(["Rename"]);
  });

  it("starts the rename of the workspace when the user chooses Rename", async () => {
    const { wrapper, session } = await mountSidebar();
    await wrapper.get(".ws-row .row-btn").trigger("click");
    await wrapper.get(".ws-row .row-menu-item").trigger("click");
    expect(session.state.renaming).toBe("ws:w1");
    expect(wrapper.find(".ws-row .row-menu").exists()).toBe(false);
  });

  it("saves the new name of the workspace", async () => {
    const { session, api } = await mountSidebar();
    await session.finishRename("ws", "w1", "new name");
    expect(api.renameWorkspace).toHaveBeenCalledWith("w1", "new name");
  });

  it("asks for confirmation before it closes the workspace, and does not close before the answer", async () => {
    const { wrapper, api } = await mountSidebar();
    await wrapper.findAll(".ws-row .confirm")[0].trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the workspace heidrun");
    expect(api.closeWorkspace).not.toHaveBeenCalled();
  });

  it("closes the workspace after the user confirms", async () => {
    const { wrapper, api } = await mountSidebar();
    await wrapper.findAll(".ws-row .confirm")[0].trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closeWorkspace).toHaveBeenCalledWith("w1");
  });

  it("does not close the workspace when the user cancels", async () => {
    const { wrapper, api } = await mountSidebar();
    await wrapper.findAll(".ws-row .confirm")[0].trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closeWorkspace).not.toHaveBeenCalled();
  });
});

describe("Sidebar plus buttons", () => {
  it("has a plus button for a new workspace and a plus button for a new pane, each with an accessible name", async () => {
    const { wrapper } = await mountSidebar();
    const buttons = wrapper.findAll(".heading button.add");
    expect(buttons.map((button) => button.attributes("aria-label"))).toEqual([
      "Create a new workspace",
      "Add a pane: a terminal, Claude Code, or Codex (shift click: start the previous pane again)",
    ]);
    for (const button of buttons) {
      expect(button.attributes("title")).toBe(button.attributes("aria-label"));
    }
  });

  it("gives the look of each plus button to Bootstrap", async () => {
    const { wrapper } = await mountSidebar();
    for (const button of wrapper.findAll(".heading button.add")) {
      expect(button.classes()).toEqual(
        expect.arrayContaining(["btn", "btn-outline-secondary", "border-0", "d-inline-flex", "align-items-center", "justify-content-center"]),
      );
    }
  });

  it("asks for the folder of the new workspace when the user clicks the first plus button", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce(null);
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".heading button.add")[0].trigger("click");
    await flushPromises();
    expect(openDialog).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Choose the folder of the new workspace",
      defaultPath: "/home",
    });
  });

  it("starts the new pane action when the user clicks the second plus button", async () => {
    const { wrapper } = await mountSidebar();
    await wrapper.findAll(".heading button.add")[1].trigger("click");
    expect(onNewPaneClick).toHaveBeenCalledTimes(1);
    expect(openDialog).not.toHaveBeenCalled();
  });

  it("removes the grey ring that Bootstrap draws around a button that has the keyboard focus", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "Sidebar.vue"), "utf8");
    const addRule = sourceText.slice(sourceText.indexOf("\n.add {"), sourceText.indexOf("\n.add:not(:hover)"));
    expect(addRule).toContain("--bs-btn-focus-box-shadow: none;");
  });
});
