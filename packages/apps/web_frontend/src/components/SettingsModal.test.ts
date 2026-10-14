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
    const entries = wrapper.findAll("nav .nav-link").map((entry) => entry.text());
    expect(entries).toEqual(["General", "Terminal", "New tab", "Mouse", "Finished items", "Notifications", "Mobile access", "Agents", "Dynamic topics"]);
    wrapper.unmount();
  });

  it("marks the open section as the active link of the Bootstrap nav, and moves the mark when another link is clicked", async () => {
    const wrapper = await mountSettings();
    const links = wrapper.findAll("nav .nav-link");
    expect(links.map((link) => link.classes().includes("active"))).toEqual([true, false, false, false, false, false, false, false, false]);
    expect(links[0].attributes("aria-current")).toBe("page");
    await links[3].trigger("click");
    expect(wrapper.get("h3").text()).toBe("Mouse");
    expect(links.map((link) => link.classes().includes("active"))).toEqual([false, false, false, true, false, false, false, false, false]);
    expect(links[3].attributes("aria-current")).toBe("page");
    expect(links[0].attributes("aria-current")).toBeUndefined();
    wrapper.unmount();
  });
});

describe("SettingsModal: frame (issue #412)", () => {
  it("is a Bootstrap dialog with a header, a title, a body, and a close button", async () => {
    const wrapper = await mountSettings();
    const dialog = wrapper.get("dialog");
    expect(dialog.classes()).toEqual(expect.arrayContaining(["dialog", "dialog-lg", "dialog-instant", "dialog-nonmodal"]));
    expect(dialog.attributes("aria-labelledby")).toBe("settings-title");
    expect(wrapper.get("#settings-title").text()).toBe("Settings");
    expect(wrapper.get("#settings-title").classes()).toContain("dialog-title");
    expect(wrapper.find(".dialog-header button.btn").exists()).toBe(true);
    expect(wrapper.find(".dialog-body nav.nav").exists()).toBe(true);
    wrapper.unmount();
  });

  it("closes the window with the close button and with a click on the dark layer, and stays open for a click inside the dialog", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    await wrapper.get("dialog").trigger("mousedown");
    expect(settingsModal.open).toBe(true);
    await wrapper.get(".overlay").trigger("mousedown");
    expect(settingsModal.open).toBe(false);
    settingsModal.open = true;
    await wrapper.get(".dialog-header button").trigger("click");
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });

  it("draws the close button as a big X with no border and no background of its own, and not as the square Bootstrap close button", async () => {
    const wrapper = await mountSettings();
    const closeButton = wrapper.get(".dialog-header button");
    expect(closeButton.classes()).toEqual(expect.arrayContaining(["btn", "border-0", "fs-4"]));
    expect(closeButton.classes()).not.toContain("btn-close");
    expect(wrapper.findComponent({ name: "DialogCloseButton" }).exists()).toBe(true);
    expect(closeButton.find(".bi-x-lg").exists()).toBe(true);
    expect(closeButton.text()).toBe("");
    wrapper.unmount();
  });

  it("names the close button for the screen reader", async () => {
    const wrapper = await mountSettings();
    expect(wrapper.get(".dialog-header button").attributes("aria-label")).toBe("Close (Escape)");
    expect(wrapper.get(".dialog-header button").attributes("title")).toBe("Close the window (Escape)");
    wrapper.unmount();
  });
});

describe("SettingsModal: section New tab (issue #328)", () => {
  it("shows the three commands as a Bootstrap button group of radio inputs, in the secondary color, with Terminal chosen by default", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    settingsModal.section = "newTab";
    await flushPromises();
    expect(wrapper.get("h3").text()).toBe("New tab");
    const group = wrapper.get(".btn-group");
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe("Default command of a new tab");
    const labels = group.findAll("label");
    expect(labels.map((label) => label.text())).toEqual(["Terminal", "Claude Code", "Codex"]);
    for (const label of labels) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
    const radios = group.findAll("input[type=radio]");
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false, false]);
    wrapper.unmount();
  });

  it.each([
    [1, "claude"],
    [2, "codex"],
    [0, "terminal"],
  ] as const)("saves the command of the radio input %i as %s", async (index, command) => {
    const wrapper = await mountSettings();
    const { settings, settingsModal } = await import("../stores/settings");
    settingsModal.section = "newTab";
    await flushPromises();
    const radios = wrapper.get(".btn-group").findAll("input[type=radio]");
    await radios[index].setValue(true);
    expect(settings.newTabCommand).toBe(command);
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([0, 1, 2].map((position) => position === index));
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

describe("SettingsModal: status item", () => {
  it("shows a switch for the status item in the section Notifications, switched on by default", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    settingsModal.section = "notifications";
    await flushPromises();
    const label = wrapper.findAll("label").find((candidate) => candidate.text() === "Show the status item in the macOS menu bar");
    expect(label).toBeDefined();
    const checkbox = wrapper.get(`input[id="${label!.attributes("for")}"]`);
    expect(checkbox.attributes("role")).toBe("switch");
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
    await checkbox.setValue(false);
    const { settings } = await import("../stores/settings");
    expect(settings.showStatusItem).toBe(false);
    wrapper.unmount();
  });
});
