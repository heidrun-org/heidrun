import { flushPromises } from "@vue/test-utils";
import type { Mock } from "vitest";
import type { SessionSnapshot } from "../../../lib/types";

/** One selected workspace, with the folder `/work/heidrun`. */
export const SNAPSHOT = {
  workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle", worktree: { path: "/work/heidrun" } }],
  panes: [],
  agents: [],
  tabs: [],
  layouts: [],
} as unknown as SessionSnapshot;

/** The skills that the fake backend lists: `pdf` at the user level, `release-notes` at the workspace level. */
export const INSTALLED = [
  { name: "pdf", description: "", level: "user", origin: { source: "anthropics/skills", skill_id: "pdf" }, path: "/home/.agents/skills/pdf", agents: ["claude", "codex"] },
  { name: "release-notes", description: "", level: "workspace", origin: null, path: "/work/heidrun/.agents/skills/release-notes", agents: ["codex"] },
];

/** A result of the search on skills.sh. */
export const RESULT = { source: "anthropics/skills", skillId: "docx", name: "docx", installs: 198891 };

/**
 * Makes the fake backend answer the commands, selects a workspace, and loads the skills store.
 * Both coding agents are switched on, unless the saved settings already say which ones are.
 * Import the component to test only after this call, because the modules are loaded again for each test.
 */
export async function prepare(invoke: Mock, answers: Record<string, unknown> = {}) {
  const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
  localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["claude", "codex"], ...saved }));
  invoke.mockImplementation(async (command: string) => {
    if (command in answers) {
      return answers[command];
    }
    return command === "skills_list" ? INSTALLED : [];
  });
  const session = await import("../../../stores/session");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  const settings = await import("../../../stores/settings");
  const skills = await import("../../../stores/skills");
  await skills.loadSkills();
  await flushPromises();
  return { settings: settings.settings, skills, session };
}

/** A command of the backend that stays pending until `finish` is called. */
export function pending() {
  let finish: (value: unknown) => void = () => {};
  const promise = new Promise((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}
