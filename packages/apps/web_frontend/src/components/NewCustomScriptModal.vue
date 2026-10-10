<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { addAction } from "../stores/project";
import { closeNewCustomScriptModal } from "../stores/newCustomScript";
import { state } from "../stores/session";
import { t } from "../i18n/index";

const nameField = ref<HTMLInputElement>();
const name = ref("");
const command = ref("");
const canCreate = computed(() => command.value.trim() !== "");

async function create() {
  const workspaceId = state.selectedWorkspaceId;
  if (canCreate.value === false || workspaceId === null || workspaceId === undefined) {
    return;
  }
  await addAction(workspaceId, name.value, command.value);
  closeNewCustomScriptModal();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeNewCustomScriptModal();
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => nameField.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeNewCustomScriptModal()">
    <form class="modal" role="dialog" :aria-label="t('newCustomScriptModal.dialogLabel')" @submit.prevent="create">
      <header>
        <h2>{{ t("newCustomScriptModal.title") }}</h2>
        <button type="button" :title="t('newCustomScriptModal.closeTitle')" class="close" :aria-label="t('newCustomScriptModal.closeLabel')" @click="closeNewCustomScriptModal()"><Icon name="x-lg" /></button>
      </header>

      <div class="content">
        <label class="sr" for="new-script-name">{{ t("newCustomScriptModal.nameOptional") }}</label>
        <input id="new-script-name" ref="nameField" v-model="name" :placeholder="t('newCustomScriptModal.nameOptional')" spellcheck="false" />
        <label class="sr" for="new-script-command">{{ t("newCustomScriptModal.command") }}</label>
        <textarea
          id="new-script-command"
          v-model="command"
          class="mono"
          rows="5"
          placeholder="make dev"
          spellcheck="false"
          @keydown.meta.enter.prevent="create"
          @keydown.ctrl.enter.prevent="create"
        ></textarea>
        <div class="row">
          <button :title="t('newCustomScriptModal.cancelTitle')" class="btn" type="button" @click="closeNewCustomScriptModal()">{{ t("newCustomScriptModal.cancel") }}</button>
          <button :title="t('newCustomScriptModal.createTitle')" class="btn primary" type="submit" :disabled="canCreate === false">{{ t("newCustomScriptModal.create") }}</button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 57; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 32px; }
.modal {
  width: min(520px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
h2 { flex: 1; margin: 0; font-size: var(--font-size); font-weight: 600; }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: calc(var(--font-size) * 1.5); }
.close:hover { background: var(--hover); color: var(--text); }
.content { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.content input, .content textarea {
  padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--bg);
  outline: none; font-size: var(--font-size);
}
.content input { height: 32px; }
.content textarea { padding: 8px 10px; resize: vertical; min-height: 96px; font: inherit; font-family: var(--mono); }
.row { display: flex; justify-content: flex-end; gap: 6px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
