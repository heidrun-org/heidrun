<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

// Text field that replaces a label while it is being renamed.
// Enter or leaving the field saves, Esc cancels.
const props = defineProps<{ value: string; label: string; allowEmpty?: boolean }>();
const emit = defineEmits<{ save: [value: string]; cancel: [] }>();

const text = ref(props.value);
const input = ref<HTMLInputElement>();
let done = false;

function save() {
  if (done) return;
  done = true;
  const v = text.value.trim();
  if (v && v !== props.value) emit("save", v);
  else if (!v && props.allowEmpty) emit("save", "");
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
    class="form-control rename"
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
.rename { min-width: 80px; width: 100%; height: 26px; }
</style>
