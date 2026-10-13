import { beforeEach, describe, expect, it, vi } from "vitest";

const launchAgent = vi.hoisted(() => vi.fn(async () => "ok"));
const newTerminal = vi.hoisted(() => vi.fn());
const newAgent = vi.hoisted(() => ({ open: false }));
const selectedWorkspace = vi.hoisted(() => ({ value: { workspace_id: "w1" } as { workspace_id: string } | null }));
const selectedPane = vi.hoisted(() => ({ value: { cwd: "/work/project", foreground_cwd: "/work/project/src" } }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("./agents", () => ({ launchAgent, newAgent }));
vi.mock("./session", () => ({ newTerminal, selectedPane, selectedWorkspace }));
vi.mock("./input", () => ({ insertIntoFocusedPane: vi.fn() }));

/** A click on the plus button of the tab bar, with or without the key Shift. */
function click(isShift: boolean): MouseEvent {
  return new MouseEvent("click", { shiftKey: isShift });
}

beforeEach(() => {
  localStorage.clear();
  launchAgent.mockClear();
  newTerminal.mockClear();
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
    const { saveNewPaneValues, onNewPaneClick } = await import("./newPane");
    saveNewPaneValues({ tool: "codex", agent: null, model: "", label: "codex", labelTouched: false, text: "" });
    onNewPaneClick(click(false));
    expect(newTerminal).toHaveBeenCalledTimes(1);
    expect(launchAgent).not.toHaveBeenCalled();
  });

  it("starts the previous pane again with the key Shift, when one was saved", async () => {
    const { saveNewPaneValues, onNewPaneClick } = await import("./newPane");
    saveNewPaneValues({ tool: "codex", agent: null, model: "", label: "codex", labelTouched: false, text: "" });
    onNewPaneClick(click(true));
    await vi.waitFor(() => expect(launchAgent).toHaveBeenCalledTimes(1));
    expect(launchAgent.mock.calls[0]).toMatchObject([{ tool: "codex" }]);
  });

  it("starts the default command with the key Shift when no previous pane was saved", async () => {
    const { onNewPaneClick } = await import("./newPane");
    onNewPaneClick(click(true));
    expect(newTerminal).toHaveBeenCalledTimes(1);
  });
});
