import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { INSTALLED, prepare } from "./skills_test_support";

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

async function mountList(answers: Record<string, unknown> = {}) {
  const prepared = await prepare(invoke, answers);
  const { default: InstalledSkillsList } = await import("./InstalledSkillsList.vue");
  return { wrapper: mount(InstalledSkillsList), ...prepared };
}

describe("InstalledSkillsList", () => {
  it("shows the count and one row for each skill", async () => {
    const { wrapper } = await mountList();
    expect(wrapper.get(".fold").text()).toBe("Installed skills (2)");
    expect(wrapper.findAll(".list .row")).toHaveLength(2);
  });

  it("says that no skill is installed when the list is empty", async () => {
    const { wrapper } = await mountList({ skills_list: [] });
    expect(wrapper.find(".list").exists()).toBe(false);
    expect(wrapper.get(".keys").text()).toBe("No skill is installed yet.");
  });

  it("starts unfolded", async () => {
    const { wrapper } = await mountList();
    expect(wrapper.get(".fold").attributes("aria-expanded")).toBe("true");
  });

  it("folds and unfolds, and remembers the state", async () => {
    const { wrapper, settings } = await mountList();
    await wrapper.get(".fold").trigger("click");
    expect(settings.skillsInstalledOpen).toBe(false);
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    await flushPromises();
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").skillsInstalledOpen).toBe(false);
    await wrapper.get(".fold").trigger("click");
    expect(wrapper.findAll(".list .row")).toHaveLength(2);
  });

  it("restores a part that was folded", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ skillsInstalledOpen: false }));
    const { wrapper } = await mountList();
    expect(wrapper.get(".fold").attributes("aria-expanded")).toBe("false");
    expect(wrapper.find(".list").exists()).toBe(false);
  });

  it("shows the new agent of a skill after the link is added", async () => {
    const { wrapper } = await mountList();
    let linked = false;
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_link_agent") {
        linked = true;
        return undefined;
      }
      if (command === "skills_list") {
        return INSTALLED.map((skill) => (linked && skill.name === "release-notes" ? { ...skill, agents: ["claude", "codex"] } : skill));
      }
      return [];
    });
    const row = () => wrapper.findAll(".list .row")[1];
    const addLink = row().findAll("button").find((button) => button.text().startsWith("Add link"));
    await addLink?.trigger("click");
    await flushPromises();
    expect(row().get(".sub").text()).toBe("Local · Claude Code · Codex");
    expect(row().findAll("button").some((button) => button.text().startsWith("Add link"))).toBe(false);
  });
});
