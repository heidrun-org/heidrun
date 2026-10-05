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
