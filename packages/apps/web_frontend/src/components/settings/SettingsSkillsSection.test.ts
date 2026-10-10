import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { prepare } from "./skills/skills_test_support";

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

/** Mounts the section on a selected workspace. The loading of the skills is the job of the section itself. */
async function mountSection() {
  const prepared = await prepare(invoke);
  invoke.mockClear();
  const { default: SettingsSkillsSection } = await import("./SettingsSkillsSection.vue");
  const wrapper = mount(SettingsSkillsSection);
  await flushPromises();
  return { wrapper, ...prepared };
}

describe("SettingsSkillsSection", () => {
  it("asks for the skills of the folder of the selected workspace", async () => {
    await mountSection();
    expect(invoke).toHaveBeenCalledWith("skills_list", { cwd: "/work/heidrun" });
  });

  it("shows the level, the installed skills, and the search, in this order", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find(".levelChoice").exists()).toBe(true);
    expect(wrapper.findAll(".fold").map((fold) => fold.text())).toEqual(["Installed skills (2)", "Find skills on skills.sh"]);
    expect(wrapper.findAll(".list .row")).toHaveLength(2);
    expect(wrapper.find(".search").exists()).toBe(true);
  });

  it("shows no notice when an agent is switched on", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find(".notice").exists()).toBe(false);
  });

  it("shows the notice when no agent is switched on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper } = await mountSection();
    expect(wrapper.get(".notice").text()).toContain("No coding agent is switched on");
  });

  it("loads the skills again when another workspace is selected", async () => {
    const { session } = await mountSection();
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
