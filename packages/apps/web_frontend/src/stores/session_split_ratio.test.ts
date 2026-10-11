import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setSplitRatio: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/api", () => ({
  setSplitRatio: mocks.setSplitRatio,
  snapshot: mocks.snapshot,
  watchPanes: vi.fn(async () => {}),
  codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

import { setSplitRatios, state } from "./session";

const EMPTY_SNAPSHOT = {
  version: "test",
  protocol: 1,
  workspaces: [],
  tabs: [],
  panes: [],
  layouts: [],
  agents: [],
};

/** Lets the chain of asynchronous calls of the store run until it is idle. */
async function settle() {
  for (let turn = 0; turn < 20; turn++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  mocks.setSplitRatio.mockReset();
  mocks.snapshot.mockReset();
  mocks.snapshot.mockResolvedValue(EMPTY_SNAPSHOT);
  state.toast = "";
});

describe("setSplitRatios", () => {
  it("sends the share of each split to Herdr, then reads the layout again", async () => {
    mocks.setSplitRatio.mockResolvedValue({});
    setSplitRatios([
      { tabId: "w1:t1", path: [true], ratio: 0.55 },
      { tabId: "w1:t1", path: [], ratio: 0.4 },
    ]);
    await settle();
    expect(mocks.setSplitRatio.mock.calls).toEqual([
      ["w1:t1", [true], 0.55],
      ["w1:t1", [], 0.4],
    ]);
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps only the latest call while a request runs, so the panes do not replay old positions", async () => {
    let finishFirst: () => void = () => {};
    mocks.setSplitRatio.mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    mocks.setSplitRatio.mockResolvedValue({});
    setSplitRatios([{ tabId: "w1:t1", path: [], ratio: 0.41 }]);
    setSplitRatios([{ tabId: "w1:t1", path: [], ratio: 0.42 }]);
    setSplitRatios([{ tabId: "w1:t1", path: [], ratio: 0.43 }]);
    await settle();
    expect(mocks.setSplitRatio).toHaveBeenCalledTimes(1);
    finishFirst();
    await settle();
    expect(mocks.setSplitRatio.mock.calls.map((call) => call[2])).toEqual([0.41, 0.43]);
  });

  it("shows the error and goes on with the next call when Herdr refuses a request", async () => {
    mocks.setSplitRatio.mockRejectedValueOnce("split_not_found: split path not found");
    mocks.setSplitRatio.mockResolvedValue({});
    setSplitRatios([{ tabId: "w1:t1", path: [false, true], ratio: 0.5 }]);
    await settle();
    expect(state.toast).toContain("split_not_found");
    setSplitRatios([{ tabId: "w1:t1", path: [], ratio: 0.6 }]);
    await settle();
    expect(mocks.setSplitRatio).toHaveBeenCalledTimes(2);
  });
});
