import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  newWorkspace: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/api", () => ({
  snapshot: mocks.snapshot,
  newWorkspace: mocks.newWorkspace,
  watchPanes: vi.fn(async () => {}),
  codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

/** The first pane of the workspace `workspaceId`, which has one tab `${workspaceId}-t1`. */
function rootPane(workspaceId: string) {
  return { pane_id: `${workspaceId}-p1`, tab_id: `${workspaceId}-t1`, workspace_id: workspaceId };
}

/** Builds a snapshot with one workspace, one tab, and one pane for each given identifier, and Herdr focus on the first one. */
function buildSnapshot(workspaceIds: string[]) {
  return {
    version: "test",
    protocol: 1,
    focused_workspace_id: workspaceIds[0] ?? null,
    workspaces: workspaceIds.map((workspaceId, index) => ({
      workspace_id: workspaceId,
      number: index + 1,
      label: workspaceId,
      focused: index === 0,
      pane_count: 1,
      tab_count: 1,
      active_tab_id: `${workspaceId}-t1`,
      agent_status: "unknown",
    })),
    tabs: workspaceIds.map((workspaceId) => ({
      tab_id: `${workspaceId}-t1`,
      workspace_id: workspaceId,
      number: 1,
      label: "1",
      focused: true,
      pane_count: 1,
      agent_status: "unknown",
    })),
    panes: workspaceIds.map((workspaceId) => ({ ...rootPane(workspaceId), focused: true, agent_status: "unknown" })),
    layouts: [],
    agents: [],
  };
}

/** Starts the stores again, and reads a snapshot with the workspace `w1` only. */
async function startHeidrun() {
  vi.resetModules();
  mocks.snapshot.mockResolvedValue(buildSnapshot(["w1"]));
  const session = await import("./session");
  await session.refresh();
  return session;
}

beforeEach(() => {
  localStorage.clear();
  mocks.snapshot.mockReset();
  mocks.newWorkspace.mockReset();
});

describe("openFolderAsWorkspace", () => {
  it("creates the workspace with the folder and the name, then selects its first tab and its first pane", async () => {
    const session = await startHeidrun();
    expect(session.state.selectedWorkspaceId).toBe("w1");
    mocks.newWorkspace.mockResolvedValue({ workspace: { workspace_id: "w2" }, tab: {}, root_pane: rootPane("w2") });
    mocks.snapshot.mockResolvedValue(buildSnapshot(["w1", "w2"]));
    await session.openFolderAsWorkspace("/work/app/.claude/worktrees/fix-tab-35", "fix-tab-35");
    expect(mocks.newWorkspace).toHaveBeenCalledWith("/work/app/.claude/worktrees/fix-tab-35", "fix-tab-35");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(session.state.selectedTabId).toBe("w2-t1");
    expect(session.state.selectedPaneId).toBe("w2-p1");
  });

  it("expands the character ~ of the folder, and returns the first pane of the new workspace (issue #379)", async () => {
    const session = await startHeidrun();
    mocks.newWorkspace.mockResolvedValue({ workspace: { workspace_id: "w2" }, tab: {}, root_pane: rootPane("w2") });
    mocks.snapshot.mockResolvedValue(buildSnapshot(["w1", "w2"]));
    const pane = await session.newWorkspace("~/my_project", "my_project");
    expect(mocks.newWorkspace).toHaveBeenCalledWith("/home/my_project", "my_project");
    expect(pane).toEqual(rootPane("w2"));
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(session.state.selectedTabId).toBe("w2-t1");
    expect(session.state.selectedPaneId).toBe("w2-p1");
  });

  it("returns no pane when Herdr cannot create the workspace (issue #379)", async () => {
    const session = await startHeidrun();
    mocks.newWorkspace.mockRejectedValue("herdr_unreachable");
    expect(await session.newWorkspace("/work/app", "app")).toBeUndefined();
    expect(session.state.selectedWorkspaceId).toBe("w1");
  });

  it("keeps the selection and shows a toast when Herdr cannot create the workspace", async () => {
    const session = await startHeidrun();
    mocks.newWorkspace.mockRejectedValue("herdr_unreachable");
    await session.openFolderAsWorkspace("/work/app/.claude/worktrees/fix-tab-35", "fix-tab-35");
    expect(session.state.selectedWorkspaceId).toBe("w1");
    expect(session.state.toast).not.toBe("");
  });
});
