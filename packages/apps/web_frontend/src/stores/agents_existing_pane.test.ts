import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { agentCommand, launchAgent } from "./agents";
import { selectPane } from "./session";
import type { PaneInfo } from "../lib/types";

vi.mock('./workspace_folders', () => ({ WorkspaceFolders: { require: () => '/work/app' } }));
vi.mock('./guards', () => ({ allowCommand: vi.fn(async () => true) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  newTab: vi.fn(async () => ({ pane_id: "new-p1", tab_id: "new-t1" })),
  renameTab: vi.fn(async () => undefined),
  run: vi.fn(async () => undefined),
}));
vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  refresh: vi.fn(async () => undefined),
  selectPane: vi.fn(),
  toast: vi.fn(),
}));

/** The text typed before Codex, which sets the colours of the terminal view in the dark theme (issue #636). */
const DARK_COLORS = "printf '\\033]10;rgb:c9c9/cdcd/d1d1\\033\\\\\\033]11;rgb:1f1f/1f1f/1f1f\\033\\\\'; ";

/** The first pane of a new workspace, which Herdr creates with the first tab of the workspace. */
const ROOT_PANE = { pane_id: "w2:p1", tab_id: "w2:t1", workspace_id: "w2" } as PaneInfo;

/** Launches a free agent in the first pane of a new workspace, and waits for the pause before the command is typed. */
async function launchInRootPane(tool: "claude" | "codex" | "agy") {
  const launched = launchAgent({
    workspaceId: "w2",
    cwd: "/work/app",
    tool,
    agent: null,
    model: null,
    label: tool,
    prompt: "",
    existingPane: ROOT_PANE,
  });
  await vi.advanceTimersByTimeAsync(1_000);
  return launched;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(api.newTab).mockClear();
  vi.mocked(api.renameTab).mockClear();
  vi.mocked(api.run).mockClear();
  vi.mocked(selectPane).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("launchAgent with an existing pane (issue #379)", () => {
  it("opens no new tab, names the tab of the pane after the command, and types the command in the pane", async () => {
    expect(await launchInRootPane("claude")).toBe("ok");
    expect(api.newTab).not.toHaveBeenCalled();
    expect(api.renameTab).toHaveBeenCalledWith("w2:t1", "claude");
    expect(api.run).toHaveBeenCalledWith("w2:p1", "claude");
    expect(selectPane).toHaveBeenCalledWith(ROOT_PANE);
  });

  it("types codex in the existing pane for the command Codex", async () => {
    expect(await launchInRootPane("codex")).toBe("ok");
    expect(api.newTab).not.toHaveBeenCalled();
    expect(api.run).toHaveBeenCalledWith("w2:p1", `${DARK_COLORS}codex`);
  });

  it("builds the Antigravity command with a safely quoted starting prompt", () => {
    expect(agentCommand("agy", null, "gemini-3.8-flash-high", "Review Jerome's change")).toBe(
      "agy --model 'gemini-3.8-flash-high' -i 'Review Jerome'\\''s change'",
    );
  });

  it("starts Antigravity with its prompt in the command line", async () => {
    const launched = launchAgent({
      workspaceId: "w2",
      cwd: "/work/app",
      tool: "agy",
      agent: null,
      model: null,
      label: "agy",
      prompt: "Review this change",
      existingPane: ROOT_PANE,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(await launched).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("w2:p1", "agy -i 'Review this change'");
  });

  it("still opens a new tab when no pane exists", async () => {
    const launched = launchAgent({
      workspaceId: "w1",
      cwd: "/work/app",
      tool: "claude",
      agent: null,
      model: null,
      label: "claude",
      prompt: "",
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await launched).toBe("ok");
    expect(api.newTab).toHaveBeenCalledWith("w1", "/work/app", "claude");
    expect(api.renameTab).not.toHaveBeenCalled();
    expect(api.run).toHaveBeenCalledWith("new-p1", "claude");
  });
});
