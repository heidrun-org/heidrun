<script setup lang="ts">
import Icon from "./Icon.vue";
import ThemeMenu from "./ThemeMenu.vue";
import { counts, state } from "../stores/session";
import { openSettings, settings, settingsModal } from "../stores/settings";
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
    <div class="machine" :title="state.error || t('topBar.connectedTitle')">
      <span class="dot" :class="state.connected ? 'working-static' : 'offline'"></span>
      {{ t("topBar.local") }} · {{ state.snapshot ? `Herdr ${state.snapshot.version}` : t("topBar.offline") }}
    </div>
    <div class="search-wrap" data-tauri-drag-region>
      <button :title="t('topBar.searchTitle')" class="search" @click="state.paletteOpen = true">
        <span>{{ t("topBar.searchPlaceholder") }}</span><kbd>⌘K</kbd>
      </button>
    </div>
    <div class="counts">
      <span><span class="dot blocked"></span>{{ t("topBar.blocked", { count: counts.blocked }) }}</span>
      <span><span class="dot working"></span>{{ t("topBar.working", { count: counts.working }) }}</span>
      <span><span class="dot done"></span>{{ t("topBar.done", { count: counts.done }) }}</span>
    </div>
    <button class="icon-btn help" :aria-label="t('topBar.shortcutsLabel')" :title="t('topBar.shortcutsTitle')" @click="state.shortcutsOpen = true">?</button>
    <ThemeMenu />
    <button
      class="icon-btn"
      :class="{ on: settingsModal.open }"
      :aria-label="t('topBar.settingsLabel')"
      :title="t('topBar.settingsTitle')"
      @click="openSettings()"
    >
      <Icon name="gear" />
    </button>
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
  </header>
</template>

<style scoped>
.top {
  height: 48px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 0 16px 0 84px; border-bottom: 1px solid var(--line); background: var(--bar);
}
.brand { font-weight: 600; font-size: 14px; letter-spacing: 0.2px; white-space: nowrap; }
.machine {
  display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 8px; white-space: nowrap;
  border: 1px solid var(--line-strong); background: var(--field); color: var(--text-2); font-size: 12px; font-weight: 500;
}
.working-static { background: var(--working); }
.offline { background: var(--fail); }
.search-wrap { flex: 1; display: flex; justify-content: center; min-width: 120px; }
.search {
  width: min(420px, 100%); height: 30px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--muted); font-size: 12px; overflow: hidden; white-space: nowrap;
}
.search kbd { font-family: var(--mono); color: var(--faint); }
.counts { display: flex; gap: 12px; font-size: 12px; color: var(--muted-2); white-space: nowrap; }
.counts > span { display: flex; align-items: center; gap: 6px; }
.icon-btn {
  width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--line-strong);
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.icon-btn:hover { background: var(--hover); color: var(--text); }
.icon-btn.help { font-size: 13px; font-weight: 600; }
.icon-btn.on { color: var(--text-2); background: var(--field); }
@media (max-width: 1180px) { .counts { display: none; } }
</style>
