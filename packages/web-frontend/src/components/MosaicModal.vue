<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { mosaic } from "../stores/mosaic";
import { allPanes, paneFullName, selectPane } from "../stores/session";
import { agentList, showSubagent, subagents } from "../stores/subagents";
import { settings } from "../stores/settings";
import { ago } from "../lib/format";

interface Transcript {
  id: string;
  agent_type: string | null;
  description: string | null;
  modified: number;
  lines: string[];
}

const pane = computed(() => allPanes.value.find((p) => p.pane_id === mosaic.paneId) ?? null);
const sid = computed(() => pane.value?.tokens?.hd_sid ?? null);
const tiles = ref<Transcript[]>([]);
const names = ref<string[]>([]);
const current = ref<number | null>(null);
const error = ref("");
const loaded = ref(false);
const el = ref<HTMLElement>();

let loading = false;
async function load() {
  if (!pane.value) return close();
  // A slow read must not pile up with the next one.
  if (loading) return;
  loading = true;
  try {
    await loadOnce();
  } finally {
    loading = false;
  }
}

async function loadOnce() {
  if (!pane.value) return;
  if (!sid.value) {
    error.value = "Session Claude inconnue : le suivi Claude (status line) doit être activé.";
    loaded.value = true;
    return;
  }
  // Tiles already at the bottom follow the new lines; one scrolled up stays put.
  const atBottom = new Map<string, boolean>();
  el.value?.querySelectorAll<HTMLElement>(".lines").forEach((n) => atBottom.set(n.dataset.id ?? "", n.scrollHeight - n.scrollTop - n.clientHeight < 24));
  try {
    const [t, list] = await Promise.all([
      invoke<Transcript[]>("claude_session_agents", { sessionId: sid.value, lines: 40 }),
      agentList(pane.value.pane_id),
    ]);
    tiles.value = t;
    names.value = list?.names ?? [];
    current.value = list?.current ?? null;
    error.value = t.length ? "" : "Pas de journal trouvé pour cette session dans ~/.claude/projects.";
  } catch (e) {
    error.value = String(e);
  }
  loaded.value = true;
  // Each tile shows its latest lines.
  nextTick(() =>
    el.value?.querySelectorAll<HTMLElement>(".lines").forEach((n) => {
      if (atBottom.get(n.dataset.id ?? "") !== false) n.scrollTop = n.scrollHeight;
    }),
  );
}

/**
 * Name of the tile in Claude's agent list (what the arrows reach). Only a single,
 * unambiguous match: several "general-purpose" agents must not all lead to the first.
 */
function listName(t: Transcript): string | null {
  if (t.id === "main") return names.value[0] ?? "main";
  const words = (s: string | null) => (s ?? "").toLowerCase().split(/[^\p{L}\p{N}_-]+/u);
  const matches = names.value.filter((x, i) => {
    if (i === 0) return false;
    const n = x.toLowerCase();
    // The same type shared by several tiles says nothing.
    const typeUnique = tiles.value.filter((o) => o.agent_type === t.agent_type).length === 1;
    return (typeUnique && n === (t.agent_type ?? "").toLowerCase()) || t.id.toLowerCase().startsWith(n) || words(t.description).includes(n);
  });
  return matches.length === 1 ? matches[0] : null;
}
const isShown = (t: Transcript) => {
  const n = listName(t);
  return n != null && current.value != null && names.value[current.value] === n;
};
const title = (t: Transcript) => (t.id === "main" ? "main" : t.agent_type || listName(t) || t.id.slice(0, 8));
const active = (t: Transcript) => Date.now() / 1000 - t.modified < 90;
/** At work: the main thread, a journal written lately, or still in Claude's agent list. */
const working = (t: Transcript) => t.id === "main" || active(t) || listName(t) != null;
const workingCount = computed(() => tiles.value.filter(working).length);
// Tiles that appear on "Tous" show their latest lines, like the others.
watch(
  () => settings.mosaicActiveOnly,
  () => nextTick(() => el.value?.querySelectorAll<HTMLElement>(".lines").forEach((n) => (n.scrollTop = n.scrollHeight))),
);
const shownTiles = computed(() => (settings.mosaicActiveOnly ? tiles.value.filter(working) : tiles.value));

async function show(t: Transcript) {
  const p = pane.value;
  const n = listName(t);
  if (!p || !n) return;
  selectPane(p);
  if (await showSubagent(p.pane_id, n)) close();
}

let timer = 0;
onMounted(() => {
  load();
  timer = window.setInterval(load, 2500);
  window.addEventListener("keydown", onKey, true);
});
onBeforeUnmount(() => {
  window.clearInterval(timer);
  window.removeEventListener("keydown", onKey, true);
});
function close() {
  mosaic.paneId = null;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div ref="el" class="modal" role="dialog" aria-label="Mosaïque des agents">
      <header>
        <div>
          <div class="eyebrow">Mosaïque</div>
          <h2>{{ pane ? paneFullName(pane) : "" }}</h2>
        </div>
        <div class="seg" role="radiogroup" aria-label="Agents affichés" @keydown.left.prevent="settings.mosaicActiveOnly = true" @keydown.right.prevent="settings.mosaicActiveOnly = false">
          <button role="radio" :aria-checked="settings.mosaicActiveOnly" :class="{ on: settings.mosaicActiveOnly }" title="Le fil principal, les agents qui écrivent encore ou présents dans la liste de Claude" @click="settings.mosaicActiveOnly = true">Actifs <span class="n">{{ workingCount }}</span></button>
          <button role="radio" :aria-checked="!settings.mosaicActiveOnly" :class="{ on: !settings.mosaicActiveOnly }" title="Tous les agents de la session, terminés compris" @click="settings.mosaicActiveOnly = false">Tous <span class="n">{{ tiles.length }}</span></button>
        </div>
        <span class="hint">Lecture seule, d’après les journaux de Claude · un clic affiche l’agent dans le terminal</span>
        <button class="close" aria-label="Fermer (Échap)" @click="close"><Icon name="x-lg" /></button>
      </header>
      <div v-if="!loaded" class="empty">Lecture des journaux…</div>
      <div v-else-if="error && !tiles.length" class="empty">{{ error }}</div>
      <div v-else class="grid" :style="{ fontSize: `${Math.max(10, settings.codeFontSize - 1)}px` }">
        <div v-if="!shownTiles.length" class="empty">Aucun agent actif. <button class="link" @click="settings.mosaicActiveOnly = false">Voir tous les agents</button></div>
        <button
          v-for="t in shownTiles"
          :key="t.id"
          class="tile"
          :class="{ shown: isShown(t), off: !listName(t) }"
          :disabled="!listName(t) || !!subagents.busy"
          :title="listName(t) ? `Afficher ${listName(t)} dans le terminal` : 'Pas (ou plus) dans la liste des agents de Claude'"
          @click="show(t)"
        >
          <span class="t-head">
            <span class="dot" :class="{ on: active(t) }"></span>
            <span class="t-name">{{ title(t) }}</span>
            <span v-if="isShown(t)" class="tag">affiché</span>
            <span class="t-when">{{ ago(t.modified * 1000) }}</span>
          </span>
          <span v-if="t.description" class="t-desc">{{ t.description }}</span>
          <span class="lines mono" :data-id="t.id"><span v-for="(l, i) in t.lines" :key="i" class="l" :class="{ tool: l.startsWith('⏺ ') && /^⏺ \w+\(/.test(l), res: l.startsWith('  ⎿'), you: l.startsWith('> ') }">{{ l }}</span></span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 58; background: rgba(0, 0, 0, 0.55); display: flex; padding: 28px; }
.modal {
  flex: 1; min-width: 0; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.eyebrow { color: var(--question); }
h2 { margin: 2px 0 0; font-size: 15px; font-weight: 600; }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg); gap: 2px; margin-left: 8px; }
.seg button { color: var(--muted); font-size: 12px; padding: 3px 10px; border-radius: 6px; }
.seg button.on { background: var(--hover); color: var(--text); }
.seg .n { margin-left: 3px; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.link { color: var(--accent); font-size: 13px; cursor: pointer; }
.grid > .empty { grid-column: 1 / -1; }
.hint { margin-left: auto; font-size: 11.5px; color: var(--muted); }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: 18px; }
.close:hover { background: var(--hover); color: var(--text); }
.empty { padding: 40px; text-align: center; color: var(--muted); font-size: 13px; }
.grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); grid-auto-rows: minmax(240px, 1fr); gap: 10px; padding: 12px; overflow: auto; }
.tile {
  min-height: 0; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; text-align: left; border-radius: 10px;
  border: 1px solid var(--line-strong); background: var(--bg); overflow: hidden;
}
.tile:hover:not(:disabled) { border-color: var(--done); }
.tile.shown { border-color: var(--question); }
.tile.off { opacity: 0.75; cursor: default; }
.t-head { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--idle); flex-shrink: 0; }
.dot.on { background: var(--working); }
.t-name { font-weight: 600; }
.tag { font-size: 10.5px; padding: 1px 6px; border-radius: 6px; background: color-mix(in srgb, var(--question) 18%, transparent); color: var(--question); }
.t-when { margin-left: auto; font-size: 11px; color: var(--muted); }
.t-desc { font-size: 11.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lines { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; margin-top: 4px; line-height: 1.45; }
.l { white-space: pre-wrap; word-break: break-word; color: var(--text-2); }
.l.tool { color: var(--done); }
.l.res { color: var(--muted); }
.l.you { color: var(--accent); }
</style>
