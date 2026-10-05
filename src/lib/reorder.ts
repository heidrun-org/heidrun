import { ref } from "vue";

/**
 * Drag-and-drop reordering for a list (workspaces, tabs).
 * `drop` receives the dragged id and the insertion gap in the original list
 * (0 = before the first item, length = after the last), which is exactly
 * Herdr's `insert_index`.
 */
export function useReorder(axis: "x" | "y", drop: (id: string, insertIndex: number) => void) {
  const dragging = ref<string | null>(null);
  /** Gap where the item would land, for the insertion marker. */
  const gap = ref<number | null>(null);

  function onDragStart(e: DragEvent, id: string) {
    dragging.value = id;
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: DragEvent, index: number) {
    if (!dragging.value) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = axis === "x" ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
    gap.value = index + (after ? 1 : 0);
  }

  function onDrop(e: DragEvent, ids: string[]) {
    e.preventDefault();
    const id = dragging.value;
    const at = gap.value;
    reset();
    if (!id || at === null) return;
    const from = ids.indexOf(id);
    // Dropping on either side of itself changes nothing.
    if (from === -1 || at === from || at === from + 1) return;
    drop(id, at);
  }

  function reset() {
    dragging.value = null;
    gap.value = null;
  }

  return { dragging, gap, onDragStart, onDragOver, onDrop, onDragEnd: reset };
}

/** Moves `id` to the gap `at` (0…length) of `ids`; returns the new order. */
export function moveId(ids: string[], id: string, at: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const out = ids.filter((x) => x !== id);
  out.splice(from < at ? at - 1 : at, 0, id);
  return out;
}

/**
 * Reorders the items of `list` whose keys are in `visible` (a filtered view) and
 * leaves the others where they were.
 */
export function reorderSubset<T>(list: T[], key: (t: T) => string, visible: string[], id: string, at: number): T[] {
  const order = moveId(visible, id, at);
  const visibleSet = new Set(visible);
  const byKey = new Map(list.map((t) => [key(t), t]));
  let i = 0;
  return list.map((t) => (visibleSet.has(key(t)) ? byKey.get(order[i++])! : t));
}
