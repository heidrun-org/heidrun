import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));

const SNAPSHOT = {
  workspaces: [],
  panes: [
    { pane_id: "p1", workspace_id: "w1" },
    { pane_id: "p2", workspace_id: "w1" },
    { pane_id: "p3", workspace_id: "w1" },
    { pane_id: "other", workspace_id: "w2" },
  ],
  agents: [],
} as unknown as SessionSnapshot;

async function loadSession() {
  const session = await import("./session");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  return session;
}

function paneIds(session: Awaited<ReturnType<typeof loadSession>>): string[] {
  return session.workspacePanes.value.map((p) => p.pane_id);
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("movePaneInView", () => {
  it("keeps the order of Herdr when nothing was moved", async () => {
    const session = await loadSession();
    expect(paneIds(session)).toEqual(["p1", "p2", "p3"]);
  });

  it("moves a pane up", async () => {
    const session = await loadSession();
    session.movePaneInView("p3", 0);
    expect(paneIds(session)).toEqual(["p3", "p1", "p2"]);
  });

  it("moves a pane down", async () => {
    const session = await loadSession();
    session.movePaneInView("p1", 3);
    expect(paneIds(session)).toEqual(["p2", "p3", "p1"]);
  });

  it("keeps the order when a pane is dropped at its own position", async () => {
    const session = await loadSession();
    session.movePaneInView("p2", 1);
    session.movePaneInView("p2", 2);
    expect(paneIds(session)).toEqual(["p1", "p2", "p3"]);
  });

  it("keeps the order after a reload", async () => {
    const first = await loadSession();
    first.movePaneInView("p3", 0);
    vi.resetModules();
    const second = await loadSession();
    expect(paneIds(second)).toEqual(["p3", "p1", "p2"]);
  });

  it("puts a new pane after the ordered ones", async () => {
    const session = await loadSession();
    session.movePaneInView("p3", 0);
    session.state.snapshot = {
      ...SNAPSHOT,
      panes: [...SNAPSHOT.panes, { pane_id: "p4", workspace_id: "w1" }],
    } as unknown as SessionSnapshot;
    expect(paneIds(session)).toEqual(["p3", "p1", "p2", "p4"]);
  });
});
