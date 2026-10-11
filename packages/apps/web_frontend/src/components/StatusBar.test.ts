import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

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
    global: { stubs: { GitStatusSummary: true, AgentStatusSummary: true } },
  });
  return { wrapper, settings, claudeLink };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("StatusBar", () => {
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

  it("waits for the data of Claude only when Claude Code is switched on", async () => {
    const { wrapper, settings } = await mountStatusBar();
    settings.ownedAgents = ["codex"];
    await nextTick();
    expect(wrapper.find(".muted").exists()).toBe(false);
    settings.ownedAgents = ["claude", "codex"];
    await nextTick();
    expect(wrapper.get(".muted").text()).toBe("Claude: waiting for data");
  });

  it("offers to enable the tracking of Claude only when Claude Code is switched on", async () => {
    const { wrapper, settings, claudeLink } = await mountStatusBar();
    claudeLink.installed = false;
    await nextTick();
    expect(wrapper.find("button.link").exists()).toBe(false);
    settings.ownedAgents = ["claude"];
    await nextTick();
    expect(wrapper.find("button.link").exists()).toBe(true);
  });
});
