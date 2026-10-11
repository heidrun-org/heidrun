<script setup lang="ts">
import { computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import HoverCard from "./HoverCard.vue";
import Icon from "./Icon.vue";
import { fileWebUrl, relativeFilePath } from "../lib/chat_files";
import type { Forge } from "../lib/refs";
import { toast } from "../stores/session";
import { t } from "../i18n/index";

// The line of the summary of a chat that names the files that the coding agent wrote. When the pointer rests on the line,
// a card lists every file with its path below the root of the repository, and two buttons for each file: one opens the
// file in VS Code, and one opens the file on the web page of the repository on GitHub or GitLab.

const props = defineProps<{
  /** The text of the line: the names of the first files. */
  text: string;
  /** The absolute path of each file that the coding agent wrote. */
  files: string[];
  /** The root of the repository, or null when it is not known. */
  root: string | null;
  /** The folder of the selected workspace. The program checks it before it opens a file. */
  folder: string;
  /** The address of the repository on its forge, or null when the repository has no remote. */
  webBase: string | null;
  /** The forge of the repository, or null when the repository has no remote. */
  forge: Forge | null;
}>();

/** The name of the forge on the button. The names of the products are not translated. */
const forgeName = computed(() => (props.forge === "gitlab" ? "GitLab" : "GitHub"));

/** One row of the card. A file outside the repository shows its absolute path and has no button for the forge. */
const rows = computed(() =>
  props.files.map((path) => {
    const relativePath = relativeFilePath(props.root, path);
    return {
      path,
      label: relativePath ?? path,
      url: relativePath === null ? null : fileWebUrl(props.webBase, props.forge, relativePath),
    };
  }),
);

/** Checks that the file is in a project that a pane works in, then opens it in VS Code. */
async function openInVsCode(path: string) {
  try {
    const resolved = await invoke<{ root: string; path: string }>("files_resolve", { cwd: props.folder, path });
    await invoke("file_open_external", { root: resolved.root, path: resolved.path });
  } catch (reason) {
    toast(String(reason), "error");
  }
}

async function openOnForge(url: string) {
  try {
    await openUrl(url);
  } catch (reason) {
    toast(String(reason), "error");
  }
}
</script>

<template>
  <HoverCard :label="t('chatsPanel.filesWritten', { count: files.length })">
    <div class="d-flex gap-2">
      <Icon name="file-earmark" />
      <span>{{ text }}</span>
    </div>
    <template #card>
      <div class="d-flex flex-column gap-2 files-list">
        <div class="fw-medium">{{ t("chatsPanel.filesWritten", { count: files.length }) }}</div>
        <div v-for="row in rows" :key="row.path" class="d-flex align-items-center gap-2" data-file>
          <span class="me-auto text-break">{{ row.label }}</span>
          <button type="button" class="btn" :title="t('chatsPanel.vscodeTitle', { path: row.label })" @click="openInVsCode(row.path)">
            VS Code
          </button>
          <button
            v-if="row.url !== null"
            type="button"
            class="btn"
            :title="t('chatsPanel.forgeTitle', { path: row.label, forge: forgeName })"
            @click="openOnForge(row.url)"
          >
            {{ forgeName }}
          </button>
        </div>
      </div>
    </template>
  </HoverCard>
</template>

<style scoped>
.files-list { max-height: 50vh; overflow-y: auto; }
.files-list .btn { white-space: nowrap; }
</style>
