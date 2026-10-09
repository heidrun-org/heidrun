// "Nouvel agent": a tab named after the agent, Claude (or Codex) launched in it,
// and the starting consigne sent once the agent is ready.
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { allPanes, refresh, selectPane, sendPrompt, toast } from "./session";
import { resolvePrompt } from "./prompts";

export interface AgentDef {
  name: string;
  description: string;
  model: string | null;
  source: "projet" | "perso";
}

export const newAgent = reactive({ open: false });

export function listAgents(cwd: string | null): Promise<AgentDef[]> {
  return invoke<AgentDef[]>("claude_agents", { cwd }).catch(() => []);
}

// Only plain names reach the shell command line, and quoted ("sonnet[1m]" is a glob for zsh).
const SAFE = /^[A-Za-z0-9._\-[\]]+$/;
const q = (v: string) => `'${v}'`;

export function agentCommand(tool: "claude" | "codex", agent: string | null, model: string | null): string {
  if (agent && !SAFE.test(agent)) throw new Error(`Nom d’agent invalide : ${agent}`);
  if (model && !SAFE.test(model)) throw new Error(`Modèle invalide : ${model}`);
  if (tool === "codex") return ["codex", model ? `-m ${q(model)}` : ""].filter(Boolean).join(" ");
  return ["claude", agent ? `--agent ${q(agent)}` : "", model ? `--model ${q(model)}` : ""].filter(Boolean).join(" ");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for Herdr to see the agent in the pane and for it to be idle (2 min max). */
async function whenReady(paneId: string): Promise<"ready" | "closed" | "timeout"> {
  let warned = false;
  for (let i = 0; i < 160; i++) {
    await wait(750);
    await refresh();
    const p = allPanes.value.find((x) => x.pane_id === paneId);
    if (!p) return "closed"; // tab closed meanwhile
    if (!p.agent) continue;
    if (p.agent_status === "blocked" && !warned) {
      // First launch in a folder: Claude asks whether to trust it.
      warned = true;
      toast("L’agent attend une confirmation (dossier de confiance ?) : la consigne partira après");
    }
    if (p.agent_status === "idle" && p.interactive_ready !== false) return "ready";
  }
  return "timeout";
}

export async function launchAgent(o: {
  workspaceId: string;
  cwd: string | null;
  tool: "claude" | "codex";
  agent: string | null;
  model: string | null;
  label: string;
  prompt: string;
}): Promise<"ok" | "failed" | "closed"> {
  let command: string;
  try {
    command = agentCommand(o.tool, o.agent, o.model);
  } catch (e) {
    toast(String((e as Error).message ?? e));
    return "failed";
  }
  let pane;
  try {
    pane = await api.newTab(o.workspaceId, o.cwd, o.label || undefined);
  } catch (e) {
    toast(`Onglet non créé : ${e}`);
    return "failed";
  }
  await refresh();
  selectPane(pane);
  // Let the shell print its prompt before typing into it.
  await wait(400);
  try {
    await api.run(pane.pane_id, command);
  } catch (e) {
    toast(`Lancement impossible : ${e}`);
    return "failed";
  }
  const text = o.prompt.trim();
  if (!text) return "ok";
  const ready = await whenReady(pane.pane_id);
  if (ready === "closed") {
    toast("Onglet fermé avant que l’agent soit prêt : consigne non envoyée");
    return "closed";
  }
  if (ready === "timeout") {
    toast("L’agent n’est pas prêt au bout de 2 min : la consigne de départ est dans la zone de saisie");
    return "failed";
  }
  // Refused by a guard or failed: undefined, and the consigne goes back to the input.
  return (await sendPrompt(pane.pane_id, await resolvePrompt(text, pane.pane_id))) !== undefined ? "ok" : "failed";
}
