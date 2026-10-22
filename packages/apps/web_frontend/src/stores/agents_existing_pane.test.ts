import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../lib/api";
import { agentCommand, launchAgent } from "./agents";
import { selectPane } from "./session";
import { CompositionBar } from './composition_bar';
import { settings } from './settings';
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
	settings.isCompositionBarShownOnAgentStart = false;
	for (const paneId of Object.keys(CompositionBar.byPane)) {
		CompositionBar.removePane(paneId);
	}
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
    expect(api.run).toHaveBeenCalledWith("w2:p1", "codex");
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


describe('initial composition bar visibility (issue #726)', () => {
	it.each(['claude', 'codex', 'agy'] as const)(
		'keeps the composition bar hidden by default for %s',
		async (tool) => {
			expect(await launchInRootPane(tool)).toBe('ok');
			expect(CompositionBar.forPane(ROOT_PANE.pane_id).isOpen).toBe(false);
		},
	);

	it.each(['claude', 'codex', 'agy'] as const)(
		'opens the composition bar for %s in a new workspace or split pane when enabled',
		async (tool) => {
			settings.isCompositionBarShownOnAgentStart = true;
			expect(await launchInRootPane(tool)).toBe('ok');
			const compositionBar = CompositionBar.forPane(ROOT_PANE.pane_id);
			expect(compositionBar.isOpen).toBe(true);
			compositionBar.isOpen = false;
			settings.isCompositionBarShownOnAgentStart = false;
			settings.isCompositionBarShownOnAgentStart = true;
			expect(compositionBar.isOpen).toBe(false);
		},
	);

	it('opens a new tab composition bar without changing other panes when enabled', async () => {
		const existingBar = CompositionBar.forPane('existing-pane');
		existingBar.text = 'Keep this draft';
		settings.isCompositionBarShownOnAgentStart = true;
		const launched = launchAgent({
			workspaceId: 'w1',
			cwd: '/work/app',
			tool: 'claude',
			agent: null,
			model: null,
			label: 'claude',
			prompt: '',
		});
		await vi.advanceTimersByTimeAsync(1_000);
		expect(await launched).toBe('ok');
		const newBar = CompositionBar.forPane('new-p1');
		expect(newBar.isOpen).toBe(true);
		expect(existingBar.isOpen).toBe(false);
		expect(existingBar.text).toBe('Keep this draft');
		settings.isCompositionBarShownOnAgentStart = false;
		expect(newBar.isOpen).toBe(true);
	});
});
