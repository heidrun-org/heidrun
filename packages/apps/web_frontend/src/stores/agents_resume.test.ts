import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { launchAgent } from "./agents";
import { toast } from "./session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  newTab: vi.fn(async () => ({ pane_id: "p1", tab_id: "t1" })),
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

const ID = "01a03a5e-a361-7ab2-af03-62ea1a76ce4b";

/** Launches an agent that resumes a chat, and waits for the pause before the command is typed. */
async function resume(tool: "claude" | "codex", resumeId: string) {
  const launched = launchAgent({
    workspaceId: "w1",
    cwd: "/work/app",
    tool,
    agent: null,
    model: null,
    label: "Fix the tab bar",
    prompt: "",
    resumeId,
  });
  await vi.advanceTimersByTimeAsync(1_000);
  return launched;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(api.newTab).mockClear();
  vi.mocked(api.run).mockClear();
  vi.mocked(toast).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("launchAgent with a chat to resume", () => {
  it("opens a new tab named after the chat, in the folder, and types claude --resume with the session identifier", async () => {
    expect(await resume("claude", ID)).toBe("ok");
    expect(api.newTab).toHaveBeenCalledWith("w1", "/work/app", "Fix the tab bar");
    expect(api.run).toHaveBeenCalledWith("p1", `claude --resume '${ID}'`);
  });

  it("types codex resume with the session identifier for a chat of Codex", async () => {
    expect(await resume("codex", ID)).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", `${DARK_COLORS}codex resume '${ID}'`);
  });

  it("opens no tab and types nothing when the session identifier is not safe for a shell", async () => {
    expect(await resume("claude", "x'; rm -rf ~; '")).toBe("failed");
    expect(api.newTab).not.toHaveBeenCalled();
    expect(api.run).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Invalid session identifier: x'; rm -rf ~; '");
  });
});
