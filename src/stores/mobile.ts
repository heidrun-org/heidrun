// Mobile access: the phone's calls arrive here (event "mobile-call" from Rust)
// and are answered with the same data and rules as the desktop UI.
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as api from "../lib/api";
import {
  allPanes,
  REFUSAL,
  answerChoice,
  attention,
  contextFor,
  paneFullName,
  quotas,
  rememberPrompt,
  sidebarWorkspaces,
  state,
  tabLabel,
  toast,
  workspaceLabel,
} from "./session";
import { guardHit } from "./guards";
import { paneName, agentKind } from "../lib/format";
import type { AgentInfo } from "../lib/types";

export interface MobileStatus {
  enabled: boolean;
  running: boolean;
  url: string | null;
  qr: string | null;
  error: string | null;
}

export const mobile = reactive({
  open: false,
  status: null as MobileStatus | null,
  busy: false,
  /** Last call from a phone (shown in the settings window). */
  lastSeen: 0,
});

export async function mobileStatus() {
  mobile.status = await invoke<MobileStatus>("mobile_status").catch(() => null);
}
export async function setMobile(on: boolean) {
  mobile.busy = true;
  try {
    mobile.status = await invoke<MobileStatus>(on ? "mobile_enable" : "mobile_disable");
  } catch (e) {
    toast(String(e));
  } finally {
    mobile.busy = false;
  }
}
export async function revokeMobile() {
  mobile.busy = true;
  try {
    mobile.status = await invoke<MobileStatus>("mobile_revoke");
    toast("Ancien appairage révoqué : scanne le nouveau QR code");
  } catch (e) {
    toast(String(e));
  } finally {
    mobile.busy = false;
  }
}

// ---- What the phone may ask -----------------------------------------------------

function agentView(p: AgentInfo) {
  const ctx = contextFor(p);
  const menu = state.choices[p.pane_id];
  return {
    paneId: p.pane_id,
    name: paneName(p),
    kind: agentKind(p),
    workspace: workspaceLabel(p.workspace_id),
    tab: tabLabel(p.tab_id),
    status: p.agent_status,
    since: state.since[p.pane_id] ?? null,
    question: state.questions[p.pane_id]?.text ?? null,
    context: ctx ? Math.round(ctx.percent) : null,
    menu: menu ? { question: menu.question ?? null, detail: menu.detail ?? null, options: menu.options.map((o) => ({ n: o.n, label: o.label })) } : null,
  };
}

function snapshot() {
  const agents = allPanes.value.filter((p) => p.agent);
  const claude = quotas.value.find((q) => q.provider === "claude");
  return {
    now: Date.now(),
    attention: attention.value.map((p) => p.pane_id),
    workspaces: sidebarWorkspaces.value
      .map((w) => ({ id: w.workspace_id, label: w.label, agents: agents.filter((p) => p.workspace_id === w.workspace_id).map(agentView) }))
      .filter((w) => w.agents.length),
    quotas: claude ? claude.windows.map((w) => ({ name: w.name, percent: Math.round(w.percent) })) : [],
  };
}

const agentPane = (id: unknown) => allPanes.value.find((p) => p.pane_id === id && p.agent) ?? null;

type Params = Record<string, unknown>;

async function handle(method: string, params: Params): Promise<unknown> {
  mobile.lastSeen = Date.now();
  if (method === "state") return snapshot();
  const pane = agentPane(params.paneId);
  if (!pane) return { error: "Agent introuvable (panneau fermé ?)" };
  const cwd = pane.foreground_cwd || pane.cwd || null;

  if (method === "read") {
    const lines = Math.min(200, Math.max(10, Number(params.lines) || 60));
    return { text: await api.read(pane.pane_id, lines) };
  }

  if (method === "answer") {
    const menu = state.choices[pane.pane_id];
    const n = Number(params.n);
    const option = menu?.options.find((o) => o.n === n);
    if (!menu || !option) return { error: "Ce menu n’est plus affiché : rafraîchis" };
    // Anything but a refusal approves ("Always allow", "Continue"…): checked by the guards.
    const approves = !REFUSAL.test(option.label);
    if (approves && menu.detail) {
      const hit = await guardHit(menu.detail, cwd);
      if (hit?.level === "block") return { error: `Bloqué par les règles du projet : ${hit.why}` };
      // The phone confirms a precise command: the one on screen now, not another one.
      if (hit && (params.confirmed !== true || params.command !== menu.detail)) return { confirm: { command: menu.detail, why: hit.why } };
    }
    // The menu checked above, and no other (it may have changed during the checks).
    if (!(await answerChoice(pane.pane_id, n, true, menu))) return { error: "Le menu a changé ou une réponse est déjà en cours : rafraîchis" };
    return { ok: true };
  }

  if (method === "prompt") {
    const text = String(params.text ?? "").trim();
    if (!text) return { error: "Consigne vide" };
    // A menu on screen would take the text as its answer ("2" picks option 2): never.
    if (pane.agent_status === "blocked" || state.choices[pane.pane_id]) return { error: "L’agent attend une décision : réponds d’abord à son menu" };
    const shell = /^\s*!\s*(\S[\s\S]*)$/.exec(text);
    if (shell) {
      const hit = await guardHit(shell[1], cwd);
      if (hit?.level === "block") return { error: `Bloqué par les règles du projet : ${hit.why}` };
      if (hit && (params.confirmed !== true || params.command !== shell[1])) return { confirm: { command: shell[1], why: hit.why } };
    }
    await api.prompt(pane.pane_id, text);
    rememberPrompt(pane.pane_id, text);
    toast(`Consigne reçue du téléphone pour ${paneFullName(pane)}`);
    return { ok: true };
  }

  if (method === "keys") {
    // Only keys that stop or refuse: approving goes through the menu (and the guards).
    const action = String(params.action ?? "");
    if (action === "deny" || action === "interrupt") {
      await api.sendKeys(pane.pane_id, ["esc"]);
      return { ok: true };
    }
    return { error: "Action inconnue" };
  }
  return { error: "Méthode inconnue" };
}

let started = false;
export function startMobile() {
  if (started) return;
  started = true;
  listen<{ id: number; method: string; params: Params }>("mobile-call", async (e) => {
    const { id, method, params } = e.payload;
    let result: unknown;
    try {
      result = await handle(method, params ?? {});
    } catch (err) {
      result = { error: String(err).slice(0, 300) };
    }
    invoke("mobile_reply", { id, result }).catch(() => {});
  });
  mobileStatus();
}
