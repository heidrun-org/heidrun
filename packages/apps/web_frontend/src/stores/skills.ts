// Skills: the folders with a SKILL.md file that Claude Code reads. The disk and the network work are in
// src-tauri/src/skills.rs; this store holds what the section Skills of the Settings window shows.
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openSettings, settings } from "./settings";
import { AGENTS } from "../lib/agents";
import { selectedWorkspace, toast } from "./session";
import { workspaceCwd } from "./project";
import { askConfirm } from "./confirm";
import { hasText, t } from "../i18n/index";
import { clockTime } from "../lib/format";

/** Where a skill is installed: the folder of the workspace, or the user. */
export type SkillLevel = "workspace" | "user";

/** Where an installed skill comes from, written by Heidrun at the installation. */
export interface SkillOrigin {
  /** The GitHub repository, as `owner/repository`. */
  source: string;
  skill_id: string;
}

/** A skill found on the disk. */
export interface InstalledSkill {
  name: string;
  description: string;
  level: SkillLevel;
  /** `null` for a skill that Heidrun did not install. */
  origin: SkillOrigin | null;
  /** The folder with the real files of the skill. */
  path: string;
  /** The ids of the agents whose skills folder has the skill, a real folder or a link. */
  agents: string[];
}

/** A result of the search on skills.sh. */
export interface SearchResult {
  /** The GitHub repository, as `owner/repository`. */
  source: string;
  skillId: string;
  name: string;
  installs: number;
}

/** The read-only view of a SKILL.md file. */
export interface SkillView {
  name: string;
  /** "skills.sh · owner/repository", or "Local". */
  originLabel: string;
  text: string;
  loading: boolean;
}

export const skills = reactive({
  installed: [] as InstalledSkill[],
  query: "",
  results: [] as SearchResult[],
  /** A search was done: an empty list of results then means "nothing found". */
  searched: false,
  searching: false,
  searchError: "",
  /** The key of the skill being installed or deleted ("" for none). */
  busyKey: "",
  view: null as SkillView | null,
});

/** The folder of the selected workspace, or `null` when no workspace is selected. */
export function currentCwd(): string | null {
  const workspace = selectedWorkspace.value;
  return workspace === null ? null : workspaceCwd(workspace.workspace_id);
}

/**
 * The text of an error of the backend. The backend writes "code: details"; a code that has a text in the
 * namespace `skillsStore` shows that text, any other error is shown as it is.
 */
export function errorText(error: unknown): string {
  const message = String(error);
  const code = message.split(":")[0].trim();
  const key = `skillsStore.error_${code}`;
  if (hasText(key) === false) {
    return message;
  }
  if (code === "skills_github_rate_limit") {
    // The backend gives the moment when GitHub accepts requests again, in seconds since 1970.
    const reset = Number(message.slice(message.indexOf(":") + 1));
    return message.includes(":") && Number.isFinite(reset) && reset > 0
      ? t(key, { time: clockTime(reset) })
      : t(`${key}_unknown`);
  }
  return t(key, { details: message.slice(message.indexOf(":") + 1).trim() });
}

/** The key of a skill of the search, to find it back in the list of installed skills. */
export function resultKey(result: SearchResult): string {
  return `${result.source}/${result.skillId}`;
}

/** The key of an installed skill: the level and the folder name. */
export function installedKey(skill: InstalledSkill): string {
  return `${skill.level}:${skill.name}`;
}

/** True when a result of the search is already installed at the chosen level. */
export function isInstalledAtLevel(result: SearchResult): boolean {
  return skills.installed.some((skill) => skill.level === settings.skillsLevel && skill.name === result.skillId);
}

/** The ids of the agents that the user switched on, in the order of the table of agents. */
export function ownedAgentIds(): string[] {
  return AGENTS.filter((agent) => settings.ownedAgents.includes(agent.id)).map((agent) => agent.id);
}

/** The names of the agents that the user switched on and that have an installed skill. */
export function agentNames(skill: InstalledSkill): string[] {
  return AGENTS.filter((agent) => settings.ownedAgents.includes(agent.id) && skill.agents.includes(agent.id)).map((agent) => agent.name);
}

/** Opens the section Agents of the Settings window, where the user switches the coding agents on. */
export function openAgentsSection(): void {
  openSettings("agents");
}

/** The text that says where an installed skill comes from. */
export function originLabel(skill: InstalledSkill): string {
  return skill.origin === null ? t("settingsSkills.originLocal") : `skills.sh · ${skill.origin.source}`;
}

export async function loadSkills(): Promise<void> {
  try {
    skills.installed = await invoke<InstalledSkill[]>("skills_list", { cwd: currentCwd() });
  } catch (error) {
    toast(errorText(error), "error");
  }
}

export async function searchSkills(query: string): Promise<void> {
  skills.query = query;
  skills.searchError = "";
  if (query.trim() === "") {
    skills.results = [];
    skills.searched = false;
    return;
  }
  skills.searching = true;
  try {
    const results = await invoke<SearchResult[]>("skills_search", { query });
    // A slower answer of an older search must not replace the answer of the newest one.
    if (skills.query === query) {
      skills.results = results;
      skills.searched = true;
    }
  } catch (error) {
    if (skills.query === query) {
      skills.results = [];
      skills.searchError = errorText(error);
    }
  } finally {
    if (skills.query === query) {
      skills.searching = false;
    }
  }
}

/** Shows the SKILL.md file of an installed skill. */
export async function inspectInstalled(skill: InstalledSkill): Promise<void> {
  skills.view = { name: skill.name, originLabel: originLabel(skill), text: "", loading: true };
  try {
    const text = await invoke<string>("skills_read", { level: skill.level, cwd: currentCwd(), name: skill.name });
    skills.view = { name: skill.name, originLabel: originLabel(skill), text, loading: false };
  } catch (error) {
    skills.view = null;
    toast(errorText(error), "error");
  }
}

/** Shows the SKILL.md file of a result of the search, before the installation. */
export async function inspectResult(result: SearchResult): Promise<void> {
  const label = `skills.sh · ${result.source}`;
  skills.view = { name: result.name, originLabel: label, text: "", loading: true };
  try {
    const text = await invoke<string>("skills_preview", { source: result.source, skillId: result.skillId });
    skills.view = { name: result.name, originLabel: label, text, loading: false };
  } catch (error) {
    skills.view = null;
    toast(errorText(error), "error");
  }
}

export function closeSkillView(): void {
  skills.view = null;
}

/** Installs a result of the search at the chosen level. */
export async function installSkill(result: SearchResult): Promise<void> {
  const level = settings.skillsLevel;
  const cwd = currentCwd();
  const agents = ownedAgentIds();
  if (agents.length === 0) {
    toast(t("skillsStore.error_skills_no_agent"), "error");
    return;
  }
  if (level === "workspace" && cwd === null) {
    toast(t("skillsStore.error_skills_no_workspace_folder"), "error");
    return;
  }
  skills.busyKey = resultKey(result);
  try {
    await invoke<InstalledSkill>("skills_install", { level, cwd, source: result.source, skillId: result.skillId, agents });
    await loadSkills();
    toast(t("skillsStore.installed", { name: result.name }));
  } catch (error) {
    toast(errorText(error), "error");
  } finally {
    skills.busyKey = "";
  }
}

/** Moves an installed skill to the Trash, after the confirmation of the user. */
export async function deleteSkill(skill: InstalledSkill): Promise<void> {
  const confirmed = await askConfirm(t("skillsStore.confirmDelete", { name: skill.name }), t("skillsStore.confirmDeleteButton"));
  if (confirmed === false) {
    return;
  }
  skills.busyKey = installedKey(skill);
  try {
    await invoke("skills_delete", { level: skill.level, cwd: currentCwd(), name: skill.name });
    await loadSkills();
    toast(t("skillsStore.deleted", { name: skill.name }));
  } catch (error) {
    toast(errorText(error), "error");
  } finally {
    skills.busyKey = "";
  }
}
