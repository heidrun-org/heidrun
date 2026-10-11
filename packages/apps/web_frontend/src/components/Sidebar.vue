<script setup lang="ts">
import { computed } from "vue";
import { answerChoice, attention, dismiss, selectPane, state, tabLabel, workspaceLabel } from "../stores/session";
import { statusLabel, ago, paneName } from "../lib/format";
import ActionsPanel from "./ActionsPanel.vue";
import GitPanel from "./GitPanel.vue";
import Icon from "./Icon.vue";
import NavigationBar from "./NavigationBar.vue";
import { currentForge } from "../stores/git";
import { actionStatus, currentProject } from "../stores/project";
import { settings } from "../stores/settings";
import { openSidebarSection } from "../stores/sidebar_sections";
import type { AgentInfo } from "../lib/types";
import { isPinned, togglePinnedPane } from "../stores/pinned_panes";
import { t } from "../i18n/index";

function summary(p: AgentInfo): string {
  const q = state.questions[p.pane_id];
  if (q && p.agent_status !== "blocked") return q.text;
  if (p.agent_status === "blocked") return p.state_labels?.blocked || p.title || t("sidebar.waitingForDecision");
  return p.title || p.terminal_title_stripped || t("sidebar.workDoneToReview");
}

/** The number of scripts of the selected workspace that are running. */
const runningScripts = computed(() => {
  const workspaceId = state.selectedWorkspaceId;
  const project = currentProject.value;
  if (workspaceId === null || !project) {
    return 0;
  }
  return project.config.actions.filter((action) => actionStatus(workspaceId, action) === "running").length;
});

/** The buttons of the navigation bar of the left sidebar: the Scripts and Git sidebar sections. */
const sidebarSections = computed(() => [
  { id: "actions", label: t("sidebar.sidebarSection.actions"), badge: runningScripts.value, isLive: true },
  { id: "git", label: "Git", badge: currentForge.value?.requests.length ?? 0 },
]);

function selectSidebarSection(id: string) {
  openSidebarSection(id === "git" ? "git" : "actions");
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
        <GitPanel v-else />
      </div>
    </div>
    <!-- At the bottom: cards come and go without moving the sidebar section above them. -->
    <section v-if="attention.length" class="group attention">
      <div class="eyebrow pad">{{ t("sidebar.toHandle") }}</div>
      <div v-for="p in attention" :key="p.pane_id" class="card" :class="[p.agent_status, { question: p.agent_status !== 'blocked' && state.questions[p.pane_id] }]">
        <button :title="t('sidebar.showPane')" class="card-main" @click="selectPane(p)">
          <span class="row">
            <span class="name">{{ workspaceLabel(p.workspace_id) }} – {{ tabLabel(p.tab_id) }}</span>
            <span v-if="p.agent_status !== 'blocked' && state.questions[p.pane_id]" class="badge t-question">{{ t("sidebar.question") }}</span>
            <span v-else class="badge" :class="'t-' + p.agent_status">{{ statusLabel(p.agent_status).toUpperCase() }}</span>
          </span>
          <span class="desc"><span class="who">{{ paneName(p) }}</span> · {{ summary(p) }}</span>
          <span v-if="state.since[p.pane_id]" class="when">{{ ago(state.since[p.pane_id]) }}</span>
        </button>
        <!-- The agent's own menu: answer without opening its tab. -->
        <div v-if="p.agent_status === 'blocked' && state.choices[p.pane_id]" class="choices">
          <pre v-if="state.choices[p.pane_id].detail" class="choice-d mono">{{ state.choices[p.pane_id].detail }}</pre>
          <span v-if="state.choices[p.pane_id].question" class="choice-q">{{ state.choices[p.pane_id].question }}</span>
          <button
            v-for="o in state.choices[p.pane_id].options"
            :key="o.n"
            class="choice"
            :title="o.label"
            @click="answerChoice(p.pane_id, o.n)"
          >
            <span class="choice-n">{{ o.n }}</span><span class="choice-l">{{ o.label }}</span>
          </button>
        </div>
        <button
          class="card-pin"
          :class="{ on: isPinned(p.pane_id) }"
          :aria-label="isPinned(p.pane_id) ? t('sidebar.unpinLabel', { name: paneName(p) }) : t('sidebar.pinLabel', { name: paneName(p) })"
          :title="isPinned(p.pane_id) ? t('sidebar.unpinTitle') : t('sidebar.pinTitle')"
          @click="togglePinnedPane(p.pane_id)"
        ><Icon :name="isPinned(p.pane_id) ? 'pin-fill' : 'pin'" /></button>
        <button class="card-x" :aria-label="t('sidebar.hideLabel', { name: paneName(p) })" :title="t('sidebar.hideTitle')" @click="dismiss(p)">
          <Icon name="x-lg" />
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.side {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side);
  display: flex; flex-direction: column; gap: 24px; padding: 16px 12px; overflow-y: auto;
}
.group { display: flex; flex-direction: column; gap: 8px; }
.sidebar-sections { flex: 1 0 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.left-navigation-bar { margin: 0 4px; }
.sidebar-section-body { flex: 1 0 280px; min-height: 0; display: flex; flex-direction: column; }
.group.attention { margin-top: auto; padding-top: 4px; }
.pad { padding: 0 8px 6px; }
.card { position: relative; border-radius: 10px; border: 1px solid #22344f; background: var(--tint-done); }
.card-main {
  width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 12px 34px 12px 12px;
  border: none; background: transparent; border-radius: 10px;
}
.card-x {
  position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border: none; border-radius: 6px;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.card-x:hover, .card-pin:hover { background: rgba(var(--wash), 0.08); color: var(--text); }
.card-pin {
  position: absolute; top: 34px; right: 8px; width: 22px; height: 22px; border: none; border-radius: 6px; font-size: var(--font-size);
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.card-pin.on { color: var(--accent); }
.card.blocked { border-color: #5c2826; background: var(--tint-err); }
.choices { display: flex; flex-direction: column; gap: 4px; padding: 0 10px 10px; }
.choice-d {
  margin: 0 0 2px; padding: 6px 8px; border-radius: 6px; background: var(--tint-err); color: var(--text-2);
  font-size: var(--font-size); white-space: pre-wrap; word-break: break-all; max-height: 84px; overflow: hidden;
}
.choice-q { font-size: var(--font-size); color: var(--text-2); margin: 0 2px 2px; }
.choice {
  display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 4px 8px; border-radius: 7px;
  border: 1px solid #4a2523; background: #2a1514; color: var(--text); text-align: left; font-size: var(--font-size);
}
.choice:hover { background: #3a1c1b; border-color: #7d3330; }
.choice-n { flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; background: #4a2523; color: var(--blocked);
  font: 600 var(--font-size) var(--mono); display: inline-flex; align-items: center; justify-content: center; }
.choice-l { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card.question { border-color: #4a3866; background: var(--tint-merged); }
.card .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.name { font-size: var(--font-size); font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { flex-shrink: 0; }
.who { color: var(--text); font-weight: 500; }
.badge { font-size: var(--font-size); font-weight: 600; letter-spacing: 0.4px; }
.desc { font-size: var(--font-size); color: #b8bcc0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.when { font-size: var(--font-size); color: var(--muted); }
</style>
