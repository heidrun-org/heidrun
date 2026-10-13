<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { addAction, currentProject, scriptKey, suggestions, withoutImportedScripts, type Detected } from "../stores/project";
import { closeImportScriptsModal } from "../stores/importScripts";
import { state, toast } from "../stores/session";
import { pathInsideRoot } from "../lib/path_inside_root";
import { t } from "../i18n/index";

/** The keys (command and folder) of the scripts that the person ticked. */
const chosen = ref<string[]>([]);
const canImport = computed(() => chosen.value.length > 0);

/** The scripts of the package.json that the person picked, or `null` while the person has picked none. */
const pickedScripts = ref<Detected[] | null>(null);
/** The path of the package.json that the person picked, relative to the root of the repository. */
const pickedPath = ref<string | null>(null);

/** The scripts that the window lists: the scripts of the picked package.json, else the scripts that the project has. */
const shown = computed(() => (pickedScripts.value === null ? suggestions.value : withoutImportedScripts(pickedScripts.value)));

/** Opens the native file picker on the repository, then lists the scripts of the package.json that the person picks. */
async function choosePackageJson() {
  const root = currentProject.value?.root;
  if (root === undefined) {
    return;
  }
  const path = await openDialog({
    directory: false,
    multiple: false,
    title: t("importScriptsModal.choosePackageJson"),
    defaultPath: root,
    filters: [{ name: "package.json", extensions: ["json"] }],
  });
  if (path === null) {
    return;
  }
  const relativePath = pathInsideRoot(root, path);
  if (relativePath === null) {
    toast(t("importScriptsModal.outsideRepository"));
    return;
  }
  if (relativePath.split("/").pop() !== "package.json") {
    toast(t("importScriptsModal.notPackageJson"));
    return;
  }
  try {
    pickedScripts.value = await invoke<Detected[]>("project_package_scripts", { root, packageJson: path });
  } catch (e) {
    toast(String(e instanceof Error ? e.message : e));
    return;
  }
  pickedPath.value = relativePath;
  chosen.value = [];
}

/** Goes back to the scripts that the project has, and forgets the picked package.json. */
function backToProject() {
  pickedScripts.value = null;
  pickedPath.value = null;
  chosen.value = [];
}

/** Ticks every script, or none when every script is already ticked. */
function toggleAll() {
  chosen.value = chosen.value.length === shown.value.length ? [] : shown.value.map(scriptKey);
}

/** Adds each ticked script to the scripts of the project, then closes the window. */
async function importChosen() {
  const workspaceId = state.selectedWorkspaceId;
  if (canImport.value === false || workspaceId === null || workspaceId === undefined) {
    return;
  }
  for (const detected of shown.value.filter((item) => chosen.value.includes(scriptKey(item)))) {
    await addAction(workspaceId, detected.label, detected.command, undefined, detected.cwd, detected.description);
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

      <div class="source d-flex align-items-center gap-2">
        <button class="btn" type="button" @click="choosePackageJson()"><Icon name="folder2-open" /> {{ t("importScriptsModal.choosePackageJson") }}</button>
        <template v-if="pickedPath !== null">
          <span class="picked mono flex-fill" :title="pickedPath">{{ pickedPath }}</span>
          <button class="btn" type="button" @click="backToProject()">{{ t("importScriptsModal.backToProject") }}</button>
        </template>
      </div>

      <p v-if="shown.length === 0" class="empty">{{ t(pickedPath === null ? "importScriptsModal.empty" : "importScriptsModal.emptyPicked") }}</p>
      <div v-else class="list-group list-group-flush list">
        <label v-for="detected in shown" :key="scriptKey(detected)" class="list-group-item d-flex align-items-center gap-2" :title="detected.command">
          <span class="switch"><input v-model="chosen" type="checkbox" role="switch" :value="scriptKey(detected)" /></span>
          <span class="name flex-fill">{{ detected.label }}</span>
          <span v-if="detected.command !== detected.label" class="command mono">{{ detected.command }}</span>
          <span class="badge theme-secondary">{{ detected.source }}</span>
        </label>
      </div>

      <footer class="d-flex align-items-center gap-2">
        <button v-if="shown.length > 0" class="btn me-auto" type="button" @click="toggleAll()">
          {{ t(chosen.length === shown.length ? "importScriptsModal.selectNone" : "importScriptsModal.selectAll") }}
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
.source { padding: 10px 16px; border-bottom: 1px solid var(--line); }
.picked { min-width: 0; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list { overflow-y: auto; min-height: 0; }
.list-group-item { padding: 12px 16px; cursor: pointer; border-color: var(--line); }
.list-group-item:hover { background: var(--hover-soft); }
.name { min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.command { min-width: 0; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.empty { margin: 0; padding: 16px; color: var(--muted); }
footer { padding: 10px 16px; border-top: 1px solid var(--line); }
.btn:disabled { opacity: 0.5; cursor: default; }
</style>
