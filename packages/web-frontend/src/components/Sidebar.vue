<script setup lang="ts">
import { computed, ref } from "vue";
import {
  allPanes,
  answerChoice,
  attention,
  dismiss,
  finishRename,
  moveWorkspaceInView,
  newWorkspace,
  selectPane,
  selectWorkspace,
  startRename,
  state,
  tabLabel,
  workspaceLabel,
  workspacePanes,
  sidebarWorkspaces as workspaces,
} from "../stores/session";
import { statusLabel, agentKind, ago, paneName } from "../lib/format";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { settings } from "../stores/settings";
import { remote } from "../stores/claude";
import { useReorder } from "../lib/reorder";
import { git } from "../stores/git";
import type { AgentInfo } from "../lib/types";
import { isDocked, toggleDock } from "../stores/dock";

function summary(p: AgentInfo): string {
  const q = state.questions[p.pane_id];
  if (q && p.agent_status !== "blocked") return q.text;
  if (p.agent_status === "blocked") return p.state_labels?.blocked || p.title || "attend une décision";
  return p.title || p.terminal_title_stripped || "travail terminé, à relire";
}

function paneCount(wsId: string) {
  return allPanes.value.filter((p) => p.workspace_id === wsId).length;
}

/** Agents running in a workspace, by kind: [{ kind: "Claude", n: 2 }, …]. */
function agentsIn(wsId: string) {
  const counts = new Map<string, number>();
  for (const p of allPanes.value) {
    if (p.workspace_id !== wsId || !p.agent) continue;
    const k = agentKind(p);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([kind, n]) => ({ kind, n }));
}

/** Index of the first workspace without an agent, where the divider goes. */
const firstQuiet = computed(() => workspaces.value.findIndex((w) => !agentsIn(w.workspace_id).length));

const ws = useReorder("y", (id, at) => moveWorkspaceInView(id, at));

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
  <aside class="side" :style="{ width: `${settings.leftWidth}px` }">
    <section class="group tight">
      <div class="eyebrow pad">Workspaces</div>
      <template v-for="(w, wi) in workspaces" :key="w.workspace_id">
        <div v-if="wi === firstQuiet && wi > 0" class="ws-divider" role="separator" aria-label="Workspaces sans agent"></div>
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
            quiet: !agentsIn(w.workspace_id).length,
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
          <span
            v-if="git.status[w.workspace_id]?.ahead"
            class="git-ahead"
            :title="`${git.status[w.workspace_id]!.ahead} commit(s) pas encore poussé(s)`"
          >↑{{ git.status[w.workspace_id]!.ahead }}</span>
          <span
            v-for="a in agentsIn(w.workspace_id)"
            :key="a.kind"
            class="agent-tag"
            :class="a.kind.toLowerCase()"
            :title="`${a.n} session${a.n > 1 ? 's' : ''} ${a.kind}`"
          >{{ a.kind }}<template v-if="a.n > 1"> {{ a.n }}</template></span>
          <span class="count">{{ paneCount(w.workspace_id) }}</span>
        </button>
      </template>
      <form v-if="creating" class="create" @submit.prevent="createWorkspace">
        <label class="sr" for="ws-path">Dossier du workspace</label>
        <input id="ws-path" v-model="newPath" class="mono" placeholder="~/Projects/…" autofocus @keydown.esc="creating = false" />
      </form>
      <button title="Create a new workspace" v-else class="item dashed" @click="creating = true">+ Nouveau workspace</button>
    </section>

    <section class="group tight">
      <div class="eyebrow pad">Panneaux · {{ state.selectedWorkspaceId ? workspaceLabel(state.selectedWorkspaceId) : "" }}</div>
      <template v-for="p in workspacePanes" :key="p.pane_id">
        <div v-if="state.renaming === `pane:${p.pane_id}`" class="item small editing">
          <span class="dot" :class="p.agent ? p.agent_status : 'process'"></span>
          <InlineRename
            :value="p.label || paneName(p)"
            label="Nouveau nom du panneau (vide pour revenir au nom automatique)"
            allow-empty
            @save="(v) => finishRename('pane', p.pane_id, v)"
            @cancel="state.renaming = null"
          />
        </div>
        <button
          v-else
          class="item small"
          :class="{ active: p.pane_id === state.selectedPaneId }"
          :title="`${p.terminal_title_stripped || p.agent || 'terminal'} · double-clic pour renommer`"
          @click="selectPane(p)"
          @dblclick="startRename('pane', p.pane_id)"
        >
          <span class="dot" :class="[p.agent ? p.agent_status : 'process', state.pulse[p.pane_id] ? 'pulse' : '']"></span>
          <span class="grow">{{ paneName(p) }}</span>
          <span v-if="remote.byPane[p.pane_id] === 'active'" class="rc" title="Remote Control connecté">RC</span>
          <span class="status" :class="p.agent ? 't-' + p.agent_status : 't-idle'">
            {{ p.agent ? statusLabel(p.agent_status) : "terminal" }}
          </span>
        </button>
      </template>
    </section>
    <!-- At the bottom: cards come and go without moving the workspaces list. -->
    <section v-if="attention.length" class="group attention">
      <div class="eyebrow pad">À traiter</div>
      <div v-for="p in attention" :key="p.pane_id" class="card" :class="[p.agent_status, { question: p.agent_status !== 'blocked' && state.questions[p.pane_id] }]">
        <button title="Show this pane" class="card-main" @click="selectPane(p)">
          <span class="row">
            <span class="name">{{ workspaceLabel(p.workspace_id) }} – {{ tabLabel(p.tab_id) }}</span>
            <span v-if="p.agent_status !== 'blocked' && state.questions[p.pane_id]" class="badge t-question">QUESTION</span>
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
          class="card-dock"
          :class="{ on: isDocked(p.pane_id) }"
          :aria-label="`${isDocked(p.pane_id) ? 'Retirer d’à côté' : 'Ouvrir à côté'} ${paneName(p)}`"
          :title="isDocked(p.pane_id) ? 'Retirer de la vue à côté' : 'Ouvrir à côté : le suivre sans quitter l’onglet en cours'"
          @click="toggleDock(p.pane_id)"
        ><Icon :name="isDocked(p.pane_id) ? 'pin-fill' : 'pin'" /></button>
        <button class="card-x" :aria-label="`Masquer ${paneName(p)}`" title="Masquer jusqu’au prochain changement" @click="dismiss(p)">
          <Icon name="x-lg" />
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.side {
  flex-shrink: 0; min-width: 0; border-right: 1px solid var(--line); background: var(--panel);
  display: flex; flex-direction: column; gap: 24px; padding: 16px 12px; overflow-y: auto;
}
.group { display: flex; flex-direction: column; gap: 8px; }
.group.tight { gap: 2px; }
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
.card-x:hover, .card-dock:hover { background: rgba(var(--wash), 0.08); color: var(--text); }
.card-dock {
  position: absolute; top: 34px; right: 8px; width: 22px; height: 22px; border: none; border-radius: 6px; font-size: 13px;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.card-dock.on { color: var(--accent); }
.card.blocked { border-color: #5c2826; background: var(--tint-err); }
.choices { display: flex; flex-direction: column; gap: 4px; padding: 0 10px 10px; }
.choice-d {
  margin: 0 0 2px; padding: 6px 8px; border-radius: 6px; background: var(--tint-err); color: var(--text-2);
  font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: 84px; overflow: hidden;
}
.choice-q { font-size: 11.5px; color: var(--text-2); margin: 0 2px 2px; }
.choice {
  display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 4px 8px; border-radius: 7px;
  border: 1px solid #4a2523; background: #2a1514; color: var(--text); text-align: left; font-size: 12px;
}
.choice:hover { background: #3a1c1b; border-color: #7d3330; }
.choice-n { flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; background: #4a2523; color: var(--blocked);
  font: 600 11px var(--mono); display: inline-flex; align-items: center; justify-content: center; }
.choice-l { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card.question { border-color: #4a3866; background: var(--tint-merged); }
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
.item:hover { background: var(--hover-soft); }
.item.active { background: var(--hover); color: var(--text); }
.item.dashed { margin-top: 4px; border: 1px dashed var(--line-strong); color: var(--muted-2); font-size: 12px; }
.grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc {
  font: 600 9.5px var(--mono); letter-spacing: 0.4px; padding: 1px 5px; border-radius: 4px;
  background: var(--tint-working); color: var(--working);
}
.count, .status { font-size: 11px; color: var(--muted); }
/* Workspaces with an agent session vs. plain shells or nothing running. */
.git-ahead { flex-shrink: 0; font: 600 10.5px var(--mono); color: var(--accent); }
.ws-divider { height: 1px; margin: 7px 10px; background: var(--line-strong); }
.agent-tag {
  flex-shrink: 0; height: 18px; padding: 0 6px; border-radius: 5px; font-size: 10.5px; font-weight: 600;
  display: inline-flex; align-items: center; background: var(--chip); color: var(--text-2); letter-spacing: 0.2px;
}
.agent-tag.claude { background: rgba(217, 119, 87, 0.14); color: #e3a083; }
.agent-tag.codex { background: rgba(110, 168, 254, 0.13); color: #9cc3ff; }
.item.quiet:not(.active) .grow { color: var(--muted); }
.item.quiet .dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--faint); }
.key { font: 400 10.5px var(--mono); color: var(--faint); opacity: 0; transition: opacity 0.15s; }
.item:hover .key, .item.active .key { opacity: 1; }
.create input {
  width: 100%; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line-strong);
  background: var(--field); outline: none; font-size: 12px;
}
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
