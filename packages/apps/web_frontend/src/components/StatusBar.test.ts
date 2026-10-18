import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import Fs from "node:fs";
import Path from "node:path";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

async function mountStatusBar() {
  const { state } = await import("../stores/session");
  const { settings } = await import("../stores/settings");
  const { claudeLink } = await import("../stores/claude");
  const { default: StatusBar } = await import("./StatusBar.vue");
  state.codex = {
    available: true,
    primary: { used_percent: 45, window_minutes: 300 },
    secondary: { used_percent: 20, window_minutes: 10080 },
    plan: "prolite",
    sessions: {},
  };
  claudeLink.loaded = true;
  claudeLink.installed = true;
  const wrapper = mount(StatusBar, {
    global: { stubs: { GitStatusSummary: true, WorkspaceStatusSummary: true } },
  });
  const { antigravityLink } = await import("../stores/antigravity");
  antigravityLink.loaded = true;
  antigravityLink.installed = true;
  return { wrapper, settings, claudeLink, antigravityLink };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("StatusBar", () => {
  it("starts with the workspace status bar section, before the quotas, and separates it from the next section", async () => {
    const { wrapper, settings } = await mountStatusBar();
    settings.ownedAgents = ["codex"];
    await nextTick();
    const children = Array.from(wrapper.get("footer").element.children);
    expect(children[0].tagName.toLowerCase()).toBe("workspace-status-summary-stub");
    expect(children[1].classList.contains("sep")).toBe(true);
    expect(children[2].classList.contains("quota")).toBe(true);
  });

  it("gives the line after the workspace status bar section 6 more pixels on each side than the other lines", async () => {
    const { wrapper } = await mountStatusBar();
    expect(wrapper.get(".sep").classes()).toContain("workspace-sep");
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "StatusBar.vue"), "utf8");
    expect(sourceText).toContain(".workspace-sep { margin: 0 6px; }");
  });

  it("gives every status bar section a rounded background like a button, while the pointer is over it and while its card is open", () => {
    const stylesText = Fs.readFileSync(Path.resolve(import.meta.dirname, "..", "styles.css"), "utf8");
    expect(stylesText).toMatch(/\.status-section \{[^}]*margin: 6px -11px;[^}]*border-radius: 6px;/);
    expect(stylesText).toContain(".status-section:hover, .status-section.show { background: rgba(var(--wash), 0.12); }");
  });

  it("has no section with the number of agents that are blocked, working, or done: the connection to Herdr follows the free space", async () => {
    const { wrapper } = await mountStatusBar();
    const children = Array.from(wrapper.get("footer").element.children);
    const machineIndex = children.findIndex((child) => child.classList.contains("machine"));
    expect(children[machineIndex - 1].classList.contains("grow")).toBe(true);
    expect(wrapper.find(".agent-status").exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/\d+ (blocked|working|done)/);
  });

  it("shows no quota when no coding agent is switched on", async () => {
    const { wrapper } = await mountStatusBar();
    expect(wrapper.findAll(".quota")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("waiting for data");
  });

  it("shows the quota of Codex only when Codex is switched on", async () => {
    const { wrapper, settings } = await mountStatusBar();
    settings.ownedAgents = ["codex"];
    await nextTick();
    expect(wrapper.findAll(".quota").map((quota) => quota.attributes("data-provider"))).toEqual(["codex"]);
  });

  it("removes the quota of Codex at once when Codex is switched off", async () => {
    const { wrapper, settings } = await mountStatusBar();
    settings.ownedAgents = ["claude", "codex"];
    await nextTick();
    expect(wrapper.find("[data-provider=codex]").exists()).toBe(true);
    settings.ownedAgents = ["claude"];
    await nextTick();
    expect(wrapper.find("[data-provider=codex]").exists()).toBe(false);
  });

  it("shows no tracking message when an enabled coding agent has no quota data", async () => {
    const { wrapper, settings } = await mountStatusBar();
    settings.ownedAgents = ["codex"];
    await nextTick();
    settings.ownedAgents = ["antigravity"];
    await nextTick();
    expect(wrapper.find("button.link").exists()).toBe(false);
    expect(wrapper.find(".muted").exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/tracking|waiting/i);
  });

  it("shows Antigravity quota in the same list as the other coding agents", async () => {
    const { wrapper, settings } = await mountStatusBar();
    const { state } = await import("../stores/session");
    state.snapshot = {
      version: "1", protocol: 1, workspaces: [], tabs: [], agents: [], layouts: [],
      panes: [{
        pane_id: "agy-pane", terminal_id: "terminal", workspace_id: "workspace", tab_id: "tab",
        focused: true, agent_status: "idle", revision: 1, agent: "antigravity",
        tokens: { hd_agy_ts: String(Math.floor(Date.now() / 1000)), hd_agy_count: "1", hd_agy_0_id: "gemini-weekly", hd_agy_0_remaining: "0.5" },
      }],
    };
    settings.ownedAgents = ["antigravity"];
    await nextTick();
    expect(wrapper.findAll(".quota").map((quota) => quota.attributes("data-provider"))).toEqual(["antigravity"]);
  });
});
