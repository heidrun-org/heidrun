// Reusable consignes: personal ones (this Mac) and the project's (.heidrun/config.json).
import { computed, reactive, watch } from "vue";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { allPanes, state, tabLabel, workspaceLabel } from "./session";
import { currentProject, loadProject, saveProject } from "./project";
import { git } from "./git";
import { selectionReaders } from "./notes";
import { paneName } from "../lib/format";
import { t } from "../i18n/index";

export interface PromptTemplate {
  id: string;
  label: string;
  /** One short line shown under the label in the template menu. May be empty. */
  description: string;
  text: string;
}

const KEY = "heidrun.prompts";

// The labels of the default templates follow the language in use (getters); the texts are consignes sent to
// the agent, kept as they are.
const DEFAULTS: PromptTemplate[] = [
  { id: "revue-mr", get label() { return t("promptsStore.default.reviewMergeRequest"); }, get description() { return t("promptsStore.default.reviewMergeRequestDescription"); }, text: "Fais la revue de la MR de la branche {branche} : sécurité, bugs, tests. Résumé, points bloquants, suggestions." },
  { id: "note-reprise", get label() { return t("promptsStore.default.handoverNote"); }, get description() { return t("promptsStore.default.handoverNoteDescription"); }, text: "Commite ce qui est prêt, puis écris la note de reprise : ce qui est fait, ce qui reste, les décisions prises." },
  { id: "ou-en-es-tu", get label() { return t("promptsStore.default.progress"); }, get description() { return t("promptsStore.default.progressDescription"); }, text: "Où en es-tu ? Résume en 5 lignes ce que tu as fait et ce qu'il reste." },
  { id: "explique-selection", get label() { return t("promptsStore.default.explainSelection"); }, get description() { return t("promptsStore.default.explainSelectionDescription"); }, text: "Explique-moi ceci :\n\n```\n{selection}\n```" },
];

function load(): PromptTemplate[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(v) ? v.map((p: Partial<PromptTemplate>) => ({ description: "", ...p }) as PromptTemplate) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export const prompts = reactive({ personal: load() });
watch(
  () => prompts.personal,
  (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

/** Templates of the selected workspace's project, from .heidrun/config.json `prompts`. */
export const projectPrompts = computed<PromptTemplate[]>(() => {
  const list = (currentProject.value?.config as { prompts?: unknown } | undefined)?.prompts;
  if (!Array.isArray(list)) return [];
  // Hand-written entries: label and id may be missing.
  return (list as Partial<PromptTemplate>[])
    .filter((p) => p && typeof p.text === "string")
    .map((p, i) => ({
      id: typeof p.id === "string" && p.id ? p.id : `projet-${i}`,
      label: typeof p.label === "string" && p.label ? p.label : p.text!.slice(0, 40),
      description: typeof p.description === "string" ? p.description : "",
      text: p.text!,
    }));
});

const slug = (s: string) =>
  `${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "modele"}-${Math.random().toString(36).slice(2, 5)}`;

export async function addPrompt(label: string, description: string, text: string, inProject: boolean): Promise<string> {
  const template = { id: slug(label), label: label.trim() || text.slice(0, 40), description: description.trim(), text };
  const ws = state.selectedWorkspaceId;
  if (inProject && ws && currentProject.value) {
    // Re-read the file first: another workspace on the same repo may have changed it.
    await loadProject(ws);
    const cfg = currentProject.value.config as { prompts?: PromptTemplate[] };
    cfg.prompts = [...(Array.isArray(cfg.prompts) ? cfg.prompts : []), template];
    if (!(await saveProject(ws))) throw new Error(t("promptsStore.saveFailed"));
  } else {
    prompts.personal.push(template);
  }
  return template.id;
}

/** Replaces the label, the description and the text of the template `id`, in the project file or on this Mac. */
export async function updatePrompt(id: string, fromProject: boolean, label: string, description: string, text: string) {
  const ws = state.selectedWorkspaceId;
  if (fromProject && ws && currentProject.value) {
    await loadProject(ws);
    const cfg = currentProject.value.config as { prompts?: Partial<PromptTemplate>[] };
    cfg.prompts = (cfg.prompts ?? []).map((p, i) =>
      (typeof p.id === "string" && p.id ? p.id : `projet-${i}`) === id ? { ...p, id, label: label.trim() || text.slice(0, 40), description: description.trim(), text } : p,
    );
    if (!(await saveProject(ws))) throw new Error(t("promptsStore.saveFailed"));
  } else {
    prompts.personal = prompts.personal.map((p) => (p.id === id ? { id, label: label.trim() || text.slice(0, 40), description: description.trim(), text } : p));
  }
}

/** The window that edits the templates. */
export const promptEditor = reactive({ open: false });

export async function removePrompt(id: string, fromProject: boolean) {
  const ws = state.selectedWorkspaceId;
  if (fromProject && ws && currentProject.value) {
    await loadProject(ws);
    const cfg = currentProject.value.config as { prompts?: Partial<PromptTemplate>[] };
    cfg.prompts = (cfg.prompts ?? []).filter((p, i) => (typeof p.id === "string" && p.id ? p.id : `projet-${i}`) !== id);
    await saveProject(ws);
  } else {
    prompts.personal = prompts.personal.filter((p) => p.id !== id);
  }
}

export const VARIABLES = ["{workspace}", "{onglet}", "{agent}", "{branche}", "{selection}", "{presse-papiers}"];

/**
 * Replaces the variables for the pane the consigne goes to. An unknown variable
 * stays as it is, so nothing silently disappears.
 */
export async function resolvePrompt(text: string, paneId: string | null): Promise<string> {
  const p = paneId ? allPanes.value.find((x) => x.pane_id === paneId) : undefined;
  const ws = p?.workspace_id ?? state.selectedWorkspaceId ?? "";
  const values: Record<string, () => string | Promise<string>> = {
    workspace: () => (ws ? workspaceLabel(ws) : ""),
    onglet: () => (p ? tabLabel(p.tab_id) : ""),
    agent: () => (p ? paneName(p) : ""),
    branche: () => git.status[ws]?.branch ?? "",
    selection: () => {
      for (const read of [p && selectionReaders.get(p.pane_id), ...selectionReaders.values()]) {
        const s = read?.();
        if (s) return s;
      }
      return "";
    },
    "presse-papiers": async () => (await readText().catch(() => "")) ?? "",
  };
  // Values first, then a single pass: a value that contains "{…}" is not expanded
  // again, and an empty value becomes "" (no "{branche}" left in the consigne).
  const vals: Record<string, string> = {};
  for (const [name, get] of Object.entries(values)) if (text.includes(`{${name}}`)) vals[name] = await get();
  return text.replace(/\{([\w-]+)\}/g, (m, k: string) => (k in vals ? vals[k] : m));
}
