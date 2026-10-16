<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

// A part of the screen that opens a small card when it is clicked. The part gets a background while the pointer is over it
// and while the card is open. By default the card opens at the left of the part, so the part belongs in a sidebar at the
// right edge of the window. The card is a child of the part in the page, so the keyboard reaches the buttons in the card. A click on
// the part opens the card, and a second click closes it. The card also closes when the key Escape is pressed, when the
// keyboard focus leaves, and on a click outside. The card does not open when the pointer only moves over the part.
// The card is placed again each time its height changes, for example when a row of its list expands, and each time the
// window changes its size, so that the card always stays inside the window.
// The property "placement" chooses the side of the card: "start" (the default) puts it at the left of the part, "end"
// puts it at the right of the part, for a part in a sidebar at the left edge of the window, and "bottom" puts it below
// the part, with its arrow under the middle of the part, for a part that is not in a sidebar, for example the circled
// question mark of a page of the Settings window.
// The first slot is the part. The slot "card" is the content of the card, which has no padding of its own: the content
// decides its padding. The event "open" tells that the card just opened. The property "width" gives a narrower or wider
// card than the default, for a card with only a few short rows, for example the usage wheel in the header of a pane.
// The property "prepare" is a function that reads what the card shows. A click on the part then does not open the card at
// once: the card opens when the function has finished, with everything in it, so that its content never changes while
// the developer looks at it. When the function takes more than 0.3 second, a small spinning wheel shows at the right end
// of the part until the card opens. A second click on the part, the key Escape, a press outside, or the loss of the
// keyboard focus cancels the opening.
// - issue #607

const props = withDefaults(
  defineProps<{
    /** The name of the card, for the screen reader. */
    label: string;
    /** The side of the part where the card opens: at the left of the part, at the right of the part, or below it. */
    placement?: "start" | "end" | "bottom";
    /** The width of the card, as a CSS length. Without it, the card is 34rem wide. */
    width?: string;
    /** Reads what the card shows. The card opens when the returned promise is done. Without it, the card opens at once. */
    prepare?: (() => Promise<unknown>) | null;
    /** The name of the wheel for the screen reader while the card is not open yet. Without it, the label of the card. */
    busyLabel?: string | null;
  }>(),
  { placement: "start", prepare: null, busyLabel: null },
);

const emit = defineEmits<{
  /** The card just opened. */
  open: [];
}>();

/** The space between the part and the card, and between the card and the edge of the window, in pixels. */
const GAP = 8;

/** The time that the function `prepare` may take, in milliseconds, before the spinning wheel shows. */
const BUSY_DELAY_MS = 300;

/** The widest card, in pixels. A narrow window makes it narrower. */
const MAX_WIDTH = 560;

/** The height of the arrow of the card, in pixels: the half of the width, as Bootstrap draws it. */
const ARROW_HALF_WIDTH = 8;

const root = ref<HTMLElement | null>(null);
const card = ref<HTMLElement | null>(null);
const isOpen = ref(false);
/** True from the click on the part until the card opens, while the function `prepare` runs. */
const isPreparing = ref(false);
/** True when the function `prepare` has run for more than `BUSY_DELAY_MS`: the spinning wheel shows. */
const isBusy = ref(false);
/** The number of the last preparation. A preparation that is not the last one was cancelled. */
let preparation = 0;
/** The timer that shows the spinning wheel, or null when no timer runs. */
let busyTimer: ReturnType<typeof setTimeout> | null = null;
const cardStyle = ref<Record<string, string>>({});
const arrowStyle = ref<Record<string, string>>({});
/** Puts the card at the left of the part, as high as the part, or below the part, and inside the window. */
function place() {
  if (root.value === null || card.value === null) {
    return;
  }
  const part = root.value.getBoundingClientRect();
  const { height, width } = card.value.getBoundingClientRect();
  if (props.placement === "bottom") {
    const bottomTop = Math.max(GAP, Math.min(part.bottom + GAP, window.innerHeight - height - GAP));
    const bottomLeft = Math.max(GAP, Math.min(part.left, window.innerWidth - width - GAP));
    const arrowLeft = Math.max(GAP, part.left + part.width / 2 - bottomLeft - ARROW_HALF_WIDTH);
    cardStyle.value = {
      top: `${bottomTop}px`,
      left: `${bottomLeft}px`,
      "--popover-max-width": `${Math.max(0, Math.min(MAX_WIDTH, window.innerWidth - 2 * GAP))}px`,
    };
    arrowStyle.value = { left: `${arrowLeft}px` };
    return;
  }
  const top = Math.max(GAP, Math.min(part.top, window.innerHeight - height - GAP));
  const arrowTop = Math.max(GAP, part.top + part.height / 2 - top - ARROW_HALF_WIDTH);
  if (props.placement === "end") {
    cardStyle.value = {
      top: `${top}px`,
      left: `${part.right + GAP}px`,
      right: "auto",
      "--popover-max-width": `${Math.max(0, Math.min(MAX_WIDTH, window.innerWidth - part.right - 2 * GAP))}px`,
    };
    arrowStyle.value = { top: `${arrowTop}px` };
    return;
  }
  cardStyle.value = {
    top: `${top}px`,
    left: "auto",
    right: `${window.innerWidth - part.left + GAP}px`,
    "--popover-max-width": `${Math.max(0, Math.min(MAX_WIDTH, part.left - 2 * GAP))}px`,
  };
  arrowStyle.value = { top: `${arrowTop}px` };
}

/** Stops the timer of the spinning wheel, and hides the wheel. */
function stopBusy() {
  if (busyTimer !== null) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
  isBusy.value = false;
}

/** Cancels the preparation that runs, if any. */
function cancelPreparation() {
  preparation += 1;
  isPreparing.value = false;
  stopBusy();
}

/** Runs the function `prepare`, and shows the spinning wheel when it takes more than `BUSY_DELAY_MS`. */
async function prepareCard(): Promise<boolean> {
  if (props.prepare === null) {
    return true;
  }
  preparation += 1;
  const current = preparation;
  isPreparing.value = true;
  busyTimer = setTimeout(() => {
    isBusy.value = preparation === current;
  }, BUSY_DELAY_MS);
  try {
    await props.prepare();
  } catch {
    // The card opens with what it has.
  }
  if (preparation !== current) {
    return false;
  }
  isPreparing.value = false;
  stopBusy();
  return true;
}

async function open() {
  if (isOpen.value === true || isPreparing.value === true) {
    return;
  }
  if ((await prepareCard()) === false) {
    return;
  }
  isOpen.value = true;
  emit("open");
  await nextTick();
  place();
}

function close() {
  cancelPreparation();
  isOpen.value = false;
}

/** Closes the card when it is open or opening, and opens it when it is closed. */
function toggle() {
  if (isOpen.value === true || isPreparing.value === true) {
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

/** Watches the size of the card while it is open. It is null while the card is closed, and in a window without this API. */
let sizeObserver: ResizeObserver | null = null;

watch(card, (element) => {
  sizeObserver?.disconnect();
  sizeObserver = null;
  if (element !== null && typeof ResizeObserver !== "undefined") {
    sizeObserver = new ResizeObserver(place);
    sizeObserver.observe(element);
  }
});

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  window.addEventListener("resize", place);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  window.removeEventListener("resize", place);
  sizeObserver?.disconnect();
  stopBusy();
});
</script>

<template>
  <div
    ref="root"
    class="information-card-part"
    :class="{ 'is-open': isOpen }"
    :aria-busy="isBusy ? 'true' : undefined"
    tabindex="0"
    @click="toggle"
    @focusout="onFocusOut"
    @keydown.escape.stop="close"
    @keydown.enter.self.prevent="open"
    @keydown.space.self.prevent="open"
  >
    <slot />
    <span
      v-if="isBusy"
      class="information-card-busy spinner-border spinner-border-sm"
      role="status"
      data-information-card-busy
      :aria-label="props.busyLabel ?? props.label"
    ></span>
    <div
      v-if="isOpen"
      ref="card"
      class="popover popover-instant show position-fixed"
      :class="`bs-popover-${props.placement}`"
      role="group"
      :aria-label="props.label"
      :style="{ ...cardStyle, width: props.width }"
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
.popover { --popover-body-padding-x: 0; --popover-body-padding-y: 0; width: 34rem; }
.popover-body { overflow: hidden; border-radius: var(--popover-inner-border-radius); }
.information-card-part { position: relative; margin: 0 -4px; padding: 0 4px; border-radius: var(--radius-5); cursor: pointer; }
/* The part keeps its background while it waits for its card, as it does while its card is open. */
.information-card-part[aria-busy="true"] { background-color: var(--bg-2); }
/* The spinning wheel is near the right end of the part, with space around it, and does not move what the part holds. */
.information-card-busy { position: absolute; top: 50%; right: 12px; width: 16px; height: 16px; margin-top: -8px; border-width: 2px; border-radius: 50%; color: var(--muted); background-color: var(--bg-2); box-shadow: 0 0 0 5px var(--bg-2); }
.information-card-part:hover, .information-card-part.is-open { background-color: var(--bg-2); }
</style>
