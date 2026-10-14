import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

/** Mounts the Notes sidebar section with no note. */
async function mountNotesPanel() {
  const { notes } = await import("../stores/notes");
  const { settings } = await import("../stores/settings");
  const { default: NotesPanel } = await import("./NotesPanel.vue");
  notes.list.splice(0, notes.list.length);
  settings.notesShowAll = false;
  const wrapper = mount(NotesPanel);
  return { wrapper, settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("NotesPanel", () => {
  it("shows the title Notes, in normal letters and in semibold, like the title of the Past chats sidebar section", async () => {
    const { wrapper } = await mountNotesPanel();
    const title = wrapper.get("header.notes-title span");
    expect(title.text()).toBe("Notes");
    expect(title.classes()).toContain("fw-semibold");
    expect(wrapper.find(".eyebrow").exists()).toBe(false);
  });

  it("does not show the old text Pinned notes", async () => {
    const { wrapper } = await mountNotesPanel();
    expect(wrapper.text()).not.toMatch(/pinned notes/i);
  });

  it("gives the title the same word as the tooltip of its icon in the sidebar icon bar", async () => {
    const { wrapper } = await mountNotesPanel();
    const { t } = await import("../i18n/index");
    expect(wrapper.get("header.notes-title span").text()).toBe(t("rightPanel.sidebarSection.notes"));
  });

  it("keeps the check box All workspaces on the same line as the title, at the right", async () => {
    const { wrapper, settings } = await mountNotesPanel();
    const header = wrapper.get("header.notes-title");
    expect(header.classes()).toContain("d-flex");
    expect(Array.from(header.element.children).map((child) => child.tagName)).toEqual(["SPAN", "LABEL"]);
    const checkbox = header.get("label input[type=checkbox]");
    expect(header.get("label").text()).toBe("All workspaces");
    await checkbox.setValue(true);
    expect(settings.notesShowAll).toBe(true);
  });

  it("shows the title above the message when there is no note", async () => {
    const { wrapper } = await mountNotesPanel();
    expect(wrapper.element.children[0]).toBe(wrapper.get("header.notes-title").element);
    expect(wrapper.find(".empty").exists()).toBe(true);
  });
});
