<script setup lang="ts">
import MoreMenu from "./MoreMenu.vue";
import PaneFocusHistoryButton from "./PaneFocusHistoryButton.vue";
import ThemeMenu from "./ThemeMenu.vue";
import { selectedWorkspace, state } from "../stores/session";
import { t } from "../i18n/index";
</script>

<template>
  <!-- macOS traffic lights sit over the left padding (titleBarStyle: Overlay). -->
  <header class="top" data-tauri-drag-region>
    <div class="search-wrap" data-tauri-drag-region>
      <div class="history-buttons">
        <PaneFocusHistoryButton direction="back" />
        <PaneFocusHistoryButton direction="forward" />
      </div>
      <button :title="t('topBar.searchTitle')" class="search" @click="state.paletteOpen = true">
        <span v-if="selectedWorkspace !== null" class="workspace-name" :title="selectedWorkspace.label">
          {{ selectedWorkspace.label }}
        </span>
        <span v-else>{{ t("topBar.searchPlaceholder") }}</span>
        <kbd>⌘K</kbd>
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
.search-wrap { flex: 1; display: flex; justify-content: center; align-items: center; gap: 8px; min-width: 188px; }
.workspace-name {
  min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.history-buttons { display: flex; flex-shrink: 0; }
.search {
  width: min(420px, 100%); height: 30px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--muted); font-size: var(--font-size); overflow: hidden; white-space: nowrap;
}
.search kbd { flex-shrink: 0; margin-left: 12px; font-family: var(--mono); color: var(--faint); }
.tools { display: flex; flex-shrink: 0; align-items: center; gap: 2px; }
</style>
