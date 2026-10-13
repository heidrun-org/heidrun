<script setup lang="ts">
import { computed } from "vue";
import ChatsPanel from "./ChatsPanel.vue";
import { attention } from "../stores/session";
import NavigationBar from "./NavigationBar.vue";
import NotesPanel from "./NotesPanel.vue";
import SidebarIconBar from "./SidebarIconBar.vue";
import ToHandlePanel from "./ToHandlePanel.vue";
import { settings } from "../stores/settings";
import { COLLAPSED_SIDEBAR_WIDTH, openSidebarSection, type SidebarSectionButton } from "../stores/sidebar_sections";
import { visibleNotes } from "../stores/notes";
import { t } from "../i18n/index";

/** The buttons of the navigation bar of the right sidebar: the Needs you, Notes, and Chats sidebar sections. */
const sidebarSections = computed((): SidebarSectionButton[] => [
  {
    id: "toHandle",
    label: t("rightPanel.sidebarSection.toHandle"),
    icon: "bell",
    badge: attention.value.length,
    isAlert: attention.value.some((pane) => pane.agent_status === "blocked"),
  },
  { id: "notes", label: t("rightPanel.sidebarSection.notes"), icon: "sticky", badge: visibleNotes.value.length },
  { id: "chats", label: t("rightPanel.sidebarSection.chats"), icon: "chat-left-text", badge: 0 },
]);

function selectSidebarSection(id: string) {
  openSidebarSection(id === "notes" || id === "chats" ? id : "toHandle");
}
</script>

<template>
  <aside v-if="settings.rightCollapsed" class="right collapsed" :style="{ width: `${COLLAPSED_SIDEBAR_WIDTH}px` }">
    <SidebarIconBar
      :sidebar-sections="sidebarSections"
      :selected-id="settings.rightSidebarSection"
      :label="t('rightPanel.label')"
      side="right"
      @select="selectSidebarSection"
      @expand="settings.rightCollapsed = false"
    />
  </aside>
  <aside v-else class="right" :style="{ width: `${settings.rightWidth}px` }">
    <NavigationBar
      class="right-navigation-bar"
      :sidebar-sections="sidebarSections"
      :selected-id="settings.rightSidebarSection"
      :label="t('rightPanel.label')"
      side="right"
      @select="selectSidebarSection"
      @collapse="settings.rightCollapsed = true"
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
.right.collapsed { padding: 5px 0; }
.right-navigation-bar { margin: 5px 0 0; padding: 0 16px; }
</style>
