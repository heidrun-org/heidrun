import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import type { SessionSnapshot } from "../lib/types";
import { answerConfirm, confirmDialog } from "../stores/confirm";
import { onNewPaneClick } from "../stores/newPane";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("../stores/newPane", () => ({ onNewPaneClick: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    renameTab: vi.fn(async () => ({})),
    closeTab: vi.fn(async () => ({})),
    moveTab: vi.fn(async () => ({})),
  };
});

const SNAPSHOT = {
  workspaces: [
    { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" },
    { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "idle" },
  ],
  tabs: [
    { tab_id: "t1", workspace_id: "w1", number: 1, label: "build", focused: true, pane_count: 1, agent_status: "working" },
    { tab_id: "t2", workspace_id: "w1", number: 2, label: "review", focused: false, pane_count: 2, agent_status: "blocked" },
    { tab_id: "t3", workspace_id: "w1", number: 3, label: "", focused: false, pane_count: 1, agent_status: "idle" },
    { tab_id: "t4", workspace_id: "w2", number: 1, label: "other workspace", focused: false, pane_count: 1, agent_status: "idle" },
  ],
  panes: [
    { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent_status: "working" },
    { pane_id: "p2", workspace_id: "w1", tab_id: "t2", agent_status: "blocked" },
    { pane_id: "p3", workspace_id: "w1", tab_id: "t2", agent_status: "idle" },
    { pane_id: "p4", workspace_id: "w1", tab_id: "t3", agent_status: "idle" },
    { pane_id: "p5", workspace_id: "w2", tab_id: "t4", agent_status: "idle" },
  ],
  agents: [],
  layouts: [],
} as unknown as SessionSnapshot;

async function mountTabBar() {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const claude = await import("../stores/claude");
  const { default: TabBar } = await import("./TabBar.vue");
  for (const paneId of Object.keys(claude.remote.byPane)) {
    delete claude.remote.byPane[paneId];
  }
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = "t1";
  session.state.renaming = null;
  const wrapper = mount(TabBar, { attachTo: document.body });
  return { session, api, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  confirmDialog.open = false;
  document.body.innerHTML = "";
});

describe("TabBar entries", () => {
  it("shows one entry for each tab of the selected workspace, and no tab of another workspace", async () => {
    const { wrapper } = await mountTabBar();
    const tabs = wrapper.findAll("[role=tab]");
    expect(tabs.map((tab) => tab.text())).toEqual(["build", "review", "tab 3"]);
    expect(wrapper.text()).not.toContain("other workspace");
  });

  it("shows the tabs of the other workspace after the selected workspace changes", async () => {
    const { wrapper, session } = await mountTabBar();
    session.state.selectedWorkspaceId = "w2";
    await flushPromises();
    expect(wrapper.findAll("[role=tab]").map((tab) => tab.text())).toEqual(["other workspace"]);
  });

  it("shows the status dot of each tab", async () => {
    const { wrapper } = await mountTabBar();
    const dotClasses = wrapper.findAll("[role=tab] .dot").map((dot) => dot.classes());
    expect(dotClasses[0]).toContain("working");
    expect(dotClasses[1]).toContain("blocked");
    expect(dotClasses[2]).toEqual(["dot"]);
  });

  it("marks the selected tab", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.findAll("[role=tab]").map((tab) => tab.attributes("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([true, false, false]);
  });

  it("is a list of tabs with an accessible name", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.get("[role=tablist]").attributes("aria-label")).toBe("Tabs of the workspace");
  });

  it("is a Bootstrap nav with tabs: one nav-item for each tab, and the class active on the link of the selected tab", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.get("[role=tablist]").classes()).toEqual(expect.arrayContaining(["nav", "nav-tabs"]));
    expect(wrapper.findAll(".nav-item")).toHaveLength(3);
    expect(wrapper.findAll(".nav-item .nav-link").map((link) => link.classes("active"))).toEqual([true, false, false]);
  });

  it("has a close button on every tab, and no menu button with three dots", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.findAll(".nav-link .confirm")).toHaveLength(3);
    expect(wrapper.find(".bi-three-dots-vertical").exists()).toBe(false);
    expect(wrapper.find(".nav-tabs [aria-haspopup=menu]").exists()).toBe(false);
  });

  it("shows the close button of the selected tab always, and the close button of another tab only when the mouse is over it", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(".nav-link:not(.active) .confirm { opacity: 0; }");
    expect(sourceText).toContain(".nav-link:not(.active):hover .confirm");
  });

  it("makes the whole tab clickable: the button that selects the tab covers the tab, and the close button sits over it", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain('.tab-main::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; left: 0; }');
    expect(sourceText).toMatch(/\.nav-link \.confirm \{\s*position: relative; z-index: 1;/);
  });

  it("puts the close button 6px from the right border of the tab, and keeps the padding of the tab that is being renamed", async () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(".nav-tabs .nav-link.tab-closable { padding-right: 5px; }");
    const { wrapper, session } = await mountTabBar();
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("tab-closable"))).toEqual([true, true, true]);
    session.state.renaming = "tab:t2";
    await flushPromises();
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("tab-closable"))).toEqual([true, false, true]);
  });

  it("shows the badge RC on the tab that holds a pane with Remote Control connected", async () => {
    const { wrapper } = await mountTabBar();
    const claude = await import("../stores/claude");
    claude.remote.byPane["p3"] = "active";
    await flushPromises();
    expect(wrapper.findAll(".nav-link").map((tab) => tab.find(".rc").exists())).toEqual([false, true, false]);
  });
});

describe("TabBar selection", () => {
  it("selects the tab after a click on its entry", async () => {
    const { wrapper, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[1].trigger("click");
    expect(session.state.selectedTabId).toBe("t2");
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([false, true, false]);
  });

  it("follows the shortcut Option+Command+Right arrow, which selects the next tab, and wraps around", async () => {
    const { wrapper, session } = await mountTabBar();
    session.cycleTab(1);
    await flushPromises();
    expect(session.state.selectedTabId).toBe("t2");
    session.cycleTab(1);
    session.cycleTab(1);
    await flushPromises();
    expect(session.state.selectedTabId).toBe("t1");
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([true, false, false]);
  });

  it("follows the shortcut Option+Command+Left arrow, which selects the previous tab, and wraps around", async () => {
    const { wrapper, session } = await mountTabBar();
    session.cycleTab(-1);
    await flushPromises();
    expect(session.state.selectedTabId).toBe("t3");
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([false, false, true]);
  });
});

describe("TabBar plus button", () => {
  it("is after the last tab, and has an accessible name", async () => {
    const { wrapper } = await mountTabBar();
    const plus = wrapper.get("button.add");
    expect(plus.attributes("aria-label")).toBe("Create a tab: a terminal, Claude Code, or Codex (shift click: start the previous tab again)");
    expect(plus.attributes("title")).toBe(plus.attributes("aria-label"));
    const tabRow = wrapper.get("[role=tablist]").element;
    expect(tabRow.compareDocumentPosition(plus.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("starts the creation of a tab when the user clicks it", async () => {
    const { wrapper } = await mountTabBar();
    await wrapper.get("button.add").trigger("click");
    expect(onNewPaneClick).toHaveBeenCalledTimes(1);
  });
});

describe("TabBar rename in place", () => {
  it("shows the rename field in place of the name after a double click, and selects the tab", async () => {
    const { wrapper, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[1].trigger("dblclick");
    expect(session.state.renaming).toBe("tab:t2");
    expect(session.state.selectedTabId).toBe("t2");
    expect(wrapper.findAll("input.rename")).toHaveLength(1);
    expect((wrapper.get("input.rename").element as HTMLInputElement).value).toBe("review");
  });

  it("saves the new name when the user presses Enter", async () => {
    const { wrapper, api, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[1].trigger("dblclick");
    const input = wrapper.get("input.rename");
    await input.setValue("code review");
    await input.trigger("keydown.enter");
    await flushPromises();
    expect(api.renameTab).toHaveBeenCalledWith("t2", "code review");
    expect(session.state.renaming).toBeNull();
    expect(wrapper.find("input.rename").exists()).toBe(false);
  });

  it("does not save when the user presses Escape", async () => {
    const { wrapper, api, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[0].trigger("dblclick");
    const input = wrapper.get("input.rename");
    await input.setValue("other");
    await input.trigger("keydown.esc");
    await flushPromises();
    expect(api.renameTab).not.toHaveBeenCalled();
    expect(session.state.renaming).toBeNull();
  });

  it("shows the rename field when the command search asks to rename the tab", async () => {
    const { wrapper, session } = await mountTabBar();
    session.startRename("tab", "t3");
    await flushPromises();
    expect(wrapper.findAll("input.rename")).toHaveLength(1);
    expect(session.state.selectedTabId).toBe("t3");
  });
});

describe("TabBar close", () => {
  it("asks for confirmation before it closes the tab, and does not close before the answer", async () => {
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the tab review");
    expect(api.closeTab).not.toHaveBeenCalled();
  });

  it("closes the tab after the user confirms", async () => {
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closeTab).toHaveBeenCalledWith("t2");
  });

  it("does not close the tab when the user cancels", async () => {
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closeTab).not.toHaveBeenCalled();
  });
});

describe("TabBar move", () => {
  it("moves a tab after the user drags it to the end of the bar", async () => {
    const { wrapper, api } = await mountTabBar();
    const tabs = wrapper.findAll(".nav-link");
    await tabs[0].trigger("dragstart");
    await tabs[2].trigger("dragover", { clientX: 10 });
    await tabs[2].trigger("drop");
    expect(api.moveTab).toHaveBeenCalledWith("t1", 3);
  });

  it("does not move a tab dropped on its own place", async () => {
    const { wrapper, api } = await mountTabBar();
    const tabs = wrapper.findAll(".nav-link");
    await tabs[1].trigger("dragstart");
    await tabs[1].trigger("dragover", { clientX: 0 });
    await tabs[1].trigger("drop");
    expect(api.moveTab).not.toHaveBeenCalled();
  });

  it("moves the selected tab with the shortcut Shift+Option+Command+Right arrow", async () => {
    const { session, api } = await mountTabBar();
    await session.shiftTab(1);
    expect(api.moveTab).toHaveBeenCalledWith("t1", 2);
  });

  it("moves the selected tab with the shortcut Shift+Option+Command+Left arrow", async () => {
    const { session, api } = await mountTabBar();
    session.selectTab("t3");
    await session.shiftTab(-1);
    expect(api.moveTab).toHaveBeenCalledWith("t3", 1);
  });

  it("does not move the first tab to the left", async () => {
    const { session, api } = await mountTabBar();
    await session.shiftTab(-1);
    expect(api.moveTab).not.toHaveBeenCalled();
  });
});

describe("TabBar height", () => {
  it("gives a tab a fixed height, and a rename field that fits in it, so that the rename does not make the tab bar higher", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    const heightOfTab = /\.nav-tabs \.nav-link \{[^}]*height: (\d+)px/.exec(sourceText);
    const heightOfField = /\.nav-link \.tab-rename \{[^}]*height: (\d+)px/.exec(sourceText);
    expect(heightOfTab).not.toBeNull();
    expect(heightOfField).not.toBeNull();
    expect(Number(heightOfField![1])).toBeLessThanOrEqual(Number(heightOfTab![1]) - 2);
  });

  it("gives the rename field the class tab-rename", async () => {
    const { wrapper } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[0].trigger("dblclick");
    expect(wrapper.get("input.rename").classes()).toContain("tab-rename");
  });
});

describe("TabBar join with the panes", () => {
  it("has no gap above the panes: the bar goes 1 pixel over them, and the selected tab is 1 pixel higher than the other tabs", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toMatch(/\.tab-bar \{[^}]*margin-bottom: -1px/);
    expect(sourceText).not.toMatch(/\.tab-bar \{[^}]*margin-bottom: var\(--pane-gap\)/);
    const heightOfTab = /\.nav-tabs \.nav-link \{[^}]*height: (\d+)px/.exec(sourceText);
    const heightOfSelectedTab = /\.nav-tabs \.nav-link\.active \{[^}]*height: (\d+)px/.exec(sourceText);
    expect(Number(heightOfSelectedTab![1]) - Number(heightOfTab![1])).toBe(1);
  });

  it("draws the outline of the selected tab with the color of the ring of the selected pane, and has no border at its bottom", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(
      "--bs-nav-tabs-link-active-border-color: var(--pane-ring-selected) var(--pane-ring-selected) var(--bg);",
    );
    expect(sourceText).toMatch(/\.nav-tabs \.nav-link\.active \{[^}]*border-bottom-width: 0/);
  });

  it("draws the ring of the selected pane and of a blocked pane with the border of the pane, so that it joins the selected tab", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "PaneCard.vue"), "utf8");
    expect(sourceText).toMatch(/\.pane\.selected \{ border-color: var\(--pane-ring-selected\); \}/);
    expect(sourceText).toMatch(/\.pane\.blocked \{ border-color: var\(--pane-ring-blocked\); \}/);
    expect(sourceText).toMatch(/\.pane\.blocked\.selected \{ border-color: var\(--pane-ring-blocked-selected\); \}/);
    expect(sourceText).not.toMatch(/\.pane[^{]*\{[^}]*box-shadow: inset/);
  });
});

describe("TabBar workspace button", () => {
  it("starts with the workspace button, before the tabs, at the left edge of the panes", async () => {
    const { wrapper } = await mountTabBar();
    const children = Array.from(wrapper.get(".tab-bar").element.children);
    expect(children[0].classList.contains("workspace-button")).toBe(true);
    expect(children[1].classList.contains("nav-tabs")).toBe(true);
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toMatch(/\.tab-bar \{[^}]*padding: 4px var\(--pane-radius\) 0 0;/);
  });
});

describe("TabBar place in the window", () => {
  it("sits on top of the viewport: the file App.vue shows the tab bar before the viewport", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "../App.vue"), "utf8");
    const tabBarIndex = sourceText.indexOf("<TabBar />");
    expect(tabBarIndex).toBeGreaterThan(-1);
    expect(tabBarIndex).toBeLessThan(sourceText.indexOf('<div class="stage">'));
  });
});
