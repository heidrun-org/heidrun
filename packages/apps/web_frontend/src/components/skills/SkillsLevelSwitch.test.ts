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
    expect(wrapper.findAll(".levelChoice button").map((button) => button.text())).toEqual(["User", "Workspace"]);
  });

  it("starts on the workspace level", async () => {
    const { wrapper, settings } = await mountSwitch();
    expect(settings.skillsLevel).toBe("workspace");
    expect(wrapper.get(".levelChoice button.on").text()).toBe("Workspace");
  });

  it("changes the level and keeps it in the saved settings", async () => {
    const { wrapper, settings } = await mountSwitch();
    await wrapper.findAll(".levelChoice button")[0].trigger("click");
    expect(settings.skillsLevel).toBe("user");
    await flushPromises();
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").skillsLevel).toBe("user");
  });

  it("restores the last level chosen", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ skillsLevel: "user" }));
    const { wrapper } = await mountSwitch();
    expect(wrapper.get(".levelChoice button.on").text()).toBe("User");
  });
});
