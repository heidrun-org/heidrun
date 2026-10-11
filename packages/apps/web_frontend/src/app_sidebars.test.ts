import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
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
  panes: [{ pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "idle" }],
  agents: [],
  layouts: [],
} as unknown as SessionSnapshot;

/** The windows that a test mounted: each one listens to the keys of the window, so a test unmounts them all at its end. */
const mountedWindows: { unmount: () => void }[] = [];

/** Mounts the window with its real top bar. Every other part of the window is a stub that only keeps its place. */
async function mountApp() {
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  const session = await import("./stores/session");
  const settingsStore = await import("./stores/settings");
  const notes = await import("./stores/notes");
  const { default: App } = await import("./App.vue");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = "t1";
  session.state.selectedPaneId = "p1";
  settingsStore.settings.leftOpen = true;
  settingsStore.settings.rightOpen = true;
  settingsStore.settings.leftSidebarSection = "actions";
  settingsStore.settings.rightSidebarSection = "pane";
  const wrapper = shallowMount(App, { attachTo: document.body, global: { stubs: { TopBar: false, Icon: false, MoreMenu: true, ThemeMenu: true } } });
  mountedWindows.push(wrapper);
  await flushPromises();
  return { wrapper, session, settings: settingsStore.settings, notes };
}

/** The names of the children of the area under the top bar, from the left to the right. */
function bodyChildren(wrapper: Awaited<ReturnType<typeof mountApp>>["wrapper"]): string[] {
  return Array.from(wrapper.get(".body").element.children).map((child) => child.tagName.toLowerCase());
}

/** Presses a shortcut of the window. */
function press(code: string, options: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, metaKey: true, bubbles: true, cancelable: true, ...options }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const mountedWindow of mountedWindows.splice(0)) {
    mountedWindow.unmount();
  }
});

describe("window with the two sidebars", () => {
  it("shows the left sidebar, the viewport, and the right sidebar, with a line to drag between each pair", async () => {
    const { wrapper } = await mountApp();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("has one hide button for each sidebar in the top bar, of the same kind, the left one at the left and the right one at the right", async () => {
    const { wrapper } = await mountApp();
    const buttons = wrapper.findAll(".top .icon-btn[aria-pressed]");
    expect(buttons.map((button) => button.attributes("aria-label"))).toEqual(["Show the left sidebar", "Show the right sidebar"]);
    expect(buttons.map((button) => button.attributes("title"))).toEqual(["Left sidebar (⌘B)", "Right sidebar (⌥⌘B)"]);
    expect(buttons.map((button) => button.attributes("aria-pressed"))).toEqual(["true", "true"]);
    expect(buttons[0].element.compareDocumentPosition(buttons[1].element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wrapper.get(".top > .icon-btn").attributes("aria-label")).toBe("Show the left sidebar");
    expect(wrapper.get(".top > .tools > .icon-btn:last-child").attributes("aria-label")).toBe("Show the right sidebar");
  });
});

describe("hiding the left sidebar", () => {
  it("removes the left sidebar and its line to drag after a click on its button, and leaves no strip", async () => {
    const { wrapper, settings } = await mountApp();
    await wrapper.findAll(".top .icon-btn[aria-pressed]")[0].trigger("click");
    expect(settings.leftOpen).toBe(false);
    expect(bodyChildren(wrapper)).toEqual(["main", "resizer-stub", "right-panel-stub"]);
    expect(wrapper.findAll(".top .icon-btn[aria-pressed]")[0].attributes("aria-pressed")).toBe("false");
  });

  it("shows the left sidebar again after a second click", async () => {
    const { wrapper } = await mountApp();
    const button = wrapper.findAll(".top .icon-btn[aria-pressed]")[0];
    await button.trigger("click");
    await button.trigger("click");
    expect(bodyChildren(wrapper)[0]).toBe("sidebar-stub");
  });

  it("hides and shows with the shortcut Command+B", async () => {
    const { wrapper } = await mountApp();
    press("KeyB");
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["main", "resizer-stub", "right-panel-stub"]);
    press("KeyB");
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)[0]).toBe("sidebar-stub");
  });
});

describe("hiding the right sidebar", () => {
  it("removes the right sidebar and its line to drag after a click on its button, and leaves no strip", async () => {
    const { wrapper, settings } = await mountApp();
    await wrapper.findAll(".top .icon-btn[aria-pressed]")[1].trigger("click");
    expect(settings.rightOpen).toBe(false);
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main"]);
    expect(wrapper.findAll(".top .icon-btn[aria-pressed]")[1].attributes("aria-pressed")).toBe("false");
  });

  it("shows the right sidebar again after a second click", async () => {
    const { wrapper } = await mountApp();
    const button = wrapper.findAll(".top .icon-btn[aria-pressed]")[1];
    await button.trigger("click");
    await button.trigger("click");
    expect(bodyChildren(wrapper).slice(-1)[0]).toBe("right-panel-stub");
  });

  it("hides and shows with the shortcut Option+Command+B", async () => {
    const { wrapper } = await mountApp();
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main"]);
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper).slice(-1)[0]).toBe("right-panel-stub");
  });
});

describe("hiding both sidebars", () => {
  it("leaves only the viewport, so the viewport takes the whole width", async () => {
    const { wrapper } = await mountApp();
    await wrapper.findAll(".top .icon-btn[aria-pressed]")[0].trigger("click");
    await wrapper.findAll(".top .icon-btn[aria-pressed]")[1].trigger("click");
    expect(bodyChildren(wrapper)).toEqual(["main"]);
    expect(wrapper.find("sidebar-stub").exists()).toBe(false);
    expect(wrapper.find("right-panel-stub").exists()).toBe(false);
    expect(wrapper.find("resizer-stub").exists()).toBe(false);
  });

  it("keeps the tab bar and the panes in the viewport", async () => {
    const { wrapper, settings } = await mountApp();
    settings.leftOpen = false;
    settings.rightOpen = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.get("main").find("tab-bar-stub").exists()).toBe(true);
    expect(wrapper.get("main").find("pane-grid-stub").exists()).toBe(true);
  });

  it("remembers the choice for the next start", async () => {
    const { wrapper, settings } = await mountApp();
    settings.leftOpen = false;
    settings.rightOpen = false;
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect(saved.leftOpen).toBe(false);
    expect(saved.rightOpen).toBe(false);
  });
});

describe("opening a sidebar section while its sidebar is hidden", () => {
  it("shows the right sidebar, with the Notes sidebar section, when the shortcut Shift+Command+P pins a text", async () => {
    const { wrapper, settings, notes } = await mountApp();
    settings.rightOpen = false;
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main"]);
    notes.selectionReaders.set("p1", () => "text to keep");
    press("KeyP", { shiftKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.rightOpen).toBe(true);
    expect(settings.rightSidebarSection).toBe("notes");
    expect(bodyChildren(wrapper).slice(-1)[0]).toBe("right-panel-stub");
  });

  it("does not show the left sidebar when the right sidebar holds the sidebar section", async () => {
    const { wrapper, settings, notes } = await mountApp();
    settings.leftOpen = false;
    settings.rightOpen = false;
    await wrapper.vm.$nextTick();
    notes.selectionReaders.set("p1", () => "text to keep");
    press("KeyP", { shiftKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.leftOpen).toBe(false);
    expect(bodyChildren(wrapper)).toEqual(["main", "resizer-stub", "right-panel-stub"]);
  });
});

describe("texts that name a sidebar", () => {
  it.each(["en", "fr"] as const)("say sidebar, and never panel, for the two sidebars in the language %s", async (language) => {
    const settingsStore = await import("./stores/settings");
    const { t } = await import("./i18n/index");
    settingsStore.settings.language = language;
    const keys = [
      "topBar.leftSidebarLabel",
      "topBar.leftSidebarTitle",
      "topBar.rightSidebarLabel",
      "topBar.rightSidebarTitle",
      "commandPalette.leftSidebar",
      "commandPalette.rightSidebar",
      "resizer.leftWidth",
      "resizer.rightWidth",
      "rightPanel.label",
      "sidebar.navigationBarLabel",
      "shortcuts.action.hideSidebars",
    ];
    const word = language === "en" ? /sidebar/i : /barre latérale/i;
    for (const key of keys) {
      const text = t(key);
      expect(text, key).toMatch(word);
      expect(text, key).not.toMatch(/panel|panneau/i);
    }
    settingsStore.settings.language = "en";
  });

  it("gives the same shape to the left and the right hide buttons: a label that starts with Show, and a title with the name and the shortcut", async () => {
    const { t } = await import("./i18n/index");
    expect(t("topBar.leftSidebarLabel")).toBe("Show the left sidebar");
    expect(t("topBar.rightSidebarLabel")).toBe("Show the right sidebar");
    expect(t("topBar.leftSidebarTitle")).toBe("Left sidebar (⌘B)");
    expect(t("topBar.rightSidebarTitle")).toBe("Right sidebar (⌥⌘B)");
  });
});
