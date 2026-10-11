<script setup lang="ts">
import { computed } from "vue";
import { attention, state } from "../stores/session";
import ActionsPanel from "./ActionsPanel.vue";
import GitPanel from "./GitPanel.vue";
import NavigationBar from "./NavigationBar.vue";
import ToHandlePanel from "./ToHandlePanel.vue";
import { currentForge } from "../stores/git";
import { actionStatus, currentProject } from "../stores/project";
import { settings } from "../stores/settings";
import { openSidebarSection } from "../stores/sidebar_sections";
import { t } from "../i18n/index";

/** The number of scripts of the selected workspace that are running. */
const runningScripts = computed(() => {
  const workspaceId = state.selectedWorkspaceId;
  const project = currentProject.value;
  if (workspaceId === null || !project) {
    return 0;
  }
  return project.config.actions.filter((action) => actionStatus(workspaceId, action) === "running").length;
});

/** The buttons of the navigation bar of the left sidebar: the To handle, Scripts, and Git sidebar sections. */
const sidebarSections = computed(() => [
  {
    id: "toHandle",
    label: t("sidebar.sidebarSection.toHandle"),
    badge: attention.value.length,
    isAlert: attention.value.some((pane) => pane.agent_status === "blocked"),
  },
  { id: "actions", label: t("sidebar.sidebarSection.actions"), badge: runningScripts.value, isLive: true },
  { id: "git", label: "Git", badge: currentForge.value?.requests.length ?? 0 },
]);

function selectSidebarSection(id: string) {
  openSidebarSection(id === "toHandle" || id === "git" ? id : "actions");
}
</script>

<template>
  <aside class="side" :style="{ width: `${settings.leftWidth}px` }">
    <div class="sidebar-sections">
      <NavigationBar
        class="left-navigation-bar"
        :sidebar-sections="sidebarSections"
        :selected-id="settings.leftSidebarSection"
        :label="t('sidebar.navigationBarLabel')"
        @select="selectSidebarSection"
      />
      <div class="sidebar-section-body">
        <ToHandlePanel v-if="settings.leftSidebarSection === 'toHandle'" />
        <ActionsPanel v-else-if="settings.leftSidebarSection === 'actions'" />
        <GitPanel v-else />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.side {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side);
  display: flex; flex-direction: column; gap: 24px; padding: 16px 12px; overflow-y: auto;
}
.sidebar-sections { flex: 1 0 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.left-navigation-bar { margin: 0 4px; }
.sidebar-section-body { flex: 1 0 280px; min-height: 0; display: flex; flex-direction: column; }
</style>
