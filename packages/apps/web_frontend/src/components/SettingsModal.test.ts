import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the Settings window. */
async function mountSettings() {
  const { settingsModal } = await import("../stores/settings");
  const { default: SettingsModal } = await import("./SettingsModal.vue");
  settingsModal.open = true;
  const wrapper = mount(SettingsModal);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsModal: sections", () => {
  it("lists the sections in the sidebar, without the section Skills", async () => {
    const wrapper = await mountSettings();
    const entries = wrapper.findAll(".side .entry").map((entry) => entry.text());
    expect(entries).toEqual(["General", "Terminal", "Mouse", "Finished items", "Notifications", "Mobile access", "Agents"]);
    wrapper.unmount();
  });
});
