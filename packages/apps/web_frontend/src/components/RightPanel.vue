<script setup lang="ts">
import { computed } from "vue";
import Inspector from "./Inspector.vue";
import ActionsPanel from "./ActionsPanel.vue";
import NotesPanel from "./NotesPanel.vue";
import GitPanel from "./GitPanel.vue";
import { currentForge } from "../stores/git";
import { settings } from "../stores/settings";
import { notes } from "../stores/notes";
import { actionStatus, currentProject } from "../stores/project";
import { state } from "../stores/session";
import { t } from "../i18n/index";

const running = computed(() => {
  const ws = state.selectedWorkspaceId;
  const p = currentProject.value;
  if (!ws || !p) return 0;
  return p.config.actions.filter((a) => actionStatus(ws, a) === "running").length;
});

const sidebarSections = computed(() => [
  { id: "pane" as const, label: t("rightPanel.sidebarSection.pane"), badge: 0 },
  { id: "actions" as const, label: t("rightPanel.sidebarSection.actions"), badge: running.value },
  { id: "git" as const, label: "Git", badge: currentForge.value?.requests.length ?? 0 },
  { id: "notes" as const, label: t("rightPanel.sidebarSection.notes"), badge: notes.list.length },
]);
</script>

<template>
  <aside class="right" :style="{ width: `${settings.rightWidth}px` }">
    <div class="navigation-bar" role="tablist" :aria-label="t('rightPanel.label')">
      <button :title="t('rightPanel.showSidebarSection')"
        v-for="sidebarSection in sidebarSections"
        :key="sidebarSection.id"
        role="tab"
        :aria-selected="settings.rightSidebarSection === sidebarSection.id"
        :class="{ on: settings.rightSidebarSection === sidebarSection.id }"
        @click="settings.rightSidebarSection = sidebarSection.id"
      >
        {{ sidebarSection.label }}<span v-if="sidebarSection.badge" class="badge" :class="{ live: sidebarSection.id === 'actions' }">{{ sidebarSection.badge }}</span>
      </button>
    </div>
    <Inspector v-if="settings.rightSidebarSection === 'pane'" />
    <ActionsPanel v-else-if="settings.rightSidebarSection === 'actions'" />
    <GitPanel v-else-if="settings.rightSidebarSection === 'git'" />
    <NotesPanel v-else />
  </aside>
</template>

<style scoped>
.right {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side); overflow: hidden;
  display: flex; flex-direction: column; min-height: 0;
}
.navigation-bar { display: flex; gap: 2px; margin: 14px 16px 0; border-bottom: 1px solid var(--line-strong); flex-shrink: 0; }
.navigation-bar button {
  flex: 1 1 auto; min-width: 0; height: 34px; margin-bottom: -1px; padding: 0 10px; border: 1px solid transparent;
  border-radius: 6px 6px 0 0; background: transparent; color: var(--muted); font-size: var(--font-size); font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.navigation-bar button:hover:not(.on) { border-color: var(--line) var(--line) transparent; color: var(--text-2); }
.navigation-bar button.on { background: var(--side); color: var(--text); border-color: var(--line-strong) var(--line-strong) var(--side); }
.badge {
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--line-strong); color: var(--text-2);
  font-size: var(--font-size); display: inline-flex; align-items: center; justify-content: center;
}
.badge.live { background: var(--tint-working); color: var(--working); }
</style>
