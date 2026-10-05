import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../lib/api";
import { allPanes, sendPrompt, toast } from "./session";

interface StatuslineState {
  installed: boolean;
  settings_path: string;
  chained: string | null;
  hidden: boolean;
}

/** Whether Claude Code's status line reports to Herdr Desk (see src-tauri/src/claude.rs). */
export const claudeLink = reactive({
  loaded: false,
  installed: false,
  chained: null as string | null,
  hidden: false,
  busy: false,
});

function apply(s: StatuslineState) {
  claudeLink.installed = s.installed;
  claudeLink.chained = s.chained;
  claudeLink.hidden = s.hidden;
  claudeLink.loaded = true;
}

export async function loadClaudeLink() {
  try {
    apply(await invoke<StatuslineState>("claude_statusline_state"));
  } catch {
    claudeLink.loaded = true;
  }
}

export async function enableClaudeLink() {
  claudeLink.busy = true;
  try {
    apply(await invoke<StatuslineState>("claude_statusline_install"));
    toast("Suivi Claude activé : les chiffres arrivent à la prochaine réponse de Claude");
  } catch (e) {
    toast(String(e));
  } finally {
    claudeLink.busy = false;
  }
}

export async function setClaudeLineHidden(hidden: boolean) {
  try {
    apply(await invoke<StatuslineState>("claude_statusline_set_hidden", { hidden }));
    toast(hidden ? "Status line masquée dans le terminal (à la prochaine réponse de Claude)" : "Status line réaffichée dans le terminal");
  } catch (e) {
    toast(String(e));
  }
}

// ---- Remote Control ------------------------------------------------------
// Claude Code exposes no API for it: the state is read from the "/rc active"
// indicator it draws in the prompt footer (hidden when the terminal is too narrow).

export type RcState = "active" | "failed" | "off";

export const remote = reactive({
  byPane: {} as Record<string, RcState>,
  atStartup: null as boolean | null,
});

function readRc(screen: string): RcState {
  const tail = screen.split("\n").slice(-12).join("\n");
  if (/\/rc active/i.test(tail)) return "active";
  if (/remote control (failed|disconnected|error)|\/rc (failed|error|disconnected)/i.test(tail)) return "failed";
  return "off";
}

async function pollRc() {
  const panes = allPanes.value.filter((p) => p.agent?.includes("claude"));
  for (const p of panes) {
    try {
      const r = await api.request<{ read: { text: string } }>("pane.read", { pane_id: p.pane_id, source: "visible" });
      remote.byPane[p.pane_id] = readRc(r.read.text);
    } catch {
      /* keep the last state */
    }
  }
}

/** /remote-control toggles: it connects, or opens the status panel (URL, QR code, disconnect). */
export function toggleRemoteControl(paneId: string) {
  return sendPrompt(paneId, "/remote-control");
}

export async function loadRcStartup() {
  try {
    remote.atStartup = await invoke<boolean | null>("claude_rc_startup");
  } catch {
    /* ignore */
  }
}

export async function setRcStartup(enabled: boolean) {
  try {
    remote.atStartup = await invoke<boolean | null>("claude_set_rc_startup", { enabled });
    toast(enabled ? "Remote Control activé pour les nouvelles sessions Claude" : "Remote Control automatique désactivé");
  } catch (e) {
    toast(String(e));
  }
}

let rcTimer: number | undefined;
export function startRemoteWatch() {
  if (rcTimer) return;
  loadRcStartup();
  pollRc();
  rcTimer = window.setInterval(pollRc, 8000);
}

export async function disableClaudeLink() {
  claudeLink.busy = true;
  try {
    apply(await invoke<StatuslineState>("claude_statusline_uninstall"));
    toast("Suivi Claude désactivé : ta status line d’origine est rétablie");
  } catch (e) {
    toast(String(e));
  } finally {
    claudeLink.busy = false;
  }
}
