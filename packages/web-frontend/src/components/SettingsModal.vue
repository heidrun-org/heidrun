<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import Icon from "./Icon.vue";
import SettingsFinishedItemsSection from "./settings/SettingsFinishedItemsSection.vue";
import SettingsGeneralSection from "./settings/SettingsGeneralSection.vue";
import SettingsMobileAccessSection from "./settings/SettingsMobileAccessSection.vue";
import SettingsMouseSection from "./settings/SettingsMouseSection.vue";
import SettingsNotificationsSection from "./settings/SettingsNotificationsSection.vue";
import SettingsTerminalSection from "./settings/SettingsTerminalSection.vue";
import { settingsModal, type SettingsSection } from "../stores/settings";
import { t } from "../i18n/index";

const SECTIONS: { id: SettingsSection; icon: string; labelKey: string }[] = [
  { id: "general", icon: "sliders", labelKey: "settingsModal.general" },
  { id: "terminal", icon: "terminal", labelKey: "settingsModal.terminal" },
  { id: "mouse", icon: "mouse", labelKey: "settingsModal.mouse" },
  { id: "finishedItems", icon: "check2-circle", labelKey: "settingsModal.finishedItems" },
  { id: "notifications", icon: "bell", labelKey: "settingsModal.notifications" },
  { id: "mobileAccess", icon: "phone", labelKey: "settingsModal.mobileAccess" },
];

function close() {
  settingsModal.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div class="dialog" role="dialog" aria-labelledby="settings-title">
      <nav class="side" :aria-label="t('settingsModal.sectionsLabel')">
        <h2 id="settings-title">{{ t("settingsModal.title") }}</h2>
        <button
          v-for="s in SECTIONS"
          :key="s.id"
          class="entry"
          :class="{ on: settingsModal.section === s.id }"
          :aria-current="settingsModal.section === s.id ? 'page' : undefined"
          @click="settingsModal.section = s.id"
        >
          <Icon :name="s.icon" />
          <span>{{ t(s.labelKey) }}</span>
        </button>
      </nav>
      <section class="pane">
        <header>
          <h3>{{ t(SECTIONS.find((s) => s.id === settingsModal.section)?.labelKey ?? "settingsModal.title") }}</h3>
          <button :title="t('settingsModal.closeTitle')" class="close" :aria-label="t('settingsModal.closeLabel')" @click="close"><Icon name="x-lg" /></button>
        </header>
        <SettingsGeneralSection v-if="settingsModal.section === 'general'" />
        <SettingsTerminalSection v-else-if="settingsModal.section === 'terminal'" />
        <SettingsMouseSection v-else-if="settingsModal.section === 'mouse'" />
        <SettingsFinishedItemsSection v-else-if="settingsModal.section === 'finishedItems'" />
        <SettingsNotificationsSection v-else-if="settingsModal.section === 'notifications'" />
        <SettingsMobileAccessSection v-else-if="settingsModal.section === 'mobileAccess'" />
      </section>
    </div>
  </div>
</template>

<style scoped>
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog {
  width: min(820px, 100%); height: min(560px, calc(100vh - 48px)); display: flex; overflow: hidden; border-radius: 14px;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
.side { width: 210px; flex-shrink: 0; padding: 18px 10px; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid var(--line); }
h2 { margin: 0 8px 12px; font-size: var(--font-size); font-weight: 600; }
.entry {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: 8px;
  color: var(--text-2); font-size: var(--font-size); text-align: left;
}
.entry:hover { background: var(--hover); color: var(--text); }
.entry.on { background: var(--field); color: var(--text); }
.pane { flex: 1; min-width: 0; padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
header { display: flex; align-items: center; justify-content: space-between; }
h3 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: calc(var(--font-size) * 1.5); }
.close:hover { background: var(--hover); color: var(--text); }
.pane :deep(select) {
  height: 34px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text);
  padding: 0 10px; font-size: var(--font-size);
}
.pane :deep(.keys) { font-size: var(--font-size); color: var(--muted); line-height: 1.5; }
.pane :deep(.seg) { display: flex; padding: 3px; border-radius: 9px; background: var(--bg); gap: 3px; }
.pane :deep(.seg button) {
  flex: 1; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--muted);
  font-size: var(--font-size); font-weight: 500;
}
.pane :deep(.seg button.on) { background: var(--hover); color: var(--text); }
.pane :deep(kbd) { font-family: var(--mono); color: var(--text-2); }
.pane :deep(.sr) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
