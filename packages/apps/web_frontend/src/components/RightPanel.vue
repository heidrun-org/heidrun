<script setup lang="ts">
import { computed } from "vue";
import ChatsPanel from "./ChatsPanel.vue";
import { attention } from "../stores/session";
import NotesPanel from "./NotesPanel.vue";
import SidebarIconBar from "./SidebarIconBar.vue";
import ToHandlePanel from "./ToHandlePanel.vue";
import { settings } from "../stores/settings";
import { clickSidebarSectionIcon, COLLAPSED_SIDEBAR_WIDTH, type SidebarSectionButton } from "../stores/sidebar_sections";
import { visibleNotes } from "../stores/notes";
import { t } from "../i18n/index";

/** The buttons of the sidebar icon bar of the right sidebar: the Needs you, Notes, and Chats sidebar sections. */
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
  clickSidebarSectionIcon(id === "notes" || id === "chats" ? id : "toHandle");
}
</script>

<template>
  <aside class="right" :style="{ width: `${settings.rightCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.rightWidth}px` }">
    <div v-if="settings.rightCollapsed === false" class="sidebar-section-body">
      <ToHandlePanel v-if="settings.rightSidebarSection === 'toHandle'" />
      <ChatsPanel v-else-if="settings.rightSidebarSection === 'chats'" />
      <NotesPanel v-else />
    </div>
    <SidebarIconBar
      :sidebar-sections="sidebarSections"
      :selected-id="settings.rightCollapsed ? null : settings.rightSidebarSection"
      :label="t('rightPanel.label')"
      @select="selectSidebarSection"
    />
  </aside>
</template>

<style scoped>
.right {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side); overflow: hidden;
  display: flex; min-height: 0;
}
.sidebar-section-body {
  flex: 1 1 auto; min-width: 0; min-height: 0; border-right: 1px solid var(--line); padding-top: 5px;
  display: flex; flex-direction: column;
}
</style>
