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

const running = computed(() => {
  const ws = state.selectedWorkspaceId;
  const p = currentProject.value;
  if (!ws || !p) return 0;
  return p.config.actions.filter((a) => actionStatus(ws, a) === "running").length;
});

const tabs = computed(() => [
  { id: "pane" as const, label: "Panneau", badge: 0 },
  { id: "actions" as const, label: "Actions", badge: running.value },
  { id: "git" as const, label: "Git", badge: currentForge.value?.requests.length ?? 0 },
  { id: "notes" as const, label: "Notes", badge: notes.list.length },
]);
</script>

<template>
  <aside class="right" :style="{ width: `${settings.rightWidth}px` }">
    <div class="seg" role="tablist" aria-label="Panneau de droite">
      <button title="Show this tab"
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="settings.rightTab === t.id"
        :class="{ on: settings.rightTab === t.id }"
        @click="settings.rightTab = t.id"
      >
        {{ t.label }}<span v-if="t.badge" class="badge" :class="{ live: t.id === 'actions' }">{{ t.badge }}</span>
      </button>
    </div>
    <Inspector v-if="settings.rightTab === 'pane'" />
    <ActionsPanel v-else-if="settings.rightTab === 'actions'" />
    <GitPanel v-else-if="settings.rightTab === 'git'" />
    <NotesPanel v-else />
  </aside>
</template>

<style scoped>
.right {
  flex-shrink: 0; min-width: 0; border-left: 1px solid var(--line); background: var(--panel);
  display: flex; flex-direction: column; min-height: 0;
}
.seg { display: flex; gap: 3px; margin: 14px 16px 0; padding: 3px; border-radius: 9px; background: var(--bg); }
.seg button {
  flex: 1; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--muted);
  font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.seg button.on { background: var(--hover); color: var(--text); }
.badge {
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #2a2e33; color: var(--text-2);
  font-size: 10px; display: inline-flex; align-items: center; justify-content: center;
}
.badge.live { background: #13282a; color: var(--working); }
</style>
