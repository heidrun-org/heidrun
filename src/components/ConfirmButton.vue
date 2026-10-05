<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

// Two-step button for destructive actions: the first click arms it, the second confirms.
// Closing a pane ends the process running in it, so it is worth one extra click.
const props = defineProps<{ label: string; armedLabel?: string; ariaLabel?: string }>();
const emit = defineEmits<{ confirm: [] }>();

const armed = ref(false);
let timer: number | undefined;

function click(e: MouseEvent) {
  e.stopPropagation();
  if (armed.value) {
    window.clearTimeout(timer);
    armed.value = false;
    emit("confirm");
    return;
  }
  armed.value = true;
  timer = window.setTimeout(() => (armed.value = false), 2500);
}

onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <button
    class="confirm"
    :class="{ armed }"
    :aria-label="armed ? `Confirmer : ${props.ariaLabel ?? props.label}` : props.ariaLabel"
    :title="armed ? 'Cliquer encore pour confirmer' : props.ariaLabel"
    @mousedown.stop
    @click="click"
  >
    {{ armed ? props.armedLabel ?? "Fermer ?" : props.label }}
  </button>
</template>

<style scoped>
.confirm {
  border: none; background: transparent; color: var(--muted); border-radius: 6px;
  min-width: 22px; height: 22px; padding: 0 6px; font-size: 13px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;
}
.confirm:hover { background: var(--hover); color: var(--text); }
.confirm.armed { background: #3a1d1d; color: var(--fail); font-size: 11px; font-weight: 600; }
</style>
