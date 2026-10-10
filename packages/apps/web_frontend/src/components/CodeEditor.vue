<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Editor } from "../lib/editor";
import { codeIsDark } from "../stores/theme";

const props = defineProps<{ path: string; text: string; wrap: boolean; line?: number | null }>();
const emit = defineEmits<{ change: [text: string]; save: [] }>();
const host = ref<HTMLElement>();
let ed: Editor | null = null;
let alive = true;

onMounted(async () => {
  // CodeMirror is only loaded the first time a file is edited.
  const { createEditor } = await import("../lib/editor");
  if (!alive || !host.value) return;
  ed = await createEditor(host.value, {
    text: props.text,
    path: props.path,
    wrap: props.wrap,
    dark: codeIsDark.value,
    onChange: (t) => emit("change", t),
    onSave: () => emit("save"),
  });
  if (props.line) ed.goToLine(props.line);
  ed.focus();
});
onBeforeUnmount(() => {
  alive = false;
  ed?.destroy();
});
watch(
  () => props.wrap,
  (w) => ed?.setWrap(w),
);
watch(codeIsDark, (dark) => ed?.setDark(dark));
// Reloaded from the disk (or "recharger"): replace the content, not while typing.
watch(
  () => props.text,
  (t) => {
    if (ed && ed.getText() !== t) ed.replaceKeepingCursor(t);
  },
);
watch(
  () => props.line,
  (l) => l && ed?.goToLine(l),
);
defineExpose({ focus: () => ed?.focus() });
</script>

<template>
  <div ref="host" class="editor"></div>
</template>

<style scoped>
.editor { height: 100%; min-height: 0; }
.editor :deep(.cm-editor) { height: 100%; outline: none; }
</style>
