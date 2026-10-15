import { beforeEach, describe, expect, it, vi } from "vitest";

const launchAgent = vi.hoisted(() => vi.fn(async () => "ok"));
const newTerminal = vi.hoisted(() => vi.fn());
const splitPane = vi.hoisted(() => vi.fn(async (): Promise<typeof splitPaneResult | undefined> => splitPaneResult));
const splitPaneResult = vi.hoisted(() => ({ pane_id: "w1:p2", tab_id: "w1:t1", workspace_id: "w1" }));
const rootPane = vi.hoisted(() => ({ pane_id: "w2:p1", tab_id: "w2:t1", workspace_id: "w2" }));
const newWorkspace = vi.hoisted(() => vi.fn(async (): Promise<typeof rootPane | undefined> => rootPane));
const newAgent = vi.hoisted(() => ({ open: false }));
const selectedWorkspace = vi.hoisted(() => ({ value: { workspace_id: "w1" } as { workspace_id: string } | null }));
const selectedPane = vi.hoisted(() => ({ value: { cwd: "/work/project", foreground_cwd: "/work/project/src" } }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("./agents", () => ({ launchAgent, newAgent }));
vi.mock("./session", () => ({ newTerminal, newWorkspace, selectedPane, selectedWorkspace, splitPane }));
vi.mock("./input", () => ({ insertIntoFocusedPane: vi.fn() }));

/** A click on the plus button of the tab bar, with or without the key Shift. */
function click(isShift: boolean): MouseEvent {
  return new MouseEvent("click", { shiftKey: isShift });
}

beforeEach(() => {
  localStorage.clear();
  launchAgent.mockClear();
  newTerminal.mockClear();
  splitPane.mockClear();
  splitPane.mockResolvedValue(splitPaneResult);
  newWorkspace.mockClear();
  newWorkspace.mockResolvedValue(rootPane);
  newAgent.open = false;
  vi.resetModules();
});

describe("the plus button of the tab bar (issue #328)", () => {
  it("starts a terminal, and opens no window, when the default command is Terminal", async () => {
    const { onNewPaneClick } = await import("./newPane");
    onNewPaneClick(click(false));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
    expect(newAgent.open).toBe(false);
  });

  it.each(["claude", "codex"] as const)("starts a free agent %s with the default model and no starting prompt", async (command) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = command;
    const { onNewPaneClick } = await import("./newPane");
    onNewPaneClick(click(false));
    await vi.waitFor(() => expect(launchAgent).toHaveBeenCalledTimes(1));
    expect(launchAgent).toHaveBeenCalledWith({
      workspaceId: "w1",
      cwd: "/work/project/src",
      tool: command,
      agent: null,
      model: null,
      label: command,
      prompt: "",
    });
    expect(newTerminal).not.toHaveBeenCalled();
    expect(newAgent.open).toBe(false);
  });

  it("starts the default command even when a previous pane was saved, without the key Shift", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { saveNewPaneValues, onNewPaneClick } = await import("./newPane");
    saveNewPaneValues({ tool: "codex", agent: null, model: "", label: "codex", labelTouched: false, text: "" });
    onNewPaneClick(click(false));
    await vi.waitFor(() => expect(launchAgent).toHaveBeenCalledTimes(1));
    expect(launchAgent.mock.calls[0]).toMatchObject([{ tool: "claude" }]);
    expect(newTerminal).not.toHaveBeenCalled();
  });

  it.each(["claude", "codex"] as const)("starts a terminal with the key Shift when the default command is %s (issue #465)", async (command) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = command;
    const { onNewPaneClick } = await import("./newPane");
    onNewPaneClick(click(true));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts a terminal with the key Shift, also when a previous pane was saved (issue #465)", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { saveNewPaneValues, onNewPaneClick } = await import("./newPane");
    saveNewPaneValues({ tool: "codex", agent: null, model: "", label: "codex", labelTouched: false, text: "" });
    onNewPaneClick(click(true));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });
});

describe("the split controls of a pane (issue #465)", () => {
  it.each(["right", "down"] as const)("splits %s and starts the default command in the new pane, without the key Shift", async (direction) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { onSplitPaneClick } = await import("./newPane");
    await onSplitPaneClick(click(false), direction, "w1:p1");
    expect(splitPane).toHaveBeenCalledWith(direction, "w1:p1");
    expect(launchAgent).toHaveBeenCalledTimes(1);
    expect(launchAgent).toHaveBeenCalledWith({
      workspaceId: "w1",
      cwd: "/work/project/src",
      tool: "codex",
      agent: null,
      model: null,
      label: "",
      prompt: "",
      existingPane: splitPaneResult,
    });
  });

  it("keeps the name of the tab: the label of the command is empty", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    const { onSplitPaneClick } = await import("./newPane");
    await onSplitPaneClick(click(false), "right", "w1:p1");
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: "claude", label: "" }));
  });

  it.each(["right", "down"] as const)("splits %s and starts a terminal only, with the key Shift", async (direction) => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { onSplitPaneClick } = await import("./newPane");
    await onSplitPaneClick(click(true), direction, "w1:p1");
    expect(splitPane).toHaveBeenCalledWith(direction, "w1:p1");
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it.each(["right", "down"] as const)("splits %s and starts a terminal only, when the default command is Terminal", async (direction) => {
    const { onSplitPaneClick } = await import("./newPane");
    await onSplitPaneClick(click(false), direction, "w1:p1");
    expect(splitPane).toHaveBeenCalledWith(direction, "w1:p1");
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts no command when the pane was not split", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    splitPane.mockResolvedValue(undefined);
    const { onSplitPaneClick } = await import("./newPane");
    await onSplitPaneClick(click(false), "right", "w1:p1");
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts the default command for the shortcut Command+D, for the selected pane", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { startDefaultSplit } = await import("./newPane");
    await startDefaultSplit("right");
    expect(splitPane).toHaveBeenCalledWith("right", undefined);
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: "codex", existingPane: splitPaneResult }));
  });
});

describe("the shortcut Command+T (issue #340)", () => {
  it("starts the default command of a new tab, the same command as the plus button", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "codex";
    const { startDefaultNewTab } = await import("./newPane");
    await startDefaultNewTab();
    expect(launchAgent).toHaveBeenCalledTimes(1);
    expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({ tool: "codex", agent: null, prompt: "" }));
    expect(newTerminal).not.toHaveBeenCalled();
  });
});

describe("the entry New workspace (issue #379)", () => {
  it("creates the workspace and opens no other tab when the default command is Terminal", async () => {
    const { openNewWorkspace } = await import("./newPane");
    await openNewWorkspace("/work/app", "app");
    expect(newWorkspace).toHaveBeenCalledWith("/work/app", "app");
    expect(newTerminal).not.toHaveBeenCalled();
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it.each(["claude", "codex"] as const)(
    "starts a free agent %s in the first pane of the new workspace, and creates no other tab",
    async (command) => {
      const { settings } = await import("./settings");
      settings.newTabCommand = command;
      const { openNewWorkspace } = await import("./newPane");
      await openNewWorkspace("/work/app", "app");
      expect(launchAgent).toHaveBeenCalledTimes(1);
      expect(launchAgent).toHaveBeenCalledWith(
        expect.objectContaining({ tool: command, agent: null, prompt: "", label: command, existingPane: rootPane }),
      );
      expect(newTerminal).not.toHaveBeenCalled();
    },
  );

  it("starts no command when Herdr did not create the workspace", async () => {
    const { settings } = await import("./settings");
    settings.newTabCommand = "claude";
    newWorkspace.mockResolvedValue(undefined);
    const { openNewWorkspace } = await import("./newPane");
    await openNewWorkspace("/work/app", "app");
    expect(launchAgent).not.toHaveBeenCalled();
  });
});
