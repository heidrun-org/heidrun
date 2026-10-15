<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import InformationCard from "./InformationCard.vue";
import Icon from "./Icon.vue";
import ScrollingLine from "./ScrollingLine.vue";
import { listedWorktrees, type ChatWorktree } from "../lib/chat_worktrees";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import { openFolderAsWorkspace, toast } from "../stores/session";
import { t } from "../i18n/index";

// The line of the summary of a chat that names the worktrees where the coding agent worked: the first two names, then "+" and
// how many more. The name of a worktree that was removed is followed by a small icon of a circle with a slash (the sign of the
// empty set). Until the program has answered, and when it cannot answer, a name has no icon, because the line does not know
// yet. When the line is clicked, an information card lists every worktree of the chat. A row has three lines: the name of the
// worktree, its current branch, and the path of its folder. Three buttons follow: one opens the folder of the worktree as a
// workspace and selects it, one opens the folder in VS Code, and one opens the folder in the Finder. A button is disabled,
// with a title that says why, when the worktree no longer exists on the disk of this Mac. A line that does not fit shows its
// beginning with an ellipsis, and scrolls to its end while the pointer is over the row.

const props = defineProps<{
  /** The worktrees that the coding agent worked in, each name once. */
  entries: ChatWorktree[];
}>();

/** What the Tauri command `chats_worktrees_branches` answers for one worktree that exists. */
type WorktreeBranch = { folder: string; branch: string | null };

/** The worktrees that the line names, and how many more there are. */
const shown = computed(() => listedWorktrees(props.entries));

/** The folders among the listed worktrees that exist, as the program answered. It is null while the answer is not known. */
const existing = ref<Set<string> | null>(null);

/** The worktrees of the chat that exist, with their branch, by folder. It is null until the card has opened once. */
const details = ref<Map<string, WorktreeBranch> | null>(null);

/** One name of the line: "unknown" until the program answers, then "exists" or "gone". */
const items = computed(() =>
  shown.value.listed.map((worktree) => {
    const state = existing.value === null ? "unknown" : existing.value.has(worktree.folder) ? "exists" : "gone";
    const title = state === "gone" ? t("chatsPanel.worktreeGoneTitle", { name: worktree.name }) : undefined;
    return { worktree, state, title };
  }),
);

/** One row of the card. */
const rows = computed(() =>
  props.entries.map((worktree) => {
    const known = details.value === null ? undefined : details.value.get(worktree.folder);
    const isRemoved = details.value !== null && known === undefined;
    return { worktree, isRemoved, branchText: branchText(isRemoved, known) };
  }),
);

type Row = (typeof rows.value)[number];

/** The second line of a row: the current branch, or why there is none. It is empty until the card has an answer. */
function branchText(isRemoved: boolean, known: WorktreeBranch | undefined): string {
  if (isRemoved) {
    return t("chatsPanel.worktreeRemoved");
  }
  if (known === undefined) {
    return "";
  }
  return known.branch === null ? t("chatsPanel.worktreeDetached") : t("chatsPanel.worktreeBranch", { branch: known.branch });
}

/** The title of a button: what the button does, or why it cannot do it. */
function buttonTitle(row: Row, key: string): string {
  return row.isRemoved ? t("chatsPanel.worktreeMissingTitle") : t(key, { name: row.worktree.name });
}

/** Asks which of the listed worktrees still exist. A failure leaves every name without the icon. */
async function checkWorktrees() {
  existing.value = null;
  const folders = shown.value.listed.map((worktree) => worktree.folder);
  if (folders.length === 0) {
    return;
  }
  try {
    const found = await invoke<string[]>("chats_worktrees_exist", { folders });
    existing.value = new Set(found);
  } catch {
    existing.value = null;
  }
}

/** Asks which worktrees of the chat exist and which branch each one has, each time the card opens. A failure leaves the buttons on. */
async function checkDetails() {
  const folders = props.entries.map((worktree) => worktree.folder);
  try {
    const found = await invoke<WorktreeBranch[]>("chats_worktrees_branches", { folders });
    details.value = new Map(found.map((item) => [item.folder, item]));
  } catch {
    details.value = null;
  }
}

/** Opens the folder of the worktree as a workspace named after the worktree, selects the workspace, and closes the card. */
function openAsWorkspace(row: Row, close: () => void) {
  close();
  return openFolderAsWorkspace(row.worktree.folder, row.worktree.name);
}

/** Opens the folder of the worktree in VS Code. */
async function openInVsCode(row: Row) {
  try {
    await invoke("chats_worktree_open_in_vscode", { folder: row.worktree.folder });
  } catch (reason) {
    toast(String(reason), "error");
  }
}

/** Shows the folder of the worktree in the Finder. */
async function openInFinder(row: Row) {
  try {
    await revealItemInDir(row.worktree.folder);
  } catch (reason) {
    toast(String(reason), "error");
  }
}

watch(() => shown.value.listed.map((worktree) => worktree.folder).join("\n"), checkWorktrees, { immediate: true });
</script>

<template>
  <InformationCard :label="t('chatsPanel.worktreesLabel', { count: entries.length })" @open="checkDetails">
    <div class="d-flex gap-2">
      <Icon name="folder-symlink" />
      <span class="worktree-names">
        <template v-for="(item, index) in items" :key="item.worktree.folder">
          <span v-if="index > 0">, </span>
          <span :title="item.title" data-worktree
            >{{ item.worktree.name }}<Icon v-if="item.state === 'gone'" name="slash-circle" class="ms-1"
          /></span>
        </template>
        <span v-if="shown.more > 0">, +{{ shown.more }}</span>
      </span>
    </div>
    <template #card="{ close }">
      <div class="list-group list-group-flush worktrees-list">
        <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
          <Icon name="folder-symlink" />
          {{ t("chatsPanel.worktreesLabel", { count: entries.length }) }}
        </div>
        <div
          v-for="row in rows"
          :key="row.worktree.folder"
          class="list-group-item list-group-item-action d-flex align-items-center gap-3"
          data-worktree-row
          @pointerenter="startScrolling"
          @pointerleave="stopScrolling"
        >
          <Icon :name="row.isRemoved ? 'slash-circle' : 'folder-symlink'" />
          <div class="worktree-text d-flex flex-column">
            <ScrollingLine class="fw-medium">{{ row.worktree.name }}</ScrollingLine>
            <ScrollingLine class="detail text-body-secondary" data-branch>{{ row.branchText }}</ScrollingLine>
            <ScrollingLine class="detail text-body-secondary" data-folder>{{ row.worktree.folder }}</ScrollingLine>
          </div>
          <div class="btn-group" role="group" :aria-label="t('chatsPanel.worktreeActionsLabel')">
            <button
              type="button"
              class="btn"
              :disabled="row.isRemoved"
              :title="buttonTitle(row, 'chatsPanel.worktreeOpenTitle')"
              :aria-label="buttonTitle(row, 'chatsPanel.worktreeOpenTitle')"
              data-action="workspace"
              @click="openAsWorkspace(row, close)"
            >
              <Icon name="window-plus" />
            </button>
            <button
              type="button"
              class="btn"
              :disabled="row.isRemoved"
              :title="buttonTitle(row, 'chatsPanel.vscodeTitle')"
              :aria-label="buttonTitle(row, 'chatsPanel.vscodeTitle')"
              data-action="vscode"
              @click="openInVsCode(row)"
            >
              <Icon name="code-slash" />
            </button>
            <button
              type="button"
              class="btn"
              :disabled="row.isRemoved"
              :title="buttonTitle(row, 'chatsPanel.worktreeFinderTitle')"
              :aria-label="buttonTitle(row, 'chatsPanel.worktreeFinderTitle')"
              data-action="finder"
              @click="openInFinder(row)"
            >
              <Icon name="folder2-open" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </InformationCard>
</template>

<style scoped>
.worktree-names { min-width: 0; overflow-wrap: anywhere; }
.worktrees-list { max-height: 50vh; overflow-y: auto; }
.worktrees-list .btn { --btn-hover-bg: var(--bg-2); --btn-active-bg: var(--bg-2); }
.worktrees-list .btn:disabled { opacity: 0.45; }
.worktree-text { flex: 1 1 0; min-width: 0; }
.detail { font-size: 0.85em; }
</style>
