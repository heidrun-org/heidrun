<script setup lang="ts">
import Icon from "./Icon.vue";
import { nextTick, onBeforeUnmount, ref } from "vue";
import { insertText } from "../stores/session";
import { projectPrompts, promptEditor, prompts, resolvePrompt, type PromptTemplate } from "../stores/prompts";
import { t } from "../i18n/index";

const props = defineProps<{ paneId: string }>();

const open = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const position = ref({ top: 0, right: 0 });

// The menu is placed with the viewport, so the pane around it cannot cut it.
function toggle() {
  if (open.value) {
    close();
    return;
  }
  const rect = button.value!.getBoundingClientRect();
  position.value = { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) };
  open.value = true;
  nextTick(() => {
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

function close() {
  open.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (menu.value?.contains(target) === true || button.value?.contains(target) === true) {
    return;
  }
  close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
  }
}

// A click writes the text; a Shift+click writes it and presses Enter.
async function useTemplate(template: PromptTemplate, event: MouseEvent) {
  close();
  const text = await resolvePrompt(template.text, props.paneId);
  await insertText(props.paneId, text, event.shiftKey);
}

function edit() {
  close();
  promptEditor.open = true;
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="button"
    class="tool"
    :class="{ on: open }"
    :aria-expanded="open"
    :aria-label="t('promptMenu.label')"
    :title="t('promptMenu.title')"
    @mousedown.stop
    @click="toggle"
  >
    <Icon name="chat-square-text" />
  </button>
  <Teleport to="body">
    <div v-if="open" ref="menu" class="menu" role="menu" :style="{ top: `${position.top}px`, right: `${position.right}px` }" @mousedown.stop>
      <template v-for="group in [{ id: 'project', title: t('promptMenu.project'), items: projectPrompts }, { id: 'personal', title: t('promptMenu.personal'), items: prompts.personal }]" :key="group.id">
        <template v-if="group.items.length > 0">
          <div v-if="projectPrompts.length > 0" class="group">{{ group.title }}</div>
          <button v-for="template in group.items" :key="group.id + template.id" type="button" class="item" role="menuitem" :title="template.text" @click="useTemplate(template, $event)">
            <span class="label">{{ template.label }}</span>
            <span v-if="template.description !== ''" class="description">{{ template.description }}</span>
          </button>
        </template>
      </template>
      <div class="separator"></div>
      <button type="button" class="item edit" role="menuitem" @click="edit">
        <Icon name="pencil" /> {{ t("promptMenu.edit") }}
      </button>
      <div class="separator"></div>
      <div class="hint">{{ t("promptMenu.hint") }}</div>
    </div>
  </Teleport>
</template>

<style scoped>
.tool {
  width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover, .tool.on { background: var(--hover); color: var(--text); }
.menu {
  position: fixed; z-index: 50; width: min(320px, calc(100vw - 16px)); max-height: 70vh; overflow-y: auto; padding: 6px;
  border-radius: 12px; border: 1px solid var(--line-modal); background: var(--field);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55); display: flex; flex-direction: column; gap: 2px;
}
.group { font-size: var(--font-size); font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--muted); margin: 6px 8px 2px; }
.item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; border: none;
  background: transparent; color: var(--text); padding: 7px 9px; border-radius: 7px; font-size: var(--font-size);
}
.item:hover { background: var(--hover); }
.label { font-weight: 500; }
.description { font-size: var(--font-size); color: var(--muted); }
.edit { flex-direction: row; align-items: center; gap: 6px; color: var(--done); }
.separator { border-top: 1px solid var(--line); margin: 4px 0; }
.hint { padding: 4px 9px 6px; font-size: var(--font-size); color: var(--faint); }
</style>
