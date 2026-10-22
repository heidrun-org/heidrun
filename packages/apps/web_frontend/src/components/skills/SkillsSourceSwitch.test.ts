import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { prepare } from "./skills_test_support";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

async function mountSwitch() {
  const { skills } = await prepare(invoke);
  const { default: SkillsSourceSwitch } = await import("./SkillsSourceSwitch.vue");
  return { wrapper: mount(SkillsSourceSwitch), skills };
}

describe("SkillsSourceSwitch", () => {
  it("has the title Source of the skill, with a circled question mark and one line of help", async () => {
    const { wrapper } = await mountSwitch();
    expect(wrapper.get(".title").text()).toBe("Source of the skill");
    expect(wrapper.find(".title .bi-question-circle").exists()).toBe(true);
    expect(wrapper.get(".keys").text()).toBe("Where the skill comes from");
  });

  it("shows the sources in the order skills.sh, Local folder, Code hosting", async () => {
    const { wrapper } = await mountSwitch();
    expect(wrapper.findAll(".sourceChoice label").map((label) => label.text())).toEqual(["skills.sh", "Local folder", "Code hosting"]);
  });

  it("draws the choice as a Bootstrap button group of radio inputs, like the choice of the level", async () => {
    const { wrapper } = await mountSwitch();
    const group = wrapper.get(".sourceChoice");
    expect(group.classes()).toContain("btn-group");
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe("Source of the skill");
    for (const label of group.findAll("label")) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
    expect(group.findAll("input[type=radio]")).toHaveLength(3);
  });

  it("starts on skills.sh", async () => {
    const { wrapper, skills } = await mountSwitch();
    expect(skills.skills.source).toBe("skillsSh");
    const radios = wrapper.findAll(".sourceChoice input[type=radio]");
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false, false]);
  });

  it("changes the source in the store", async () => {
    const { wrapper, skills } = await mountSwitch();
    await wrapper.findAll(".sourceChoice input[type=radio]")[1].setValue(true);
    await flushPromises();
    expect(skills.skills.source).toBe("localFolder");
    await wrapper.findAll(".sourceChoice input[type=radio]")[2].setValue(true);
    await flushPromises();
    expect(skills.skills.source).toBe("codeHosting");
  });
});
