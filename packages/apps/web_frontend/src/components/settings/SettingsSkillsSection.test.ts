import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { SessionSnapshot } from "../../lib/types";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

const SNAPSHOT = {
  workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle", worktree: { path: "/work/heidrun" } }],
  panes: [],
  agents: [],
  tabs: [],
  layouts: [],
} as unknown as SessionSnapshot;

const INSTALLED = [
  { name: "pdf", description: "", level: "user", origin: { source: "anthropics/skills", skill_id: "pdf" }, path: "/home/.agents/skills/pdf", agents: ["claude", "codex"] },
  { name: "release-notes", description: "", level: "workspace", origin: null, path: "/work/heidrun/.agents/skills/release-notes", agents: ["codex"] },
];

/**
 * Answers the commands of the backend, then mounts the section on a selected workspace.
 * Both coding agents are switched on, unless the saved settings already say which ones are.
 */
async function mountSection(answers: Record<string, unknown> = {}) {
  const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
  localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["claude", "codex"], ...saved }));
  invoke.mockImplementation(async (command: string) => {
    if (command in answers) {
      return answers[command];
    }
    return command === "skills_list" ? INSTALLED : [];
  });
  const session = await import("../../stores/session");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  const settings = await import("../../stores/settings");
  const skills = await import("../../stores/skills");
  const { default: SettingsSkillsSection } = await import("./SettingsSkillsSection.vue");
  const wrapper = mount(SettingsSkillsSection);
  await flushPromises();
  return { wrapper, settings: settings.settings, skills };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("SettingsSkillsSection: level", () => {
  it("starts on the workspace level", async () => {
    const { wrapper, settings } = await mountSection();
    expect(settings.skillsLevel).toBe("workspace");
    expect(wrapper.get(".levelChoice button.on").text()).toBe("Workspace");
  });

  it("changes the level and keeps it in the saved settings", async () => {
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll(".levelChoice button")[1].trigger("click");
    expect(settings.skillsLevel).toBe("user");
    await flushPromises();
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").skillsLevel).toBe("user");
  });

  it("restores the last level chosen", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ skillsLevel: "user" }));
    const { wrapper } = await mountSection();
    expect(wrapper.get(".levelChoice button.on").text()).toBe("User");
  });
});

describe("SettingsSkillsSection: installed skills", () => {
  it("asks for the skills of the folder of the selected workspace", async () => {
    await mountSection();
    expect(invoke).toHaveBeenCalledWith("skills_list", { cwd: "/work/heidrun" });
  });

  it("shows the count, the origin and the place of each skill", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.get(".fold").text()).toBe("Installed skills (2)");
    const rows = wrapper.findAll(".list .row");
    expect(rows[0].text()).toContain("pdf");
    expect(rows[0].text()).toContain("skills.sh · anthropics/skills");
    expect(rows[0].get(".place").text()).toBe("User");
    expect(rows[1].text()).toContain("Local");
    expect(rows[1].get(".place").text()).toBe("Workspace");
  });

  it("shows the names of the switched on agents that have the skill", async () => {
    const { wrapper } = await mountSection();
    const rows = wrapper.findAll(".list .row");
    expect(rows[0].get(".sub").text()).toBe("skills.sh · anthropics/skills · Claude Code · Codex");
    expect(rows[1].get(".sub").text()).toBe("Local · Codex");
  });

  it("does not show an agent that the user did not switch on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["claude"] }));
    const { wrapper } = await mountSection();
    const rows = wrapper.findAll(".list .row");
    expect(rows[0].get(".sub").text()).toBe("skills.sh · anthropics/skills · Claude Code");
    expect(rows[1].get(".sub").text()).toBe("Local");
  });

  it("shows no hint when an agent is switched on", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find(".notice").exists()).toBe(false);
  });

  it("tells the user to switch an agent on, and opens the section Agents", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper } = await mountSection();
    expect(wrapper.get(".notice").text()).toContain("No coding agent is switched on");
    const { settingsModal } = await import("../../stores/settings");
    await wrapper.get(".notice button").trigger("click");
    expect(settingsModal.open).toBe(true);
    expect(settingsModal.section).toBe("agents");
  });

  it("starts with both parts unfolded", async () => {
    const { wrapper } = await mountSection();
    const folds = wrapper.findAll(".fold");
    expect(folds.map((fold) => fold.attributes("aria-expanded"))).toEqual(["true", "true"]);
    expect(wrapper.find(".search").exists()).toBe(true);
  });

  it("folds and unfolds a part, and remembers the state", async () => {
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll(".fold")[0].trigger("click");
    expect(settings.skillsInstalledOpen).toBe(false);
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    await wrapper.findAll(".fold")[1].trigger("click");
    expect(settings.skillsFindOpen).toBe(false);
    expect(wrapper.find(".search").exists()).toBe(false);
    await flushPromises();
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect([saved.skillsInstalledOpen, saved.skillsFindOpen]).toEqual([false, false]);
    await wrapper.findAll(".fold")[0].trigger("click");
    expect(wrapper.findAll(".list .row")).toHaveLength(2);
  });

  it("restores a part that was folded", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ skillsFindOpen: false }));
    const { wrapper } = await mountSection();
    expect(wrapper.findAll(".fold").map((fold) => fold.attributes("aria-expanded"))).toEqual(["true", "false"]);
    expect(wrapper.find(".search").exists()).toBe(false);
  });
});

describe("SettingsSkillsSection: inspect", () => {
  it("opens the SKILL.md file of an installed skill, read at its own level", async () => {
    const { wrapper, skills } = await mountSection({ skills_read: "# Release notes" });
    await wrapper.findAll(".list .row")[1].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_read", { level: "workspace", cwd: "/work/heidrun", name: "release-notes" });
    expect(skills.skills.view).toEqual({ name: "release-notes", originLabel: "Local", text: "# Release notes", loading: false });
    expect(wrapper.findAll(".list .row")).toHaveLength(2);
  });
});

describe("SettingsSkillsSection: search and install", () => {
  const RESULT = { source: "anthropics/skills", skillId: "docx", name: "docx", installs: 198891 };

  async function search(wrapper: Awaited<ReturnType<typeof mountSection>>["wrapper"], skills: Awaited<ReturnType<typeof mountSection>>["skills"]) {
    await skills.searchSkills("docx");
    await flushPromises();
    return wrapper;
  }

  it("lists the results of the search", async () => {
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    await search(wrapper, skills);
    expect(invoke).toHaveBeenCalledWith("skills_search", { query: "docx" });
    const row = wrapper.findAll(".list")[1].get(".row");
    expect(row.text()).toContain("docx");
    expect(row.text()).toContain("anthropics/skills · 198,891 installs");
  });

  it("installs at the chosen level, in the folder of the workspace", async () => {
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    await search(wrapper, skills);
    await wrapper.findAll(".list")[1].findAll("button")[1].trigger("click");
    await flushPromises();
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
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    await search(wrapper, skills);
    await wrapper.findAll(".list")[1].findAll("button")[1].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ agents: ["codex"] }));
  });

  it("does not install when no agent is switched on, and says what to do", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    await search(wrapper, skills);
    await wrapper.findAll(".list")[1].findAll("button")[1].trigger("click");
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    const session = await import("../../stores/session");
    expect(session.state.toast).toBe("Switch on a coding agent in the section Agents first");
  });

  it("installs at the user level when the user chose it", async () => {
    const { wrapper, settings, skills } = await mountSection({ skills_search: [RESULT] });
    settings.skillsLevel = "user";
    await search(wrapper, skills);
    await wrapper.findAll(".list")[1].findAll("button")[1].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ level: "user" }));
  });

  it("shows a skill as installed at the chosen level, and as installable at the other level", async () => {
    const pdf = { source: "anthropics/skills", skillId: "pdf", name: "pdf", installs: 1 };
    const { wrapper, settings, skills } = await mountSection({ skills_search: [pdf] });
    await search(wrapper, skills);
    // "pdf" is installed at the user level only.
    expect(wrapper.findAll(".list")[1].findAll("button")).toHaveLength(2);
    settings.skillsLevel = "user";
    await flushPromises();
    expect(wrapper.findAll(".list")[1].findAll("button")).toHaveLength(1);
    expect(wrapper.findAll(".list")[1].get(".place").text()).toBe("Installed");
  });

  it("does not install at the workspace level without a workspace", async () => {
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    await search(wrapper, skills);
    const session = await import("../../stores/session");
    session.state.selectedWorkspaceId = null;
    invoke.mockClear();
    await skills.installSkill(RESULT);
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(session.state.toast).toBe("Select a workspace first, or choose the level User");
    expect(wrapper.exists()).toBe(true);
  });

  it("shows the SKILL.md file of a result before the installation", async () => {
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT], skills_preview: "---\nname: docx\n---" });
    await search(wrapper, skills);
    await wrapper.findAll(".list")[1].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview", { source: "anthropics/skills", skillId: "docx" });
    expect(skills.skills.view?.text).toContain("name: docx");
    expect(skills.skills.view?.originLabel).toBe("skills.sh · anthropics/skills");
  });
});

describe("SettingsSkillsSection: delete", () => {
  it("deletes only after the confirmation", async () => {
    const { wrapper } = await mountSection();
    const confirm = await import("../../stores/confirm");
    await wrapper.findAll(".list .row")[0].get(".danger").trigger("click");
    expect(confirm.confirmDialog.open).toBe(true);
    expect(confirm.confirmDialog.title).toBe("Move the skill pdf to the Trash?");
    expect(invoke).not.toHaveBeenCalledWith("skills_delete", expect.anything());
    confirm.answerConfirm(true);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_delete", { level: "user", cwd: "/work/heidrun", name: "pdf" });
  });

  it("keeps the skill when the user cancels", async () => {
    const { wrapper } = await mountSection();
    const confirm = await import("../../stores/confirm");
    await wrapper.findAll(".list .row")[0].get(".danger").trigger("click");
    confirm.answerConfirm(false);
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_delete", expect.anything());
  });
});

describe("errorText", () => {
  it("gives the text of a known code of the backend", async () => {
    const { errorText } = await import("../../stores/skills");
    expect(errorText("skills_already_installed: pdf")).toBe("The skill pdf is already installed at this level");
  });

  it("tells the time when GitHub accepts requests again", async () => {
    const { errorText } = await import("../../stores/skills");
    const reset = new Date(2026, 9, 10, 15, 4, 46).getTime() / 1000;
    const text = errorText(`skills_github_rate_limit: ${reset}`);
    expect(text).toMatch(/^GitHub refuses more requests for now\. Try again at .*(15:04|3:04)/);
  });

  it("says a few minutes when GitHub does not give the time", async () => {
    const { errorText } = await import("../../stores/skills");
    expect(errorText("skills_github_rate_limit")).toBe("GitHub refuses more requests for now. Try again in a few minutes.");
  });

  it("shows an unknown error as it is", async () => {
    const { errorText } = await import("../../stores/skills");
    expect(errorText("something_else: boom")).toBe("something_else: boom");
  });
});

describe("SettingsSkillsSection: icons and spinner", () => {
  const RESULT = { source: "anthropics/skills", skillId: "docx", name: "docx", installs: 198891 };

  /** A command of the backend that stays pending until `finish` is called. */
  function pending() {
    let finish: (value: unknown) => void = () => {};
    const promise = new Promise((resolve) => {
      finish = resolve;
    });
    return { promise, finish };
  }

  it("shows an icon before the text of each button", async () => {
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    await skills.searchSkills("docx");
    await flushPromises();
    const installed = wrapper.findAll(".list")[0].get(".row").findAll("button");
    expect(installed[0].find(".bi-eye").exists()).toBe(true);
    expect(installed[1].find(".bi-trash").exists()).toBe(true);
    const found = wrapper.findAll(".list")[1].get(".row").findAll("button");
    expect(found[0].find(".bi-eye").exists()).toBe(true);
    expect(found[1].find(".bi-download").exists()).toBe(true);
  });

  it("shows a spinner in the button Install while the installation runs, and removes it at the notification", async () => {
    const install = pending();
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT], skills_install: install.promise });
    await skills.searchSkills("docx");
    await flushPromises();
    const button = () => wrapper.findAll(".list")[1].get(".row").findAll("button")[1];
    expect(button().find(".spinner").exists()).toBe(false);
    await button().trigger("click");
    expect(button().find(".spinner").exists()).toBe(true);
    expect(button().find(".bi-download").exists()).toBe(false);
    expect(button().attributes("aria-busy")).toBe("true");
    expect(button().attributes("disabled")).toBeDefined();
    install.finish({});
    await flushPromises();
    const session = await import("../../stores/session");
    expect(session.state.toast).toBe("Skill docx installed");
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });

  it("shows a spinner in the button Delete while the deletion runs, and removes it at the notification", async () => {
    const deletion = pending();
    const { wrapper } = await mountSection({ skills_delete: deletion.promise });
    const confirm = await import("../../stores/confirm");
    const button = () => wrapper.findAll(".list")[0].get(".row").get(".danger");
    await button().trigger("click");
    confirm.answerConfirm(true);
    await flushPromises();
    expect(button().find(".spinner").exists()).toBe(true);
    expect(button().find(".bi-trash").exists()).toBe(false);
    deletion.finish(undefined);
    await flushPromises();
    const session = await import("../../stores/session");
    expect(session.state.toast).toBe("Skill pdf moved to the Trash");
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });

  it("removes the spinner when the installation fails", async () => {
    const { wrapper, skills } = await mountSection({ skills_search: [RESULT] });
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_install") {
        throw "skills_download_failed: timeout";
      }
      return command === "skills_search" ? [RESULT] : INSTALLED;
    });
    await skills.searchSkills("docx");
    await flushPromises();
    await wrapper.findAll(".list")[1].get(".row").findAll("button")[1].trigger("click");
    await flushPromises();
    expect(wrapper.find(".spinner").exists()).toBe(false);
    const session = await import("../../stores/session");
    expect(session.state.toastKind).toBe("error");
  });
});
