<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { t } from "../i18n/index";
import { ResizerWidth } from "../lib/resizer_width";

// Vertical drag handle between two columns. `side` says which column it resizes:
// "left" grows when dragged right, "right" grows when dragged left.
// `highlighted` draws the line in colour although the pointer is not on it: a corner of the panes that touches it
// is under the pointer.
const props = defineProps<{ side: "left" | "right"; width: number; min: number; max: number; defaultWidth: number; reserve?: number; highlighted?: boolean }>();
const emit = defineEmits<{ "update:width": [value: number] }>();

const active = ref(false);
let startX = 0;
let startW = 0;

function clamp(w: number) {
  return ResizerWidth.clamp(w, { min: props.min, max: props.max, reserve: props.reserve ?? 0 }, window.innerWidth);
}

function onDown(e: PointerEvent) {
  active.value = true;
  startX = e.clientX;
  startW = props.width;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  document.body.style.cursor = "col-resize";
  e.preventDefault();
}

function onMove(e: PointerEvent) {
  if (!active.value) return;
  const dx = e.clientX - startX;
  emit("update:width", clamp(props.side === "left" ? startW + dx : startW - dx));
}

function onUp() {
  active.value = false;
  document.body.style.cursor = "";
}

function onKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 40 : 10;
  const grow = props.side === "left" ? "ArrowRight" : "ArrowLeft";
  const shrink = props.side === "left" ? "ArrowLeft" : "ArrowRight";
  if (e.key === grow) emit("update:width", clamp(props.width + step));
  else if (e.key === shrink) emit("update:width", clamp(props.width - step));
  else return;
  e.preventDefault();
}

onBeforeUnmount(() => (document.body.style.cursor = ""));
</script>

<template>
  <div
    class="resizer"
    :class="{ active, highlighted }"
    role="separator"
    aria-orientation="vertical"
    :aria-valuenow="width"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-label="side === 'left' ? t('resizer.leftWidth') : t('resizer.rightWidth')"
    tabindex="0"
    :title="t('resizer.title')"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="emit('update:width', defaultWidth)"
    @keydown="onKey"
  ></div>
</template>

<style scoped>
/* Like the sash of Visual Studio Code: the colour fills the whole space between the two columns. */
.resizer {
  width: var(--pane-gap); flex-shrink: 0; position: relative; z-index: 6; cursor: col-resize;
  touch-action: none; background: transparent; transition: background 0.15s;
}
.resizer:hover, .resizer.active, .resizer.highlighted, .resizer:focus-visible { background: var(--done); }
.resizer:focus-visible { outline: none; }
</style>
