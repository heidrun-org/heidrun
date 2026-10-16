import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { guardHit } from "./guards";
import { macros } from "./macros";
import { handleMobileCall } from "./mobile";
import { project, runLauncher, stopLauncher } from "./project";
import { state } from "./session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  prompt: vi.fn(async () => undefined),
}));
vi.mock("./guards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./guards")>()),
  guardHit: vi.fn(async () => null),
}));
vi.mock("./project", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./project")>()),
  runLauncher: vi.fn(async () => undefined),
  stopLauncher: vi.fn(async () => undefined),
}));
vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  toast: vi.fn(),
}));

const LAUNCHER = { id: "dev", label: "Dev server", command: "pnpm dev" };

beforeEach(() => {
  vi.mocked(api.prompt).mockClear();
  vi.mocked(guardHit).mockReset();
  vi.mocked(guardHit).mockResolvedValue(null);
  vi.mocked(runLauncher).mockClear();
  vi.mocked(stopLauncher).mockClear();
  state.snapshot = {
    workspaces: [
      { workspace_id: "w1", label: "heidrun", number: 1 },
      { workspace_id: "w2", label: "website", number: 2 },
    ],
    tabs: [{ tab_id: "t1", workspace_id: "w1", label: "fix-35" }],
    panes: [{ pane_id: "p1", tab_id: "t1", workspace_id: "w1", cwd: "/work/heidrun", agent: "claude", agent_status: "idle" }],
  } as never;
  macros.personal = [{ id: "progress", label: "Progress", description: "Where are you?", text: "Where are you? {agent}" }];
  project.byWorkspace.w1 = {
    root: "/work/heidrun",
    config: { version: 1, launchers: [LAUNCHER], prompts: [{ id: "review", label: "Review", text: "Review the branch" }] },
  } as never;
  project.byWorkspace.w2 = { root: "/work/website", config: { version: 1, launchers: [] } } as never;
  project.errors.w1 = undefined;
  project.errors.w2 = undefined;
});

describe("the method macros", () => {
  it("lists the personal macros, then the macros of the project of each workspace", async () => {
    expect(await handleMobileCall("macros", {})).toEqual({
      macros: [
        { id: "progress", label: "Progress", description: "Where are you?", source: "personal", workspaceId: null, workspace: null },
        { id: "review", label: "Review", description: "", source: "project", workspaceId: "w1", workspace: "heidrun" },
      ],
    });
  });
});

describe("the method prompt with a macro", () => {
  it("sends the text of the macro, with its variables replaced for the pane", async () => {
    expect(await handleMobileCall("prompt", { paneId: "p1", macroId: "progress", macroSource: "personal" })).toEqual({ ok: true });
    expect(api.prompt).toHaveBeenCalledWith("p1", expect.stringMatching(/^Where are you\? \S/));
  });

  it("sends a macro of a project", async () => {
    await handleMobileCall("prompt", { paneId: "p1", macroId: "review", macroSource: "project", macroWorkspaceId: "w1" });
    expect(api.prompt).toHaveBeenCalledWith("p1", "Review the branch");
  });

  it("refuses a macro that does not exist anymore", async () => {
    const answer = await handleMobileCall("prompt", { paneId: "p1", macroId: "gone", macroSource: "personal" });
    expect(answer).toHaveProperty("error");
    expect(api.prompt).not.toHaveBeenCalled();
  });

  it("asks the confirmation of a shell command of a macro, like a typed prompt", async () => {
    macros.personal = [{ id: "clean", label: "Clean", description: "", text: "! rm -rf build" }];
    vi.mocked(guardHit).mockResolvedValue({ level: "confirm", why: "deletes files" } as never);
    const answer = await handleMobileCall("prompt", { paneId: "p1", macroId: "clean", macroSource: "personal" });
    expect(answer).toEqual({ confirm: { command: "rm -rf build", why: "deletes files" } });
    expect(api.prompt).not.toHaveBeenCalled();
  });
});

describe("the method launchers", () => {
  it("lists the launchers of each workspace whose project has one, with the status of each launcher", async () => {
    expect(await handleMobileCall("launchers", {})).toEqual({
      workspaces: [
        {
          id: "w1",
          label: "heidrun",
          error: null,
          launchers: [{ id: "dev", label: "Dev server", description: null, command: "pnpm dev", status: "idle" }],
        },
      ],
    });
  });
});

describe("the method launch", () => {
  it("runs a launcher that the guards let through, and does not ask the guards of the desktop again", async () => {
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run" })).toEqual({ ok: true });
    expect(guardHit).toHaveBeenCalledWith("pnpm dev", "/work/heidrun");
    expect(runLauncher).toHaveBeenCalledWith("w1", LAUNCHER, true, true);
  });

  it("asks the phone to confirm a command that the guards stop, then runs it once confirmed", async () => {
    vi.mocked(guardHit).mockResolvedValue({ level: "confirm", why: "starts a server" } as never);
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run" })).toEqual({
      confirm: { command: "pnpm dev", why: "starts a server" },
    });
    expect(runLauncher).not.toHaveBeenCalled();
    await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run", confirmed: true, command: "pnpm dev" });
    expect(runLauncher).toHaveBeenCalledWith("w1", LAUNCHER, true, true);
  });

  it("never runs a command that the project blocks", async () => {
    vi.mocked(guardHit).mockResolvedValue({ level: "block", why: "forbidden" } as never);
    const answer = await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "run", confirmed: true, command: "pnpm dev" });
    expect(answer).toHaveProperty("error");
    expect(runLauncher).not.toHaveBeenCalled();
  });

  it("stops a launcher", async () => {
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "dev", action: "stop" })).toEqual({ ok: true });
    expect(stopLauncher).toHaveBeenCalledWith("w1", LAUNCHER);
  });

  it("refuses a launcher that does not exist", async () => {
    expect(await handleMobileCall("launch", { workspaceId: "w1", launcherId: "gone", action: "run" })).toHaveProperty("error");
    expect(runLauncher).not.toHaveBeenCalled();
  });
});
