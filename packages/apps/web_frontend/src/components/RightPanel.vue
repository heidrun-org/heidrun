<script setup lang="ts">
import { computed } from "vue";
import Inspector from "./Inspector.vue";
import NavigationBar from "./NavigationBar.vue";
import NotesPanel from "./NotesPanel.vue";
import { settings } from "../stores/settings";
import { openSidebarSection } from "../stores/sidebar_sections";
import { notes } from "../stores/notes";
import { t } from "../i18n/index";

const sidebarSections = computed(() => [
  { id: "pane", label: t("rightPanel.sidebarSection.pane"), badge: 0 },
  { id: "notes", label: t("rightPanel.sidebarSection.notes"), badge: notes.list.length },
]);

function selectSidebarSection(id: string) {
  openSidebarSection(id === "notes" ? "notes" : "pane");
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
    <Inspector v-if="settings.rightSidebarSection === 'pane'" />
    <NotesPanel v-else />
  </aside>
</template>

<style scoped>
.right {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side); overflow: hidden;
  display: flex; flex-direction: column; min-height: 0;
}
.right-navigation-bar { margin: 14px 16px 0; }
</style>
