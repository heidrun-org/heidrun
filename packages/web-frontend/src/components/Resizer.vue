<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

// Vertical drag handle between two columns. `side` says which column it resizes:
// "left" grows when dragged right, "right" grows when dragged left.
const props = defineProps<{ side: "left" | "right"; width: number; min: number; max: number; defaultWidth: number; reserve?: number }>();
const emit = defineEmits<{ "update:width": [value: number] }>();

const active = ref(false);
let startX = 0;
let startW = 0;

function clamp(w: number) {
  // Never squeeze the centre below 420 px, whatever the window size.
  const roomLeft = window.innerWidth - 420 - (props.reserve ?? 0);
  return Math.round(Math.min(props.max, roomLeft, Math.max(props.min, w)));
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
    :class="{ active }"
    role="separator"
    aria-orientation="vertical"
    :aria-valuenow="width"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-label="side === 'left' ? 'Largeur de la barre de gauche' : 'Largeur du panneau de droite'"
    tabindex="0"
    title="Glisser pour redimensionner · double-clic pour revenir à la taille par défaut"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="emit('update:width', defaultWidth)"
    @keydown="onKey"
  ></div>
</template>

<style scoped>
.resizer {
  width: 7px; margin: 0 -3px; flex-shrink: 0; position: relative; z-index: 6; cursor: col-resize;
  touch-action: none;
}
.resizer::after {
  content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 1px; background: transparent;
  transition: background 0.15s;
}
.resizer:hover::after, .resizer.active::after, .resizer:focus-visible::after { background: var(--done); width: 2px; left: 2.5px; }
.resizer:focus-visible { outline: none; }
</style>
