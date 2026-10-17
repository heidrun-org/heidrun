import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { launchAgent } from "./agents";
import { project, runLauncher } from "./project";
import type { Launcher } from "../lib/project_config";

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

/** The text typed before Codex, which sets the colours of the terminal view in the light theme (issue #636). */
const LIGHT_COLORS = "printf '\\033]10;rgb:2b2b/2f2f/3333\\033\\\\\\033]11;rgb:ffff/ffff/ffff\\033\\\\'; ";

/** The text typed before Codex, which sets the colours of the terminal view in the dark theme (issue #636). */
const DARK_COLORS = "printf '\\033]10;rgb:c9c9/cdcd/d1d1\\033\\\\\\033]11;rgb:1f1f/1f1f/1f1f\\033\\\\'; ";

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

describe("Codex in the light theme (issue #636)", () => {
  it("types the text colour and the background colour of the light theme before codex", async () => {
    document.documentElement.dataset.theme = "light";
    expect(await launch("codex")).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", `${LIGHT_COLORS}codex`);
  });

  it("types the colours of the light theme before codex resume", async () => {
    document.documentElement.dataset.theme = "light";
    expect(await launch("codex", ID)).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", `${LIGHT_COLORS}codex resume '${ID}'`);
  });

  it("types the colours of the dark theme before codex in the dark theme", async () => {
    document.documentElement.dataset.theme = "dark";
    expect(await launch("codex")).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", `${DARK_COLORS}codex`);
  });

  it("types no colours before claude", async () => {
    document.documentElement.dataset.theme = "light";
    expect(await launch("claude")).toBe("ok");
    expect(api.run).toHaveBeenCalledWith("p1", "claude");
  });

  it("types the colours of the light theme before the command of a launcher that starts Codex", async () => {
    document.documentElement.dataset.theme = "light";
    await runCommandLauncher("codex -m 'gpt-5' 'fix the tab bar'");
    expect(api.run).toHaveBeenCalledWith("p1", `${LIGHT_COLORS}codex -m 'gpt-5' 'fix the tab bar'`);
  });

  it("types the command of a launcher that does not start Codex as it is", async () => {
    document.documentElement.dataset.theme = "light";
    await runCommandLauncher("pnpm dev");
    expect(api.run).toHaveBeenCalledWith("p1", "pnpm dev");
  });
});
