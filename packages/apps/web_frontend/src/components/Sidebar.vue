<script setup lang="ts">
import { computed } from "vue";
import { state } from "../stores/session";
import ActionsPanel from "./ActionsPanel.vue";
import NavigationBar from "./NavigationBar.vue";
import SourceControlPanel from "./SourceControlPanel.vue";
import { currentGit } from "../stores/git";
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

/** The buttons of the navigation bar of the left sidebar: the Scripts and Source control sidebar sections. */
const sidebarSections = computed(() => [
  { id: "actions", label: t("sidebar.sidebarSection.actions"), badge: runningScripts.value, isLive: true },
  {
    id: "sourceControl",
    label: t("sourceControlPanel.sidebarSection"),
    badge: (currentGit.value?.changed ?? 0) + (currentGit.value?.untracked ?? 0),
  },
]);

function selectSidebarSection(id: string) {
  openSidebarSection(id === "sourceControl" ? "sourceControl" : "actions");
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
        <ActionsPanel v-if="settings.leftSidebarSection === 'actions'" />
        <SourceControlPanel v-else />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.side {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side);
  display: flex; flex-direction: column; gap: 24px; padding: 5px 0 16px; overflow-y: auto;
}
.sidebar-sections { flex: 1 0 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.left-navigation-bar { padding: 0 16px; }
.sidebar-section-body { flex: 1 0 280px; min-height: 0; display: flex; flex-direction: column; }
</style>
