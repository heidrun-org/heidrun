import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentInfo, SessionSnapshot, WorkspaceInfo } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** A workspace of the Herdr session of the test. */
function workspace(workspaceId: string, label: string): WorkspaceInfo {
  return {
    workspace_id: workspaceId,
    number: Number(workspaceId.slice(1)),
    label,
    focused: false,
    pane_count: 1,
    tab_count: 1,
    active_tab_id: `${workspaceId}:t1`,
    agent_status: "unknown",
  };
}

/** The snapshot of a Herdr session that holds these workspaces. */
function snapshotOf(workspaceList: WorkspaceInfo[]): SessionSnapshot {
  return {
    version: "test",
    protocol: 1,
    workspaces: workspaceList,
    tabs: [],
    panes: [],
    layouts: [],
    agents: [],
  };
}

/** A note as the current version saves it. */
function savedNote(id: string, workspaceLabel: string) {
  return {
    id,
    title: id,
    text: id,
    workspaceLabel,
    origin: `${workspaceLabel} – codex · ${workspaceLabel}`,
    createdAt: 1,
  };
}

/** Starts the stores again, with notes already saved in the local storage of the window. */
async function startStores(savedNotes: unknown[] = []) {
  localStorage.setItem("heidrun.notes", JSON.stringify(savedNotes));
  vi.resetModules();
  const session = await import("./session");
  const notes = await import("./notes");
  const settings = await import("./settings");
  return { ...session, ...notes, ...settings };
}

beforeEach(() => {
  localStorage.clear();
});

describe("the notes of a workspace", () => {
  it("saves the name of the workspace where the text is pinned, and not its Herdr identifier", async () => {
    const { state, notes, pinText } = await startStores();
    state.snapshot = snapshotOf([workspace("w3", "heidrun")]);
    pinText("a text to keep", { workspace_id: "w3", tab_id: "w3:t1", pane_id: "w3:p1" } as AgentInfo);
    expect(notes.list).toHaveLength(1);
    expect(notes.list[0].workspaceLabel).toBe("heidrun");
    expect(notes.list[0]).not.toHaveProperty("workspaceId");
  });

  it("shows a note in its workspace after Herdr started again and gave another identifier to the workspace", async () => {
    const { state, visibleNotes } = await startStores([savedNote("n1", "heidrun")]);
    state.snapshot = snapshotOf([workspace("w2", "teamwright"), workspace("w3", "heidrun")]);
    state.selectedWorkspaceId = "w3";
    expect(visibleNotes.value.map((note) => note.id)).toEqual(["n1"]);
  });

  it("does not show a note in a workspace that has another name, even when it has the identifier of the old workspace", async () => {
    const { state, visibleNotes } = await startStores([savedNote("n1", "heidrun")]);
    state.snapshot = snapshotOf([workspace("w2", "teamwright"), workspace("w3", "heidrun")]);
    state.selectedWorkspaceId = "w2";
    expect(visibleNotes.value).toEqual([]);
  });

  it("shows every note when All workspaces is switched on", async () => {
    const { state, settings, visibleNotes } = await startStores([savedNote("n1", "heidrun"), savedNote("n2", "teamwright")]);
    state.snapshot = snapshotOf([workspace("w3", "heidrun")]);
    state.selectedWorkspaceId = "w3";
    expect(visibleNotes.value.map((note) => note.id)).toEqual(["n1"]);
    settings.notesShowAll = true;
    expect(visibleNotes.value.map((note) => note.id)).toEqual(["n1", "n2"]);
  });

  it("keeps a note whose workspace does not exist any more, and shows it only when All workspaces is switched on", async () => {
    const { state, notes, settings, visibleNotes } = await startStores([savedNote("n1", "closed project")]);
    state.snapshot = snapshotOf([workspace("w3", "heidrun")]);
    state.selectedWorkspaceId = "w3";
    expect(notes.list).toHaveLength(1);
    expect(visibleNotes.value).toEqual([]);
    settings.notesShowAll = true;
    expect(visibleNotes.value.map((note) => note.id)).toEqual(["n1"]);
  });

  it("shows no note before Herdr has sent a workspace", async () => {
    const { visibleNotes } = await startStores([savedNote("n1", "heidrun")]);
    expect(visibleNotes.value).toEqual([]);
  });
});

describe("the notes that an older version saved", () => {
  it("takes the name of the workspace from the origin of the note, and drops the old identifier", async () => {
    const oldNote = {
      id: "n1",
      title: "old",
      text: "old",
      workspaceId: "w2",
      origin: "heidrun – codex · heidrun",
      createdAt: 1,
    };
    const { state, notes, visibleNotes } = await startStores([oldNote]);
    expect(notes.list[0].workspaceLabel).toBe("heidrun");
    expect(notes.list[0]).not.toHaveProperty("workspaceId");
    state.snapshot = snapshotOf([workspace("w9", "heidrun")]);
    state.selectedWorkspaceId = "w9";
    expect(visibleNotes.value.map((note) => note.id)).toEqual(["n1"]);
  });

  it("keeps a note whose origin has no workspace name, and shows it only when All workspaces is switched on", async () => {
    const { state, notes, visibleNotes } = await startStores([{ id: "n1", title: "x", text: "x", workspaceId: "w2", origin: "", createdAt: 1 }]);
    state.snapshot = snapshotOf([workspace("w2", "heidrun")]);
    state.selectedWorkspaceId = "w2";
    expect(notes.list).toHaveLength(1);
    expect(visibleNotes.value).toEqual([]);
  });
});
