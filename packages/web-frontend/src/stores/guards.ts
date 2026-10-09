import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { checkCommand, type ProjectGuards } from "../lib/guards";

/** The confirmation window shown before a dangerous command. */
export const danger = reactive({
  open: false,
  level: "confirm" as "confirm" | "block",
  command: "",
  why: "",
  where: "",
  resolve: null as ((ok: boolean) => void) | null,
});

const cache = new Map<string, Promise<ProjectGuards | "unreadable" | null>>();

/**
 * `guards` section of the project's .herdr-desk.json (cached a minute).
 * "unreadable": the file exists but is not valid JSON — its blocking rules
 * cannot be applied, so every command asks for confirmation.
 */
function projectGuards(cwd: string | null | undefined): Promise<ProjectGuards | "unreadable" | null> {
  if (!cwd) return Promise.resolve(null);
  let p = cache.get(cwd);
  if (!p) {
    p = invoke<{ config: { guards?: ProjectGuards } }>("project_load", { cwd })
      .then((r) => r.config?.guards ?? null)
      .catch(() => "unreadable" as const);
    cache.set(cwd, p);
    window.setTimeout(() => cache.delete(cwd), 60_000);
  }
  return p;
}

/** The guard that a command hits, without asking anything (the phone asks on its side). */
export async function guardHit(command: string, cwd: string | null | undefined) {
  const g = await projectGuards(cwd);
  if (g === "unreadable") return { level: "confirm" as const, why: ".herdr-desk.json illisible : ses règles ne peuvent pas être vérifiées" };
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
      ? { level: "confirm" as const, why: ".herdr-desk.json illisible : ses règles ne peuvent pas être vérifiées" }
      : checkCommand(command, g);
  if (!hit) return true;
  // Only one window at a time: a second request waits for the first answer.
  if (danger.open) danger.resolve?.(false);
  return new Promise((resolve) => {
    Object.assign(danger, { open: true, level: hit.level, command, why: hit.why, where, resolve });
  });
}

export function answerDanger(ok: boolean) {
  const r = danger.resolve;
  danger.open = false;
  danger.resolve = null;
  r?.(ok && danger.level !== "block");
}
