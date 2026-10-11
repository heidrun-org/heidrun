<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import HoverCard from "./HoverCard.vue";
import Icon from "./Icon.vue";
import { fileFolder, fileIconName, fileName, fileWebUrl, type ChatFile } from "../lib/chat_files";
import type { Forge } from "../lib/refs";
import { toast } from "../stores/session";
import { t } from "../i18n/index";

// The line of the summary of a chat that names the files that the coding agent wrote. When the pointer rests on the line,
// a card lists every file with its folders below the root of the repository, and two buttons for each file: one opens the
// file in VS Code, and one opens the file on the web page of the repository on GitHub or GitLab. A button is disabled,
// with a title that says why, when the file does not exist on the disk of this Mac or on the default branch of the remote.
// A file that is not below the root of the repository has no button. A row has two lines: the name of the file, and its
// folders (`./` for a file at the root). A line that does not fit shows its beginning with an ellipsis, and scrolls to
// its end while the pointer is over the row.

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

/** How long the pointer stays on a row before a line that does not fit starts to scroll, in milliseconds. */
const SCROLL_DELAY = 300;

/** How fast a line scrolls, in pixels each second. */
const SCROLL_SPEED = 60;

/** The shortest time that a line takes to scroll, in milliseconds. */
const SCROLL_MIN_DURATION = 800;

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
      hasButtons: entry.relativePath !== null,
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
  const key = row.isMissingOnDisk ? "chatsPanel.vscodeMissingTitle" : "chatsPanel.vscodeTitle";
  return t(key);
}

/** The title of the button for the forge: what the button does, or why it cannot do it. */
function forgeTitle(row: Row): string {
  const key = row.isMissingOnRemote ? "chatsPanel.forgeMissingTitle" : "chatsPanel.forgeTitle";
  return t(key, { forge: forgeName.value });
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

/** The frame that moves each line that scrolls, by line. */
const frames = new Map<HTMLElement, number>();

/** Starts to scroll each line of the row that does not fit, from its beginning to its end. */
function startScrolling(event: PointerEvent) {
  for (const line of (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[data-scroll]")) {
    const overflow = line.scrollWidth - line.clientWidth;
    if (overflow <= 0) {
      continue;
    }
    stopLine(line);
    line.classList.add("is-scrolling");
    const duration = Math.max(SCROLL_MIN_DURATION, (overflow / SCROLL_SPEED) * 1000);
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt - SCROLL_DELAY) / duration));
      line.scrollLeft = overflow * progress;
      if (progress < 1) {
        frames.set(line, requestAnimationFrame(step));
      } else {
        frames.delete(line);
      }
    };
    frames.set(line, requestAnimationFrame(step));
  }
}

/** Stops the lines of the row, and shows their beginning again. */
function stopScrolling(event: PointerEvent) {
  for (const line of (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[data-scroll]")) {
    stopLine(line);
  }
}

function stopLine(line: HTMLElement) {
  const frame = frames.get(line);
  if (frame !== undefined) {
    cancelAnimationFrame(frame);
    frames.delete(line);
  }
  line.classList.remove("is-scrolling");
  line.scrollLeft = 0;
}

onBeforeUnmount(() => {
  for (const line of [...frames.keys()]) {
    stopLine(line);
  }
});

async function openOnForge(url: string) {
  try {
    await openUrl(url);
  } catch (reason) {
    toast(String(reason), "error");
  }
}
</script>

<template>
  <HoverCard :label="t('chatsPanel.filesWritten', { count: entries.length })" @open="checkFiles">
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
            <span class="file-line fw-medium" data-scroll>{{ row.name }}</span>
            <span class="file-line folder text-body-secondary" data-scroll>{{ row.folder }}</span>
          </div>
          <div v-if="row.hasButtons" class="btn-group" role="group" :aria-label="t('chatsPanel.openFileLabel')">
            <button
              type="button"
              class="btn"
              :disabled="row.isMissingOnDisk"
              :title="vscodeTitle(row)"
              :aria-label="vscodeTitle(row)"
              @click="openInVsCode(row.entry)"
            >
              <Icon name="code-slash" />
            </button>
            <button
              v-if="row.url !== null"
              type="button"
              class="btn"
              :disabled="row.isMissingOnRemote"
              :title="forgeTitle(row)"
              :aria-label="forgeTitle(row)"
              @click="openOnForge(row.url)"
            >
              <Icon :name="props.forge === 'gitlab' ? 'gitlab' : 'github'" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </HoverCard>
</template>

<style scoped>
.files-list { max-height: 50vh; overflow-y: auto; }
.files-list .btn { --bs-btn-hover-bg: var(--bs-secondary-bg); --bs-btn-active-bg: var(--bs-secondary-bg); }
.files-list .btn:disabled { opacity: 0.45; }
.file-text { flex: 1 1 0; min-width: 0; }
.file-line { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.file-line.is-scrolling { text-overflow: clip; }
.folder { font-size: 0.85em; }
</style>
