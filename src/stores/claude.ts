import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "./session";

interface StatuslineState {
  installed: boolean;
  settings_path: string;
  chained: string | null;
}

/** Whether Claude Code's status line reports to Herdr Desk (see src-tauri/src/claude.rs). */
export const claudeLink = reactive({
  loaded: false,
  installed: false,
  chained: null as string | null,
  busy: false,
});

function apply(s: StatuslineState) {
  claudeLink.installed = s.installed;
  claudeLink.chained = s.chained;
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
