<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

// A part of the screen that opens a small card when it is clicked. The part gets a background while the pointer is over it
// and while the card is open. The card opens at the left of the part, so the part belongs in a sidebar at the right edge of
// the window. The card is a child of the part in the page, so the keyboard reaches the buttons in the card. A click on
// the part opens the card, and a second click closes it. The card also closes when the key Escape is pressed, when the
// keyboard focus leaves, and on a click outside. The card does not open when the pointer only moves over the part.
// The first slot is the part. The slot "card" is the content of the card, which has no padding of its own: the content
// decides its padding. The event "open" tells that the card just opened.

const props = defineProps<{
  /** The name of the card, for the screen reader. */
  label: string;
}>();

const emit = defineEmits<{
  /** The card just opened. */
  open: [];
}>();

/** The space between the part and the card, and between the card and the edge of the window, in pixels. */
const GAP = 8;

/** The widest card, in pixels. A narrow window makes it narrower. */
const MAX_WIDTH = 560;

/** The height of the arrow of the card, in pixels: the half of the width, as Bootstrap draws it. */
const ARROW_HALF_WIDTH = 8;

const root = ref<HTMLElement | null>(null);
const card = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const cardStyle = ref<Record<string, string>>({});
const arrowStyle = ref<Record<string, string>>({});
/** Puts the card at the left of the part, as high as the part, and inside the window. */
function place() {
  if (root.value === null || card.value === null) {
    return;
  }
  const part = root.value.getBoundingClientRect();
  const height = card.value.getBoundingClientRect().height;
  const top = Math.max(GAP, Math.min(part.top, window.innerHeight - height - GAP));
  const arrowTop = Math.max(GAP, part.top + part.height / 2 - top - ARROW_HALF_WIDTH);
  cardStyle.value = {
    top: `${top}px`,
    left: "auto",
    right: `${window.innerWidth - part.left + GAP}px`,
    "--bs-popover-max-width": `${Math.max(0, Math.min(MAX_WIDTH, part.left - 2 * GAP))}px`,
  };
  arrowStyle.value = { top: `${arrowTop}px` };
}

async function open() {
  if (isOpen.value === true) {
    return;
  }
  isOpen.value = true;
  emit("open");
  await nextTick();
  place();
}

function close() {
  isOpen.value = false;
}

/** Closes the card when it is open, and opens it when it is closed. */
function toggle() {
  if (isOpen.value === true) {
    close();
    return;
  }
  open();
}

function onFocusOut(event: FocusEvent) {
  const isStillInside =
    event.relatedTarget instanceof Node && root.value !== null && root.value.contains(event.relatedTarget);
  if (isStillInside === false) {
    close();
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  const isInside = event.target instanceof Node && root.value !== null && root.value.contains(event.target);
  if (isInside === false) {
    close();
  }
}

onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown, true));
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
});
</script>

<template>
  <div
    ref="root"
    class="information-card-part"
    :class="{ 'is-open': isOpen }"
    tabindex="0"
    @click="toggle"
    @focusout="onFocusOut"
    @keydown.escape.stop="close"
    @keydown.enter.self.prevent="open"
    @keydown.space.self.prevent="open"
  >
    <slot />
    <div
      v-if="isOpen"
      ref="card"
      class="popover bs-popover-start position-fixed"
      role="group"
      :aria-label="props.label"
      :style="cardStyle"
      @click.stop
    >
      <div class="popover-arrow position-absolute" :style="arrowStyle"></div>
      <div class="popover-body">
        <slot name="card" :close="close" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.popover { --bs-popover-body-padding-x: 0; --bs-popover-body-padding-y: 0; width: 34rem; }
.popover-body :deep(.list-group)::-webkit-scrollbar { width: 10px; background: transparent; }
.popover-body :deep(.list-group)::-webkit-scrollbar-track { background: transparent; }
.popover-body :deep(.list-group)::-webkit-scrollbar-thumb {
  border: 2px solid transparent; border-radius: 5px; background-clip: padding-box;
  background-color: color-mix(in srgb, var(--bs-body-color) 8%, transparent);
}
.popover-body :deep(.list-group:hover)::-webkit-scrollbar-thumb { background-color: color-mix(in srgb, var(--bs-body-color) 22%, transparent); }
.popover-body :deep(.list-group)::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--bs-body-color) 38%, transparent); }
.popover-body { overflow: hidden; border-radius: var(--bs-popover-inner-border-radius); }
.information-card-part { margin: 0 -4px; padding: 0 4px; border-radius: var(--bs-border-radius); cursor: pointer; }
.information-card-part:hover, .information-card-part.is-open { background-color: var(--bs-secondary-bg); }
</style>
