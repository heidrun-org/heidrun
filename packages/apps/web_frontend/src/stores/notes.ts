import { computed, reactive, watch } from "vue";
import { paneName } from "../lib/format";
import { reorderSubset } from "../lib/reorder";
import type { AgentInfo } from "../lib/types";
import { selectedWorkspace, tabLabel, toast, workspaceLabel } from "./session";
import { settings } from "./settings";
import { t } from "../i18n/index";

export interface Note {
  id: string;
  title: string;
  text: string;
  /**
   * The name of the workspace where the note was pinned. The notes stay after Herdr stops, and Herdr gives new
   * identifiers to its workspaces in its next session, so the name is what finds the workspace again.
   */
  workspaceLabel: string;
  origin: string;
  createdAt: number;
}

// Notes stay on this Mac (not in the repo): terminal output can hold tokens or secrets.
const KEY = "heidrun.notes";

/** The text between the name of the workspace and the rest of the origin of a note. */
const ORIGIN_SEPARATOR = " – ";

/**
 * A note as an older version saved it: it kept the identifier of the workspace in the Herdr session of that day, and not
 * the name. The origin of the note starts with the name, so the name comes from there.
 */
function fromStored(stored: Partial<Note>): Note {
  const origin = stored.origin ?? "";
  const separatorAt = origin.indexOf(ORIGIN_SEPARATOR);
  const { workspaceId: _unused, ...kept } = stored as Partial<Note> & { workspaceId?: string };
  return {
    id: "",
    title: "",
    text: "",
    origin,
    createdAt: 0,
    ...kept,
    workspaceLabel: stored.workspaceLabel ?? (separatorAt > 0 ? origin.slice(0, separatorAt) : ""),
  };
}

function load(): Note[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as Partial<Note>[]).map(fromStored);
  } catch {
    return [];
  }
}

export const notes = reactive({ list: load(), openId: null as string | null });

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

/**
 * The notes that the Clipboard sidebar section lists, and that the number on its button counts: the notes pinned in the
 * selected workspace, or every note when "All workspaces" is switched on.
 */
export const visibleNotes = computed(() => {
  if (settings.notesShowAll) {
    return notes.list;
  }
  const label = selectedWorkspace.value?.label;
  return notes.list.filter((n) => label !== undefined && n.workspaceLabel === label);
});

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
    workspaceLabel: workspaceLabel(pane.workspace_id),
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
