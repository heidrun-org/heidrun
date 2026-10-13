import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  invoke.mockClear();
});

describe("startStatusItem: visibility in the macOS menu bar", () => {
  it("shows the status item at the start, because the setting is switched on by default", async () => {
    const { startStatusItem } = await import("./statusItem");
    startStatusItem();
    expect(invoke).toHaveBeenCalledWith("status_item_set_visible", { isVisible: true });
  });

  it("hides the status item at the start when the user switched the setting off earlier", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ showStatusItem: false }));
    const { startStatusItem } = await import("./statusItem");
    startStatusItem();
    expect(invoke).toHaveBeenCalledWith("status_item_set_visible", { isVisible: false });
  });

  it("hides and shows the status item at once when the user changes the setting", async () => {
    const { startStatusItem } = await import("./statusItem");
    const { settings } = await import("./settings");
    startStatusItem();
    invoke.mockClear();
    settings.showStatusItem = false;
    await nextTick();
    expect(invoke).toHaveBeenCalledWith("status_item_set_visible", { isVisible: false });
    settings.showStatusItem = true;
    await nextTick();
    expect(invoke).toHaveBeenLastCalledWith("status_item_set_visible", { isVisible: true });
  });
});
