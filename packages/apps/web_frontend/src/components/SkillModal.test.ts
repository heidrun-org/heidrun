import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

const TEXT = "---\nname: pdf\ndescription: Read PDF files.\n---\n\n# PDF skill\n\nUse **this** skill for [PDF](https://example.com) files.\n";

/** The windows mounted by a test: each one listens to the keyboard of the page until it is unmounted. */
const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
});

/** Mounts the window with the SKILL.md file `TEXT` open. */
async function mountModal() {
  const { skills } = await import("../stores/skills");
  const { settings } = await import("../stores/settings");
  const { default: SkillModal } = await import("./SkillModal.vue");
  skills.view = { name: "pdf", originLabel: "skills.sh · anthropics/skills", text: TEXT, loading: false };
  const wrapper = mount(SkillModal);
  mounted.push(wrapper);
  return { wrapper, skills, settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  // The theme store follows the colour scheme of the system, which jsdom does not know.
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe("SkillModal", () => {
  it("shows the name and the origin in the title", async () => {
    const { wrapper } = await mountModal();
    expect(wrapper.get("h2").text()).toBe("pdf");
    expect(wrapper.get(".origin").text()).toBe("skills.sh · anthropics/skills");
  });

  it("shows the Markdown rendered by default, without the frontmatter lines", async () => {
    const { wrapper } = await mountModal();
    expect(wrapper.get(".md-doc h1").text()).toBe("PDF skill");
    expect(wrapper.get(".md-doc strong").text()).toBe("this");
    expect(wrapper.get(".md-doc").text()).not.toContain("name: pdf");
  });

  it("shows the fields of the frontmatter above the rendered text", async () => {
    const { wrapper } = await mountModal();
    expect(wrapper.findAll(".front dt").map((node) => node.text())).toEqual(["name", "description"]);
    expect(wrapper.findAll(".front dd").map((node) => node.text())).toEqual(["pdf", "Read PDF files."]);
  });

  it("shows the source with colours and line numbers when the user chooses Source", async () => {
    const { wrapper, settings } = await mountModal();
    await wrapper.findAll(".seg button")[1].trigger("click");
    expect(settings.skillsViewRendered).toBe(false);
    expect(wrapper.find(".md-doc").exists()).toBe(false);
    const rows = wrapper.findAll(".tbl tr");
    expect(rows.length).toBe(TEXT.split("\n").length);
    expect(rows[0].get(".no").text()).toBe("1");
    expect(wrapper.find(".src span").exists()).toBe(true);
  });

  it("remembers the choice of Source in the saved settings", async () => {
    const { wrapper } = await mountModal();
    await wrapper.findAll(".seg button")[1].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").skillsViewRendered).toBe(false);
  });

  it("closes with the close button", async () => {
    const { wrapper, skills } = await mountModal();
    await wrapper.get(".close").trigger("click");
    expect(skills.view).toBeNull();
  });

  it("closes with the Escape key, and the Settings window below stays open", async () => {
    // As in the application: the Settings window is open first, then the window of the SKILL.md file.
    const { settingsModal } = await import("../stores/settings");
    const { default: SettingsModal } = await import("./SettingsModal.vue");
    settingsModal.open = true;
    const settingsWrapper = mount(SettingsModal);
    mounted.push(settingsWrapper);
    const { wrapper, skills } = await mountModal();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    expect(skills.view).toBeNull();
    expect(settingsModal.open).toBe(true);
    expect(wrapper.exists()).toBe(true);
  });
});
