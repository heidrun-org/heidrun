<script setup lang="ts">
import { computed } from "vue";
import { state } from "../stores/session";
import ActionsPanel from "./ActionsPanel.vue";
import SidebarIconBar from "./SidebarIconBar.vue";
import FilesPanel from "./FilesPanel.vue";
import SourceControlPanel from "./SourceControlPanel.vue";
import { currentGit } from "../stores/git";
import { actionStatus, currentProject } from "../stores/project";
import { settings } from "../stores/settings";
import { clickSidebarSectionIcon, COLLAPSED_SIDEBAR_WIDTH, type SidebarSectionButton } from "../stores/sidebar_sections";
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

/** The buttons of the sidebar icon bar of the left sidebar: the Files, Scripts, and Source control sidebar sections, in this order. */
const sidebarSections = computed((): SidebarSectionButton[] => [
  { id: "files", label: t("filesPanel.sidebarSection"), icon: "folder2", badge: 0 },
  { id: "actions", label: t("sidebar.sidebarSection.actions"), icon: "play-circle", badge: runningScripts.value, isLive: true },
  {
    id: "sourceControl",
    label: t("sourceControlPanel.sidebarSection"),
    icon: "git",
    badge: (currentGit.value?.changed ?? 0) + (currentGit.value?.untracked ?? 0),
  },
]);

function selectSidebarSection(id: string) {
  if (id === "sourceControl" || id === "files") {
    clickSidebarSectionIcon(id);
    return;
  }
  clickSidebarSectionIcon("actions");
}
</script>

<template>
  <aside class="side" :style="{ width: `${settings.leftCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.leftWidth}px` }">
    <SidebarIconBar
      :sidebar-sections="sidebarSections"
      :selected-id="settings.leftCollapsed ? null : settings.leftSidebarSection"
      :label="t('sidebar.navigationBarLabel')"
      side="left"
      :is-collapsed="settings.leftCollapsed"
      @select="selectSidebarSection"
      @toggle="settings.leftCollapsed = !settings.leftCollapsed"
    />
    <div v-if="settings.leftCollapsed === false" class="sidebar-section-body">
      <ActionsPanel v-if="settings.leftSidebarSection === 'actions'" />
      <SourceControlPanel v-else-if="settings.leftSidebarSection === 'sourceControl'" />
      <FilesPanel v-else />
    </div>
  </aside>
</template>

<style scoped>
.side {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side); overflow: hidden;
  display: flex;
}
.sidebar-section-body {
  flex: 1 1 auto; min-width: 0; border-left: 1px solid var(--line); padding: 5px 0 16px; overflow-y: auto;
  display: flex; flex-direction: column;
}
</style>
