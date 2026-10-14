import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    moveWorkspace: vi.fn(async () => ({})),
  };
});

/** Three workspaces in the order of Herdr: scratch (a shell only), heidrun (an agent), and teamwright (an agent). */
function makeSnapshot(agentStatus: string): SessionSnapshot {
  return {
    workspaces: [
      { workspace_id: "w1", number: 1, label: "scratch", agent_status: "idle" },
      { workspace_id: "w2", number: 2, label: "heidrun", agent_status: agentStatus },
      { workspace_id: "w3", number: 3, label: "teamwright", agent_status: agentStatus },
    ],
    tabs: [],
    panes: [
      { pane_id: "p1", workspace_id: "w1", tab_id: "t1" },
      { pane_id: "p2", workspace_id: "w2", tab_id: "t2", agent: "claude", agent_status: agentStatus },
      { pane_id: "p3", workspace_id: "w3", tab_id: "t3", agent: "codex", agent_status: agentStatus },
    ],
    agents: [],
    layouts: [],
  } as unknown as SessionSnapshot;
}

async function loadSession(agentStatus = "idle") {
  const session = await import("./session");
  const api = await import("../lib/api");
  session.state.snapshot = makeSnapshot(agentStatus);
  session.state.selectedWorkspaceId = "w1";
  return { session, api };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("order of the workspaces: the status of the agents never changes it", () => {
  it("keeps the order of Herdr, with a workspace without an agent above the workspaces with an agent", async () => {
    const { session } = await loadSession();
    expect(session.workspaces.value.map((workspace) => workspace.label)).toEqual(["scratch", "heidrun", "teamwright"]);
  });

  it("keeps the same order for every status of the agents", async () => {
    for (const status of ["idle", "working", "blocked", "done", "unknown"]) {
      const { session } = await loadSession(status);
      expect(session.workspaces.value.map((workspace) => workspace.label)).toEqual(["scratch", "heidrun", "teamwright"]);
    }
  });

  it("keeps the same order when an agent starts and when an agent stops", async () => {
    const { session } = await loadSession();
    const startedSnapshot = makeSnapshot("working");
    (startedSnapshot.panes[0] as { agent?: string }).agent = "claude";
    session.state.snapshot = startedSnapshot;
    expect(session.workspaces.value.map((workspace) => workspace.label)).toEqual(["scratch", "heidrun", "teamwright"]);
    session.state.snapshot = { ...makeSnapshot("idle"), panes: [] } as unknown as SessionSnapshot;
    expect(session.workspaces.value.map((workspace) => workspace.label)).toEqual(["scratch", "heidrun", "teamwright"]);
  });

  it("follows the number of Herdr, which only the developer changes by moving a workspace", async () => {
    const { session } = await loadSession();
    const movedSnapshot = makeSnapshot("idle");
    const numbers: Record<string, number> = { w2: 1, w3: 2, w1: 3 };
    for (const workspace of movedSnapshot.workspaces) {
      workspace.number = numbers[workspace.workspace_id];
    }
    session.state.snapshot = movedSnapshot;
    expect(session.workspaces.value.map((workspace) => workspace.label)).toEqual(["heidrun", "teamwright", "scratch"]);
  });

  it("has no other function that orders the workspaces by the presence of an agent", async () => {
    const session = await import("./session");
    expect("orderedWorkspaces" in session).toBe(false);
    expect("moveWorkspaceInView" in session).toBe(false);
  });
});

describe("keyboard and shortcuts use the same order", () => {
  it("cycles through the workspaces in the order of the list, past a workspace without an agent", async () => {
    const { session } = await loadSession();
    session.cycleWorkspace(1);
    expect(session.state.selectedWorkspaceId).toBe("w2");
    session.cycleWorkspace(1);
    expect(session.state.selectedWorkspaceId).toBe("w3");
    session.cycleWorkspace(1);
    expect(session.state.selectedWorkspaceId).toBe("w1");
    session.cycleWorkspace(-1);
    expect(session.state.selectedWorkspaceId).toBe("w3");
  });

  it("selects the workspace by its position in the list with the shortcut Command and a digit", async () => {
    const { session } = await loadSession();
    session.selectWorkspaceAt(0);
    expect(session.state.selectedWorkspaceId).toBe("w1");
    session.selectWorkspaceAt(2);
    expect(session.state.selectedWorkspaceId).toBe("w3");
  });

  it("moves the selected workspace down past a workspace that runs an agent, and up again", async () => {
    const { session, api } = await loadSession();
    await session.shiftWorkspace(1);
    expect(api.moveWorkspace).toHaveBeenLastCalledWith("w1", 2);
    session.state.selectedWorkspaceId = "w3";
    await session.shiftWorkspace(-1);
    expect(api.moveWorkspace).toHaveBeenLastCalledWith("w3", 1);
  });

  it("moves nothing past the first and the last workspace", async () => {
    const { session, api } = await loadSession();
    await session.shiftWorkspace(-1);
    session.state.selectedWorkspaceId = "w3";
    await session.shiftWorkspace(1);
    expect(api.moveWorkspace).not.toHaveBeenCalled();
  });
});
