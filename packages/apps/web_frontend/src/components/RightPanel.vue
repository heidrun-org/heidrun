<script setup lang="ts">
import { computed } from "vue";
import ChatsPanel from "./ChatsPanel.vue";
import { attention } from "../stores/session";
import NavigationBar from "./NavigationBar.vue";
import NotesPanel from "./NotesPanel.vue";
import ToHandlePanel from "./ToHandlePanel.vue";
import { settings } from "../stores/settings";
import { openSidebarSection } from "../stores/sidebar_sections";
import { visibleNotes } from "../stores/notes";
import { t } from "../i18n/index";

/** The buttons of the navigation bar of the right sidebar: the Needs you, Notes, and Chats sidebar sections. */
const sidebarSections = computed(() => [
  {
    id: "toHandle",
    label: t("rightPanel.sidebarSection.toHandle"),
    badge: attention.value.length,
    isAlert: attention.value.some((pane) => pane.agent_status === "blocked"),
  },
  { id: "notes", label: t("rightPanel.sidebarSection.notes"), badge: visibleNotes.value.length },
  { id: "chats", label: t("rightPanel.sidebarSection.chats"), badge: 0 },
]);

function selectSidebarSection(id: string) {
  openSidebarSection(id === "notes" || id === "chats" ? id : "toHandle");
}
</script>

<template>
  <aside class="right" :style="{ width: `${settings.rightWidth}px` }">
    <NavigationBar
      class="right-navigation-bar"
      :sidebar-sections="sidebarSections"
      :selected-id="settings.rightSidebarSection"
      :label="t('rightPanel.label')"
      @select="selectSidebarSection"
    />
    <ToHandlePanel v-if="settings.rightSidebarSection === 'toHandle'" />
    <ChatsPanel v-else-if="settings.rightSidebarSection === 'chats'" />
    <NotesPanel v-else />
  </aside>
</template>

<style scoped>
.right {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side); overflow: hidden;
  display: flex; flex-direction: column; min-height: 0;
}
.right-navigation-bar { margin: 5px 0 0; padding: 0 16px; }
</style>
