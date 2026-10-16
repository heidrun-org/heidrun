import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  notify: vi.fn(async () => true),
  notifyPhone: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/notify", () => ({ notify: mocks.notify, notifyPhone: mocks.notifyPhone, isQuiet: () => false }));
vi.mock("../lib/api", () => ({
  snapshot: mocks.snapshot,
  watchPanes: vi.fn(async () => {}),
  read: vi.fn(async () => ""),
  codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

/** Builds a snapshot with one coding agent in the given status. */
function buildSnapshot(status: string) {
  return {
    version: "test",
    protocol: 1,
    focused_workspace_id: "w1",
    workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "t1", agent_status: status }],
    tabs: [{ tab_id: "t1", workspace_id: "w1", number: 1, label: "main", focused: true, pane_count: 1, agent_status: status }],
    panes: [{ pane_id: "p1", tab_id: "t1", workspace_id: "w1", focused: true, cwd: "/work", agent: "claude", agent_status: status }],
    layouts: [{ tab_id: "t1", focused_pane_id: "p1", root: { type: "pane", pane_id: "p1" } }],
    agents: [],
  };
}

/** Starts the stores, reads a working agent, then reads the same agent blocked. The window has the focus and the pane is open. */
async function blockTheOpenPane() {
  vi.resetModules();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const session = await import("./session");
  mocks.snapshot.mockResolvedValue(buildSnapshot("working"));
  await session.refresh();
  session.state.selectedPaneId = "p1";
  mocks.snapshot.mockResolvedValue(buildSnapshot("blocked"));
  await session.refresh();
}

beforeEach(() => {
  localStorage.clear();
  mocks.snapshot.mockReset();
  mocks.notify.mockClear();
  mocks.notifyPhone.mockClear();
});

describe("the push to the phone when a coding agent is blocked", () => {
  it("goes out even when the window has the focus and the blocked pane is open, where the desktop notification does not", async () => {
    await blockTheOpenPane();
    expect(mocks.notifyPhone).toHaveBeenCalledTimes(1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
