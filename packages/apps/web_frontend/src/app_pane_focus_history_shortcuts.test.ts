import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { SessionSnapshot } from "./lib/types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("./components/TerminalView.vue", () => ({ default: { render: () => null } }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: vi.fn(async () => () => {}) }) }));
vi.mock("./stores/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/session")>()), start: vi.fn() }));
vi.mock("./stores/project", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/project")>()), startProjects: vi.fn() }));
vi.mock("./stores/git", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/git")>()), startGit: vi.fn() }));
vi.mock("./stores/alerts", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/alerts")>()), startAlerts: vi.fn() }));
vi.mock("./stores/statusItem", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/statusItem")>()), startStatusItem: vi.fn() }));
vi.mock("./stores/history", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/history")>()), loadHistory: vi.fn() }));
vi.mock("./stores/mobile", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/mobile")>()), startMobile: vi.fn() }));
vi.mock("./stores/claude", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stores/claude")>()),
  loadClaudeLink: vi.fn(),
  startRemoteWatch: vi.fn(),
}));

const SNAPSHOT = {
  workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" }],
  tabs: [{ tab_id: "t1", workspace_id: "w1", number: 1, label: "build", agent_status: "idle" }],
  panes: ["p1", "p2", "p3"].map((paneId) => ({ pane_id: paneId, workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "idle" })),
  agents: [],
  layouts: [],
} as unknown as SessionSnapshot;

/** The windows that a test mounted: each one listens to the keys of the window, so a test unmounts them all at its end. */
const mountedWindows: { unmount: () => void }[] = [];

/** Presses a key with ⌘ held, as the window receives it. */
function press(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, metaKey: true, bubbles: true, cancelable: true, ...options });
  window.dispatchEvent(event);
  return event;
}

/** Mounts the window, with three panes in the tab of the workspace, and the history of the focus filled with them. */
async function mountApp() {
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  const session = await import("./stores/session");
  const history = await import("./stores/pane_focus_history");
  const { default: App } = await import("./App.vue");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = "t1";
  session.state.selectedPaneId = null;
  history.paneFocusHistory.remove(history.paneFocusHistory.paneIds);
  const wrapper = shallowMount(App, { attachTo: document.body, global: { stubs: { TopBar: true, Icon: true } } });
  mountedWindows.push(wrapper);
  await flushPromises();
  for (const paneId of ["p1", "p2", "p3"]) {
    session.state.selectedPaneId = paneId;
    await nextTick();
    vi.advanceTimersByTime(history.PANE_FOCUS_STAY_MS);
  }
  return { session, history };
}

afterEach(() => {
  for (const mountedWindow of mountedWindows.splice(0)) {
    mountedWindow.unmount();
  }
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("the shortcuts ⌘[ and ⌘]", () => {
  it("give the focus back to the previous pane, then forward to the next pane", async () => {
    vi.useFakeTimers();
    const { session } = await mountApp();
    press("[");
    expect(session.state.selectedPaneId).toBe("p2");
    press("[");
    expect(session.state.selectedPaneId).toBe("p1");
    press("]");
    expect(session.state.selectedPaneId).toBe("p2");
  });

  it("stop the key, so that the terminal does not receive it", async () => {
    vi.useFakeTimers();
    await mountApp();
    expect(press("[").defaultPrevented).toBe(true);
    expect(press("]").defaultPrevented).toBe(true);
  });

  it("do nothing without ⌘", async () => {
    vi.useFakeTimers();
    const { session } = await mountApp();
    press("[", { metaKey: false });
    expect(session.state.selectedPaneId).toBe("p3");
  });

  it("do nothing when no entry exists in the direction", async () => {
    vi.useFakeTimers();
    const { session } = await mountApp();
    press("]");
    expect(session.state.selectedPaneId).toBe("p3");
  });
});
