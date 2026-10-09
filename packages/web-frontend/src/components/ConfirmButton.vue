<script setup lang="ts">
import Icon from "./Icon.vue";
import { askConfirm } from "../stores/confirm";

// Button for destructive actions: a click opens a confirmation modal dialog, and the action runs only after the
// user confirms in that dialog. Closing a pane ends the process running in it, so it is worth a question.
const props = defineProps<{ label?: string; icon?: string; confirmLabel: string; question: string }>();
const emit = defineEmits<{ confirm: [] }>();

async function click(e: MouseEvent) {
  e.stopPropagation();
  if (await askConfirm(props.question, props.confirmLabel)) {
    emit("confirm");
  }
}
</script>

<template>
  <button class="confirm" :aria-label="props.question" :title="props.question" @mousedown.stop @click="click">
    <Icon v-if="props.icon" :name="props.icon" />
    <template v-else>{{ props.label }}</template>
  </button>
</template>

<style scoped>
.confirm {
  border: none; background: transparent; color: var(--muted); border-radius: 6px;
  min-width: 22px; height: 22px; padding: 0 6px; font-size: 13px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;
}
.confirm:hover { background: var(--hover); color: var(--text); }
</style>
