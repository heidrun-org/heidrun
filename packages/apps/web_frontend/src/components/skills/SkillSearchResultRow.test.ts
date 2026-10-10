import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { INSTALLED, RESULT, pending, prepare } from "./skills_test_support";

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

async function mountRow(result = RESULT, answers: Record<string, unknown> = {}) {
  const prepared = await prepare(invoke, answers);
  const { default: SkillSearchResultRow } = await import("./SkillSearchResultRow.vue");
  return { wrapper: mount(SkillSearchResultRow, { props: { result } }), ...prepared };
}

describe("SkillSearchResultRow: display", () => {
  it("shows the name, the source and the number of installs", async () => {
    const { wrapper } = await mountRow();
    expect(wrapper.get(".name").text()).toBe("docx");
    expect(wrapper.get(".sub").text()).toBe("anthropics/skills · 198,891 installs");
  });

  it("shows an icon before the text of the buttons Inspect and Install", async () => {
    const { wrapper } = await mountRow();
    const buttons = wrapper.findAll("button");
    expect(buttons[0].find(".bi-eye").exists()).toBe(true);
    expect(buttons[1].find(".bi-download").exists()).toBe(true);
  });

  it("shows a skill as installed at the chosen level, and as installable at the other level", async () => {
    const pdf = { source: "anthropics/skills", skillId: "pdf", name: "pdf", installs: 1 };
    const { wrapper, settings } = await mountRow(pdf);
    // "pdf" is installed at the user level only.
    expect(wrapper.findAll("button")).toHaveLength(2);
    settings.skillsLevel = "user";
    await flushPromises();
    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(wrapper.get(".place").text()).toBe("Installed");
  });
});

describe("SkillSearchResultRow: inspect", () => {
  it("shows the SKILL.md file of the result before the installation", async () => {
    const { wrapper, skills } = await mountRow(RESULT, { skills_preview: "---\nname: docx\n---" });
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview", { source: "anthropics/skills", skillId: "docx" });
    expect(skills.skills.view?.text).toContain("name: docx");
    expect(skills.skills.view?.originLabel).toBe("skills.sh · anthropics/skills");
  });
});

describe("SkillSearchResultRow: install", () => {
  async function clickInstall(wrapper: Awaited<ReturnType<typeof mountRow>>["wrapper"]) {
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
  }

  it("installs at the chosen level, in the folder of the workspace", async () => {
    const { wrapper } = await mountRow();
    await clickInstall(wrapper);
    expect(invoke).toHaveBeenCalledWith("skills_install", {
      level: "workspace",
      cwd: "/work/heidrun",
      source: "anthropics/skills",
      skillId: "docx",
      agents: ["claude", "codex"],
    });
  });

  it("installs only for the agents that the user switched on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["codex"] }));
    const { wrapper } = await mountRow();
    await clickInstall(wrapper);
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ agents: ["codex"] }));
  });

  it("does not install when no agent is switched on, and says what to do", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper, session } = await mountRow();
    await clickInstall(wrapper);
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(session.state.toast).toBe("Switch on a coding agent in the section Agents first");
  });

  it("installs at the user level when the user chose it", async () => {
    const { wrapper, settings } = await mountRow();
    settings.skillsLevel = "user";
    await clickInstall(wrapper);
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ level: "user" }));
  });

  it("does not install at the workspace level without a workspace", async () => {
    const { wrapper, session } = await mountRow();
    session.state.selectedWorkspaceId = null;
    invoke.mockClear();
    await clickInstall(wrapper);
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(session.state.toast).toBe("Select a workspace first, or choose the level User");
  });

  it("shows a spinner while the installation runs, and removes it at the notification", async () => {
    const install = pending();
    const { wrapper, session } = await mountRow(RESULT, { skills_install: install.promise });
    const button = () => wrapper.findAll("button")[1];
    expect(button().find(".spinner").exists()).toBe(false);
    await button().trigger("click");
    expect(button().find(".spinner").exists()).toBe(true);
    expect(button().find(".bi-download").exists()).toBe(false);
    expect(button().attributes("aria-busy")).toBe("true");
    expect(button().attributes("disabled")).toBeDefined();
    install.finish({});
    await flushPromises();
    expect(session.state.toast).toBe("Skill docx installed");
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });

  it("removes the spinner when the installation fails", async () => {
    const { wrapper, session } = await mountRow();
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_install") {
        throw "skills_download_failed: timeout";
      }
      return INSTALLED;
    });
    await clickInstall(wrapper);
    expect(wrapper.find(".spinner").exists()).toBe(false);
    expect(session.state.toastKind).toBe("error");
  });
});
