<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import {
  allPanes,
  closePane,
  closeTab,
  cycleTab,
  cycleWorkspace,
  newTerminal,
  shiftTab,
  shiftWorkspace,
  recentCommands,
  runInNewPane,
  runInPane,
  selectPane,
  selectedPane,
  splitPane,
  startRename,
  state,
  workspaceLabel,
} from "../stores/session";
import { STATUS_LABEL, paneName } from "../lib/format";
import { FONTS, resetZoom, settings, zoom } from "../stores/settings";
import { currentProject, runAction } from "../stores/project";

interface Item {
  section: string;
  label: string;
  hint?: string;
  mono?: boolean;
  run: () => unknown;
}

const query = ref("");
const index = ref(0);
const input = ref<HTMLInputElement>();
const recent = recentCommands();

function close() {
  state.paletteOpen = false;
}

const items = computed<Item[]>(() => {
  const q = query.value.trim();
  const lower = q.toLowerCase();
  const list: Item[] = [];
  const shell = selectedPane.value && !selectedPane.value.agent ? selectedPane.value : null;

  if (q) {
    list.push({ section: "Lancer", label: `Lancer « ${q} » dans un nouveau panneau`, hint: "↵", run: () => runInNewPane(q) });
    if (shell) list.push({ section: "Lancer", label: `Lancer dans ${paneName(shell)}`, hint: "⌥↵", run: () => runInPane(shell.pane_id, q) });
    list.push({ section: "Lancer", label: "Lancer et me notifier à la fin", hint: "⇧↵", run: () => runInNewPane(q, "passed|failed|error|Error|✓|✗|done|Done") });
  }

  for (const cmd of recent.filter((c) => !lower || c.toLowerCase().includes(lower)).slice(0, 5)) {
    list.push({ section: "Récentes", label: cmd, mono: true, run: () => runInNewPane(cmd) });
  }

  for (const p of allPanes.value.filter((x) => !lower || paneName(x).toLowerCase().includes(lower)).slice(0, 6)) {
    list.push({
      section: "Aller à",
      label: `${paneName(p)} · ${workspaceLabel(p.workspace_id)}`,
      hint: p.agent ? STATUS_LABEL[p.agent_status] : "terminal",
      run: () => selectPane(p),
    });
  }

  const sel = selectedPane.value;
  const wsId = state.selectedWorkspaceId;
  const proj = currentProject.value;
  if (wsId && proj) {
    for (const a of proj.config.actions.filter((x) => !lower || x.label.toLowerCase().includes(lower) || x.command.toLowerCase().includes(lower))) {
      list.push({ section: "Actions du projet", label: a.label, hint: a.command, run: () => runAction(wsId, a) });
    }
  }
  const actions: Item[] = [
    { section: "Terminaux", label: "Nouveau terminal", hint: "⌘T", run: () => newTerminal() },
    { section: "Terminaux", label: "Diviser à droite", hint: "⌘D", run: () => splitPane("right") },
    { section: "Terminaux", label: "Diviser en bas", hint: "⇧⌘D", run: () => splitPane("down") },
    ...(sel ? [{ section: "Terminaux", label: `Fermer le panneau ${paneName(sel)}`, hint: "⌘W ⌘W", run: () => closePane(sel.pane_id) }] : []),
    ...(state.selectedTabId ? [{ section: "Terminaux", label: "Fermer l’onglet courant", run: () => closeTab(state.selectedTabId!) }] : []),
    ...(state.selectedWorkspaceId ? [{ section: "Renommer", label: "Renommer le workspace", run: () => startRename("ws", state.selectedWorkspaceId!) }] : []),
    ...(state.selectedTabId ? [{ section: "Renommer", label: "Renommer l’onglet", run: () => startRename("tab", state.selectedTabId!) }] : []),
    ...(sel ? [{ section: "Renommer", label: "Renommer le panneau", run: () => startRename("pane", sel.pane_id) }] : []),
    { section: "Navigation", label: "Onglet suivant", hint: "⌥⌘→", run: () => cycleTab(1) },
    { section: "Navigation", label: "Onglet précédent", hint: "⌥⌘←", run: () => cycleTab(-1) },
    { section: "Navigation", label: "Workspace suivant", hint: "⌥⌘↓", run: () => cycleWorkspace(1) },
    { section: "Réorganiser", label: "Déplacer l’onglet à gauche", hint: "⇧⌥⌘←", run: () => shiftTab(-1) },
    { section: "Réorganiser", label: "Déplacer l’onglet à droite", hint: "⇧⌥⌘→", run: () => shiftTab(1) },
    { section: "Réorganiser", label: "Monter le workspace", hint: "⇧⌥⌘↑", run: () => shiftWorkspace(-1) },
    { section: "Réorganiser", label: "Descendre le workspace", hint: "⇧⌥⌘↓", run: () => shiftWorkspace(1) },
    { section: "Navigation", label: "Workspace précédent", hint: "⌥⌘↑", run: () => cycleWorkspace(-1) },
    {
      section: "Affichage",
      label: settings.mouseMode === "select" ? "Souris : envoyer à l’app (molette, clics)" : "Souris : sélectionner du texte",
      run: () => (settings.mouseMode = settings.mouseMode === "select" ? "app" : "select"),
    },
    { section: "Affichage", label: "Agrandir la police", hint: "⌘+", run: () => zoom(0.5) },
    { section: "Affichage", label: "Réduire la police", hint: "⌘−", run: () => zoom(-0.5) },
    { section: "Affichage", label: "Taille de police par défaut", hint: "⌘0", run: () => resetZoom() },
    { section: "Affichage", label: "Barre latérale gauche", hint: "⌘B", run: () => (settings.leftOpen = !settings.leftOpen) },
    { section: "Affichage", label: "Panneau de droite", hint: "⌥⌘B", run: () => (settings.rightOpen = !settings.rightOpen) },
    ...FONTS.map((f) => ({ section: "Affichage", label: `Police : ${f.label}`, hint: f.id === settings.fontId ? "✓" : undefined, run: () => (settings.fontId = f.id) })),
  ];
  list.push(...actions.filter((a) => !lower || a.label.toLowerCase().includes(lower)));
  return list;
});

const grouped = computed(() => {
  const groups: { section: string; items: { item: Item; i: number }[] }[] = [];
  items.value.forEach((item, i) => {
    let g = groups.find((x) => x.section === item.section);
    if (!g) groups.push((g = { section: item.section, items: [] }));
    g.items.push({ item, i });
  });
  return groups;
});

function execute(item?: Item) {
  if (!item) return;
  close();
  item.run();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") return close();
  if (e.key === "ArrowDown") {
    e.preventDefault();
    index.value = Math.min(items.value.length - 1, index.value + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    index.value = Math.max(0, index.value - 1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const q = query.value.trim();
    const shell = selectedPane.value && !selectedPane.value.agent ? selectedPane.value : null;
    if (q && e.altKey && shell) return execute({ section: "", label: "", run: () => runInPane(shell.pane_id, q) });
    if (q && e.shiftKey) return execute({ section: "", label: "", run: () => runInNewPane(q, "passed|failed|error|Error|✓|✗|done|Done") });
    execute(items.value[index.value]);
  }
}

onMounted(() => nextTick(() => input.value?.focus()));
</script>

<template>
  <div class="scrim" @mousedown.self="close">
    <div class="palette" role="dialog" aria-label="Palette de commandes">
      <div class="field">
        <span class="mono prompt">$</span>
        <label class="sr" for="palette-input">Commande ou recherche</label>
        <input
          id="palette-input"
          ref="input"
          v-model="query"
          class="mono"
          placeholder="Taper une commande, un agent, une action…"
          spellcheck="false"
          autocomplete="off"
          @input="index = 0"
          @keydown="onKey"
        />
        <kbd>esc</kbd>
      </div>
      <div class="list">
        <template v-for="g in grouped" :key="g.section">
          <div class="eyebrow sec">{{ g.section }}</div>
          <button
            v-for="{ item, i } in g.items"
            :key="i"
            class="row"
            :class="{ active: i === index, mono: item.mono }"
            @mouseenter="index = i"
            @click="execute(item)"
          >
            <span class="grow">{{ item.label }}</span>
            <span v-if="item.hint" class="hint">{{ item.hint }}</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; background: rgba(5, 6, 7, 0.55); z-index: 40; display: flex; justify-content: center; align-items: flex-start; padding-top: 120px; }
.palette {
  width: min(560px, calc(100% - 32px)); border-radius: 14px; border: 1px solid #33383e; background: var(--field);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6); overflow: hidden;
}
.field { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px; border-bottom: 1px solid #262a2f; }
.prompt { color: var(--working); font-size: 14px; }
.field input { flex: 1; border: none; background: none; outline: none; font-size: 15px; color: var(--text); }
kbd { font: 400 11px var(--mono); color: var(--faint); }
.list { padding: 8px; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.sec { padding: 10px 10px 4px; }
.row {
  display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 10px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-2); font-weight: 500; text-align: left;
}
.row.mono { font-family: var(--mono); font-weight: 400; font-size: 12.5px; }
.row.active { background: #232830; color: var(--text); }
.grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font: 400 11px var(--mono); color: var(--muted); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
