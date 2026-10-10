<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, ref, watch } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import InlineRename from "./InlineRename.vue";
import {
  actionPane,
  actionStatus,
  addAction,
  clearRecent,
  recentRuns,
  currentProject,
  loadProject,
  project,
  removeAction,
  renameAction,
  runAction,
  runDetected,
  stopAction,
  restartAction,
  suggestions,
  type Action,
} from "../stores/project";
import { state, workspaceLabel } from "../stores/session";
import { settings } from "../stores/settings";
import { openNewCustomScriptModal } from "../stores/newCustomScript";
import { ago } from "../lib/format";
import { t } from "../i18n/index";

const ws = computed(() => state.selectedWorkspaceId);
const p = currentProject;
const error = computed(() => (ws.value ? project.errors[ws.value] : undefined));

// Load (or reload) the project file whenever the workspace changes.
watch(ws, (id) => id && loadProject(id), { immediate: true });

const renaming = ref<string | null>(null);
const showAllSuggestions = ref(false);

const visibleSuggestions = computed(() =>
  showAllSuggestions.value ? suggestions.value : suggestions.value.slice(0, 6),
);

const STATUS_TEXT_KEY = { idle: "", running: "actionsPanel.status.running", finished: "actionsPanel.status.finished" } as const;

function status(a: Action) {
  return ws.value ? actionStatus(ws.value, a) : "idle";
}
function isRestarting(a: Action) {
  const pane = ws.value ? actionPane(ws.value, a) : null;
  return !!pane && !!project.restarting[pane.pane_id];
}
</script>

<template>
  <div class="panel">
    <template v-if="ws && p">
      <div class="head">
        <div class="eyebrow">{{ t("actionsPanel.title", { workspace: workspaceLabel(ws) }) }}</div>
      </div>

      <div class="section-row">
        <button
          class="section-head"
          :aria-expanded="!settings.scriptsCustomFolded"
          :title="t(settings.scriptsCustomFolded ? 'actionsPanel.unfoldSection' : 'actionsPanel.foldSection', { section: t('actionsPanel.customScripts') })"
          @click="settings.scriptsCustomFolded = !settings.scriptsCustomFolded"
        >
          <Icon :name="settings.scriptsCustomFolded ? 'chevron-right' : 'chevron-down'" />
          <span class="eyebrow">{{ t("actionsPanel.customScripts") }}</span>
        </button>
        <button class="tool create" :aria-label="t('actionsPanel.createTitle')" :title="t('actionsPanel.createTitle')" @click="openNewCustomScriptModal()">+</button>
      </div>
      <template v-if="!settings.scriptsCustomFolded">
        <div v-if="p.config.actions.length === 0" class="empty">
          {{ t("actionsPanel.empty") }}
        </div>

        <div v-for="a in p.config.actions" :key="a.id" class="action" :class="status(a)">
          <button class="main" :title="status(a) === 'idle' ? t('actionsPanel.runInNewTab') : t('actionsPanel.goToTab')" @click="runAction(ws, a)">
            <span class="dot" :class="status(a) === 'running' ? 'working' : status(a) === 'finished' ? 'done' : ''"></span>
            <span class="text">
              <InlineRename
                v-if="renaming === a.id"
                :value="a.label"
                :label="t('actionsPanel.actionName')"
                @save="(v) => { renameAction(ws!, a.id, v); renaming = null; }"
                @cancel="renaming = null"
              />
              <span :title="t('actionsPanel.renameTitle')" v-else class="label" @dblclick.stop="renaming = a.id">{{ a.label }}</span>
              <span class="cmd mono">{{ a.command }}</span>
            </span>
            <span v-if="STATUS_TEXT_KEY[status(a)]" class="state" :class="status(a)">{{ t(STATUS_TEXT_KEY[status(a)]) }}</span>
          </button>
          <div class="tools">
            <button
              v-if="status(a) === 'running' || isRestarting(a)"
              class="tool"
              :class="{ spin: isRestarting(a) }"
              :disabled="isRestarting(a)"
              :aria-label="t('actionsPanel.restart')"
              :title="t('actionsPanel.restartTitle')"
              @click="restartAction(ws, a)"
            >↻</button>
            <button v-if="status(a) === 'running'" class="tool" :aria-label="t('actionsPanel.stop')" :title="t('actionsPanel.stop')" @click="stopAction(ws, a)"><Icon name="stop-fill" /></button>
            <button v-else class="tool" :aria-label="t('actionsPanel.run')" :title="status(a) === 'finished' ? t('actionsPanel.runAgainInTab') : t('actionsPanel.run')" @click="runAction(ws, a, true)"><Icon name="play-fill" /></button>
            <ConfirmButton icon="x-lg" :confirm-label="t('actionsPanel.removeConfirm')" :question="t('actionsPanel.removeAction', { action: a.label })" @confirm="removeAction(ws, a.id)" />
          </div>
        </div>
      </template>

      <template v-if="recentRuns.length">
        <div class="section-row sub">
          <button
            class="section-head"
            :aria-expanded="!settings.scriptsRecentFolded"
            :title="t(settings.scriptsRecentFolded ? 'actionsPanel.unfoldSection' : 'actionsPanel.foldSection', { section: t('actionsPanel.recent') })"
            @click="settings.scriptsRecentFolded = !settings.scriptsRecentFolded"
          >
            <Icon :name="settings.scriptsRecentFolded ? 'chevron-right' : 'chevron-down'" />
            <span class="eyebrow">{{ t("actionsPanel.recent") }}</span>
          </button>
          <button class="tool clear" :aria-label="t('actionsPanel.clearTitle')" :title="t('actionsPanel.clearTitle')" @click="clearRecent(ws)"><Icon name="trash" /></button>
        </div>
        <template v-if="!settings.scriptsRecentFolded">
          <div v-for="r in recentRuns" :key="r.command" class="sugg">
            <span class="grow">
              <span class="mono">{{ r.command }}</span>
              <span class="src">{{ ago(r.at) }}</span>
            </span>
            <button class="tool" :aria-label="t('actionsPanel.runAgainCommand', { command: r.command })" :title="t('actionsPanel.restart')" @click="runDetected(ws, r)"><Icon name="play-fill" /></button>
            <button
              v-if="!p.config.actions.some((a) => a.command === r.command)"
              class="tool"
              :aria-label="t('actionsPanel.addCommand', { command: r.command })"
              :title="t('actionsPanel.addToActions')"
              @click="addAction(ws, r.label, r.command)"
            >+</button>
          </div>
        </template>
      </template>

      <template v-if="suggestions.length">
        <button
          class="section-head sub"
          :aria-expanded="!settings.scriptsExistingFolded"
          :title="t(settings.scriptsExistingFolded ? 'actionsPanel.unfoldSection' : 'actionsPanel.foldSection', { section: t('actionsPanel.existingScripts') })"
          @click="settings.scriptsExistingFolded = !settings.scriptsExistingFolded"
        >
          <Icon :name="settings.scriptsExistingFolded ? 'chevron-right' : 'chevron-down'" />
          <span class="eyebrow">{{ t("actionsPanel.existingScripts") }}</span>
        </button>
        <template v-if="!settings.scriptsExistingFolded">
          <div v-for="d in visibleSuggestions" :key="d.command" class="sugg">
            <span class="grow">
              <span class="mono">{{ d.command }}</span>
              <span class="src">{{ d.source }}</span>
            </span>
            <button class="tool" :aria-label="t('actionsPanel.runOnceCommand', { command: d.command })" :title="t('actionsPanel.runOnce')" @click="runDetected(ws, d)"><Icon name="play-fill" /></button>
            <button class="tool" :aria-label="t('actionsPanel.addCommand', { command: d.command })" :title="t('actionsPanel.addToActions')" @click="addAction(ws, d.label, d.command)">+</button>
          </div>
          <button :title="showAllSuggestions ? t('actionsPanel.showFewerTitle') : t('actionsPanel.showAllTitle')" v-if="suggestions.length > 6" class="link" @click="showAllSuggestions = !showAllSuggestions">
            {{ showAllSuggestions ? t("actionsPanel.showFewer") : t("actionsPanel.showAll", { total: suggestions.length }) }}
          </button>
        </template>
      </template>
    </template>
    <p v-else-if="error" class="err mono">{{ error }}</p>
    <p v-else class="empty">{{ t("actionsPanel.noProject") }}</p>
  </div>
</template>

<style scoped>
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.empty { margin: 0; font-size: var(--font-size); color: var(--muted); line-height: 1.5; }
.action {
  display: flex; align-items: stretch; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field);
}
.action.running { border-color: #1f4643; background: #10201f; }
.main {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px 6px 10px 12px;
  border: none; background: transparent; text-align: left; border-radius: 10px;
}
.text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.label { font-weight: 600; font-size: var(--font-size); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmd { font-size: var(--font-size); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state { font-size: var(--font-size); white-space: nowrap; }
.state.running { color: var(--working); }
.state.finished { color: var(--done); }
.tools { display: flex; align-items: center; gap: 2px; padding-right: 6px; }
.tool {
  width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  font-size: var(--font-size); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover { background: var(--hover); color: var(--text); }
.section-row { display: flex; align-items: center; justify-content: space-between; }
.section-head {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; border: none; background: none;
  padding: 2px 0; color: var(--muted);
}
.section-head:hover { color: var(--text); }
.section-head.sub, .section-row.sub { margin-top: 14px; }

.sugg { display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; border-radius: 8px; }
.sugg:hover { background: var(--hover-soft); }
.grow { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; font-size: var(--font-size); overflow: hidden; }
.grow .mono { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); }
.src { font-size: var(--font-size); color: var(--faint); white-space: nowrap; }
.link { align-self: flex-start; border: none; background: none; color: var(--muted); font-size: var(--font-size); padding: 4px 10px; }
.link:hover { color: var(--text); }
.err { color: var(--fail); font-size: var(--font-size); }
.tool.spin { animation: spin 1s linear infinite; opacity: 0.7; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
