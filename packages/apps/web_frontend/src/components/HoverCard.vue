<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

// A part of the screen that opens a small card when the mouse pointer rests on it. The part gets a background while the
// pointer is over it and while the card is open. The card opens at the left of the part, so the part belongs in a
// sidebar at the right edge of the window. The card stays open while the pointer is on the part or on the card, and the
// card is a child of the part in the page, so the keyboard reaches the buttons in the card. The card closes after the
// pointer left both, when the key Escape is pressed, when the keyboard focus leaves, and on a click outside.
// The first slot is the part. The slot "card" is the content of the card.

const props = defineProps<{
  /** The name of the card, for the screen reader. */
  label: string;
}>();

/** How long the pointer rests on the part before the card opens, in milliseconds. */
const OPEN_DELAY = 200;

/** How long the card stays open after the pointer left, in milliseconds. It lets the pointer cross the gap to the card. */
const CLOSE_DELAY = 150;

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
let timer: number | undefined;

function clearTimer() {
  window.clearTimeout(timer);
  timer = undefined;
}

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
  clearTimer();
  if (isOpen.value === true) {
    return;
  }
  isOpen.value = true;
  await nextTick();
  place();
}

function close() {
  clearTimer();
  isOpen.value = false;
}

function onPointerEnter() {
  clearTimer();
  if (isOpen.value === false) {
    timer = window.setTimeout(open, OPEN_DELAY);
  }
}

function onPointerLeave() {
  clearTimer();
  if (isOpen.value === true) {
    timer = window.setTimeout(close, CLOSE_DELAY);
  }
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
  clearTimer();
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
});
</script>

<template>
  <div
    ref="root"
    class="hover-card-part"
    :class="{ 'is-open': isOpen }"
    tabindex="0"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @click="open"
    @focusin="open"
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
.hover-card-part { margin: 0 -4px; padding: 0 4px; border-radius: var(--bs-border-radius); }
.hover-card-part:hover, .hover-card-part.is-open { background-color: var(--bs-tertiary-bg); }
</style>
