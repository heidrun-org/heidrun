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
  const wrapper = mount(SettingsModal, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsModal: sections", () => {
  it("lists the sections in the sidebar, with the section Dynamic topics at the end, and without the section Skills", async () => {
    const wrapper = await mountSettings();
    const entries = wrapper.findAll(".side .entry").map((entry) => entry.text());
    expect(entries).toEqual(["General", "Terminal", "Mouse", "Finished items", "Notifications", "Mobile access", "Agents", "Dynamic topics"]);
    wrapper.unmount();
  });
});

describe("SettingsModal: key Escape", () => {
  it("closes the Settings window on the key Escape", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });

  it("closes only the open information card of the section Dynamic topics on the first key Escape, and the window on the second", async () => {
    const { settingsModal } = await import("../stores/settings");
    const wrapper = await mountSettings();
    settingsModal.section = "dynamicTopics";
    await flushPromises();
    const mark = wrapper.findAll(".information-card-part")[0];
    await mark.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
    await mark.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(settingsModal.open).toBe(true);
    await mark.trigger("keydown", { key: "Escape" });
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });
});

describe("SettingsModal: keep agents running after quit", () => {
  it("shows a checkbox in the section General, switched off by default", async () => {
    const wrapper = await mountSettings();
    const row = wrapper.findAll(".check").find((candidate) => candidate.text() === "Keep agents running after quit");
    expect(row).toBeDefined();
    const checkbox = row!.find("input[type=checkbox]");
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
    await checkbox.setValue(true);
    const { settings } = await import("../stores/settings");
    expect(settings.keepAgentsRunningAfterQuit).toBe(true);
    wrapper.unmount();
  });

  it("keeps the long explanation out of the section: it opens from a question mark next to the checkbox", async () => {
    const wrapper = await mountSettings();
    const row = wrapper.findAll(".checkRow").find((candidate) => candidate.find(".check").text() === "Keep agents running after quit");
    expect(row).toBeDefined();
    const helpButton = row!.find("button.helpButton");
    expect(helpButton.attributes("aria-label")).toBe("What does this setting do?");
    const tip = row!.find("[role=tooltip]");
    expect(helpButton.attributes("aria-describedby")).toBe(tip.attributes("id"));
    expect(tip.text()).toContain("Heidrun stops its Herdr session");
    expect(wrapper.findAll(".keys").some((keys) => keys.text().includes("Heidrun stops its Herdr session"))).toBe(false);
    wrapper.unmount();
  });

  it("does not switch the checkbox when the question mark is clicked", async () => {
    const wrapper = await mountSettings();
    const { settings } = await import("../stores/settings");
    await wrapper.find("button.helpButton").trigger("click");
    expect(settings.keepAgentsRunningAfterQuit).toBe(false);
    wrapper.unmount();
  });
});

describe("SettingsModal: status item", () => {
  it("shows a checkbox for the status item in the section Notifications, switched on by default", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    settingsModal.section = "notifications";
    await flushPromises();
    const row = wrapper.findAll(".nrow").find((candidate) => candidate.text() === "Show the status item in the macOS menu bar");
    expect(row).toBeDefined();
    const checkbox = row!.find("input[type=checkbox]");
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
    await checkbox.setValue(false);
    const { settings } = await import("../stores/settings");
    expect(settings.showStatusItem).toBe(false);
    wrapper.unmount();
  });
});
