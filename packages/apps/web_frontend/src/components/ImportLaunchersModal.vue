<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { addLauncher, currentProject, launcherKey, suggestions, withoutImportedLaunchers, type Detected } from "../stores/project";
import { closeImportLaunchersModal } from "../stores/importLaunchers";
import { state, toast } from "../stores/session";
import { pathInsideRoot } from "../lib/path_inside_root";
import { t } from "../i18n/index";

/** The keys (command and folder) of the launchers that the person ticked. */
const chosen = ref<string[]>([]);
const canImport = computed(() => chosen.value.length > 0);

/** The commands of the package.json that the person picked, or `null` while the person has picked none. */
const pickedCommands = ref<Detected[] | null>(null);
/** The path of the package.json that the person picked, relative to the root of the repository. */
const pickedPath = ref<string | null>(null);

/** The launchers that the window lists: the commands of the picked package.json, else the commands that the project suggests. */
const shown = computed(() => (pickedCommands.value === null ? suggestions.value : withoutImportedLaunchers(pickedCommands.value)));

/** Opens the native file picker on the repository, then lists the commands of the package.json that the person picks. */
async function choosePackageJson() {
  const root = currentProject.value?.root;
  if (root === undefined) {
    return;
  }
  const path = await openDialog({
    directory: false,
    multiple: false,
    title: t("importLaunchersModal.choosePackageJson"),
    defaultPath: root,
    filters: [{ name: "package.json", extensions: ["json"] }],
  });
  if (path === null) {
    return;
  }
  const relativePath = pathInsideRoot(root, path);
  if (relativePath === null) {
    toast(t("importLaunchersModal.outsideRepository"));
    return;
  }
  if (relativePath.split("/").pop() !== "package.json") {
    toast(t("importLaunchersModal.notPackageJson"));
    return;
  }
  try {
    pickedCommands.value = await invoke<Detected[]>("project_package_scripts", { root, packageJson: path });
  } catch (e) {
    toast(String(e instanceof Error ? e.message : e));
    return;
  }
  pickedPath.value = relativePath;
  chosen.value = [];
}

/** Goes back to the commands that the project suggests, and forgets the picked package.json. */
function backToProject() {
  pickedCommands.value = null;
  pickedPath.value = null;
  chosen.value = [];
}

/** Ticks every launcher, or none when every launcher is already ticked. */
function toggleAll() {
  chosen.value = chosen.value.length === shown.value.length ? [] : shown.value.map(launcherKey);
}

/** Adds each ticked launcher to the launchers of the project, then closes the window. */
async function importChosen() {
  const workspaceId = state.selectedWorkspaceId;
  if (canImport.value === false || workspaceId === null || workspaceId === undefined) {
    return;
  }
  for (const detected of shown.value.filter((item) => chosen.value.includes(launcherKey(item)))) {
    await addLauncher(workspaceId, detected.label, detected.command, undefined, detected.cwd, detected.description);
  }
  closeImportLaunchersModal();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeImportLaunchersModal();
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeImportLaunchersModal()">
    <form class="window-box" role="dialog" :aria-label="t('importLaunchersModal.title')" @submit.prevent="importChosen">
      <header>
        <h2>{{ t("importLaunchersModal.title") }}</h2>
        <button type="button" :title="t('importLaunchersModal.closeTitle')" class="close" :aria-label="t('importLaunchersModal.closeTitle')" @click="closeImportLaunchersModal()"><Icon name="x-lg" /></button>
      </header>

      <div class="source d-flex align-items-center gap-2">
        <button class="btn" type="button" @click="choosePackageJson()"><Icon name="folder2-open" /> {{ t("importLaunchersModal.choosePackageJson") }}</button>
        <template v-if="pickedPath !== null">
          <span class="picked mono flex-fill" :title="pickedPath">{{ pickedPath }}</span>
          <button class="btn" type="button" @click="backToProject()">{{ t("importLaunchersModal.backToProject") }}</button>
        </template>
      </div>

      <p v-if="shown.length === 0" class="empty">{{ t(pickedPath === null ? "importLaunchersModal.empty" : "importLaunchersModal.emptyPicked") }}</p>
      <div v-else class="list-group list-group-flush list">
        <label v-for="detected in shown" :key="launcherKey(detected)" class="list-group-item d-flex align-items-center gap-2" :title="detected.command">
          <span class="switch"><input v-model="chosen" type="checkbox" role="switch" :value="launcherKey(detected)" /></span>
          <span class="name flex-fill">{{ detected.label }}</span>
          <span v-if="detected.command !== detected.label" class="command mono">{{ detected.command }}</span>
          <span class="badge theme-secondary">{{ detected.source }}</span>
        </label>
      </div>

      <footer class="d-flex align-items-center gap-2">
        <button v-if="shown.length > 0" class="btn me-auto" type="button" @click="toggleAll()">
          {{ t(chosen.length === shown.length ? "importLaunchersModal.selectNone" : "importLaunchersModal.selectAll") }}
        </button>
        <button class="btn" type="button" @click="closeImportLaunchersModal()">{{ t("importLaunchersModal.cancel") }}</button>
        <button class="btn primary" type="submit" :disabled="canImport === false">{{ t("importLaunchersModal.import", { count: chosen.length }) }}</button>
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
