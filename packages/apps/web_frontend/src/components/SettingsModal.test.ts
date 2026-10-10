import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the Settings window on `section`. */
async function mountOn(section: "general" | "skills") {
  const { settingsModal } = await import("../stores/settings");
  const { default: SettingsModal } = await import("./SettingsModal.vue");
  settingsModal.open = true;
  settingsModal.section = section;
  const wrapper = mount(SettingsModal);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsModal: help of a section", () => {
  it("shows a question mark with the help text next to the title of the section Skills", async () => {
    const wrapper = await mountOn("skills");
    expect(wrapper.get("h3").text()).toBe("Skills");
    const button = wrapper.get(".helpButton");
    expect(button.attributes("aria-label")).toBe("What is this section about?");
    expect(button.attributes("aria-describedby")).toBe("settings-help");
    const tip = wrapper.get("#settings-help");
    expect(tip.attributes("role")).toBe("tooltip");
    expect(tip.text()).toContain("SKILL.md");
    expect(tip.text()).toContain("skills.sh");
    wrapper.unmount();
  });

  it("shows no question mark on a section without a help text", async () => {
    const wrapper = await mountOn("general");
    expect(wrapper.find(".helpButton").exists()).toBe(false);
    wrapper.unmount();
  });
});
