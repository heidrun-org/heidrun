import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { RESULT, prepare } from "./skills_test_support";

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

async function mountFind(answers: Record<string, unknown> = {}) {
  const prepared = await prepare(invoke, answers);
  const { default: FindSkills } = await import("./FindSkills.vue");
  return { wrapper: mount(FindSkills), ...prepared };
}

describe("FindSkills", () => {
  it("shows the search field", async () => {
    const { wrapper } = await mountFind();
    expect(wrapper.find(".search").exists()).toBe(true);
  });

  it("lists the results of the search", async () => {
    const { wrapper, skills } = await mountFind({ skills_search: [RESULT] });
    await skills.searchSkills("docx");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_search", { query: "docx" });
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
    expect(wrapper.get(".row").text()).toContain("anthropics/skills · 198,891 installs");
  });

  it("says that nothing was found", async () => {
    const { wrapper, skills } = await mountFind({ skills_search: [] });
    await skills.searchSkills("zzz");
    await flushPromises();
    expect(wrapper.find(".list").exists()).toBe(false);
    expect(wrapper.get(".keys").text()).toBe("No skill found.");
  });

  it("shows the error of the search", async () => {
    const { wrapper, skills } = await mountFind();
    invoke.mockImplementation(async () => {
      throw "skills_search_failed: timeout";
    });
    await skills.searchSkills("docx");
    await flushPromises();
    expect(wrapper.get(".err").text()).toBe("The search on skills.sh failed: timeout");
  });

  it("searches 300 milliseconds after the last key typed", async () => {
    const { wrapper } = await mountFind({ skills_search: [RESULT] });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const input = wrapper.get(".search");
      await input.setValue("do");
      await input.setValue("docx");
      vi.advanceTimersByTime(299);
      expect(invoke).not.toHaveBeenCalledWith("skills_search", expect.anything());
      vi.advanceTimersByTime(1);
      await flushPromises();
      expect(invoke).toHaveBeenCalledWith("skills_search", { query: "docx" });
      expect(invoke).not.toHaveBeenCalledWith("skills_search", { query: "do" });
    } finally {
      vi.useRealTimers();
    }
  });
});
