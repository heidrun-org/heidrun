<script setup lang="ts">
import Icon from "./Icon.vue";
import MoreMenu from "./MoreMenu.vue";
import ThemeMenu from "./ThemeMenu.vue";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";
</script>

<template>
  <!-- macOS traffic lights sit over the left padding (titleBarStyle: Overlay). -->
  <header class="top" data-tauri-drag-region>
    <button
      class="icon-btn"
      :class="{ on: settings.leftOpen }"
      :aria-pressed="settings.leftOpen"
      :aria-label="t('topBar.leftSidebarLabel')"
      :title="t('topBar.leftSidebarTitle')"
      @click="settings.leftOpen = !settings.leftOpen"
    >
      <Icon name="layout-sidebar" />
    </button>
    <div class="brand" data-tauri-drag-region>Heidrun</div>
    <div class="search-wrap" data-tauri-drag-region>
      <button :title="t('topBar.searchTitle')" class="search" @click="state.paletteOpen = true">
        <span>{{ t("topBar.searchPlaceholder") }}</span><kbd>⌘K</kbd>
      </button>
    </div>
    <div class="tools">
      <ThemeMenu />
      <MoreMenu />
      <button
        class="icon-btn"
        :class="{ on: settings.rightOpen }"
        :aria-pressed="settings.rightOpen"
        :aria-label="t('topBar.rightPanelLabel')"
        :title="t('topBar.rightPanelTitle')"
        @click="settings.rightOpen = !settings.rightOpen"
      >
        <Icon name="layout-sidebar-reverse" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.top {
  height: 48px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 0 16px 0 84px; border-bottom: 1px solid var(--line); background: var(--bar);
}
.brand { font-weight: 600; font-size: var(--font-size); letter-spacing: 0.2px; white-space: nowrap; }
.search-wrap { flex: 1; display: flex; justify-content: center; min-width: 120px; }
.search {
  width: min(420px, 100%); height: 30px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--muted); font-size: var(--font-size); overflow: hidden; white-space: nowrap;
}
.search kbd { font-family: var(--mono); color: var(--faint); }
.icon-btn {
  width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; border: 0;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.icon-btn:hover { background: var(--hover); color: var(--text); }
.tools { display: flex; align-items: center; gap: 2px; }
.icon-btn.on { color: var(--text-2); background: var(--field); }
</style>
