<script setup lang="ts">
// The Files sidebar section of the left sidebar: the whole folder tree of the Git repository of the selected
// workspace. A click on a folder folds or unfolds it. A click on a file opens it in the large Git window. The section
// only reads files: it has no button to create, rename, move, delete, or edit a file.
// - issue #349
import { computed, watch } from "vue";
import Icon from "./Icon.vue";
import { currentGit, git, openGitModal } from "../stores/git";
import { buildTree, files, loadFiles, visibleRows, type TreeRow } from "../stores/files";
import { state } from "../stores/session";
import { fileIconName } from "../lib/chat_files";
import { t } from "../i18n/index";

const tree = computed(() => buildTree(files.list));
const rows = computed(() => visibleRows(tree.value, files.expanded, files.status));

/** The file that the large Git window shows, when the window is open. */
const openedPath = computed(() => (git.modal.open ? git.modal.path : null));

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
  if (row.dir) {
    toggleFolder(row);
    return;
  }
  openGitModal(row.path);
}

/** The icon of a row: a folder, or the kind of the file. */
function rowIcon(row: TreeRow): string {
  if (row.dir) {
    return files.expanded.has(row.path) ? "chevron-down" : "chevron-right";
  }
  return fileIconName(row.name);
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
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("filesPanel.title") }}</span>
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
      </header>
      <div v-if="files.error !== ''" class="error">{{ files.error }}</div>
      <ul v-else class="rows">
        <li v-for="row in rows" :key="row.path + (row.dir ? '/' : '')">
          <button
            type="button"
            class="row btn d-flex align-items-center gap-2 w-100 text-start"
            :class="{ opened: row.path === openedPath, ignored: row.ignored }"
            :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
            :title="row.path"
            :aria-expanded="row.dir && row.ignored === false ? files.expanded.has(row.path) : undefined"
            @click="chooseRow(row)"
          >
            <Icon :name="rowIcon(row)" />
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
.files-panel { flex: 1; min-height: 0; padding: 12px 8px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.title { font-weight: 600; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.files-panel :deep(.icon-button) { height: 22px; padding: 0 5px; color: var(--muted); border: none; }
.files-panel :deep(.icon-button:hover:not(:disabled)) { background: var(--hover); color: var(--text); }
.rows { list-style: none; margin: 0; padding: 0; }
.row { height: 24px; padding-top: 0; padding-bottom: 0; padding-right: 8px; border: none; border-radius: 5px; color: var(--text); font-size: var(--font-size); white-space: nowrap; }
.row:hover { background: var(--hover-soft); }
.row.opened { background: var(--hover); }
.row.ignored { color: var(--muted); }
.name { overflow: hidden; text-overflow: ellipsis; }
.letter { width: 18px; flex-shrink: 0; text-align: center; font: 600 var(--font-size) var(--mono); }
.letter.modified { color: var(--accent); }
.letter.added { color: var(--ok); }
.letter.deleted { color: var(--blocked); }
.letter.renamed { color: var(--done); }
.error { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); padding: 0 8px; }
</style>
