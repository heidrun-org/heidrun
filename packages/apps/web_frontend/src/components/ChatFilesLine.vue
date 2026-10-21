<script setup lang="ts">
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import InformationCard from "./InformationCard.vue";
import Icon from "./Icon.vue";
import ScrollingLine from "./ScrollingLine.vue";
import { fileFolder, fileIconName, fileName, fileWebUrl, type ChatFile } from "../lib/chat_files";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import type { Forge } from "../lib/refs";
import { toast } from "../stores/session";
import { t } from "../i18n/index";

// The line of the summary of a chat that names the files that the coding agent wrote. When the line is clicked, an
// information card lists every file with its folders below the root of the repository, and two buttons for each file: one
// opens the file in VS Code, and one opens the file on the web page of the repository on GitHub or GitLab. A button is
// disabled, with a title that says why, when the file does not exist on the disk of this Mac or on the default branch of
// the remote. A file that is not below the root of the repository has the same buttons, both disabled with a title that
// says why. A row has two lines: the name of the file, and its folders (`./` for a file at the root). A line that does not
// fit shows its beginning with an ellipsis, and scrolls to its end while the pointer is over the row.

const props = defineProps<{
  /** The text of the line: the names of the first files. */
  text: string;
  /** The files that the coding agent wrote, each one once. */
  entries: ChatFile[];
  /** The folder of the selected workspace. The program checks it before it opens a file. */
  folder: string;
  /** The address of the repository on its forge, or null when the repository has no remote. */
  webBase: string | null;
  /** The forge of the repository, or null when the repository has no remote. */
  forge: Forge | null;
}>();

/** What the Tauri command `chats_files_exist` answers for one file. */
type FileExistence = { path: string; on_disk: boolean; on_remote: boolean };

/** The name of the forge on the button. The names of the products are not translated. */
const forgeName = computed(() => (props.forge === "gitlab" ? "GitLab" : "GitHub"));

/** What the program knows about each file below the root, by path. It is empty until the card has opened once. */
const existence = ref<Record<string, FileExistence>>({});

/** The folders of a file for the second line: `./` for a file at the root of the repository, `/` at the root of the disk. */
function folderText(entry: ChatFile): string {
  const folder = fileFolder(entry.label);
  if (folder !== "") {
    return folder;
  }
  return entry.relativePath === null ? "/" : "./";
}

/** One row of the card. */
const rows = computed(() =>
  props.entries.map((entry) => {
    const known = entry.relativePath === null ? undefined : existence.value[entry.relativePath];
    return {
      entry,
      name: fileName(entry.label),
      folder: folderText(entry),
      icon: fileIconName(fileName(entry.label)),
      isOutside: entry.relativePath === null,
      url: entry.relativePath === null ? null : fileWebUrl(props.webBase, props.forge, entry.relativePath),
      isMissingOnDisk: known !== undefined && known.on_disk === false,
      isMissingOnRemote: known !== undefined && known.on_remote === false,
    };
  }),
);

/** Asks which files exist, each time the card opens, so the buttons follow the files. A failure leaves the buttons on. */
async function checkFiles() {
  const paths = props.entries.flatMap((entry) => (entry.relativePath === null ? [] : [entry.relativePath]));
  if (paths.length === 0) {
    return;
  }
  try {
    const found = await invoke<FileExistence[]>("chats_files_exist", { folder: props.folder, paths });
    existence.value = Object.fromEntries(found.map((item) => [item.path, item]));
  } catch {
    existence.value = {};
  }
}

type Row = (typeof rows.value)[number];

/** The title of the button for VS Code: what the button does, or why it cannot do it. */
function vscodeTitle(row: Row): string {
  if (row.isOutside) {
    return t("chatsPanel.outsideTitle");
  }
  return t(row.isMissingOnDisk ? "chatsPanel.vscodeMissingTitle" : "chatsPanel.vscodeTitle");
}

/** The title of the button for the forge: what the button does, or why it cannot do it. */
function forgeTitle(row: Row): string {
  if (row.isOutside) {
    return t("chatsPanel.outsideTitle");
  }
  return t(row.isMissingOnRemote ? "chatsPanel.forgeMissingTitle" : "chatsPanel.forgeTitle", { forge: forgeName.value });
}

/** Checks that the file is in a project that a pane works in, then opens it in VS Code. */
async function openInVsCode(entry: ChatFile) {
  try {
    const resolved = await invoke<{ root: string; path: string }>("files_resolve", {
      cwd: props.folder,
      path: entry.openPath,
    });
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
  <InformationCard :label="t('chatsPanel.filesWritten', { count: entries.length })" @open="checkFiles">
    <div class="d-flex gap-2">
      <Icon name="file-earmark" />
      <span>{{ text }}</span>
    </div>
    <template #card>
      <div class="list-group list-group-flush files-list">
        <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
          <Icon name="files" />
          {{ t("chatsPanel.filesWritten", { count: entries.length }) }}
        </div>
        <div
          v-for="row in rows"
          :key="row.entry.label"
          class="list-group-item list-group-item-action d-flex align-items-center gap-3"
          data-file
          @pointerenter="startScrolling"
          @pointerleave="stopScrolling"
        >
          <Icon :name="row.icon" />
          <div class="file-text d-flex flex-column">
            <ScrollingLine class="fw-medium">{{ row.name }}</ScrollingLine>
            <ScrollingLine class="folder text-body-secondary">{{ row.folder }}</ScrollingLine>
          </div>
          <div class="btn-group" role="group" :aria-label="t('chatsPanel.openFileLabel')">
            <button
              type="button"
              class="btn"
              :disabled="row.isOutside || row.isMissingOnDisk"
              :title="vscodeTitle(row)"
              :aria-label="vscodeTitle(row)"
              @click="openInVsCode(row.entry)"
            >
              <Icon name="code-slash" />
            </button>
            <button
              v-if="webBase !== null"
              type="button"
              class="btn"
              :disabled="row.isOutside || row.isMissingOnRemote || row.url === null"
              :title="forgeTitle(row)"
              :aria-label="forgeTitle(row)"
              @click="row.url !== null && openOnForge(row.url)"
            >
              <Icon :name="props.forge === 'gitlab' ? 'gitlab' : 'github'" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </InformationCard>
</template>

<style scoped>
.files-list { max-height: 50vh; overflow-y: auto; }
.file-text { flex: 1 1 0; min-width: 0; }
.folder { font-size: 0.85em; }
</style>
