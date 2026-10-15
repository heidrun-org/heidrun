<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";
import DOMPurify from "dompurify";

// A small tooltip below an element, with a text that is written in HTML, so the text can have bold words, paragraphs, and
// lists. The component draws no element of its own around the element. The slot gives `triggerProps`, and the element that
// owns the tooltip receives them with `v-bind`: the four event handlers, and the attribute `aria-describedby` while the
// tooltip is open. The tooltip opens after a short delay, as the tooltip of the HTML attribute `title` does, when the
// pointer stays over the element and when the element keeps the keyboard focus. It closes at once when the pointer leaves
// and when the keyboard focus leaves, and a pointer that leaves before the delay ends opens nothing. The tooltip never
// takes the pointer, so it never flickers. The tooltip is a child of the element `body`, so it is never a sibling of the element, for example inside a
// button group. The HTML is cleaned with DOMPurify before it is shown. The tooltip is placed again when the window
// changes its size, so that it stays inside the window.

const props = defineProps<{
  /** The text of the tooltip, written in HTML. */
  html: string;
}>();

/** The time that the pointer or the keyboard focus must stay on the element before the tooltip opens, in milliseconds. */
const OPEN_DELAY = 1500;

/** The space between the element and the tooltip, and between the tooltip and the edge of the window, in pixels. */
const GAP = 8;

/** The widest tooltip, as a CSS length. A narrow window makes it narrower. */
const MAX_WIDTH = "24rem";

/** The identifier of the tooltip, for the screen reader. Two tooltips never have the same identifier. */
const tooltipId = `html-tooltip-${useId()}`;

/** The element that owns the tooltip, or `null` while the tooltip is closed. */
const trigger = ref<HTMLElement | null>(null);
const tooltip = ref<HTMLElement | null>(null);
const arrow = ref<HTMLElement | null>(null);

/** The timer that opens the tooltip after the delay, or `null` when no timer runs. */
let openTimer: ReturnType<typeof setTimeout> | null = null;

/** True while the tooltip is open. */
const isOpen = ref(false);

/** True from the moment that the tooltip has its place: before that, the tooltip is hidden, so it never jumps. */
const isPlaced = ref(false);

const tooltipStyle = ref<Record<string, string>>({});
const arrowStyle = ref<Record<string, string>>({});

/** The text of the tooltip, cleaned. */
const safeHtml = computed(() => DOMPurify.sanitize(props.html));

/** Puts the tooltip below the element, in the middle of it, and inside the window, with its arrow under the element. */
function place() {
  if (trigger.value === null || tooltip.value === null) {
    return;
  }
  const part = trigger.value.getBoundingClientRect();
  const { height, width } = tooltip.value.getBoundingClientRect();
  const arrowHalfWidth = arrow.value === null ? 0 : arrow.value.getBoundingClientRect().width / 2;
  const left = Math.max(GAP, Math.min(part.left + part.width / 2 - width / 2, window.innerWidth - width - GAP));
  const top = Math.max(GAP, Math.min(part.bottom + GAP, window.innerHeight - height - GAP));
  tooltipStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    "--tooltip-max-width": `min(${MAX_WIDTH}, ${Math.max(0, window.innerWidth - 2 * GAP)}px)`,
  };
  arrowStyle.value = { left: `${Math.max(0, part.left + part.width / 2 - left - arrowHalfWidth)}px` };
  isPlaced.value = true;
}

/** Opens the tooltip now, and places it. */
async function show() {
  openTimer = null;
  if (trigger.value === null || isOpen.value === true) {
    return;
  }
  isPlaced.value = false;
  isOpen.value = true;
  window.addEventListener("resize", place);
  await nextTick();
  place();
}

/** Starts the timer that opens the tooltip, unless the tooltip is open or a timer already runs. */
function open(event: Event) {
  trigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (isOpen.value === true || openTimer !== null) {
    return;
  }
  openTimer = setTimeout(show, OPEN_DELAY);
}

/** Stops the timer, and closes the tooltip at once. */
function close() {
  if (openTimer !== null) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  isOpen.value = false;
  trigger.value = null;
  window.removeEventListener("resize", place);
}

/** What the element that owns the tooltip receives with `v-bind`. */
const triggerProps = computed(() => ({
  "aria-describedby": isOpen.value ? tooltipId : undefined,
  onPointerenter: open,
  onPointerleave: close,
  onFocusin: open,
  onFocusout: close,
}));

onBeforeUnmount(() => {
  if (openTimer !== null) {
    clearTimeout(openTimer);
  }
  window.removeEventListener("resize", place);
});
</script>

<template>
  <slot :triggerProps="triggerProps" />
  <Teleport to="body">
    <div
      v-if="isOpen"
      :id="tooltipId"
      ref="tooltip"
      class="tooltip tooltip-instant bs-tooltip-bottom show position-fixed"
      role="tooltip"
      :style="{ ...tooltipStyle, visibility: isPlaced ? 'visible' : 'hidden' }"
    >
      <div ref="arrow" class="tooltip-arrow position-absolute" :style="arrowStyle"></div>
      <!-- eslint-disable-next-line vue/no-v-html -- the text is cleaned with DOMPurify above -->
      <div class="tooltip-inner text-start" v-html="safeHtml"></div>
    </div>
  </Teleport>
</template>

<style scoped>
.tooltip { pointer-events: none; }
.tooltip-inner :deep(p), .tooltip-inner :deep(ul) { margin: 0 0 0.25rem; }
.tooltip-inner :deep(ul) { padding-left: 1rem; }
.tooltip-inner :deep(:last-child) { margin-bottom: 0; }
</style>
