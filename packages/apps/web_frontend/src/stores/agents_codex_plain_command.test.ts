import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { launchAgent } from "./agents";
import { project, runLauncher } from "./project";
import type { Launcher } from "../lib/project_config";

vi.mock('./workspace_folders', () => ({ WorkspaceFolders: { require: () => '/work/app' } }));
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
vi.mock("./guards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./guards")>()),
  allowCommand: vi.fn(async () => true),
}));

const ID = "01a03a5e-a361-7ab2-af03-62ea1a76ce4b";

/** Launches a free agent in a new tab, and waits for the pause before the command is typed. */
async function launch(tool: "claude" | "codex", resumeId?: string) {
  const launched = launchAgent({
    workspaceId: "w1",
    cwd: "/work/app",
    tool,
    agent: null,
    model: null,
    label: tool,
    prompt: "",
    resumeId,
  });
  await vi.advanceTimersByTimeAsync(1_000);
  return launched;
}

/** Runs a launcher of the Launchers sidebar section, and waits for the pause before the command is typed. */
async function runCommandLauncher(command: string) {
  const launcher: Launcher = { id: "agent", label: "Agent", command };
  project.byWorkspace.w1 = {
    root: "/work/app",
    config_path: "/work/app/.heidrun/config.json",
    config: { launchers: [launcher] } as never,
    detected: [],
  };
  const running = runLauncher("w1", launcher);
  await vi.advanceTimersByTimeAsync(1_000);
  await running;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(api.run).mockClear();
  project.panes = {};
  project.busy = {};
});

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.theme;
});

describe("Codex starts with the plain command (issue 791)", () => {
  for (const theme of ["light", "dark"]) {
    it(`types the plain command codex in the ${theme} theme`, async () => {
      document.documentElement.dataset.theme = theme;
      expect(await launch("codex")).toBe("ok");
      expect(api.run).toHaveBeenCalledWith("p1", "codex");
    });

    it(`types the plain command codex resume in the ${theme} theme`, async () => {
      document.documentElement.dataset.theme = theme;
      expect(await launch("codex", ID)).toBe("ok");
      expect(api.run).toHaveBeenCalledWith("p1", `codex resume '${ID}'`);
    });

    it(`types the command of a launcher that starts Codex as it is in the ${theme} theme`, async () => {
      document.documentElement.dataset.theme = theme;
      await runCommandLauncher("codex -m 'gpt-5' 'fix the tab bar'");
      expect(api.run).toHaveBeenCalledWith("p1", "codex -m 'gpt-5' 'fix the tab bar'");
    });
  }

  it("types no printf before any command", async () => {
    document.documentElement.dataset.theme = "light";
    await launch("codex");
    await launch("codex", ID);
    await runCommandLauncher("codex");
    for (const call of vi.mocked(api.run).mock.calls) {
      expect(call[1]).not.toContain("printf");
    }
  });

  it("types the plain command claude", async () => {
    expect(await launch("claude")).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", "claude");
  });

  it("types the command of a launcher that does not start Codex as it is", async () => {
    await runCommandLauncher("pnpm dev");
    expect(api.run).toHaveBeenCalledWith("p1", "pnpm dev");
  });
});
