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
      { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle", tab_count: 2 },
      { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "idle", tab_count: 1 },
      { workspace_id: "w3", number: 3, label: "scratch", agent_status: "idle", tab_count: 1 },
    ],
    tabs: [],
    panes: [
      { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "idle", cwd: "/work/heidrun" },
      { pane_id: "p2", workspace_id: "w2", tab_id: "t2", agent: "codex", agent_status: "idle", cwd: "/work/teamwright" },
      { pane_id: "p3", workspace_id: "w3", tab_id: "t3" },
      ...panes,
    ],
    agents: [],
    layouts: [],
  } as unknown as SessionSnapshot;
}

async function mountSection(snapshot: SessionSnapshot = makeSnapshot()) {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const { git } = await import("../stores/git");
  const { default: WorkspaceStatusSummary } = await import("./WorkspaceStatusSummary.vue");
  session.state.snapshot = snapshot;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedPaneId = null;
  session.state.renaming = null;
  git.status = {};
  for (const paneId of Object.keys(session.state.dismissed)) {
    delete session.state.dismissed[paneId];
  }
  const wrapper = mount(WorkspaceStatusSummary, { attachTo: document.body });
  return { session, api, git, wrapper };
}

/** The name in the status bar, without the text of the card. */
function sectionName(wrapper: Awaited<ReturnType<typeof mountSection>>["wrapper"]): string {
  return wrapper.get(".workspace-status > .name").text();
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  confirmDialog.open = false;
  document.body.innerHTML = "";
});

describe("WorkspaceStatusSummary section", () => {
  it("shows the status dot, then the name of the selected workspace, and nothing else", async () => {
    const { wrapper } = await mountSection();
    const children = Array.from(wrapper.get(".workspace-status").element.children);
    expect(children.map((child) => child.classList.contains("dot"))).toEqual([true, false]);
    expect(children[1].classList.contains("name")).toBe(true);
    expect(sectionName(wrapper)).toBe("heidrun");
  });

  it("follows the selected workspace", async () => {
    const { wrapper, session } = await mountSection();
    session.selectWorkspace("w2");
    await wrapper.vm.$nextTick();
    expect(sectionName(wrapper)).toBe("teamwright");
  });

  it("says that no workspace is selected when Herdr has no workspace, and still shows a dot", async () => {
    const { wrapper, session } = await mountSection();
    session.state.selectedWorkspaceId = null;
    await wrapper.vm.$nextTick();
    expect(sectionName(wrapper)).toBe("No workspace");
    expect(wrapper.get(".workspace-status > .dot").classes()).toContain("quiet");
  });

  it("is a keyboard target like the other status bar sections", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.get(".workspace-status").attributes("tabindex")).toBe("0");
    await wrapper.get(".workspace-status").trigger("keydown.enter");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });
});

describe("WorkspaceStatusSummary status dot", () => {
  it("is always there: a plain dot for a workspace with an idle agent", async () => {
    const { wrapper } = await mountSection();
    const dot = wrapper.get(".workspace-status > .dot");
    expect(dot.classes()).toEqual(["dot"]);
  });

  it("is a hollow ring for a workspace without an agent", async () => {
    const { wrapper, session } = await mountSection();
    session.selectWorkspace("w3");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".workspace-status > .dot").classes()).toContain("quiet");
    const stylesText = Fs.readFileSync(Path.resolve(import.meta.dirname, "../styles.css"), "utf8");
    expect(stylesText).toMatch(/\.dot\.quiet \{ background: transparent; box-shadow: inset 0 0 0 1\.5px var\(--faint\); \}/);
  });

  it("shows the status of the selected workspace when no agent of another workspace calls", async () => {
    const snapshot = makeSnapshot();
    (snapshot.workspaces[0] as { agent_status: string }).agent_status = "working";
    const { wrapper } = await mountSection(snapshot);
    const dot = wrapper.get(".workspace-status > .dot");
    expect(dot.classes()).toContain("working");
    expect(dot.classes()).not.toContain("calling");
    expect(dot.attributes("aria-label")).toBeUndefined();
  });

  it("shows a red dot when an agent of another workspace is blocked", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "blocked" }]);
    const { wrapper } = await mountSection(snapshot);
    const dot = wrapper.get(".calling");
    expect(dot.classes()).toContain("blocked");
    expect(dot.attributes("role")).toBe("img");
    expect(dot.attributes("aria-label")).toBe("An agent in another workspace is blocked");
  });

  it("shows a blue dot when an agent of another workspace has finished", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: "done" }]);
    const { wrapper } = await mountSection(snapshot);
    const dot = wrapper.get(".calling");
    expect(dot.classes()).toContain("done");
    expect(dot.attributes("aria-label")).toBe("An agent in another workspace has finished");
  });

  it("shows the red dot when one agent is blocked and another has finished", async () => {
    const snapshot = makeSnapshot([
      { pane_id: "p8", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "done" },
      { pane_id: "p9", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: "blocked" },
    ]);
    const { wrapper } = await mountSection(snapshot);
    expect(wrapper.get(".calling").classes()).toContain("blocked");
  });

  it("does not show the call of an agent of the selected workspace, because the developer sees it", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "blocked" }]);
    const { wrapper } = await mountSection(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(false);
  });

  it("does not show the call of a shell that is not an agent", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent_status: "blocked" }]);
    const { wrapper } = await mountSection(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(false);
  });

  it("moves the call to the other workspace when the developer selects the workspace of the calling agent", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: "blocked" }]);
    (snapshot.workspaces[1] as { agent_status: string }).agent_status = "blocked";
    const { wrapper, session } = await mountSection(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(true);
    session.selectWorkspace("w2");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".calling").exists()).toBe(false);
    expect(wrapper.get(".workspace-status > .dot").classes()).toContain("blocked");
  });

  it("goes back to the status of the selected workspace when the developer hides the card of the agent in the sidebar", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: "done" }]);
    const { wrapper, session } = await mountSection(snapshot);
    expect(wrapper.find(".calling").exists()).toBe(true);
    session.dismiss(session.allPanes.value.find((pane) => pane.pane_id === "p9")!);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".calling").exists()).toBe(false);
    expect(wrapper.find(".workspace-status > .dot").exists()).toBe(true);
  });
});

describe("WorkspaceStatusSummary card", () => {
  it("is closed at first, and opens after a click on the section", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.get(".workspace-status").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("is a Bootstrap popover above the section, with an arrow, like the other cards of the status bar", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    const card = wrapper.get(".popover");
    expect(card.classes()).toEqual(expect.arrayContaining(["bs-popover-top", "position-absolute", "bottom-100"]));
    expect(card.find(".popover-arrow").exists()).toBe(true);
    expect(card.find(".popover-body").exists()).toBe(true);
  });

  it("does not open when the mouse moves over the section", async () => {
    const { wrapper } = await mountSection();
    const section = wrapper.get(".workspace-status");
    await section.trigger("mouseenter");
    await section.trigger("mouseover");
    await section.trigger("mousemove");
    expect(wrapper.find(".popover").exists()).toBe(false);
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceStatusSummary.vue"), "utf8");
    expect(sourceText).not.toMatch(/@mouse(enter|over|move)/);
    expect(sourceText).not.toMatch(/@pointer(enter|over|move)/);
  });

  it("has no native tooltip on the section, because the card gives the information", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.get(".workspace-status").attributes("title")).toBeUndefined();
  });

  it("closes after a second click on the section", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.get(".workspace-status").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("stays open after a click inside the card", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.get("[data-field=details]").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("closes when the user presses Escape", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("closes when the user presses the mouse outside the card", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});

describe("WorkspaceStatusSummary details of the selected workspace", () => {
  it("shows the folder, the Git branch, the number of tabs, and the number of agents", async () => {
    const snapshot = makeSnapshot([{ pane_id: "p9", workspace_id: "w1", tab_id: "t1", agent: "codex", agent_status: "idle" }]);
    const { wrapper, git } = await mountSection(snapshot);
    git.status = { w1: { root: "/work/heidrun", branch: "dev_jerome" } as never };
    await wrapper.get(".workspace-status").trigger("click");
    expect(wrapper.get("[data-field=folder]").text()).toBe("/work/heidrun");
    expect(wrapper.get("[data-field=branch]").text()).toBe("dev_jerome");
    expect(wrapper.get("[data-field=tabs]").text()).toBe("2");
    expect(wrapper.get("[data-field=agents]").text()).toBe("2");
  });

  it("says that the workspace has no folder and no Git branch when Herdr does not know them", async () => {
    const { wrapper, session } = await mountSection();
    session.selectWorkspace("w3");
    await wrapper.get(".workspace-status").trigger("click");
    expect(wrapper.get("[data-field=folder]").text()).toBe("No folder");
    expect(wrapper.get("[data-field=branch]").text()).toBe("No Git branch");
    expect(wrapper.get("[data-field=agents]").text()).toBe("0");
  });

  it("follows the selected workspace while the card is open", async () => {
    const { wrapper, session } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    session.state.selectedWorkspaceId = "w2";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-field=folder]").text()).toBe("/work/teamwright");
    expect(wrapper.get("[data-field=tabs]").text()).toBe("1");
  });

  it("shows no details when Herdr has no workspace", async () => {
    const { wrapper, session } = await mountSection();
    session.state.selectedWorkspaceId = null;
    await wrapper.get(".workspace-status").trigger("click");
    expect(wrapper.find("[data-field=details]").exists()).toBe(false);
  });
});

describe("WorkspaceStatusSummary list", () => {
  it("lists every workspace in the order of Herdr, and marks the selected workspace", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    const rows = wrapper.findAll(".workspace-row");
    expect(rows.map((row) => row.get(".workspace-main").text())).toEqual(["heidrun", "teamwright", "scratch"]);
    expect(rows.map((row) => row.classes("active"))).toEqual([true, false, false]);
    expect(rows.map((row) => row.get(".workspace-main").attributes("aria-current"))).toEqual(["true", "false", "false"]);
  });

  it("puts no separator line between the workspaces", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    const list = wrapper.get("[role=group]");
    expect(list.findAll("[role=separator]")).toHaveLength(0);
    expect(list.findAll(".border-top, .border-bottom, hr")).toHaveLength(0);
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceStatusSummary.vue"), "utf8");
    expect(sourceText).not.toContain("firstQuiet");
    expect(sourceText).not.toContain("dropdown-divider");
  });

  it("gives every workspace a dot: a ring when no agent runs, and a colored dot for the status of the agents", async () => {
    const snapshot = makeSnapshot();
    (snapshot.workspaces[1] as { agent_status: string }).agent_status = "blocked";
    const { wrapper } = await mountSection(snapshot);
    await wrapper.get(".workspace-status").trigger("click");
    const dots = wrapper.findAll(".workspace-row .dot");
    expect(dots).toHaveLength(3);
    expect(dots.map((dot) => dot.classes("blocked"))).toEqual([false, true, false]);
    expect(dots.map((dot) => dot.classes("quiet"))).toEqual([false, false, true]);
  });

  it("shows the pencil and the cross of a row only when the mouse is over the row, and a Bootstrap class does not keep them visible", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    for (const actions of wrapper.findAll(".workspace-row .row-actions")) {
      expect(actions.classes()).not.toContain("d-flex");
    }
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceStatusSummary.vue"), "utf8");
    expect(sourceText).toMatch(/\.row-actions \{ display: none;/);
    expect(sourceText).toContain(".workspace-row:hover .row-actions, .workspace-row:focus-within .row-actions { display: flex; }");
  });

  it("selects the workspace and closes the card after a click on a row", async () => {
    const { wrapper, session } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.findAll(".workspace-main")[1].trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(sectionName(wrapper)).toBe("teamwright");
  });
});

describe("WorkspaceStatusSummary new workspace", () => {
  it("has the entry New workspace at the end of the card, after one separator line", async () => {
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    const body = wrapper.get(".popover-body").element;
    const separators = wrapper.findAll(".popover-body > [role=separator]");
    expect(separators).toHaveLength(1);
    expect(separators[0].element.nextElementSibling).toBe(body.lastElementChild);
    const entry = wrapper.get(".popover-body > button");
    expect(entry.text()).toBe("New workspace…");
    expect(entry.attributes("title")).toBe("Create a new workspace");
  });

  it("asks for the folder of the new workspace, and closes the card", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce(null);
    const { wrapper } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.get(".popover-body > button").trigger("click");
    await flushPromises();
    expect(openDialog).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Choose the folder of the new workspace",
      defaultPath: "/home",
    });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("creates the workspace with the name of the folder", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce("/home/me/my_project");
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.get(".popover-body > button").trigger("click");
    await flushPromises();
    expect(api.newWorkspace).toHaveBeenCalledWith("/home/me/my_project", "my_project");
  });

  it("creates no workspace when the user cancels the choice of the folder", async () => {
    vi.mocked(openDialog).mockResolvedValueOnce(null);
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.get(".popover-body > button").trigger("click");
    await flushPromises();
    expect(api.newWorkspace).not.toHaveBeenCalled();
  });

  it("offers the entry New workspace, without a separator line, when Herdr has no workspace", async () => {
    const snapshot = { ...makeSnapshot(), workspaces: [], panes: [] } as unknown as SessionSnapshot;
    const { wrapper } = await mountSection(snapshot);
    await wrapper.get(".workspace-status").trigger("click");
    expect(wrapper.findAll(".workspace-row")).toHaveLength(0);
    expect(wrapper.findAll(".popover-body > button")).toHaveLength(1);
    expect(wrapper.findAll("[role=separator]")).toHaveLength(0);
  });
});

describe("WorkspaceStatusSummary rename", () => {
  it("does not start the rename after a double click on the section: the name belongs to the card now", async () => {
    const { wrapper, session } = await mountSection();
    await wrapper.get(".workspace-status").trigger("dblclick");
    expect(session.state.renaming).toBeNull();
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "WorkspaceStatusSummary.vue"), "utf8");
    expect(sourceText).not.toContain("@dblclick");
  });

  it("starts the rename of a workspace with the pencil of its row, closes the card, and shows a field in the place of the name", async () => {
    const { wrapper, session } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.findAll(".workspace-row .row-button")[2].trigger("click");
    expect(session.state.renaming).toBe("ws:w2");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(wrapper.get<HTMLInputElement>("input.rename").element.value).toBe("teamwright");
    expect(wrapper.get("input.rename").attributes("aria-label")).toBe("New name of the workspace");
    expect(wrapper.find(".workspace-status > .dot").exists()).toBe(false);
  });

  it("does not open the card after a click in the field", async () => {
    const { wrapper, session } = await mountSection();
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    await wrapper.get("input.rename").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("starts the rename from the command search, and closes an open card", async () => {
    const { wrapper, session } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(wrapper.find("input.rename").exists()).toBe(true);
  });

  it("saves the new name with the key Enter", async () => {
    const { wrapper, session, api } = await mountSection();
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    const field = wrapper.get("input.rename");
    await field.setValue("new name");
    await field.trigger("keydown.enter");
    await flushPromises();
    expect(api.renameWorkspace).toHaveBeenCalledWith("w1", "new name");
    expect(session.state.renaming).toBeNull();
  });

  it("keeps the name with the key Escape, and shows the dot and the name again", async () => {
    const { wrapper, session, api } = await mountSection();
    session.startRename("ws", "w1");
    await wrapper.vm.$nextTick();
    const field = wrapper.get("input.rename");
    await field.setValue("new name");
    await field.trigger("keydown.esc");
    await flushPromises();
    expect(api.renameWorkspace).not.toHaveBeenCalled();
    expect(session.state.renaming).toBeNull();
    expect(sectionName(wrapper)).toBe("heidrun");
    expect(wrapper.find(".workspace-status > .dot").exists()).toBe(true);
  });
});

describe("WorkspaceStatusSummary close", () => {
  it("asks for confirmation before it closes the workspace, and does not close before the answer", async () => {
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.findAll(".workspace-row .row-button")[1].trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the workspace heidrun");
    expect(api.closeWorkspace).not.toHaveBeenCalled();
  });

  it("closes the workspace after the user confirms", async () => {
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.findAll(".workspace-row .row-button")[3].trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closeWorkspace).toHaveBeenCalledWith("w2");
  });

  it("closes the workspace after the user confirms, even when the card has closed because the focus went to the dialog", async () => {
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.findAll(".workspace-row .row-button")[3].trigger("click");
    await wrapper.get(".workspace-status").trigger("focusout", { relatedTarget: null });
    expect(wrapper.find(".popover").exists()).toBe(false);
    answerConfirm(true);
    await flushPromises();
    expect(api.closeWorkspace).toHaveBeenCalledWith("w2");
  });

  it("does not close the workspace when the user cancels", async () => {
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    await wrapper.findAll(".workspace-row .row-button")[1].trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closeWorkspace).not.toHaveBeenCalled();
  });
});

describe("WorkspaceStatusSummary move", () => {
  it("moves a workspace to the top of the list after the user drags it above the first row", async () => {
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    const rows = wrapper.findAll(".workspace-row");
    await rows[1].trigger("dragstart");
    await rows[0].trigger("dragover", { clientY: -10 });
    await rows[0].trigger("drop");
    expect(api.moveWorkspace).toHaveBeenCalledWith("w2", 0);
  });

  it("moves nothing when the user drops a workspace where it is", async () => {
    const { wrapper, api } = await mountSection();
    await wrapper.get(".workspace-status").trigger("click");
    const rows = wrapper.findAll(".workspace-row");
    await rows[1].trigger("dragstart");
    await rows[1].trigger("dragover", { clientY: -10 });
    await rows[1].trigger("drop");
    expect(api.moveWorkspace).not.toHaveBeenCalled();
  });
});

describe("WorkspaceStatusSummary shortcuts", () => {
  it("keeps the shortcuts Option+Command+Up arrow and Option+Command+Down arrow: the section shows the new workspace", async () => {
    const { wrapper, session } = await mountSection();
    session.cycleWorkspace(1);
    await wrapper.vm.$nextTick();
    expect(sectionName(wrapper)).toBe("teamwright");
    session.cycleWorkspace(-1);
    await wrapper.vm.$nextTick();
    expect(sectionName(wrapper)).toBe("heidrun");
  });

  it("keeps the shortcut Command with a digit: the section shows the workspace at that place", async () => {
    const { wrapper, session } = await mountSection();
    session.selectWorkspaceAt(2);
    await wrapper.vm.$nextTick();
    expect(sectionName(wrapper)).toBe("scratch");
  });

  it("keeps the keys of the window on the shortcuts", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "../App.vue"), "utf8");
    expect(sourceText).toContain('if (e.code === "ArrowUp") return run(() => cycleWorkspace(-1));');
    expect(sourceText).toContain('if (e.code === "ArrowDown") return run(() => cycleWorkspace(1));');
  });
});
