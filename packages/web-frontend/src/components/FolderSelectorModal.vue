<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { foldersList, type FolderList } from "../lib/api";
import { answerFolder } from "../stores/folderSelector";
import { t } from "../i18n/index";

const listing = ref<FolderList | null>(null);
const error = ref("");
const loading = ref(true);
const dialog = ref<HTMLElement>();

async function open(path: string | null) {
  loading.value = true;
  try {
    listing.value = await foldersList(path);
    error.value = "";
  } catch (e) {
    error.value = String(e);
  }
  loading.value = false;
}

function child(name: string): string {
  const base = listing.value?.path ?? "";
  return base.endsWith("/") ? base + name : `${base}/${name}`;
}

onMounted(async () => {
  await open(null);
  nextTick(() => dialog.value?.focus());
});
</script>

<template>
  <div class="overlay" @mousedown.self="answerFolder(null)" @keydown.esc.stop.prevent="answerFolder(null)">
    <div ref="dialog" class="dialog" role="dialog" aria-labelledby="fs-title" tabindex="-1">
      <h2 id="fs-title">{{ t("folderSelectorModal.title") }}</h2>
      <div class="where">
        <button
          class="btn"
          :disabled="listing?.parent == null"
          :title="t('folderSelectorModal.parentTitle')"
          @click="listing?.parent != null && open(listing.parent)"
        >↑</button>
        <span class="path mono">{{ listing?.path ?? "" }}</span>
      </div>
      <div class="list" role="listbox" :aria-label="t('folderSelectorModal.foldersLabel')">
        <div v-if="error !== ''" class="muted">{{ error }}</div>
        <div v-else-if="loading" class="muted">{{ t("folderSelectorModal.loading") }}</div>
        <div v-else-if="listing !== null && listing.folders.length === 0" class="muted">{{ t("folderSelectorModal.empty") }}</div>
        <button
          v-for="name in listing?.folders ?? []"
          :key="name"
          class="folder"
          role="option"
          @click="open(child(name))"
        >{{ name }}</button>
      </div>
      <div class="row">
        <button class="btn lg" :title="t('folderSelectorModal.cancelTitle')" @click="answerFolder(null)">{{ t("folderSelectorModal.cancel") }}</button>
        <button
          class="btn lg go"
          :disabled="listing === null"
          :title="t('folderSelectorModal.chooseTitle')"
          @click="listing !== null && answerFolder(listing.path)"
        >{{ t("folderSelectorModal.choose") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog {
  width: min(520px, 100%); max-height: calc(100vh - 48px); padding: 22px; border-radius: 14px; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column; gap: 12px;
}
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.where { display: flex; align-items: center; gap: 8px; }
.path { min-width: 0; font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
.list {
  height: 280px; overflow: auto; display: flex; flex-direction: column; gap: 1px; padding: 4px;
  border: 1px solid var(--line-strong); border-radius: 8px; background: var(--field);
}
.folder { height: 30px; padding: 0 10px; border-radius: 6px; text-align: left; font-size: 13px; color: var(--text-2); flex-shrink: 0; }
.folder:hover { background: var(--hover); color: var(--text); }
.muted { color: var(--muted); font-size: 12px; padding: 6px; }
.row { display: flex; justify-content: flex-end; gap: 8px; }
.btn.go { background: var(--accent); border-color: transparent; color: #1a1206; font-weight: 600; }
</style>
