import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { checkCommand, type GuardId, type ProjectGuards } from "../lib/guards";
import { parseProjectConfig } from "../lib/project_config";
import { openSettings } from "./settings";
import { t } from "../i18n/index";

/** The confirmation window shown before a dangerous command. */
export const danger = reactive({
  open: false,
  level: "confirm" as "confirm" | "block",
  command: "",
  why: "",
  /** The description of the project guard that stopped the command. Empty when the guard has none. */
  description: "",
  where: "",
  /** The guard that stopped the command. Null when no single guard did, for example when the project file is not valid. */
  guard: null as GuardId | null,
  resolve: null as ((ok: boolean) => void) | null,
});

/**
 * The guard that the Guards section of the Settings window shows with a highlight. The confirmation window sets it with
 * the button "Change this guard", and the section clears it when it closes.
 */
export const guardFocus = reactive({
  guard: null as GuardId | null,
});

const cache = new Map<string, Promise<ProjectGuards | "unreadable" | null>>();

/**
 * `guards` section of the project's .heidrun/config.json (cached a minute).
 * "unreadable": the file exists but is not valid JSON or does not follow the schema — its blocking rules
 * cannot be applied, so every command asks for confirmation.
 */
function projectGuards(cwd: string | null | undefined): Promise<ProjectGuards | "unreadable" | null> {
  if (!cwd) return Promise.resolve(null);
  let p = cache.get(cwd);
  if (!p) {
    p = invoke<{ config: unknown }>("project_load", { cwd })
      .then((r) => parseProjectConfig(r.config).guards ?? null)
      .catch(() => "unreadable" as const);
    cache.set(cwd, p);
    window.setTimeout(() => cache.delete(cwd), 60_000);
  }
  return p;
}

/** Forgets the guards read from the project files, so that the next command reads them again. */
export function forgetProjectGuards() {
  cache.clear();
}

/** The guard that a command hits, without asking anything (the phone asks on its side). */
export async function guardHit(command: string, cwd: string | null | undefined) {
  const g = await projectGuards(cwd);
  if (g === "unreadable") return { level: "confirm" as const, why: t("guardsStore.unreadableConfig"), description: null, guard: null };
  return checkCommand(command, g);
}

/**
 * Resolves to true when the command may be sent: harmless, or confirmed by the
 * user. A command the project blocks is never sent.
 */
export async function allowCommand(command: string, cwd: string | null | undefined, where: string): Promise<boolean> {
  const g = await projectGuards(cwd);
  const hit =
    g === "unreadable"
      ? { level: "confirm" as const, why: t("guardsStore.unreadableConfig"), description: null, guard: null }
      : checkCommand(command, g);
  if (!hit) return true;
  // Only one window at a time: a second request waits for the first answer.
  if (danger.open) danger.resolve?.(false);
  return new Promise((resolve) => {
    Object.assign(danger, { open: true, level: hit.level, command, why: hit.why, description: hit.description ?? "", where, guard: hit.guard, resolve });
  });
}

export function answerDanger(ok: boolean) {
  const r = danger.resolve;
  danger.open = false;
  danger.resolve = null;
  r?.(ok && danger.level !== "block");
}

/**
 * Cancels the command, closes the confirmation window, and opens the Guards section of the Settings window on the guard
 * that stopped the command.
 */
export function changeDangerGuard() {
  const guard = danger.guard;
  answerDanger(false);
  guardFocus.guard = guard;
  openSettings("guards");
}
