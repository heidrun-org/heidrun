import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { RESULT, prepare } from "./skills/skills_test_support";

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

/** Mounts the window on a selected workspace. The loading of the skills is the job of the window itself. */
async function mountWindow(answers: Record<string, unknown> = {}) {
  const prepared = await prepare(invoke, answers);
  invoke.mockClear();
  const { default: FindNewSkillsModal } = await import("./FindNewSkillsModal.vue");
  const wrapper = mount(FindNewSkillsModal);
  await flushPromises();
  return { wrapper, ...prepared };
}

describe("FindNewSkillsModal", () => {
  it("asks for the skills of the folder of the selected workspace", async () => {
    await mountWindow();
    expect(invoke).toHaveBeenCalledWith("skills_list", { cwd: "/work/heidrun" });
  });

  it("shows a question mark with the help text next to the title", async () => {
    const { wrapper } = await mountWindow();
    expect(wrapper.get("h2").text()).toBe("Find new skills");
    const button = wrapper.get(".helpButton");
    expect(button.attributes("aria-label")).toBe("What is this window about?");
    const tip = wrapper.get('[role="tooltip"]');
    expect(button.attributes("aria-describedby")).toBe(tip.attributes("id"));
    expect(tip.text()).toContain("SKILL.md");
  });

  it("closes the window with the close button", async () => {
    const { wrapper } = await mountWindow();
    const { findNewSkillsModal } = await import("../stores/skills");
    findNewSkillsModal.open = true;
    await wrapper.get(".close").trigger("click");
    expect(findNewSkillsModal.open).toBe(false);
  });

  it("shows the lines in this order: installation level, source of the skill, the field of the source, and the result", async () => {
    const { wrapper } = await mountWindow();
    const html = wrapper.html();
    const positions = ["levelChoice", "sourceChoice", 'class="searchField"', "Result"].map((text) => html.indexOf(text));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
  });

  it("gives every line a circled question mark that opens an information card", async () => {
    const { wrapper } = await mountWindow();
    const parts = wrapper.findAll(".information-card-part");
    // The title of the window has its own tooltip. The lines have the cards: level, source, search, and result.
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      await part.trigger("click");
      expect(wrapper.findAll("[data-help-block]").length).toBeGreaterThan(0);
      await part.trigger("click");
    }
  });

  it("closes an open information card with the key Escape first, and the window with a second key Escape", async () => {
    await prepare(invoke);
    const { findNewSkillsModal } = await import("../stores/skills");
    const { default: FindNewSkillsModal } = await import("./FindNewSkillsModal.vue");
    const wrapper = mount(FindNewSkillsModal, { attachTo: document.body });
    await flushPromises();
    findNewSkillsModal.open = true;
    const part = wrapper.get(".information-card-part");
    await part.trigger("click");
    expect(wrapper.find("[data-help-block]").exists()).toBe(true);
    await part.trigger("keydown", { key: "Escape" });
    expect(wrapper.find("[data-help-block]").exists()).toBe(false);
    expect(findNewSkillsModal.open).toBe(true);
    await wrapper.get("h2").trigger("keydown", { key: "Escape" });
    expect(findNewSkillsModal.open).toBe(false);
    wrapper.unmount();
  });

  it("gives every input a visible label", async () => {
    const { wrapper } = await mountWindow();
    for (const [index, input] of wrapper.findAll("input:not([type=radio])").entries()) {
      const label = wrapper.find(`label[for="${input.attributes("id")}"]`);
      expect(label.exists(), `input ${index}`).toBe(true);
      expect(label.text()).not.toBe("");
    }
    await wrapper.findAll(".sourceChoice input[type=radio]")[1].setValue(true);
    await wrapper.findAll(".sourceChoice input[type=radio]")[2].setValue(true);
    for (const input of wrapper.findAll("input:not([type=radio])")) {
      expect(wrapper.find(`label[for="${input.attributes("id")}"]`).exists()).toBe(true);
    }
  });

  it("shows the results of the search, with the buttons Inspect and Install", async () => {
    const { wrapper, skills } = await mountWindow({ skills_search: [RESULT] });
    await skills.searchSkills("docx");
    await flushPromises();
    const buttons = wrapper.findAll(".list .row button").map((button) => button.text());
    expect(buttons).toContain("Inspect");
    expect(buttons).toContain("Install");
  });

  it("shows no notice when an agent is switched on", async () => {
    const { wrapper } = await mountWindow();
    expect(wrapper.find(".notice").exists()).toBe(false);
  });

  it("shows the notice when no agent is switched on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper } = await mountWindow();
    expect(wrapper.get(".notice").text()).toContain("No coding agent is switched on");
  });

  it("loads the skills again when another workspace is selected", async () => {
    const { session } = await mountWindow();
    session.state.snapshot = {
      ...session.state.snapshot,
      workspaces: [
        ...(session.state.snapshot?.workspaces ?? []),
        { workspace_id: "w2", number: 2, label: "other", agent_status: "idle", worktree: { path: "/work/other" } },
      ],
    } as typeof session.state.snapshot;
    invoke.mockClear();
    session.state.selectedWorkspaceId = "w2";
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_list", { cwd: "/work/other" });
  });
});
