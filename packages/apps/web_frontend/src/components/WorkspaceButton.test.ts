import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import type { SessionSnapshot } from "../lib/types";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { answerConfirm, confirmDialog } from "../stores/confirm";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    newWorkspace: vi.fn(async () => ({})),
    closeWorkspace: vi.fn(async () => ({})),
    renameWorkspace: vi.fn(async () => ({})),
    moveWorkspace: vi.fn(async () => ({})),
  };
});

/** Three workspaces: heidrun and teamwright run an agent, and scratch runs only a shell. */
function makeSnapshot(panes: Record<string, unknown>[] = []): SessionSnapshot {
  return {
    workspaces: [
      { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" },
      { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "idle" },
      { workspace_id: "w3", number: 3, label: "scratch", agent_status: "idle" },
    ],
    tabs: [],
    panes: [
      { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "idle" },
      { pane_id: "p2", workspace_id: "w2", tab_id: "t2", agent: "codex", agent_status: "idle" },
      { pane_id: "p3", workspace_id: "w3", tab_id: "t3" },
      ...panes,
    ],
    agents: [],
    layouts: [],
  } as unknown as SessionSnapshot;
}

async function mountWorkspaceButton(snapshot: SessionSnapshot = makeSnapshot()) {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const { default: WorkspaceButton } = await import("./WorkspaceButton.vue");
  session.state.snapshot = snapshot;
  session.state.selectedWorkspaceId = "w1";
  session.state.renaming = null;
  for (const paneId of Object.keys(session.state.dismissed)) {
    delete session.state.dismissed[paneId];
  }
  const wrapper = mount(WorkspaceButton, { attachTo: document.body, global: { stubs: { Teleport: true } } });
  return { session, api, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  confirmDialog.open = false;
  document.body.innerHTML = "";
});

describe("WorkspaceButton button", () => {
  it("shows the name of the selected workspace, and nothing else", async () => {
    const { wrapper } = await mountWorkspaceButton();
    const button = wrapper.get("button.workspace");
    expect(button.text()).toBe("heidrun");
  });

  it("follows the selected workspace", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    session.selectWorkspace("w2");
    await wrapper.vm.$nextTick();
    expect(wrapper.get("button.workspace").text()).toBe("teamwright");
  });

  it("is a Bootstrap button, and tells the screen reader that it opens a list", async () => {
    const { wrapper } = await mountWorkspaceButton();
    const button = wrapper.get("button.workspace");
    expect(button.classes()).toEqual(expect.arrayContaining(["btn", "border-0"]));
    expect(button.attributes("aria-haspopup")).toBe("menu");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("aria-label")).toBe("Workspace heidrun: open the list of workspaces");
  });

  it("says that no workspace is selected when Herdr has no workspace", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    session.state.selectedWorkspaceId = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.get("button.workspace").text()).toBe("No workspace");
  });

  it("removes the grey ring that Bootstrap draws around a button that has the keyboard focus", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceButton.vue"), "utf8");
    expect(sourceText).toContain("--bs-btn-focus-box-shadow: none;");
  });
});

describe("WorkspaceButton list", () => {
  it("is closed at first, and opens after a click on the button", async () => {
    const { wrapper } = await mountWorkspaceButton();
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
    await wrapper.get("button.workspace").trigger("click");
    expect(wrapper.find(".workspace-menu").exists()).toBe(true);
    expect(wrapper.get("button.workspace").attributes("aria-expanded")).toBe("true");
  });

  it("does not open when the mouse moves over the button", async () => {
    const { wrapper } = await mountWorkspaceButton();
    const button = wrapper.get("button.workspace");
    await button.trigger("mouseenter");
    await button.trigger("mouseover");
    await button.trigger("mousemove");
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceButton.vue"), "utf8");
    expect(sourceText).not.toMatch(/@mouse(enter|over|move)/);
    expect(sourceText).not.toMatch(/@pointer(enter|over|move)/);
  });

  it("closes after a second click on the button", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.get("button.workspace").trigger("click");
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
  });

  it("closes when the user presses Escape", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.vm.$nextTick();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
  });

  it("closes when the user presses the mouse outside the list", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.vm.$nextTick();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
  });

  it("lists every workspace, the workspaces with an agent first, and marks the selected workspace", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    const rows = wrapper.findAll(".workspace-row");
    expect(rows.map((row) => row.get(".name").text())).toEqual(["heidrun", "teamwright", "scratch"]);
    expect(rows.map((row) => row.classes("active"))).toEqual([true, false, false]);
    expect(rows.map((row) => row.get(".workspace-main").attributes("aria-current"))).toEqual(["true", "false", "false"]);
  });

  it("puts a line between the workspaces with an agent and the workspaces without an agent", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    const separators = wrapper.findAll(".dropdown-divider[aria-label]");
    expect(separators.map((separator) => separator.attributes("aria-label"))).toEqual(["Workspaces without an agent"]);
    const rows = wrapper.findAll(".workspace-row");
    expect(rows.map((row) => row.classes("quiet"))).toEqual([false, false, true]);
  });

  it("shows the status of the agents of a workspace with a colored dot, and a plain dot when the workspace is idle", async () => {
    const snapshot = makeSnapshot();
    (snapshot.workspaces[1] as { agent_status: string }).agent_status = "blocked";
    const { wrapper } = await mountWorkspaceButton(snapshot);
    await wrapper.get("button.workspace").trigger("click");
    const dots = wrapper.findAll(".workspace-row .dot");
    expect(dots.map((dot) => dot.classes("blocked"))).toEqual([false, true, false]);
  });

  it("shows the pencil and the cross of a row only when the mouse is over the row, and a Bootstrap class does not keep them visible", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    for (const actions of wrapper.findAll(".workspace-row .row-actions")) {
      expect(actions.classes()).not.toContain("d-flex");
    }
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceButton.vue"), "utf8");
    expect(sourceText).toMatch(/\.row-actions \{ display: none;/);
    expect(sourceText).toContain(".workspace-row:hover .row-actions, .workspace-row:focus-within .row-actions { display: flex; }");
  });

  it("selects the workspace and closes after a click on a row", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.findAll(".workspace-main")[1].trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
    expect(wrapper.get("button.workspace").text()).toBe("teamwright");
  });
});

describe("WorkspaceButton new workspace", () => {
  it("has the entry New workspace at the end of the list", async () => {
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    const entries = wrapper.findAll(".workspace-menu > button.dropdown-item");
    expect(entries.map((entry) => entry.text())).toEqual(["New workspace…"]);
    expect(entries[0].attributes("title")).toBe("Create a new workspace");
  });

  it("asks for the folder of the new workspace, and closes the list", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce(null);
    const { wrapper } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.get(".workspace-menu > button.dropdown-item").trigger("click");
    await flushPromises();
    expect(openDialog).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Choose the folder of the new workspace",
      defaultPath: "/home",
    });
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
  });

  it("creates the workspace with the name of the folder", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce("/home/me/my_project");
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.get(".workspace-menu > button.dropdown-item").trigger("click");
    await flushPromises();
    expect(api.newWorkspace).toHaveBeenCalledWith("/home/me/my_project", "my_project");
  });

  it("creates no workspace when the user cancels the choice of the folder", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce(null);
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.get(".workspace-menu > button.dropdown-item").trigger("click");
    await flushPromises();
    expect(api.newWorkspace).not.toHaveBeenCalled();
  });

  it("offers the entry New workspace when Herdr has no workspace", async () => {
    const snapshot = { ...makeSnapshot(), workspaces: [], panes: [] } as unknown as SessionSnapshot;
    const { wrapper } = await mountWorkspaceButton(snapshot);
    await wrapper.get("button.workspace").trigger("click");
    expect(wrapper.findAll(".workspace-row")).toHaveLength(0);
    expect(wrapper.findAll(".workspace-menu > button.dropdown-item")).toHaveLength(1);
  });
});

describe("WorkspaceButton rename", () => {
  it("starts the rename of the workspace after a double click on the button, with a field in the place of the button", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("dblclick");
    expect(session.state.renaming).toBe("ws:w1");
    expect(wrapper.find("button.workspace").exists()).toBe(false);
    expect(wrapper.get<HTMLInputElement>("input.rename").element.value).toBe("heidrun");
    expect(wrapper.get("input.rename").attributes("aria-label")).toBe("New name of the workspace");
  });

  it("starts the rename of a workspace with the pencil of its row, and closes the list", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.findAll(".workspace-row .row-button")[1].trigger("click");
    expect(session.state.renaming).toBe("ws:w2");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
    expect(wrapper.get<HTMLInputElement>("input.rename").element.value).toBe("teamwright");
  });

  it("starts the rename from the command search, and closes an open list", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".workspace-menu").exists()).toBe(false);
    expect(wrapper.find("input.rename").exists()).toBe(true);
  });

  it("saves the new name with the key Enter", async () => {
    const { wrapper, session, api } = await mountWorkspaceButton();
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    const field = wrapper.get("input.rename");
    await field.setValue("new name");
    await field.trigger("keydown.enter");
    await flushPromises();
    expect(api.renameWorkspace).toHaveBeenCalledWith("w1", "new name");
    expect(session.state.renaming).toBeNull();
  });

  it("keeps the name with the key Escape, and shows the button again", async () => {
    const { wrapper, session, api } = await mountWorkspaceButton();
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    const field = wrapper.get("input.rename");
    await field.setValue("new name");
    await field.trigger("keydown.esc");
    await flushPromises();
    expect(api.renameWorkspace).not.toHaveBeenCalled();
    expect(session.state.renaming).toBeNull();
    expect(wrapper.get("button.workspace").text()).toBe("heidrun");
  });
});

describe("WorkspaceButton close", () => {
  it("asks for confirmation before it closes the workspace, and does not close before the answer", async () => {
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.findAll(".workspace-row .confirm")[0].trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the workspace heidrun");
    expect(api.closeWorkspace).not.toHaveBeenCalled();
  });

  it("closes the workspace after the user confirms", async () => {
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.findAll(".workspace-row .confirm")[1].trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closeWorkspace).toHaveBeenCalledWith("w2");
  });

  it("does not close the workspace when the user cancels", async () => {
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    await wrapper.findAll(".workspace-row .confirm")[0].trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closeWorkspace).not.toHaveBeenCalled();
  });
});

describe("WorkspaceButton move", () => {
  it("moves a workspace to the top of its group after the user drags it above the first row", async () => {
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    const rows = wrapper.findAll(".workspace-row");
    await rows[1].trigger("dragstart");
    await rows[0].trigger("dragover", { clientY: -10 });
    await rows[0].trigger("drop");
    expect(api.moveWorkspace).toHaveBeenCalledWith("w2", 0);
  });

  it("moves nothing when the user drops a workspace where it is", async () => {
    const { wrapper, api } = await mountWorkspaceButton();
    await wrapper.get("button.workspace").trigger("click");
    const rows = wrapper.findAll(".workspace-row");
    await rows[1].trigger("dragstart");
    await rows[1].trigger("dragover", { clientY: -10 });
    await rows[1].trigger("drop");
    expect(api.moveWorkspace).not.toHaveBeenCalled();
  });
});

describe("WorkspaceButton dot for the other workspaces", () => {
  it("shows no dot when no agent calls", async () => {
    const { wrapper } = await mountWorkspaceButton();
    expect(wrapper.find(".calling").exists()).toBe(false);
  });

  it("shows a red dot when an agent of another workspace is blocked", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "blocked" }]);
    const { wrapper } = await mountWorkspaceButton(snapshot);
    const dot = wrapper.get(".calling");
    expect(dot.classes()).toContain("blocked");
    expect(dot.attributes("aria-label")).toBe("An agent in another workspace is blocked");
    expect(dot.attributes("title")).toBe("An agent in another workspace is blocked");
  });

  it("shows a blue dot when an agent of another workspace has finished", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: "done" }]);
    const { wrapper } = await mountWorkspaceButton(snapshot);
    const dot = wrapper.get(".calling");
    expect(dot.classes()).toContain("done");
    expect(dot.attributes("aria-label")).toBe("An agent in another workspace has finished");
  });

  it("shows the red dot when one agent is blocked and another has finished", async () => {
    const snapshot = makeSnapshot([
      { pane_id: "p8", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "done" },
      { pane_id: "p9", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: "blocked" },
    ]);
    const { wrapper } = await mountWorkspaceButton(snapshot);
    expect(wrapper.get(".calling").classes()).toContain("blocked");
  });

  it("shows no dot for an agent of the selected workspace, because the developer sees it", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "blocked" }]);
    const { wrapper } = await mountWorkspaceButton(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(false);
  });

  it("shows no dot for a shell that is not an agent", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent_status: "blocked" }]);
    const { wrapper } = await mountWorkspaceButton(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(false);
  });

  it("moves the dot to the other workspace when the developer selects the workspace of the calling agent", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "blocked" }]);
    const { wrapper, session } = await mountWorkspaceButton(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(true);
    session.selectWorkspace("w2");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".calling").exists()).toBe(false);
  });

  it("goes away when the developer hides the card of the agent in the sidebar", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: "done" }]);
    const { wrapper, session } = await mountWorkspaceButton(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(true);
    session.dismiss(session.allPanes.value.find((pane) => pane.pane_id === "p9")!);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".calling").exists()).toBe(false);
  });
});

describe("WorkspaceButton shortcuts", () => {
  it("keeps the shortcuts Option+Command+Up arrow and Option+Command+Down arrow: the button shows the new workspace", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    session.cycleWorkspace(1);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("button.workspace").text()).toBe("teamwright");
    session.cycleWorkspace(-1);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("button.workspace").text()).toBe("heidrun");
  });

  it("keeps the shortcut Command with a digit: the button shows the workspace at that place", async () => {
    const { wrapper, session } = await mountWorkspaceButton();
    session.selectWorkspaceAt(2);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("button.workspace").text()).toBe("scratch");
  });

  it("keeps the keys of the window on the shortcuts", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "../App.vue"), "utf8");
    expect(sourceText).toContain('if (e.code === "ArrowUp") return run(() => cycleWorkspace(-1));');
    expect(sourceText).toContain('if (e.code === "ArrowDown") return run(() => cycleWorkspace(1));');
  });
});
