<script setup lang="ts">
import MoreMenu from "./MoreMenu.vue";
import ThemeMenu from "./ThemeMenu.vue";
import { state } from "../stores/session";
import { t } from "../i18n/index";
</script>

<template>
  <!-- macOS traffic lights sit over the left padding (titleBarStyle: Overlay). -->
  <header class="top" data-tauri-drag-region>
    <div class="search-wrap" data-tauri-drag-region>
      <button :title="t('topBar.searchTitle')" class="search" @click="state.paletteOpen = true">
        <span>{{ t("topBar.searchPlaceholder") }}</span><kbd>⌘K</kbd>
      </button>
    </div>
    <div class="tools">
      <ThemeMenu />
      <MoreMenu />
    </div>
  </header>
</template>

<style scoped>
.top {
  height: 43px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 9px 16px 4px 84px; background: var(--shell);
}
.search-wrap { flex: 1; display: flex; justify-content: center; min-width: 120px; }
.search {
  width: min(420px, 100%); height: 30px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--muted); font-size: var(--font-size); overflow: hidden; white-space: nowrap;
}
.search kbd { font-family: var(--mono); color: var(--faint); }
.tools { display: flex; align-items: center; gap: 2px; }
</style>
