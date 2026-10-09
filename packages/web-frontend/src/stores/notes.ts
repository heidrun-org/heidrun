import { reactive, watch } from "vue";
import { paneName } from "../lib/format";
import { reorderSubset } from "../lib/reorder";
import type { AgentInfo } from "../lib/types";
import { tabLabel, toast, workspaceLabel } from "./session";
import { t } from "../i18n/index";

export interface Note {
  id: string;
  title: string;
  text: string;
  workspaceId: string;
  origin: string;
  createdAt: number;
}

// Notes stay on this Mac (not in the repo): terminal output can hold tokens or secrets.
const KEY = "herdr-desk.notes";

function load(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export const notes = reactive({ list: load(), showAll: false, openId: null as string | null });

watch(
  () => notes.list,
  (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

/** Each terminal registers how to read its current selection, for ⇧⌘P. */
export const selectionReaders = new Map<string, () => string>();

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0].trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line || t("notesStore.defaultTitle");
}

export function pinText(text: string, pane: AgentInfo) {
  const clean = text.replace(/\s+$/gm, "").trim();
  if (!clean) return;
  notes.list.unshift({
    id: crypto.randomUUID(),
    title: firstLine(clean),
    text: clean,
    workspaceId: pane.workspace_id,
    origin: `${workspaceLabel(pane.workspace_id)} – ${tabLabel(pane.tab_id)} · ${paneName(pane)}`,
    createdAt: Date.now(),
  });
  toast(t("notesStore.pinned"));
}

/** Drag and drop within the visible notes (current workspace or all). */
export function moveNote(visibleIds: string[], id: string, at: number) {
  notes.list = reorderSubset(notes.list, (n) => n.id, visibleIds, id, at);
}

export function removeNote(id: string) {
  notes.list = notes.list.filter((n) => n.id !== id);
}

export function updateNoteText(id: string, text: string) {
  const n = notes.list.find((x) => x.id === id);
  if (n) n.text = text;
}

export function renameNote(id: string, title: string) {
  const n = notes.list.find((x) => x.id === id);
  if (n) n.title = title;
}
