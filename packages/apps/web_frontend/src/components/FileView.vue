<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import CodeEditor from "./CodeEditor.vue";
import { FileViewLabel } from "../lib/file_view_label";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import { isImage } from "../stores/files";
import { toast } from "../stores/session";
import { settings } from "../stores/settings";
import { codeThemeClass } from "../stores/theme";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

// The body of a file view pane: the file of the label of the pane, shown read only. The developer cannot change the file here.
// Issue: https://github.com/heidrun-org/heidrun/issues/714
const props = defineProps<{ pane: AgentInfo }>();

/** The project of the file and the path inside it, as the backend resolves them. */
type FileLocation = { root: string; path: string };

const absolutePath = computed(() => FileViewLabel.parse(props.pane.label));
const isMarkdownFile = computed(() => isMarkdown(absolutePath.value));
const isPreview = computed(() => isMarkdownFile.value && settings.filesMdRead);
const location = ref<FileLocation | null>(null);
const text = ref("");
const rendered = ref("");
const image = ref("");
const error = ref("");
const isLoading = ref(false);
const editor = ref<InstanceType<typeof CodeEditor> | null>(null);
const isCodeShown = computed(() => isLoading.value === false && error.value === "" && image.value === "" && isPreview.value === false);
let sequence = 0;

// An answer that comes after the path or the mode changed again is dropped.
async function load() {
  const mine = ++sequence;
  text.value = "";
  rendered.value = "";
  image.value = "";
  error.value = "";
  location.value = null;
  const path = absolutePath.value;
  if (path === null) {
    return;
  }
  isLoading.value = true;
  try {
    const resolved = await invoke<FileLocation>("files_resolve", { cwd: props.pane.cwd || props.pane.foreground_cwd, path });
    if (mine !== sequence) {
      return;
    }
    location.value = resolved;
    if (isImage(resolved.path)) {
      const url = await invoke<string>("file_image", { root: resolved.root, path: resolved.path });
      if (mine === sequence) {
        image.value = url;
      }
      return;
    }
    const content = (await invoke<string>("git_file", { root: resolved.root, path: resolved.path, rev: null })).replace(/\n$/, "");
    if (mine !== sequence) {
      return;
    }
    text.value = content;
    if (isPreview.value) {
      rendered.value = renderMarkdown(content);
    }
  } catch (e) {
    if (mine === sequence) {
      error.value = String(e);
    }
  } finally {
    if (mine === sequence) {
      isLoading.value = false;
    }
  }
}
watch([absolutePath, isPreview], load, { immediate: true });

async function copyPath(isAbsolute: boolean) {
  const path = isAbsolute ? absolutePath.value : location.value?.path;
  if (path === null || path === undefined) {
    return;
  }
  await writeText(path).catch(() => {});
  toast(t("filesModal.copied", { path }));
}
function showInFinder() {
  if (absolutePath.value !== null) {
    revealItemInDir(absolutePath.value).catch((e) => toast(String(e)));
  }
}
async function openInVisualStudioCode() {
  if (location.value === null) {
    return;
  }
  await invoke("file_open_external", { root: location.value.root, path: location.value.path }).catch((e) => toast(String(e)));
}
// Links in rendered Markdown open in the browser.
function onMarkdownClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest("a");
  if (anchor === null) {
    return;
  }
  event.preventDefault();
  const href = anchor.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) {
    openUrl(href).catch(() => {});
  }
}
</script>

<template>
  <div class="file-view">
    <div class="bar">
      <div v-if="isMarkdownFile" class="seg" role="radiogroup" :aria-label="t('filesModal.markdownLabel')">
        <button class="btn small" :class="{ on: settings.filesMdRead }" :title="t('filesModal.renderedTitle')" @click="settings.filesMdRead = true">{{ t("filesModal.rendered") }}</button>
        <button class="btn small" :class="{ on: settings.filesMdRead === false }" :title="t('filesModal.sourceTitle')" @click="settings.filesMdRead = false">{{ t("filesModal.source") }}</button>
      </div>
      <label class="wrap-toggle"><input v-model="settings.codeWrap" type="checkbox" />{{ t("filesModal.wrap") }}</label>
      <button v-if="isCodeShown" class="btn small" data-action="search" :title="t('fileView.searchTitle')" @click="editor?.openSearch()">{{ t("fileView.search") }}</button>
      <button class="btn small" :title="t('filesModal.copyPathTitle')" @click="(event) => copyPath(event.altKey)">{{ t("filesModal.copyPath") }}</button>
      <button class="btn small" :title="t('filesModal.finderTitle')" @click="showInFinder">Finder</button>
      <button class="btn small" :title="t('filesModal.vscodeTitle')" @click="openInVisualStudioCode">VS Code</button>
    </div>
    <div class="code" :class="[codeThemeClass, { editing: isCodeShown }]">
      <div v-if="error !== ''" class="empty err">{{ error }}</div>
      <div v-else-if="isLoading" class="empty">{{ t("filesModal.loading") }}</div>
      <div v-else-if="image !== ''" class="img"><img :src="image" :alt="absolutePath ?? ''" /></div>
      <article v-else-if="isPreview" class="md-doc" :class="{ full: settings.mdWidth === 'full' }" @click="onMarkdownClick" v-html="rendered"></article>
      <CodeEditor v-else ref="editor" :key="absolutePath ?? ''" :path="location?.path ?? absolutePath ?? ''" :text="text" :wrap="settings.codeWrap" read-only />
    </div>
  </div>
</template>

<style scoped>
.file-view { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 10px; border-bottom: 1px solid var(--line); }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg); gap: 2px; }
.wrap-toggle { display: flex; align-items: center; gap: 5px; font-size: var(--font-size); color: var(--text-2); white-space: nowrap; }
.code { position: relative; flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
.code.editing { overflow: hidden; }
.img { padding: 24px; display: flex; justify-content: center; background: repeating-conic-gradient(var(--image-checker-light) 0% 25%, var(--image-checker-dark) 0% 50%) 50% / 20px 20px; min-height: 100%; }
.img img { max-width: 100%; height: auto; image-rendering: auto; }
.md-doc { padding: 24px 36px 60px; }
.empty { padding: 24px; color: var(--muted); font-family: var(--sans); font-size: var(--font-size); }
.err { color: var(--fail); }
</style>
