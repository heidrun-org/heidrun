<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";
import DOMPurify from "dompurify";

// A part of the screen that shows a small tooltip below it, with a text that is written in HTML, so the text can have
// bold words, paragraphs, and lists. The tooltip opens when the pointer is over the part and when the part has the
// keyboard focus. It closes when the pointer leaves the part and when the keyboard focus leaves it. The tooltip never
// takes the pointer, so it never flickers. The HTML is cleaned with DOMPurify before it is shown. The slot is the part: it
// receives `describedBy`, the identifier of the tooltip while the tooltip is open, for the attribute `aria-describedby`
// of the button inside the slot. The tooltip is placed again when the window changes its size, so that it stays inside
// the window.

const props = defineProps<{
  /** The text of the tooltip, written in HTML. */
  html: string;
}>();

/** The space between the part and the tooltip, and between the tooltip and the edge of the window, in pixels. */
const GAP = 8;

/** The widest tooltip, as a CSS length. A narrow window makes it narrower. */
const MAX_WIDTH = "24rem";

/** The identifier of the tooltip, for the screen reader. Two tooltips never have the same identifier. */
const tooltipId = `html-tooltip-${useId()}`;

const root = ref<HTMLElement | null>(null);
const tooltip = ref<HTMLElement | null>(null);
const arrow = ref<HTMLElement | null>(null);

/** True while the tooltip is open. */
const isOpen = ref(false);

/** True from the moment that the tooltip has its place: before that, the tooltip is hidden, so it never jumps. */
const isPlaced = ref(false);

const tooltipStyle = ref<Record<string, string>>({});
const arrowStyle = ref<Record<string, string>>({});

/** The text of the tooltip, cleaned. */
const safeHtml = computed(() => DOMPurify.sanitize(props.html));

/** Puts the tooltip below the part, in the middle of it, and inside the window, with its arrow under the part. */
function place() {
  if (root.value === null || tooltip.value === null) {
    return;
  }
  const part = root.value.getBoundingClientRect();
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

async function open() {
  if (isOpen.value === true) {
    return;
  }
  isPlaced.value = false;
  isOpen.value = true;
  window.addEventListener("resize", place);
  await nextTick();
  place();
}

function close() {
  isOpen.value = false;
  window.removeEventListener("resize", place);
}

onBeforeUnmount(() => {
  window.removeEventListener("resize", place);
});
</script>

<template>
  <span
    ref="root"
    class="d-inline-flex"
    role="presentation"
    @pointerenter="open"
    @pointerleave="close"
    @focusin="open"
    @focusout="close"
  >
    <slot :describedBy="isOpen ? tooltipId : undefined" />
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
  </span>
</template>

<style scoped>
.tooltip { pointer-events: none; }
.tooltip-inner :deep(p), .tooltip-inner :deep(ul) { margin: 0 0 0.25rem; }
.tooltip-inner :deep(ul) { padding-left: 1rem; }
.tooltip-inner :deep(:last-child) { margin-bottom: 0; }
</style>
