import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "./session";
import { t } from "../i18n/index";

interface StatuslineState {
  installed: boolean;
  can_change: boolean;
  settings_path: string;
  chained: string | null;
}

export const antigravityLink = reactive({
  loaded: false,
  installed: false,
  canChange: false,
  chained: null as string | null,
  busy: false,
});

function apply(state: StatuslineState) {
  antigravityLink.installed = state.installed;
  antigravityLink.canChange = state.can_change;
  antigravityLink.chained = state.chained;
  antigravityLink.loaded = true;
}

export async function loadAntigravityLink() {
  try {
    apply(await invoke<StatuslineState>("antigravity_statusline_state"));
  } catch {
    antigravityLink.loaded = true;
  }
}

export async function enableAntigravityLink() {
  antigravityLink.busy = true;
  try {
    apply(await invoke<StatuslineState>("antigravity_statusline_install"));
    toast(t("antigravityStore.trackingEnabled"));
  } catch (error) {
    toast(String(error));
  } finally {
    antigravityLink.busy = false;
  }
}

export async function disableAntigravityLink() {
  antigravityLink.busy = true;
  try {
    apply(await invoke<StatuslineState>("antigravity_statusline_uninstall"));
    toast(t("antigravityStore.trackingDisabled"));
  } catch (error) {
    toast(String(error));
  } finally {
    antigravityLink.busy = false;
  }
}
