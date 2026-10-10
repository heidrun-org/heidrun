import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the menu with the three vertical dots, attached to the page so the click outside can be tested. */
async function mountMoreMenu() {
  const { state } = await import("../stores/session");
  const { settingsModal } = await import("../stores/settings");
  const { findNewSkillsModal, installedSkillModal } = await import("../stores/skills");
  const { default: MoreMenu } = await import("./MoreMenu.vue");
  const wrapper = mount(MoreMenu, { attachTo: document.body });
  return { wrapper, state, settingsModal, installedSkillModal, findNewSkillsModal };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = "";
});

describe("MoreMenu", () => {
  it("shows a button with three vertical dots and no menu at first", async () => {
    const { wrapper } = await mountMoreMenu();
    expect(wrapper.get("button").attributes("aria-label")).toBe("More actions");
    expect(wrapper.find("i.bi-three-dots-vertical").exists()).toBe(true);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("opens the menu with the entries Shortcuts help, Installed skill, Find new skills, and Settings when the button is clicked", async () => {
    const { wrapper } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    const labels = wrapper.findAll('[role="menuitem"] .label');
    expect(labels.map((label) => label.text())).toEqual(["Shortcuts help", "Installed skill", "Find new skills", "Settings"]);
  });

  it("opens the Settings window and closes the menu when the entry Settings is clicked", async () => {
    const { wrapper, settingsModal } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    await wrapper.findAll('[role="menuitem"]')[3].trigger("click");
    expect(settingsModal.open).toBe(true);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("opens the help about the shortcuts and closes the menu when the entry Shortcuts help is clicked", async () => {
    const { wrapper, state, settingsModal } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    await wrapper.findAll('[role="menuitem"]')[0].trigger("click");
    expect(state.shortcutsOpen).toBe(true);
    expect(settingsModal.open).toBe(false);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("separates the entries with two dividers, and puts the title Skills above the two entries of the skills", async () => {
    const { wrapper } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    expect(wrapper.findAll('[role="separator"]')).toHaveLength(2);
    const group = wrapper.get('[role="group"]');
    expect(group.get(".heading").text()).toBe("Skills");
    expect(group.findAll('[role="menuitem"] .label').map((label) => label.text())).toEqual(["Installed skill", "Find new skills"]);
    const children = Array.from(wrapper.get('[role="menu"]').element.children).map((child) => child.getAttribute("role"));
    expect(children).toEqual(["menuitem", "separator", "group", "separator", "menuitem"]);
  });

  it("opens the window Installed skill and closes the menu when the entry Installed skill is clicked", async () => {
    const { wrapper, installedSkillModal, findNewSkillsModal } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    await wrapper.findAll('[role="menuitem"]')[1].trigger("click");
    expect(installedSkillModal.open).toBe(true);
    expect(findNewSkillsModal.open).toBe(false);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("opens the window Find new skills and closes the menu when the entry Find new skills is clicked", async () => {
    const { wrapper, installedSkillModal, findNewSkillsModal } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    await wrapper.findAll('[role="menuitem"]')[2].trigger("click");
    expect(findNewSkillsModal.open).toBe(true);
    expect(installedSkillModal.open).toBe(false);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("closes the menu when the button is clicked a second time", async () => {
    const { wrapper } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    await wrapper.get("button").trigger("click");
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("closes the menu without opening the Settings window when the user clicks outside", async () => {
    const { wrapper, settingsModal } = await mountMoreMenu();
    await wrapper.get("button").trigger("click");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(settingsModal.open).toBe(false);
  });
});
