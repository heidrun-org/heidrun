<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import InlineRename from "./InlineRename.vue";
import {
  actionStatus,
  addAction,
  currentProject,
  loadProject,
  project,
  removeAction,
  renameAction,
  runAction,
  runDetected,
  stopAction,
  suggestions,
  type Action,
} from "../stores/project";
import { state, workspaceLabel } from "../stores/session";
import { shortPath } from "../lib/format";

const ws = computed(() => state.selectedWorkspaceId);
const p = currentProject;
const error = computed(() => (ws.value ? project.errors[ws.value] : undefined));

// Load (or reload) the project file whenever the workspace changes.
watch(ws, (id) => id && loadProject(id), { immediate: true });

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

const STATUS_TEXT = { idle: "", running: "en cours", finished: "terminée" } as const;

function status(a: Action) {
  return ws.value ? actionStatus(ws.value, a) : "idle";
}
</script>

<template>
  <div class="panel">
    <template v-if="ws && p">
      <div class="head">
        <div class="eyebrow">Actions · {{ workspaceLabel(ws) }}</div>
        <div class="path mono" :title="p.config_path">{{ shortPath(p.root) }}/.herdr-desk.json</div>
      </div>

      <div v-if="!p.config.actions.length && !adding" class="empty">
        Aucune action pour ce projet. Ajoute une commande ou choisis une suggestion ci-dessous.
      </div>

      <div v-for="a in p.config.actions" :key="a.id" class="action" :class="status(a)">
        <button class="main" :title="status(a) === 'idle' ? `Lancer dans un nouvel onglet` : `Aller à l’onglet`" @click="runAction(ws, a)">
          <span class="dot" :class="status(a) === 'running' ? 'working' : status(a) === 'finished' ? 'done' : ''"></span>
          <span class="text">
            <InlineRename
              v-if="renaming === a.id"
              :value="a.label"
              label="Nom de l’action"
              @save="(v) => { renameAction(ws!, a.id, v); renaming = null; }"
              @cancel="renaming = null"
            />
            <span v-else class="label" @dblclick.stop="renaming = a.id">{{ a.label }}</span>
            <span class="cmd mono">{{ a.command }}</span>
          </span>
          <span v-if="STATUS_TEXT[status(a)]" class="state" :class="status(a)">{{ STATUS_TEXT[status(a)] }}</span>
        </button>
        <div class="tools">
          <button v-if="status(a) === 'running'" class="tool" aria-label="Arrêter (ctrl+C)" title="Arrêter (ctrl+C)" @click="stopAction(ws, a)">■</button>
          <button v-else class="tool" aria-label="Lancer" :title="status(a) === 'finished' ? 'Relancer dans son onglet' : 'Lancer'" @click="runAction(ws, a, true)">▶</button>
          <ConfirmButton label="×" armed-label="Retirer ?" :aria-label="`Retirer l’action ${a.label}`" @confirm="removeAction(ws, a.id)" />
        </div>
      </div>

      <form v-if="adding" class="add" @submit.prevent="submit">
        <label class="sr" for="act-cmd">Commande</label>
        <input id="act-cmd" v-model="command" class="mono" placeholder="make dev" autofocus spellcheck="false" />
        <label class="sr" for="act-label">Nom (facultatif)</label>
        <input id="act-label" v-model="label" placeholder="Nom (facultatif)" spellcheck="false" />
        <div class="row">
          <button class="btn" type="button" @click="adding = false">Annuler</button>
          <button class="btn primary" type="submit">Ajouter</button>
        </div>
      </form>
      <button v-else class="btn dashed" @click="adding = true">+ Ajouter une action</button>

      <template v-if="suggestions.length">
        <div class="eyebrow sub">Suggestions</div>
        <div v-for="d in visibleSuggestions" :key="d.command" class="sugg">
          <span class="grow">
            <span class="mono">{{ d.command }}</span>
            <span class="src">{{ d.source }}</span>
          </span>
          <button class="tool" :aria-label="`Lancer ${d.command} une fois`" title="Lancer une fois" @click="runDetected(ws, d)">▶</button>
          <button class="tool" :aria-label="`Ajouter ${d.command} aux actions`" title="Ajouter aux actions" @click="addAction(ws, d.label, d.command)">+</button>
        </div>
        <button v-if="suggestions.length > 6" class="link" @click="showAllSuggestions = !showAllSuggestions">
          {{ showAllSuggestions ? "Moins" : `Voir les ${suggestions.length}` }}
        </button>
      </template>
    </template>
    <p v-else-if="error" class="err mono">{{ error }}</p>
    <p v-else class="empty">Ouvre un terminal dans ce workspace pour détecter son dossier de projet.</p>
  </div>
</template>

<style scoped>
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.path { font-size: 11px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
.action {
  display: flex; align-items: stretch; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field);
}
.action.running { border-color: #1f4643; background: #10201f; }
.main {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px 6px 10px 12px;
  border: none; background: transparent; text-align: left; border-radius: 10px;
}
.text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.label { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmd { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state { font-size: 11px; white-space: nowrap; }
.state.running { color: var(--working); }
.state.finished { color: var(--done); }
.tools { display: flex; align-items: center; gap: 2px; padding-right: 6px; }
.tool {
  width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  font-size: 11px; display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover { background: var(--hover); color: var(--text); }
.add { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 10px; background: var(--field); }
.add input {
  height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--bg);
  outline: none; font-size: 12px;
}
.row { display: flex; justify-content: flex-end; gap: 6px; }
.dashed { border-style: dashed; justify-content: center; height: 34px; }
.sub { margin-top: 14px; }
.sugg { display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; border-radius: 8px; }
.sugg:hover { background: #16191c; }
.grow { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; font-size: 12px; overflow: hidden; }
.grow .mono { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); }
.src { font-size: 10.5px; color: var(--faint); white-space: nowrap; }
.link { align-self: flex-start; border: none; background: none; color: var(--muted); font-size: 12px; padding: 4px 10px; }
.link:hover { color: var(--text); }
.err { color: var(--fail); font-size: 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
