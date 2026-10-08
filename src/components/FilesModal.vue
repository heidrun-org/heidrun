<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { buildTree, closeTab, files, isImage, openTab, quickSearch, reloadFiles, visibleRows, type TreeRow } from "../stores/files";
import { settings } from "../stores/settings";
import { toast } from "../stores/session";
import { fillInput } from "../stores/input";
import { CODE_THEMES, highlightFile, languageFor } from "../lib/highlight";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import { shortPath } from "../lib/format";

const MAX_ROWS = 20000;
const q = ref("");
const qIndex = ref(0);
const searchEl = ref<HTMLInputElement>();
const codeEl = ref<HTMLElement>();
const sel = ref<{ from: number; to: number; text: string; x: number; y: number } | null>(null);

// ---- Tree / quick search ---------------------------------------------------------
const tree = computed(() => buildTree(files.list));
const rows = computed(() => visibleRows(tree.value, files.expanded, files.status));
const results = computed(() => (q.value.trim() ? quickSearch(q.value.trim(), files.list) : []));

function toggle(r: TreeRow) {
  if (r.ignored) return;
  const next = new Set(files.expanded);
  if (next.has(r.path)) next.delete(r.path);
  else next.add(r.path);
  files.expanded = next;
}
function pick(r: TreeRow) {
  if (r.dir) toggle(r);
  else openTab(r.path);
}
function openResult(i: number) {
  const p = results.value[i];
  if (!p) return;
  openTab(p);
  q.value = "";
}
function onSearchKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    qIndex.value = Math.min(results.value.length - 1, qIndex.value + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    qIndex.value = Math.max(0, qIndex.value - 1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    openResult(qIndex.value);
  }
}
watch(q, () => (qIndex.value = 0));
watch(
  () => files.searchTick,
  () => nextTick(() => searchEl.value?.focus()),
);
watch(
  () => files.showIgnored,
  () => reloadFiles(),
);

const statusLabel: Record<string, string> = { M: "modifié", A: "ajouté", D: "supprimé", R: "renommé", "?": "nouveau, non suivi", "•": "contient des modifications" };

// ---- File view --------------------------------------------------------------------
const lines = ref<string[]>([]);
const rendered = ref("");
const image = ref("");
const error = ref("");
const loading = ref(false);
const truncated = ref(false);
const md = computed(() => isMarkdown(files.active));
const reading = computed(() => md.value && settings.filesMdRead);
let seq = 0;

async function load() {
  const path = files.active;
  // First: an answer still on its way for the previous file is dropped.
  const my = ++seq;
  sel.value = null;
  lines.value = [];
  rendered.value = "";
  image.value = "";
  error.value = "";
  truncated.value = false;
  if (!path || !files.root) return;
  loading.value = true;
  try {
    if (isImage(path)) {
      const url = await invoke<string>("file_image", { root: files.root, path });
      if (my === seq) image.value = url;
      return;
    }
    if (files.status[path] === "D") {
      error.value = "Fichier supprimé (pas encore commité) : voir l’onglet Git pour son contenu d’avant.";
      return;
    }
    const text = (await invoke<string>("git_file", { root: files.root, path, rev: null })).replace(/\n$/, "");
    if (my !== seq) return;
    if (reading.value) {
      rendered.value = renderMarkdown(text);
      return;
    }
    const lang = languageFor(path);
    const all = text.length > 400_000 ? highlightFile(text, null) : highlightFile(text, lang);
    truncated.value = all.length > MAX_ROWS;
    lines.value = all.slice(0, MAX_ROWS);
    // Opened from a terminal at a line: show it.
    if (files.line) nextTick(() => codeEl.value?.querySelector(`tr[data-line="${files.line}"]`)?.scrollIntoView({ block: "center" }));
  } catch (e) {
    if (my === seq) error.value = String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
watch([() => files.active, () => files.root, reading], load, { immediate: true });
// "file:line" chip for the file already shown: just scroll.
watch(
  () => files.lineTick,
  () => {
    if (!loading.value && files.line) nextTick(() => codeEl.value?.querySelector(`tr[data-line="${files.line}"]`)?.scrollIntoView({ block: "center" }));
  },
);

const crumbs = computed(() => (files.active ? files.active.split("/") : []));
function crumbOpen(i: number) {
  const parts = crumbs.value.slice(0, i + 1);
  const next = new Set(files.expanded);
  for (let k = 1; k <= parts.length; k++) next.add(parts.slice(0, k).join("/"));
  files.expanded = next;
  q.value = "";
}

async function fullPath(): Promise<string | null> {
  if (!files.active) return null;
  try {
    return await invoke<string>("file_full_path", { root: files.root, path: files.active });
  } catch (e) {
    toast(String(e));
    return null;
  }
}
async function copyPath(abs: boolean) {
  const p = abs ? await fullPath() : files.active;
  if (!p) return;
  await writeText(p).catch(() => {});
  toast(`Copié : ${p}`);
}
async function finder() {
  const p = await fullPath();
  if (p) revealItemInDir(p).catch((e) => toast(String(e)));
}
async function vscode() {
  if (!files.active) return;
  await invoke("file_open_external", { root: files.root, path: files.active }).catch((e) => toast(String(e)));
}
function sendToAgent() {
  if (!files.active) return;
  fillInput(`@${files.active} `);
  files.open = false;
}

// Selection in the code: lines, and the actions that go with them.
function onMouseUp() {
  const s = window.getSelection();
  const text = s?.toString() ?? "";
  if (!s || !text.trim() || !codeEl.value) return (sel.value = null);
  const line = (n: Node | null) => Number((n instanceof Element ? n : n?.parentElement)?.closest("tr[data-line]")?.getAttribute("data-line") ?? 0);
  const a = line(s.anchorNode);
  const b = line(s.focusNode);
  if (!a || !b) return (sel.value = null);
  const rect = s.getRangeAt(0).getBoundingClientRect();
  const box = codeEl.value.getBoundingClientRect();
  const x = rect.left - box.left + codeEl.value.scrollLeft;
  sel.value = { from: Math.min(a, b), to: Math.max(a, b), text, x: Math.min(x, codeEl.value.scrollLeft + box.width - 330), y: rect.bottom - box.top + codeEl.value.scrollTop + 6 };
}
function askAgent(kind: "explain" | "fix") {
  const s = sel.value;
  if (!s || !files.active) return;
  const where = s.from === s.to ? `ligne ${s.from}` : `lignes ${s.from}-${s.to}`;
  const lang = languageFor(files.active) ?? "";
  const ask = kind === "explain" ? "Explique-moi ce code." : "Corrige ces lignes (explique ce qui n’allait pas).";
  fillInput(`Dans @${files.active} (${where}) :\n\n\`\`\`${lang}\n${s.text.replace(/\n$/, "")}\n\`\`\`\n\n${ask}`);
  sel.value = null;
  files.open = false;
}

// Links in rendered Markdown open in the browser.
function onMdClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) openUrl(href).catch(() => {});
}

// ---- Width of the tree --------------------------------------------------------------
let drag: { x: number; w: number } | null = null;
function startDrag(e: PointerEvent) {
  drag = { x: e.clientX, w: settings.filesListWidth };
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}
function moveDrag(e: PointerEvent) {
  if (drag) settings.filesListWidth = Math.min(700, Math.max(200, drag.w + e.clientX - drag.x));
}
function endDrag() {
  drag = null;
}

// ---- Keys ---------------------------------------------------------------------------
function close() {
  files.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (sel.value) sel.value = null;
    else if (q.value) q.value = "";
    else close();
  } else if (e.metaKey && e.code === "KeyP" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    searchEl.value?.focus();
    searchEl.value?.select();
  } else if (e.metaKey && e.code === "KeyW" && files.active) {
    // Inside the explorer, ⌘W closes the file, never the terminal pane behind.
    e.preventDefault();
    e.stopPropagation();
    closeTab(files.active);
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => searchEl.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div class="modal" role="dialog" aria-label="Fichiers du projet">
      <header class="top">
        <span class="title">Fichiers</span>
        <span class="root mono" :title="files.root">{{ shortPath(files.root) }}</span>
        <div class="tabs" role="tablist">
          <div v-for="t in files.tabs" :key="t" class="tab" :class="{ on: t === files.active }" role="tab" :title="t">
            <button class="tab-name" @click="openTab(t)">
              <span v-if="files.status[t]" class="st" :class="'s-' + files.status[t]">●</span>{{ t.split("/").pop() }}
            </button>
            <button class="tab-x" :aria-label="`Fermer ${t}`" @click="closeTab(t)">×</button>
          </div>
        </div>
        <button class="close" aria-label="Fermer (Échap)" @click="close">×</button>
      </header>

      <div class="body" :style="{ gridTemplateColumns: `${settings.filesListWidth}px 5px 1fr` }">
        <aside class="side">
          <div class="search">
            <input ref="searchEl" v-model="q" placeholder="Rechercher un fichier…  ⌘P" spellcheck="false" @keydown="onSearchKey" />
          </div>
          <div class="opts">
            <label><input v-model="files.showIgnored" type="checkbox" />Fichiers ignorés</label>
            <button class="link" title="Relire la liste des fichiers" @click="reloadFiles()">↻</button>
          </div>
          <div class="list">
            <div v-if="files.loading && !files.list.length" class="empty">Lecture…</div>
            <div v-else-if="files.error" class="empty err">{{ files.error }}</div>
            <template v-else-if="q.trim()">
              <button v-for="(p, i) in results" :key="p" class="res" :class="{ on: i === qIndex }" @mouseenter="qIndex = i" @click="openResult(i)">
                <span class="r-name">{{ p.split("/").pop() }}</span>
                <span class="r-dir mono">{{ p.split("/").slice(0, -1).join("/") }}</span>
              </button>
              <div v-if="!results.length" class="empty">Aucun fichier pour « {{ q }} ».</div>
            </template>
            <template v-else>
              <button
                v-for="r in rows"
                :key="r.path + (r.dir ? '/' : '')"
                class="row"
                :class="{ on: r.path === files.active, ignored: r.ignored, dir: r.dir }"
                :style="{ paddingLeft: `${8 + r.depth * 14}px` }"
                :title="r.status ? `${r.path} · ${statusLabel[r.status] ?? r.status}` : r.path"
                @click="pick(r)"
              >
                <span class="chev">{{ r.dir ? (r.ignored ? "" : files.expanded.has(r.path) ? "▾" : "▸") : "" }}</span>
                <span class="nm" :class="r.status ? 's-' + (r.status === '•' ? 'dir' : r.status) : ''">{{ r.name }}</span>
                <span v-if="r.status && !r.dir" class="st" :class="'s-' + r.status">{{ r.status === "?" ? "U" : r.status }}</span>
                <span v-else-if="r.status" class="st s-dir">•</span>
              </button>
              <div v-if="files.truncated" class="empty">Liste limitée aux 50 000 premiers fichiers.</div>
            </template>
          </div>
        </aside>
        <div class="drag" title="Glisser pour redimensionner" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @dblclick="settings.filesListWidth = 300"></div>

        <section class="view">
          <div v-if="files.active" class="bar">
            <nav class="crumbs mono" aria-label="Chemin">
              <template v-for="(c, i) in crumbs" :key="i">
                <span v-if="i" class="sep">/</span>
                <button :class="{ last: i === crumbs.length - 1 }" @click="crumbOpen(i)">{{ c }}</button>
              </template>
            </nav>
            <div class="tools">
              <div v-if="md" class="seg" role="radiogroup" aria-label="Affichage Markdown">
                <button :class="{ on: settings.filesMdRead }" @click="settings.filesMdRead = true">Lecture</button>
                <button :class="{ on: !settings.filesMdRead }" @click="settings.filesMdRead = false">Code</button>
              </div>
              <select v-model="settings.codeTheme" class="theme" aria-label="Thème">
                <option v-for="t in CODE_THEMES" :key="t.id" :value="t.id">{{ t.label }}</option>
              </select>
              <label class="wrap-t"><input v-model="settings.codeWrap" type="checkbox" />Retour à la ligne</label>
              <button class="tb" title="Copier le chemin relatif (⌥ : absolu)" @click="(e) => copyPath(e.altKey)">⧉ Chemin</button>
              <button class="tb" title="Voir dans le Finder" @click="finder">Finder</button>
              <button class="tb" title="Ouvrir dans VS Code" @click="vscode">VS Code</button>
              <button class="tb accent" title="Insère @chemin dans la barre de saisie de l’agent" @click="sendToAgent">→ Agent</button>
            </div>
          </div>
          <div ref="codeEl" class="code" :class="[settings.codeTheme, { wrap: settings.codeWrap }]" :style="{ fontSize: `${settings.codeFontSize}px` }" @mouseup="onMouseUp">
            <div v-if="!files.active" class="empty">Choisis un fichier à gauche, ou ⌘P pour le chercher par son nom.</div>
            <div v-else-if="error" class="empty err">{{ error }}</div>
            <div v-else-if="loading" class="empty">Chargement…</div>
            <div v-else-if="image" class="img"><img :src="image" :alt="files.active" /></div>
            <article v-else-if="reading" class="md-doc" :class="{ full: settings.mdWidth === 'full' }" @click="onMdClick" v-html="rendered"></article>
            <table v-else class="tbl">
              <tbody>
                <tr v-for="(h, i) in lines" :key="i" :data-line="i + 1" :class="{ hit: files.line === i + 1 }">
                  <td class="no">{{ i + 1 }}</td>
                  <td class="src" v-html="h || '&#8203;'"></td>
                </tr>
              </tbody>
            </table>
            <div v-if="truncated" class="empty">Affichage limité aux {{ MAX_ROWS }} premières lignes.</div>
            <div v-if="sel" class="selbar" :style="{ left: `${Math.max(8, sel.x)}px`, top: `${sel.y}px` }" @mousedown.stop.prevent>
              <span class="muted">{{ sel.from === sel.to ? `ligne ${sel.from}` : `lignes ${sel.from}–${sel.to}` }}</span>
              <button class="tb" @click="askAgent('explain')">Explique</button>
              <button class="tb" @click="askAgent('fix')">Corrige ces lignes</button>
            </div>
          </div>
          <div v-if="files.active" class="foot muted">
            {{ files.status[files.active] ? statusLabel[files.status[files.active]] : files.git ? "à jour avec git" : "hors git" }}
            · ⌘P chercher · ⌘W fermer l’onglet · ⌘+ / ⌘− taille
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
:where(button) { background: transparent; border: 0; color: inherit; font: inherit; }
.overlay { position: fixed; inset: 0; z-index: 56; background: rgba(0, 0, 0, 0.55); display: flex; padding: 24px; }
.modal { flex: 1; min-width: 0; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6); }
.top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--line); min-width: 0; }
.title { font-weight: 600; font-size: 14px; }
.root { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
.tabs { flex: 1; min-width: 0; display: flex; gap: 2px; overflow-x: auto; }
.tab { display: flex; align-items: center; border-radius: 7px; flex-shrink: 0; }
.tab.on { background: var(--field); }
.tab-name { height: 28px; padding: 0 4px 0 10px; font-size: 12px; color: var(--text-2); display: flex; align-items: center; gap: 5px; }
.tab.on .tab-name { color: var(--text); }
.tab-x { width: 22px; height: 22px; border-radius: 5px; color: var(--muted); }
.tab-x:hover { background: var(--hover); color: var(--text); }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: 18px; flex-shrink: 0; }
.close:hover { background: var(--hover); color: var(--text); }
.body { flex: 1; min-height: 0; display: grid; }
.side { min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }
.search { padding: 8px; }
.search input { width: 100%; height: 30px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); padding: 0 9px; font-size: 12.5px; }
.opts { display: flex; justify-content: space-between; align-items: center; padding: 0 10px 6px; font-size: 11.5px; color: var(--muted); }
.opts label { display: flex; gap: 5px; align-items: center; }
.opts .link { color: var(--muted); font-size: 13px; }
.list { flex: 1; min-height: 0; overflow: auto; padding-bottom: 12px; }
.row, .res { width: 100%; display: flex; align-items: center; gap: 4px; height: 24px; padding-right: 8px; text-align: left; font-size: 12.5px; color: var(--text-2); white-space: nowrap; }
.row:hover, .res:hover, .res.on { background: var(--hover); }
.row.on { background: color-mix(in srgb, var(--done) 18%, transparent); color: var(--text); }
.row.dir { color: var(--text); }
.row.ignored { opacity: 0.5; }
.chev { width: 12px; flex-shrink: 0; color: var(--muted); font-size: 10px; }
.nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.st { font-size: 10.5px; font-weight: 700; flex-shrink: 0; }
.s-M { color: var(--accent); } .s-A, .s-\? { color: var(--ok); } .s-D { color: var(--blocked); } .s-R { color: var(--done); } .s-dir { color: var(--accent); }
.nm.s-D { text-decoration: line-through; }
.res { height: auto; padding: 5px 10px; flex-direction: column; align-items: flex-start; gap: 1px; }
.r-name { font-size: 12.5px; color: var(--text); }
.r-dir { font-size: 10.5px; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.drag { cursor: col-resize; background: transparent; }
.drag:hover { background: rgba(110, 168, 254, 0.35); }
.view { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.crumbs { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; font-size: 12px; overflow: hidden; white-space: nowrap; }
.crumbs button { color: var(--text-2); padding: 2px 3px; border-radius: 4px; }
.crumbs button:hover { background: var(--hover); color: var(--text); }
.crumbs button.last { color: var(--text); font-weight: 600; }
.crumbs .sep { color: var(--muted); }
.tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg); gap: 2px; }
.seg button { color: var(--muted); font-size: 12px; padding: 3px 9px; border-radius: 6px; }
.seg button.on { background: var(--hover); color: var(--text); }
.theme { height: 26px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 12px; padding: 0 6px; }
.wrap-t { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.tb { height: 26px; padding: 0 9px; border-radius: 7px; border: 1px solid var(--line-strong); font-size: 12px; color: var(--text-2); white-space: nowrap; }
.tb:hover { background: var(--hover); color: var(--text); }
.tb.accent { color: var(--done); border-color: color-mix(in srgb, var(--done) 40%, var(--line-strong)); }
.code { position: relative; flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
.tbl { border-collapse: collapse; width: 100%; }
.tbl td { padding: 0 10px; vertical-align: top; }
.no { width: 1%; min-width: 44px; text-align: right; color: var(--c-gutter); user-select: none; white-space: nowrap; }
.src { white-space: pre; user-select: text; }
.code.wrap .src { white-space: pre-wrap; word-break: break-all; }
tr.hit > td { background: rgba(242, 169, 59, 0.16); }
.img { padding: 24px; display: flex; justify-content: center; background: repeating-conic-gradient(#1a1d21 0% 25%, #121417 0% 50%) 50% / 20px 20px; min-height: 100%; }
.img img { max-width: 100%; height: auto; image-rendering: auto; }
.md-doc { padding: 24px 36px 60px; }
.empty { padding: 24px; color: var(--muted); font-family: var(--sans); font-size: 13px; }
.err { color: var(--fail); }
.selbar { position: absolute; z-index: 3; display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 10px; border-radius: 9px; background: #1b1e22; border: 1px solid var(--line-strong); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5); font-family: var(--sans); font-size: 12px; }
.foot { padding: 5px 12px; border-top: 1px solid var(--line); font-size: 11px; }
.muted { color: var(--muted); }
</style>
