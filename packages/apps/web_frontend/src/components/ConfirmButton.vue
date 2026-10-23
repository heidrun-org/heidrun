<script setup lang="ts">
import Icon from "./Icon.vue";
import { askConfirm } from "../stores/confirm";

// Button for destructive actions: a click opens a confirmation modal dialog, and the action runs only after the
// user confirms in that dialog. Closing a pane ends the process running in it, so it is worth a question.
// When `isConfirmRequired` is false, a click runs the action at once, without the confirmation modal dialog.
const props = withDefaults(
  defineProps<{ label?: string; icon?: string; confirmLabel: string; question: string; isConfirmRequired?: boolean }>(),
  { isConfirmRequired: true },
);
const emit = defineEmits<{ confirm: [] }>();

async function click(e: MouseEvent) {
  e.stopPropagation();
  if (props.isConfirmRequired === false || (await askConfirm(props.question, props.confirmLabel))) {
    emit("confirm");
  }
}
</script>

<template>
  <button class="btn small confirm" :class="{ icon: props.label === undefined }" :aria-label="props.question" :title="props.question" @mousedown.stop @click="click">
    <Icon v-if="props.icon" :name="props.icon" />
    <template v-if="props.label">{{ props.label }}</template>
  </button>
</template>

<style scoped>
.confirm { min-width: 22px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; gap: 6px; }
</style>
