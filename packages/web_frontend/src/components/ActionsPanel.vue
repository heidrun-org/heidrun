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
  moveAction,
  moveSuggestion,
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
import { ago, shortPath } from "../lib/format";
import { useReorder } from "../lib/reorder";
import { t } from "../i18n/index";

const ws = computed(() => state.selectedWorkspaceId);
const p = currentProject;
const error = computed(() => (ws.value ? project.errors[ws.value] : undefined));

// Load (or reload) the project file whenever the workspace changes.
watch(ws, (id) => id && loadProject(id), { immediate: true });

const actionsDrag = useReorder("y", (id, at) => ws.value && moveAction(ws.value, id, at));
const suggDrag = useReorder("y", (id, at) => ws.value && moveSuggestion(ws.value, id, at));

const adding = ref(false);
const label = ref("");
const command = ref("");
const renaming = ref<string | null>(null);
const showAllSuggestions = ref(false);

const visibleSuggestions = computed(() =>
  showAllSuggestions.value ? suggestions.value : suggestions.value.slice(0, 6),
);

async function submit() {
  if (!ws.value || !command.value.trim()) return;
  await addAction(ws.value, label.value, command.value);
  label.value = "";
  command.value = "";
  adding.value = false;
}

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
        <div class="path mono" :title="p.config_path">{{ shortPath(p.root) }}/.heidrun/config.json</div>
      </div>

      <div v-if="!p.config.actions.length && !adding" class="empty">
        {{ t("actionsPanel.empty") }}
      </div>

      <div
        v-for="(a, ai) in p.config.actions"
        :key="a.id"
        class="action"
        :class="[
          status(a),
          {
            dragging: actionsDrag.dragging.value === a.id,
            'drop-before': actionsDrag.gap.value === ai,
            'drop-after': actionsDrag.gap.value === ai + 1 && ai === p.config.actions.length - 1,
          },
        ]"
        :draggable="renaming !== a.id"
        @dragstart="actionsDrag.onDragStart($event, a.id)"
        @dragover="actionsDrag.onDragOver($event, ai)"
        @drop="actionsDrag.onDrop($event, p.config.actions.map((x) => x.id))"
        @dragend="actionsDrag.onDragEnd()"
      >
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

      <form v-if="adding" class="add" @submit.prevent="submit">
        <label class="sr" for="act-cmd">{{ t("actionsPanel.command") }}</label>
        <input id="act-cmd" v-model="command" class="mono" placeholder="make dev" autofocus spellcheck="false" />
        <label class="sr" for="act-label">{{ t("actionsPanel.nameOptional") }}</label>
        <input id="act-label" v-model="label" :placeholder="t('actionsPanel.nameOptional')" spellcheck="false" />
        <div class="row">
          <button :title="t('actionsPanel.cancelTitle')" class="btn" type="button" @click="adding = false">{{ t("actionsPanel.cancel") }}</button>
          <button :title="t('actionsPanel.addTitle')" class="btn primary" type="submit">{{ t("actionsPanel.add") }}</button>
        </div>
      </form>
      <button :title="t('actionsPanel.addNewTitle')" v-else class="btn dashed" @click="adding = true">{{ t("actionsPanel.addNew") }}</button>

      <template v-if="recentRuns.length">
        <div class="sub-head">
          <div class="eyebrow">{{ t("actionsPanel.recent") }}</div>
          <button :title="t('actionsPanel.clearTitle')" class="link small" @click="clearRecent(ws)">{{ t("actionsPanel.clear") }}</button>
        </div>
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

      <template v-if="suggestions.length">
        <div class="eyebrow sub">{{ t("actionsPanel.suggestions") }}</div>
        <div
          v-for="(d, di) in visibleSuggestions"
          :key="d.command"
          class="sugg"
          :class="{
            dragging: suggDrag.dragging.value === d.command,
            'drop-before': suggDrag.gap.value === di,
            'drop-after': suggDrag.gap.value === di + 1 && di === visibleSuggestions.length - 1,
          }"
          draggable="true"
          :title="t('actionsPanel.dragToReorder')"
          @dragstart="suggDrag.onDragStart($event, d.command)"
          @dragover="suggDrag.onDragOver($event, di)"
          @drop="suggDrag.onDrop($event, visibleSuggestions.map((x) => x.command))"
          @dragend="suggDrag.onDragEnd()"
        >
          <span class="grip" aria-hidden="true">⋮⋮</span>
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
    <p v-else-if="error" class="err mono">{{ error }}</p>
    <p v-else class="empty">{{ t("actionsPanel.noProject") }}</p>
  </div>
</template>

<style scoped>
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.path { font-size: var(--font-size); color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.add { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 10px; background: var(--field); }
.add input {
  height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--bg);
  outline: none; font-size: var(--font-size);
}
.row { display: flex; justify-content: flex-end; gap: 6px; }
.dashed { border-style: dashed; justify-content: center; height: 34px; }
.sub { margin-top: 14px; }
.sub-head { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.link.small { padding: 0; font-size: var(--font-size); }
.dragging { opacity: 0.4; }
.drop-before, .drop-after { position: relative; }
.drop-before::before, .drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.drop-before::before { top: -5px; }
.drop-after::after { bottom: -5px; }
.grip { color: var(--faint); cursor: grab; font-size: var(--font-size); letter-spacing: -2px; padding: 0 2px; user-select: none; }

.sugg { display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; border-radius: 8px; }
.sugg:hover { background: var(--hover-soft); }
.grow { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; font-size: var(--font-size); overflow: hidden; }
.grow .mono { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); }
.src { font-size: var(--font-size); color: var(--faint); white-space: nowrap; }
.link { align-self: flex-start; border: none; background: none; color: var(--muted); font-size: var(--font-size); padding: 4px 10px; }
.link:hover { color: var(--text); }
.err { color: var(--fail); font-size: var(--font-size); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.tool.spin { animation: spin 1s linear infinite; opacity: 0.7; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
