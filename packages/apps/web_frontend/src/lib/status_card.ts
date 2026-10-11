import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * The open state of a card above the status bar.
 * A click on the item of the status bar opens the card, and the next click on the item closes it.
 * The card also closes when the user presses the key Escape, when the user clicks outside the item, and when the
 * keyboard focus leaves the item. So only one card stays open: a click on another item is a click outside this item.
 *
 * @param root - The element of the item of the status bar. The card is inside this element.
 * @returns The state `isOpen`, the functions `toggle` and `close`, and the handler `onFocusOut` for the item.
 */
export function useStatusCard(root: Ref<HTMLElement | null>) {
  const isOpen = ref(false);

  function toggle() {
    isOpen.value = isOpen.value === false;
  }

  function close() {
    isOpen.value = false;
  }

  function onFocusOut(event: FocusEvent) {
    const isStillInside =
      event.relatedTarget instanceof Node && root.value !== null && root.value.contains(event.relatedTarget);
    if (isStillInside === true) {
      return;
    }
    close();
  }

  function onDocumentPointerDown(event: PointerEvent) {
    const isInside = event.target instanceof Node && root.value !== null && root.value.contains(event.target);
    if (isInside === true) {
      return;
    }
    close();
  }

  function onDocumentKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
    }
  }

  onMounted(() => {
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("keydown", onDocumentKeyDown, true);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    document.removeEventListener("keydown", onDocumentKeyDown, true);
  });

  return { isOpen, toggle, close, onFocusOut };
}
