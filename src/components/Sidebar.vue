<script setup lang="ts">
import { ref } from "vue";
import {
  allPanes,
  attention,
  dismiss,
  finishRename,
  moveWorkspace,
  newWorkspace,
  selectPane,
  selectWorkspace,
  startRename,
  state,
  tabLabel,
  workspaceLabel,
  workspacePanes,
  workspaces,
} from "../stores/session";
import { STATUS_LABEL, ago, paneName } from "../lib/format";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { useReorder } from "../lib/reorder";
import type { AgentInfo } from "../lib/types";

function summary(p: AgentInfo): string {
  if (p.agent_status === "blocked") return p.state_labels?.blocked || p.title || "attend une décision";
  return p.title || p.terminal_title_stripped || "travail terminé, à relire";
}

function paneCount(wsId: string) {
  return allPanes.value.filter((p) => p.workspace_id === wsId).length;
}

const ws = useReorder("y", (id, at) => moveWorkspace(id, at));

const creating = ref(false);
const newPath = ref("");
async function createWorkspace() {
  const path = newPath.value.trim();
  const label = path ? path.split("/").filter(Boolean).pop() ?? null : null;
  await newWorkspace(path || null, label);
  creating.value = false;
  newPath.value = "";
}
</script>

<template>
  <aside class="side">
    <section v-if="attention.length" class="group">
      <div class="eyebrow pad">À traiter</div>
      <div v-for="p in attention" :key="p.pane_id" class="card" :class="p.agent_status">
        <button class="card-main" @click="selectPane(p)">
          <span class="row">
            <span class="name">{{ workspaceLabel(p.workspace_id) }} – {{ tabLabel(p.tab_id) }}</span>
            <span class="badge" :class="'t-' + p.agent_status">{{ STATUS_LABEL[p.agent_status].toUpperCase() }}</span>
          </span>
          <span class="desc"><span class="who">{{ paneName(p) }}</span> · {{ summary(p) }}</span>
          <span v-if="state.since[p.pane_id]" class="when">{{ ago(state.since[p.pane_id]) }}</span>
        </button>
        <button class="card-x" :aria-label="`Masquer ${paneName(p)}`" title="Masquer jusqu’au prochain changement" @click="dismiss(p)">
          <Icon name="close" />
        </button>
      </div>
    </section>

    <section class="group tight">
      <div class="eyebrow pad">Workspaces</div>
      <template v-for="(w, wi) in workspaces" :key="w.workspace_id">
        <div v-if="state.renaming === `ws:${w.workspace_id}`" class="item editing">
          <span class="dot" :class="w.agent_status === 'idle' ? '' : w.agent_status"></span>
          <InlineRename
            :value="w.label"
            label="Nouveau nom du workspace"
            @save="(v) => finishRename('ws', w.workspace_id, v)"
            @cancel="state.renaming = null"
          />
        </div>
        <button
          v-else
          class="item"
          :class="{
            active: w.workspace_id === state.selectedWorkspaceId,
            dragging: ws.dragging.value === w.workspace_id,
            'drop-before': ws.gap.value === wi,
            'drop-after': ws.gap.value === wi + 1 && wi === workspaces.length - 1,
          }"
          draggable="true"
          title="Double-clic pour renommer · glisser pour déplacer"
          @dragstart="ws.onDragStart($event, w.workspace_id)"
          @dragover="ws.onDragOver($event, wi)"
          @drop="ws.onDrop($event, workspaces.map((x) => x.workspace_id))"
          @dragend="ws.onDragEnd()"
          @click="selectWorkspace(w.workspace_id)"
          @dblclick="startRename('ws', w.workspace_id)"
        >
          <span class="dot" :class="w.agent_status === 'idle' ? '' : w.agent_status"></span>
          <span class="grow">{{ w.label }}</span>
          <span v-if="wi < 9" class="key">⌘{{ wi + 1 }}</span>
          <span class="count">{{ paneCount(w.workspace_id) }}</span>
        </button>
      </template>
      <form v-if="creating" class="create" @submit.prevent="createWorkspace">
        <label class="sr" for="ws-path">Dossier du workspace</label>
        <input id="ws-path" v-model="newPath" class="mono" placeholder="~/Projects/…" autofocus @keydown.esc="creating = false" />
      </form>
      <button v-else class="item dashed" @click="creating = true">+ Nouveau workspace</button>
    </section>

    <section class="group tight">
      <div class="eyebrow pad">Panneaux · {{ state.selectedWorkspaceId ? workspaceLabel(state.selectedWorkspaceId) : "" }}</div>
      <button
        v-for="p in workspacePanes"
        :key="p.pane_id"
        class="item small"
        :class="{ active: p.pane_id === state.selectedPaneId }"
        @click="selectPane(p)"
      >
        <span class="dot" :class="[p.agent ? p.agent_status : 'process', state.pulse[p.pane_id] ? 'pulse' : '']"></span>
        <span class="grow">{{ paneName(p) }}</span>
        <span class="status" :class="p.agent ? 't-' + p.agent_status : 't-idle'">
          {{ p.agent ? STATUS_LABEL[p.agent_status] : "terminal" }}
        </span>
      </button>
    </section>
  </aside>
</template>

<style scoped>
.side {
  width: 280px; flex-shrink: 0; border-right: 1px solid var(--line); background: var(--panel);
  display: flex; flex-direction: column; gap: 24px; padding: 16px 12px; overflow-y: auto;
}
.group { display: flex; flex-direction: column; gap: 8px; }
.group.tight { gap: 2px; }
.pad { padding: 0 8px 6px; }
.card { position: relative; border-radius: 10px; border: 1px solid #22344f; background: #121821; }
.card-main {
  width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 12px 34px 12px 12px;
  border: none; background: transparent; border-radius: 10px;
}
.card-x {
  position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border: none; border-radius: 6px;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.card-x:hover { background: rgba(255, 255, 255, 0.08); color: var(--text); }
.card.blocked { border-color: #4a3a1e; background: #1e1912; }
.card .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.name { font-size: 13px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { flex-shrink: 0; }
.who { color: var(--text); font-weight: 500; }
.badge { font-size: 11px; font-weight: 600; letter-spacing: 0.4px; }
.desc { font-size: 12px; color: #b8bcc0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.when { font-size: 11px; color: var(--muted); }
.item {
  display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px; border-radius: 8px;
  border: none; background: transparent; color: var(--text-2); font-weight: 500; text-align: left;
}
.item.small { height: 34px; font-weight: 400; }
.item { position: relative; }
.item.dragging { opacity: 0.4; }
.item.drop-before::before, .item.drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.item.drop-before::before { top: -1px; }
.item.drop-after::after { bottom: -1px; }
.item.editing { background: var(--hover); padding-right: 4px; }
.item:hover { background: #181b1e; }
.item.active { background: var(--hover); color: var(--text); }
.item.dashed { margin-top: 4px; border: 1px dashed var(--line-strong); color: #9aa0a6; font-size: 12px; }
.grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count, .status { font-size: 11px; color: var(--muted); }
.key { font: 400 10.5px var(--mono); color: var(--faint); opacity: 0; transition: opacity 0.15s; }
.item:hover .key, .item.active .key { opacity: 1; }
.create input {
  width: 100%; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line-strong);
  background: var(--field); outline: none; font-size: 12px;
}
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
