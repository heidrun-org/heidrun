<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import Icon from "./Icon.vue";
import { allPanes, paneFullName } from "../stores/session";
import {
  goBackInPaneFocusHistory,
  goForwardInPaneFocusHistory,
  goToPaneFocusHistoryEntry,
  paneFocusHistory,
} from "../stores/pane_focus_history";
import { t } from "../i18n/index";

/** The "Back" button or the "Forward" button of the top bar. A long press on the button opens the list of its entries. */
const props = defineProps<{ direction: "back" | "forward" }>();

/** How long the developer presses the button, in milliseconds, before the list of the entries opens. */
const LONG_PRESS_MS = 500;

const isBack = computed(() => props.direction === "back");
/** True when an entry exists in the direction of the button. The button is disabled otherwise. */
const isEnabled = computed(() => (isBack.value ? paneFocusHistory.canGoBack : paneFocusHistory.canGoForward));

/** The entries of the list, the nearest first, each with the name of its pane. An entry of a closed pane is left out. */
const itemList = computed(() => {
  const entryList = isBack.value ? paneFocusHistory.entriesBefore : paneFocusHistory.entriesAfter;
  const labeledEntryList: { index: number; label: string }[] = [];
  for (const entry of entryList) {
    const pane = allPanes.value.find((candidate) => candidate.pane_id === entry.paneId);
    if (pane !== undefined) {
      labeledEntryList.push({ index: entry.index, label: paneFullName(pane) });
    }
  }
  return labeledEntryList;
});

/** True while the list of the entries is open. */
const isOpen = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
/** Where the list sits, in pixels from the top and from the left edge of the window. */
const position = ref({ top: 0, left: 0 });

let pressTimer: ReturnType<typeof setTimeout> | null = null;
/** True from the moment a long press opens the list until the next press: the click that ends the press is ignored. */
let isLongPress = false;

/** Stops the wait for a long press. */
function cancelPress() {
  if (pressTimer !== null) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}

/** Starts the wait for a long press. The list opens when the developer keeps the button pressed long enough. */
function onPointerDown(event: PointerEvent) {
  isLongPress = false;
  cancelPress();
  if (event.button !== 0 || isEnabled.value === false) {
    return;
  }
  pressTimer = setTimeout(() => {
    pressTimer = null;
    isLongPress = true;
    openList();
  }, LONG_PRESS_MS);
}

/** Moves one entry in the direction of the button, unless the click ends a long press. */
function onClick() {
  if (isLongPress) {
    isLongPress = false;
    return;
  }
  if (isBack.value) {
    goBackInPaneFocusHistory();
  } else {
    goForwardInPaneFocusHistory();
  }
}

/** Opens the list under the button. The window places it, so that the top bar cannot cut it. */
function openList() {
  if (button.value === undefined || itemList.value.length === 0) {
    return;
  }
  const rect = button.value.getBoundingClientRect();
  position.value = { top: rect.bottom + 6, left: Math.max(8, rect.left) };
  isOpen.value = true;
  nextTick(() => {
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

/** Closes the list. */
function closeList() {
  isOpen.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

/** Closes the list on a click outside the list and outside the button. */
function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (menu.value?.contains(target) === true || button.value?.contains(target) === true) {
    return;
  }
  closeList();
}

/** Closes the list on the key Escape, and gives the keyboard focus back to the button. */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeList();
    button.value?.focus();
  }
}

/** Gives the focus to the pane of the chosen entry, and closes the list. */
function chooseEntry(index: number) {
  closeList();
  goToPaneFocusHistoryEntry(index);
}

onBeforeUnmount(() => {
  cancelPress();
  closeList();
});
</script>

<template>
  <button
    ref="button"
    type="button"
    class="btn icon history-button"
    :data-direction="direction"
    :aria-label="t(isBack ? 'paneFocusHistoryButton.backLabel' : 'paneFocusHistoryButton.forwardLabel')"
    :title="t(isBack ? 'paneFocusHistoryButton.backTitle' : 'paneFocusHistoryButton.forwardTitle')"
    :disabled="isEnabled === false"
    @pointerdown="onPointerDown"
    @pointerup="cancelPress"
    @pointerleave="cancelPress"
    @pointercancel="cancelPress"
    @click="onClick"
  >
    <Icon :name="isBack ? 'arrow-left' : 'arrow-right'" />
  </button>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menu"
      class="menu show position-fixed"
      role="menu"
      :aria-label="t(isBack ? 'paneFocusHistoryButton.backMenuLabel' : 'paneFocusHistoryButton.forwardMenuLabel')"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    >
      <button
        v-for="item in itemList"
        :key="item.index"
        type="button"
        class="menu-item"
        role="menuitem"
        @click="chooseEntry(item.index)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.history-button { width: 30px; }
</style>
