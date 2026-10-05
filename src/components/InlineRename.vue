<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

// Text field that replaces a label while it is being renamed.
// Enter or leaving the field saves, Esc cancels.
const props = defineProps<{ value: string; label: string }>();
const emit = defineEmits<{ save: [value: string]; cancel: [] }>();

const text = ref(props.value);
const input = ref<HTMLInputElement>();
let done = false;

function save() {
  if (done) return;
  done = true;
  const v = text.value.trim();
  if (v && v !== props.value) emit("save", v);
  else emit("cancel");
}

function cancel() {
  if (done) return;
  done = true;
  emit("cancel");
}

onMounted(() =>
  nextTick(() => {
    input.value?.focus();
    input.value?.select();
  }),
);
</script>

<template>
  <input
    ref="input"
    v-model="text"
    class="rename"
    :aria-label="props.label"
    spellcheck="false"
    autocomplete="off"
    @keydown.enter.prevent="save"
    @keydown.esc.prevent="cancel"
    @keydown.stop
    @blur="save"
    @click.stop
    @mousedown.stop
  />
</template>

<style scoped>
.rename {
  min-width: 80px; width: 100%; height: 26px; padding: 0 8px; border-radius: 6px;
  border: 1px solid #3a5a80; background: var(--bg); color: var(--text); font: 500 13px var(--sans); outline: none;
}
</style>
