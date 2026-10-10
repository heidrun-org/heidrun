import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsAgentsSection } = await import("./SettingsAgentsSection.vue");
  return { wrapper: mount(SettingsAgentsSection), settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsAgentsSection", () => {
  it("lists Claude Code and Codex", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.findAll(".name").map((name) => name.text())).toEqual(["Claude Code", "Codex"]);
  });

  it("starts with every agent switched off", async () => {
    const { wrapper, settings } = await mountSection();
    expect(settings.ownedAgents).toEqual([]);
    expect(wrapper.findAll("[role=switch]").map((node) => node.attributes("aria-checked"))).toEqual(["false", "false"]);
  });

  it("switches an agent on and off", async () => {
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll("[role=switch]")[1].trigger("click");
    expect(settings.ownedAgents).toEqual(["codex"]);
    await wrapper.findAll("[role=switch]")[0].trigger("click");
    expect(settings.ownedAgents).toEqual(["codex", "claude"]);
    await wrapper.findAll("[role=switch]")[1].trigger("click");
    expect(settings.ownedAgents).toEqual(["claude"]);
  });

  it("names each switch after its agent and shows no text beside it", async () => {
    const { wrapper } = await mountSection();
    const first = wrapper.get("[role=switch]");
    expect(first.attributes("aria-labelledby")).toBe("agent-claude");
    expect(wrapper.get("#agent-claude").text()).toBe("Claude Code");
    expect(wrapper.get(".row").text()).toBe("Claude Code");
  });

  it("saves the choice and restores it at the next start", async () => {
    const first = await mountSection();
    await first.wrapper.findAll("[role=switch]")[0].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").ownedAgents).toEqual(["claude"]);
    vi.resetModules();
    const second = await mountSection();
    expect(second.settings.ownedAgents).toEqual(["claude"]);
    expect(second.wrapper.findAll("[role=switch]").map((node) => node.attributes("aria-checked"))).toEqual(["true", "false"]);
  });
});
