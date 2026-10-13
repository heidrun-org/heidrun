<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { addAction, suggestions } from "../stores/project";
import { closeImportScriptsModal } from "../stores/importScripts";
import { state } from "../stores/session";
import { t } from "../i18n/index";

/** The commands of the scripts that the person ticked. */
const chosen = ref<string[]>([]);
const canImport = computed(() => chosen.value.length > 0);

/** Ticks every script, or none when every script is already ticked. */
function toggleAll() {
  chosen.value = chosen.value.length === suggestions.value.length ? [] : suggestions.value.map((item) => item.command);
}

/** Adds each ticked script to the scripts of the project, then closes the window. */
async function importChosen() {
  const workspaceId = state.selectedWorkspaceId;
  if (canImport.value === false || workspaceId === null || workspaceId === undefined) {
    return;
  }
  for (const detected of suggestions.value.filter((item) => chosen.value.includes(item.command))) {
    await addAction(workspaceId, detected.label, detected.command, undefined, undefined, detected.description);
  }
  closeImportScriptsModal();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeImportScriptsModal();
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeImportScriptsModal()">
    <form class="window-box" role="dialog" :aria-label="t('importScriptsModal.title')" @submit.prevent="importChosen">
      <header>
        <h2>{{ t("importScriptsModal.title") }}</h2>
        <button type="button" :title="t('importScriptsModal.closeTitle')" class="close" :aria-label="t('importScriptsModal.closeTitle')" @click="closeImportScriptsModal()"><Icon name="x-lg" /></button>
      </header>

      <p v-if="suggestions.length === 0" class="empty">{{ t("importScriptsModal.empty") }}</p>
      <div v-else class="list-group list-group-flush list">
        <label v-for="detected in suggestions" :key="detected.command" class="list-group-item d-flex align-items-center gap-2" :title="detected.command">
          <span class="switch"><input v-model="chosen" type="checkbox" role="switch" :value="detected.command" /></span>
          <span class="name flex-fill">{{ detected.label }}</span>
          <span v-if="detected.command !== detected.label" class="command mono">{{ detected.command }}</span>
          <span class="badge theme-secondary">{{ detected.source }}</span>
        </label>
      </div>

      <footer class="d-flex align-items-center gap-2">
        <button v-if="suggestions.length > 0" class="btn me-auto" type="button" @click="toggleAll()">
          {{ t(chosen.length === suggestions.length ? "importScriptsModal.selectNone" : "importScriptsModal.selectAll") }}
        </button>
        <button class="btn" type="button" @click="closeImportScriptsModal()">{{ t("importScriptsModal.cancel") }}</button>
        <button class="btn primary" type="submit" :disabled="canImport === false">{{ t("importScriptsModal.import", { count: chosen.length }) }}</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
:where(button:not(.btn)) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 57; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 32px; }
.window-box {
  width: min(520px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
h2 { flex: 1; margin: 0; font-size: var(--font-size); font-weight: 600; }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: calc(var(--font-size) * 1.5); }
.close:hover { background: var(--hover); color: var(--text); }
.list { overflow-y: auto; min-height: 0; }
.list-group-item { padding: 12px 16px; cursor: pointer; border-color: var(--line); }
.list-group-item:hover { background: var(--hover-soft); }
.name { min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.command { min-width: 0; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.empty { margin: 0; padding: 16px; color: var(--muted); }
footer { padding: 10px 16px; border-top: 1px solid var(--line); }
.btn:disabled { opacity: 0.5; cursor: default; }
</style>
