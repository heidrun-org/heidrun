<script setup lang="ts">
import Icon from "./Icon.vue";
import { nextTick, onBeforeUnmount, ref } from "vue";
import { insertText } from "../stores/session";
import { macroEditor, macros, projectMacros, resolveMacroVariables, type Macro } from "../stores/macros";
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
async function useMacro(macro: Macro, event: MouseEvent) {
  close();
  const text = await resolveMacroVariables(macro.text, props.paneId);
  await insertText(props.paneId, text, event.shiftKey);
}

function edit() {
  close();
  macroEditor.open = true;
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="button"
    class="tool"
    :class="{ on: open }"
    :aria-expanded="open"
    :aria-label="t('macroMenu.label')"
    :title="t('macroMenu.title')"
    @mousedown.stop
    @click="toggle"
  >
    <Icon name="chat-square-text" />
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menu"
      class="dropdown-menu show position-fixed overflow-y-auto"
      role="menu"
      :style="{ top: `${position.top}px`, right: `${position.right}px`, width: 'min(320px, calc(100vw - 16px))', maxHeight: '70vh' }"
      @mousedown.stop
    >
      <template v-for="group in [{ id: 'project', title: t('macroMenu.project'), items: projectMacros }, { id: 'personal', title: t('macroMenu.personal'), items: macros.personal }]" :key="group.id">
        <template v-if="group.items.length > 0">
          <div v-if="projectMacros.length > 0" class="dropdown-header">{{ group.title }}</div>
          <button v-for="macro in group.items" :key="group.id + macro.id" type="button" class="dropdown-item text-wrap" role="menuitem" :title="macro.text" @click="useMacro(macro, $event)">
            <span class="d-block fw-medium">{{ macro.label }}</span>
            <span v-if="macro.description !== ''" class="d-block text-body-secondary">{{ macro.description }}</span>
          </button>
        </template>
      </template>
      <div class="dropdown-divider" role="separator"></div>
      <button type="button" class="dropdown-item d-flex align-items-center gap-2 text-primary-emphasis" role="menuitem" @click="edit">
        <Icon name="pencil" /> {{ t("macroMenu.edit") }}
      </button>
      <div class="dropdown-divider" role="separator"></div>
      <div class="dropdown-item-text text-body-secondary">{{ t("macroMenu.hint") }}</div>
    </div>
  </Teleport>
</template>

<style scoped>
.tool {
  width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover, .tool.on { background: var(--hover); color: var(--text); }
</style>
