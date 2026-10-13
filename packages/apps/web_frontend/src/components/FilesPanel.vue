<script setup lang="ts">
// The Files sidebar section of the left sidebar: the whole folder tree of the Git repository of the selected
// workspace. A click on a folder folds or unfolds it. A click on a file opens it in the large Git window. The only
// changes that the section makes are a new empty file and a new empty folder. It has no button to rename, move,
// delete, or edit a file.
// - issue #349
import { computed, nextTick, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import Icon from "./Icon.vue";
import SourceControlMenu from "./SourceControlMenu.vue";
import { currentGit, openGitModal } from "../stores/git";
import { buildTree, files, filesPanelSelection, loadFiles, visibleRows, type TreeRow } from "../stores/files";
import { state, toast } from "../stores/session";
import { settings } from "../stores/settings";
import { fileIconName } from "../lib/chat_files";
import { t } from "../i18n/index";

const tree = computed(() => buildTree(files.list));
const rows = computed(() => visibleRows(tree.value, files.expanded, files.status));

/** The width in pixels that each level of a folder adds at the left of a row, for each choice of the menu. */
const INDENT_WIDTHS = { small: 12, medium: 20, large: 28 } as const;

/** The height in pixels of a row, for each choice of the menu. */
const ROW_HEIGHTS = { compact: 24, comfortable: 30 } as const;

const indentWidth = computed(() => INDENT_WIDTHS[settings.filesPanelIndent]);
const rowHeight = computed(() => ROW_HEIGHTS[settings.filesPanelRowHeight]);

/** The mark that the menu puts before the choice that is on. */
function mark(isOn: boolean): string {
  return isOn ? "✓ " : "\u2003";
}

/** The items of the menu of the three dots: the indentation, the row height, and the indent guides. */
const menuItems = computed(() => [
  { id: "indentTitle", label: t("filesPanel.menu.indent"), isDisabled: true },
  ...(["small", "medium", "large"] as const).map((choice) => ({
    id: `indent:${choice}`,
    label: mark(settings.filesPanelIndent === choice) + t(`filesPanel.menu.indent.${choice}`),
  })),
  { id: "rowHeightTitle", label: t("filesPanel.menu.rowHeight"), isDisabled: true },
  ...(["compact", "comfortable"] as const).map((choice) => ({
    id: `rowHeight:${choice}`,
    label: mark(settings.filesPanelRowHeight === choice) + t(`filesPanel.menu.rowHeight.${choice}`),
  })),
  { id: "guidesTitle", label: t("filesPanel.menu.guides"), isDisabled: true },
  { id: "guides:on", label: mark(settings.filesPanelIndentGuides) + t("filesPanel.menu.guides.on") },
  { id: "guides:off", label: mark(settings.filesPanelIndentGuides === false) + t("filesPanel.menu.guides.off") },
]);

function chooseMenuItem(id: string) {
  const [name, choice] = id.split(":");
  if (name === "indent") {
    settings.filesPanelIndent = choice as typeof settings.filesPanelIndent;
  } else if (name === "rowHeight") {
    settings.filesPanelRowHeight = choice as typeof settings.filesPanelRowHeight;
  } else if (name === "guides") {
    settings.filesPanelIndentGuides = choice === "on";
  }
}

// The tree is read again when the repository changes, and when the number of changed files changes.
watch(
  () => [currentGit.value?.root, currentGit.value?.changed, currentGit.value?.untracked],
  () => {
    const root = currentGit.value?.root;
    if (root !== undefined) {
      void loadFiles(root);
    }
  },
  { immediate: true },
);

/** The folder that a new file or a new folder goes into: the selected folder, or the folder of the selected file. */
const targetFolder = computed(() => {
  const selected = filesPanelSelection.path;
  if (selected === null) {
    return "";
  }
  if (filesPanelSelection.isFolder) {
    return selected;
  }
  return selected.includes("/") ? selected.slice(0, selected.lastIndexOf("/")) : "";
});

/** The name that the developer is typing for a new file or a new folder, or null when no name is being typed. */
const naming = ref<{ kind: "file" | "dir"; value: string } | null>(null);
const nameInput = ref<HTMLInputElement>();

function startNaming(kind: "file" | "dir") {
  const folder = targetFolder.value;
  if (folder !== "") {
    files.expanded = new Set([...files.expanded, folder]);
  }
  naming.value = { kind, value: folder === "" ? "" : `${folder}/` };
  void nextTick(() => {
    const input = nameInput.value;
    if (input !== undefined) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}

function cancelNaming() {
  naming.value = null;
}

async function submitNaming() {
  const current = naming.value;
  if (current === null) {
    return;
  }
  const path = current.value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (path === "") {
    return;
  }
  try {
    await invoke("file_create", { root: files.root, path, dir: current.kind === "dir" });
  } catch (error) {
    toast(String(error), "error");
    return;
  }
  naming.value = null;
  const parts = path.split("/");
  const folders = new Set(files.expanded);
  for (let index = 1; index < parts.length; index++) {
    folders.add(parts.slice(0, index).join("/"));
  }
  if (current.kind === "dir") {
    folders.add(path);
    filesPanelSelection.path = path;
    filesPanelSelection.isFolder = true;
  }
  files.expanded = folders;
  await loadFiles(files.root);
  if (current.kind === "file") {
    filesPanelSelection.path = path;
    filesPanelSelection.isFolder = false;
    openGitModal(path);
  }
}

function collapseAll() {
  files.expanded = new Set();
}

function refresh() {
  const root = currentGit.value?.root;
  if (root !== undefined) {
    void loadFiles(root);
  }
}

function toggleFolder(row: TreeRow) {
  if (row.ignored) {
    return;
  }
  const expanded = new Set(files.expanded);
  if (expanded.has(row.path)) {
    expanded.delete(row.path);
  } else {
    expanded.add(row.path);
  }
  files.expanded = expanded;
}

function chooseRow(row: TreeRow) {
  filesPanelSelection.path = row.path;
  filesPanelSelection.isFolder = row.dir;
  if (row.dir) {
    toggleFolder(row);
    return;
  }
  openGitModal(row.path);
}

/** The icon of a row: a folder that is closed or open, or the kind of the file. */
function rowIcon(row: TreeRow): string {
  if (row.dir) {
    return files.expanded.has(row.path) ? "folder2-open" : "folder2";
  }
  return fileIconName(row.name);
}

/** The name of the arrow of a folder row. A file row has no arrow, but it keeps the space of the arrow. */
function arrowIcon(row: TreeRow): string | null {
  if (row.dir === false || row.ignored) {
    return null;
  }
  return files.expanded.has(row.path) ? "chevron-down" : "chevron-right";
}

/** The class that gives a status letter its color. */
function letterClass(letter: string): string {
  if (letter === "A" || letter === "?") {
    return "added";
  }
  if (letter === "D") {
    return "deleted";
  }
  if (letter === "R") {
    return "renamed";
  }
  return "modified";
}
</script>

<template>
  <div class="files-panel">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("filesPanel.selectWorkspace") }}</div>
    <template v-else-if="currentGit">
      <header class="panel-header d-flex align-items-center">
        <span class="title me-auto">{{ t("filesPanel.title") }}</span>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('filesPanel.newFile')"
          :title="t('filesPanel.newFile')"
          @click="startNaming('file')"
        >
          <Icon name="file-earmark-plus" />
        </button>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('filesPanel.newFolder')"
          :title="t('filesPanel.newFolder')"
          @click="startNaming('dir')"
        >
          <Icon name="folder-plus" />
        </button>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('filesPanel.refresh')"
          :title="t('filesPanel.refresh')"
          :disabled="files.loading"
          @click="refresh()"
        >
          <Icon name="arrow-clockwise" />
        </button>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('filesPanel.collapseAll')"
          :title="t('filesPanel.collapseAll')"
          @click="collapseAll()"
        >
          <Icon name="dash-square" />
        </button>
        <SourceControlMenu
          button-class="btn btn-sm icon-button"
          icon="three-dots-vertical"
          :label="t('filesPanel.menu.label')"
          :items="menuItems"
          @choose="chooseMenuItem"
        />
      </header>
      <form v-if="naming !== null" class="naming" @submit.prevent="submitNaming">
        <label class="muted" for="files-panel-name">{{ naming.kind === "dir" ? t("filesPanel.newFolder") : t("filesPanel.newFile") }}</label>
        <input
          id="files-panel-name"
          ref="nameInput"
          v-model="naming.value"
          class="form-control form-control-sm"
          spellcheck="false"
          @keydown.esc.prevent="cancelNaming"
        />
        <span class="muted">{{ t("filesPanel.namingHint") }}</span>
      </form>
      <div v-if="files.error !== ''" class="error">{{ files.error }}</div>
      <ul v-else class="rows" :style="{ '--row-height': `${rowHeight}px`, '--indent-width': `${indentWidth}px` }">
        <li v-for="row in rows" :key="row.path + (row.dir ? '/' : '')">
          <button
            type="button"
            class="row btn d-flex align-items-center text-start"
            :class="{ selected: row.path === filesPanelSelection.path, ignored: row.ignored }"
            :title="row.path"
            :aria-expanded="row.dir && row.ignored === false ? files.expanded.has(row.path) : undefined"
            @click="chooseRow(row)"
          >
            <template v-if="settings.filesPanelIndentGuides">
              <span v-for="level in row.depth" :key="level" class="guide"></span>
            </template>
            <span v-else :style="{ width: `${row.depth * indentWidth}px` }" class="flex-shrink-0"></span>
            <span class="arrow">
              <Icon v-if="arrowIcon(row) !== null" :name="arrowIcon(row) ?? ''" />
            </span>
            <Icon :name="rowIcon(row)" class="kind" />
            <span class="name me-auto">{{ row.name }}</span>
            <span v-if="row.status !== null && row.dir" class="letter modified">•</span>
            <span v-else-if="row.status !== null" class="letter" :class="letterClass(row.status)">{{ row.status === "?" ? "U" : row.status }}</span>
          </button>
        </li>
      </ul>
      <div v-if="files.truncated" class="muted">{{ t("filesPanel.truncated") }}</div>
    </template>
    <div v-else class="muted">{{ t("filesPanel.notRepository") }}</div>
  </div>
</template>

<style scoped>
.files-panel { flex: 1; min-height: 0; padding: 0 8px 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
/* The header stays at the top while the rows scroll under it. Its own padding replaces the top padding of the panel, so no row shows above it. */
.panel-header { position: sticky; top: 0; z-index: 2; padding: 12px 0 8px; background: var(--side); }
.title { font-weight: 600; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.files-panel :deep(.icon-button) { height: 22px; padding: 0 5px; color: var(--muted); border: none; }
.files-panel :deep(.icon-button:hover:not(:disabled)) { background: var(--hover); color: var(--text); }
.rows { list-style: none; margin: 0; padding: 0; }
.row { width: 100%; height: var(--row-height); padding: 0 8px; border: none; border-radius: 5px; color: var(--text); font-size: var(--font-size); white-space: nowrap; }
.row:hover { background: var(--hover-soft); }
/* The selected row is darker than a row under the pointer, and has a blue line, as the selected row of VS Code. */
.row.selected { background: var(--line-strong); box-shadow: inset 0 0 0 1px var(--done); }
.row.ignored { color: var(--muted); }
/* One guide for each level: its line sits under the arrow of the folder of that level. */
.guide { position: relative; flex: 0 0 var(--indent-width); align-self: stretch; }
.guide::before { content: ""; position: absolute; left: 7px; top: 0; bottom: 0; border-left: 1px solid var(--line); }
.arrow { flex: 0 0 16px; width: 16px; display: inline-flex; justify-content: center; color: var(--muted); }
.kind { flex: 0 0 auto; margin-right: 6px; color: var(--muted); }
.name { overflow: hidden; text-overflow: ellipsis; }
.letter { width: 18px; flex-shrink: 0; text-align: center; font: 600 var(--font-size) var(--mono); }
.letter.modified { color: var(--accent); }
.letter.added { color: var(--ok); }
.letter.deleted { color: var(--blocked); }
.letter.renamed { color: var(--done); }
.naming { display: flex; flex-direction: column; gap: 4px; padding: 0 8px; }
.error { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); padding: 0 8px; }
</style>
