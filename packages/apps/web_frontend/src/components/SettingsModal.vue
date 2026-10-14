<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import Icon from "./Icon.vue";
import SettingsAgentsSection from "./settings/SettingsAgentsSection.vue";
import SettingsDynamicTopicsSection from "./settings/SettingsDynamicTopicsSection.vue";
import SettingsFinishedItemsSection from "./settings/SettingsFinishedItemsSection.vue";
import SettingsGeneralSection from "./settings/SettingsGeneralSection.vue";
import SettingsNeedsYouSection from "./settings/SettingsNeedsYouSection.vue";
import SettingsNewTabSection from "./settings/SettingsNewTabSection.vue";
import SettingsMobileAccessSection from "./settings/SettingsMobileAccessSection.vue";
import SettingsMouseSection from "./settings/SettingsMouseSection.vue";
import SettingsNotificationsSection from "./settings/SettingsNotificationsSection.vue";
import SettingsTerminalSection from "./settings/SettingsTerminalSection.vue";
import { settingsModal, type SettingsSection } from "../stores/settings";
import { t } from "../i18n/index";

const SECTIONS: { id: SettingsSection; icon: string; labelKey: string }[] = [
  { id: "general", icon: "sliders", labelKey: "settingsModal.general" },
  { id: "terminal", icon: "terminal", labelKey: "settingsModal.terminal" },
  { id: "newTab", icon: "plus-lg", labelKey: "settingsModal.newTab" },
  { id: "mouse", icon: "mouse", labelKey: "settingsModal.mouse" },
  { id: "finishedItems", icon: "check2-circle", labelKey: "settingsModal.finishedItems" },
  { id: "needsYou", icon: "layout-sidebar-inset-reverse", labelKey: "settingsModal.needsYou" },
  { id: "notifications", icon: "bell", labelKey: "settingsModal.notifications" },
  { id: "mobileAccess", icon: "phone", labelKey: "settingsModal.mobileAccess" },
  { id: "agents", icon: "robot", labelKey: "settingsModal.agents" },
  { id: "dynamicTopics", icon: "tags", labelKey: "settingsModal.dynamicTopics" },
];

function close() {
  settingsModal.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    // An open information card closes first: the key reaches the card, which closes alone.
    if (e.target instanceof Element && e.target.closest(".information-card-part.is-open") !== null) {
      return;
    }
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
    <dialog class="dialog dialog-lg dialog-instant dialog-nonmodal h-75" open aria-labelledby="settings-title">
      <div class="dialog-header">
        <div id="settings-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t("settingsModal.title") }}</div>
        <DialogCloseButton :title="t('settingsModal.closeTitle')" :label="t('settingsModal.closeLabel')" @click="close" />
      </div>
      <div class="dialog-body d-flex gap-3 overflow-y-auto">
        <nav class="nav flex-column theme-secondary align-self-start" :aria-label="t('settingsModal.sectionsLabel')">
          <button
            v-for="s in SECTIONS"
            :key="s.id"
            type="button"
            class="nav-link justify-content-start"
            :class="{ active: settingsModal.section === s.id }"
            :aria-current="settingsModal.section === s.id ? 'page' : undefined"
            @click="settingsModal.section = s.id"
          >
            <Icon :name="s.icon" />
            <span>{{ t(s.labelKey) }}</span>
          </button>
        </nav>
        <section class="flex-fill overflow-y-auto d-flex flex-column gap-3">
          <h3 class="m-0 fw-semibold">{{ t(SECTIONS.find((s) => s.id === settingsModal.section)?.labelKey ?? "settingsModal.title") }}</h3>
          <SettingsGeneralSection v-if="settingsModal.section === 'general'" />
          <SettingsTerminalSection v-else-if="settingsModal.section === 'terminal'" />
          <SettingsNewTabSection v-else-if="settingsModal.section === 'newTab'" />
          <SettingsMouseSection v-else-if="settingsModal.section === 'mouse'" />
          <SettingsFinishedItemsSection v-else-if="settingsModal.section === 'finishedItems'" />
          <SettingsNeedsYouSection v-else-if="settingsModal.section === 'needsYou'" />
          <SettingsNotificationsSection v-else-if="settingsModal.section === 'notifications'" />
          <SettingsMobileAccessSection v-else-if="settingsModal.section === 'mobileAccess'" />
          <SettingsAgentsSection v-else-if="settingsModal.section === 'agents'" />
          <SettingsDynamicTopicsSection v-else-if="settingsModal.section === 'dynamicTopics'" />
        </section>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); }
</style>
