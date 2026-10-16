import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { prepare } from "./skills_test_support";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

async function mountSwitch() {
  const { settings } = await prepare(invoke);
  const { default: SkillsLevelSwitch } = await import("./SkillsLevelSwitch.vue");
  return { wrapper: mount(SkillsLevelSwitch), settings };
}

describe("SkillsLevelSwitch", () => {
  it("shows the choice User first, then Workspace", async () => {
    const { wrapper } = await mountSwitch();
    expect(wrapper.findAll(".levelChoice label").map((label) => label.text())).toEqual(["User", "Workspace"]);
  });

  it("draws the choice as a Bootstrap button group of radio inputs, like the choice of the language in the Settings window", async () => {
    const { wrapper } = await mountSwitch();
    const group = wrapper.get(".levelChoice");
    expect(group.classes()).toContain("btn-group");
    expect(group.attributes("role")).toBe("group");
    for (const label of group.findAll("label")) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
    expect(group.findAll("input[type=radio]")).toHaveLength(2);
    expect(wrapper.find(".seg").exists()).toBe(false);
  });

  it("starts on the workspace level", async () => {
    const { wrapper, settings } = await mountSwitch();
    expect(settings.skillsLevel).toBe("workspace");
    const radios = wrapper.findAll(".levelChoice input[type=radio]");
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true]);
  });

  it("changes the level and keeps it in the saved settings", async () => {
    const { wrapper, settings } = await mountSwitch();
    await wrapper.findAll(".levelChoice input[type=radio]")[0].setValue(true);
    expect(settings.skillsLevel).toBe("user");
    await flushPromises();
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").skillsLevel).toBe("user");
  });

  it("restores the last level chosen", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ skillsLevel: "user" }));
    const { wrapper } = await mountSwitch();
    const radios = wrapper.findAll(".levelChoice input[type=radio]");
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false]);
  });

  it("has the title Installation level, with a circled question mark and one line of help", async () => {
    const { wrapper } = await mountSwitch();
    expect(wrapper.get(".title").text()).toBe("Installation level");
    expect(wrapper.find(".title .bi-question-circle").exists()).toBe(true);
    expect(wrapper.get(".keys").text()).toBe("Where a new skill is installed");
  });

  it("opens an information card with the blocks What it is, User, Workspace, and Coding agents", async () => {
    const { wrapper } = await mountSwitch();
    await wrapper.get(".information-card-part").trigger("click");
    expect(wrapper.findAll("[data-help-block] .fw-medium").map((title) => title.text())).toEqual([
      "What it is",
      "User",
      "Workspace",
      "Coding agents",
    ]);
  });
});
