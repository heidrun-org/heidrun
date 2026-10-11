import { computed, ref } from "vue";

/**
 * The open state of a card above the status bar.
 * The card is open while the mouse pointer is on the item of the status bar, and while the item has the keyboard focus.
 * A click with the mouse also gives the focus to the item, so only the focus from the keyboard counts, as the rule
 * `:focus-visible` of the browser says.
 *
 * @returns The state `isOpen`, and the four handlers that the item of the status bar listens to.
 */
export function useStatusCard() {
  const isHovered = ref(false);
  const isFocused = ref(false);
  const isOpen = computed(() => isHovered.value || isFocused.value);

  function onMouseEnter() {
    isHovered.value = true;
  }

  function onMouseLeave() {
    isHovered.value = false;
  }

  function onFocusIn(event: FocusEvent) {
    isFocused.value = event.target instanceof Element && isKeyboardFocus(event.target);
  }

  function onFocusOut() {
    isFocused.value = false;
  }

  return { isOpen, onMouseEnter, onMouseLeave, onFocusIn, onFocusOut };
}

/**
 * Tells if an element has the focus from the keyboard.
 *
 * @param element - The element that received the focus.
 * @returns `true` when the element matches `:focus-visible`, and also when the browser does not know that rule.
 */
function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}
