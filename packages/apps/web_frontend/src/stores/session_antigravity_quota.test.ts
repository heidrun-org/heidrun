import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("Antigravity quota", () => {
  it("shows the latest Antigravity bucket snapshot with remaining use and reset times", async () => {
    const { quotas, state } = await import("./session");
    const now = Math.floor(Date.now() / 1000);
    const reset = new Date((now + 6 * 24 * 60 * 60) * 1000).toISOString();
    state.snapshot = {
      version: "1",
      protocol: 1,
      workspaces: [],
      tabs: [],
      panes: [
        {
          pane_id: "agy-pane",
          terminal_id: "terminal",
          workspace_id: "workspace",
          tab_id: "tab",
          focused: true,
          agent_status: "idle",
          revision: 1,
          agent: "antigravity",
          tokens: {
            hd_agy_ts: String(now),
            hd_agy_count: "2",
            hd_agy_0_id: "3p-weekly",
            hd_agy_0_remaining: "1",
            hd_agy_0_reset: reset,
            hd_agy_1_id: "gemini-weekly",
            hd_agy_1_remaining: "0.86712",
            hd_agy_1_reset: reset,
          },
        },
      ],
      agents: [],
      layouts: [],
    };

    const quota = quotas.value.find((entry) => entry.provider === "antigravity");
    expect(quota?.windows).toHaveLength(2);
    expect(quota?.windows[0]).toMatchObject({
      id: "antigravity:gemini-weekly",
      name: "Gemini weekly limit",
      resetsAt: expect.any(Number),
      period: "week",
      windowMinutes: 10080,
    });
    expect(quota?.windows[0]?.percent).toBeCloseTo(13.288);
    expect(quota?.windows[1]).toMatchObject({ id: "antigravity:3p-weekly", percent: 0 });
  });

  it("keeps the last quota snapshot after the Antigravity pane closes", async () => {
    const { quotas, state } = await import("./session");
    const now = Math.floor(Date.now() / 1000);
    state.snapshot = {
      version: "1",
      protocol: 1,
      workspaces: [],
      tabs: [],
      panes: [
        {
          pane_id: "agy-pane",
          terminal_id: "terminal",
          workspace_id: "workspace",
          tab_id: "tab",
          focused: true,
          agent_status: "idle",
          revision: 1,
          tokens: { hd_agy_ts: String(now), hd_agy_count: "1", hd_agy_0_id: "gemini-weekly", hd_agy_0_remaining: "0.5" },
        },
      ],
      agents: [],
      layouts: [],
    };
    expect(quotas.value.find((entry) => entry.provider === "antigravity")?.windows[0]?.percent).toBe(50);
    state.snapshot = { ...state.snapshot, panes: [] };
    expect(quotas.value.find((entry) => entry.provider === "antigravity")?.windows[0]?.percent).toBe(50);
  });
});
