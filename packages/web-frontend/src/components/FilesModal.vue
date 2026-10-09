<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  buildTree,
  checkEdit,
  closeTab,
  dirtyTabs,
  discardAll,
  quitNow,
  files,
  isDirty,
  isImage,
  openTab,
  quickSearch,
  reloadEdit,
  reloadFiles,
  saveEdit,
  startEdit,
  stopEdit,
  visibleRows,
  createFile,
  grepFiles,
  renameFile,
  trashFile,
  type GrepHit,
  type TreeRow,
} from "../stores/files";
import { parseDiff, type DiffLine } from "../lib/diff";
import CodeEditor from "./CodeEditor.vue";
import { diffLines } from "diff";
import { allPanes } from "../stores/session";
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

// ---- Editing ---------------------------------------------------------------------
const edit = computed(() => (files.active ? files.edits[files.active] ?? null : null));
const dirty = computed(() => isDirty(files.active));
const canEdit = computed(() => !!files.active && !isImage(files.active) && files.status[files.active] !== "D" && !error.value);
/** "diff": my changes vs what was read; "conflict": what is on the disk vs mine. */
const showDiff = ref<null | "mine" | "conflict" | "beforeSave">(null);
const closingTab = ref<string | null>(null);
const closingAll = ref(false);
const leaving = ref(false);

async function beginEdit() {
  if (!files.active) return;
  await startEdit(files.active);
  showDiff.value = null;
}
function finishEdit() {
  if (!files.active) return;
  if (dirty.value && !leaving.value && !edit.value?.conflict) {
    leaving.value = true; // second click confirms
    return;
  }
  leaving.value = false;
  stopEdit(files.active);
  showDiff.value = null;
  load();
}
async function save(force = false) {
  const path = files.active;
  if (!path || !edit.value) return;
  if (!dirty.value && !force) return;
  if (settings.filesDiffBeforeSave && !force && showDiff.value !== "beforeSave") {
    showDiff.value = "beforeSave";
    return;
  }
  const ok = await saveEdit(path, force);
  if (ok) showDiff.value = null;
  else if (files.edits[path]?.conflict) showDiff.value = null;
}
function onEditorChange(text: string) {
  if (files.active && files.edits[files.active]) files.edits[files.active].current = text;
  leaving.value = false;
}
/** Diff lines (added / removed / same), for the panels. */
function diffOf(a: string, b: string) {
  const out: { kind: "add" | "del" | "ctx"; text: string }[] = [];
  for (const part of diffLines(a, b)) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const l of lines) out.push({ kind: part.added ? "add" : part.removed ? "del" : "ctx", text: l });
  }
  // Long unchanged stretches are folded to a few lines of context.
  const keep = new Set<number>();
  out.forEach((l, i) => {
    if (l.kind !== "ctx") for (let k = i - 3; k <= i + 3; k++) keep.add(k);
  });
  const folded: { kind: "add" | "del" | "ctx" | "gap"; text: string }[] = [];
  out.forEach((l, i) => {
    if (keep.has(i)) folded.push(l);
    else if (folded[folded.length - 1]?.kind !== "gap") folded.push({ kind: "gap", text: "…" });
  });
  // Invisible otherwise: only the newline at the very end differs.
  if (a.endsWith("\n") !== b.endsWith("\n")) folded.push({ kind: b.endsWith("\n") ? "add" : "del", text: "↵ retour à la ligne à la fin du fichier" });
  return folded;
}
const diffRows = computed(() => {
  const e = edit.value;
  if (!e || !showDiff.value) return [];
  if (showDiff.value === "conflict") return diffOf(e.disk ?? "", e.current);
  return diffOf(e.original, e.current);
});
// An agent at work in this project may write to the same file.
const agentBusy = computed(() => allPanes.value.some((p) => p.agent && p.agent_status === "working" && (p.foreground_cwd || p.cwd || "").startsWith(files.root)));

// Changes made on the disk while editing (an agent): checked every few seconds.
let poll = 0;
onMounted(() => {
  poll = window.setInterval(() => {
    if (files.active && files.edits[files.active]) checkEdit(files.active);
  }, 4000);
});
onBeforeUnmount(() => window.clearInterval(poll));

function askCloseTab(t: string) {
  if (isDirty(t) && closingTab.value !== t) {
    closingTab.value = t; // second click confirms
    return;
  }
  closingTab.value = null;
  closeTab(t);
}

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
  if (r.dir) {
    toggle(r);
    lastDir.value = r.path;
  } else openTab(r.path);
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
  showDiff.value = null;
  leaving.value = false;
  // Being edited: the editor shows it, nothing to load.
  if (path && files.edits[path]) {
    error.value = "";
    loading.value = false;
    return;
  }
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

// ---- Search in the project (⇧⌘F) ------------------------------------------------------
const sideMode = ref<"tree" | "grep">("tree");
const gq = ref("");
const gRegex = ref(false);
const gCase = ref(false);
const gHits = ref<GrepHit[]>([]);
const gTruncated = ref(false);
const gError = ref("");
const gBusy = ref(false);
const grepEl = ref<HTMLInputElement>();
const gFolded = ref(new Set<string>());
let gTimer = 0;
let gSeq = 0;
async function runGrep() {
  const query = gq.value;
  const my = ++gSeq;
  if (query.trim().length < 2) {
    gHits.value = [];
    gError.value = "";
    gBusy.value = false;
    gTruncated.value = false;
    return;
  }
  gBusy.value = true;
  try {
    const r = await grepFiles(query, gRegex.value, gCase.value);
    if (my !== gSeq) return;
    gHits.value = r.hits;
    gTruncated.value = r.truncated;
    gError.value = "";
  } catch (e) {
    if (my === gSeq) gError.value = String(e);
  } finally {
    if (my === gSeq) gBusy.value = false;
  }
}
watch([gq, gRegex, gCase], () => {
  window.clearTimeout(gTimer);
  gTimer = window.setTimeout(runGrep, 350);
});
const gGroups = computed(() => {
  const m = new Map<string, GrepHit[]>();
  for (const h of gHits.value) m.set(h.path, [...(m.get(h.path) ?? []), h]);
  return [...m.entries()];
});
/** The hit's text split around the match, for the highlight. */
function hitParts(text: string) {
  try {
    const re = gRegex.value ? new RegExp(gq.value, gCase.value ? "" : "i") : null;
    const i = re ? text.search(re) : (gCase.value ? text : text.toLowerCase()).indexOf(gCase.value ? gq.value : gq.value.toLowerCase());
    if (i < 0) return { pre: text, hit: "", post: "" };
    const len = re ? (text.slice(i).match(re)?.[0].length ?? 0) : gq.value.length;
    const from = Math.max(0, i - 40);
    return { pre: (from ? "…" : "") + text.slice(from, i), hit: text.slice(i, i + len), post: text.slice(i + len) };
  } catch {
    return { pre: text, hit: "", post: "" };
  }
}
function toggleGroup(p: string) {
  const n = new Set(gFolded.value);
  if (n.has(p)) n.delete(p);
  else n.add(p);
  gFolded.value = n;
}
function openSearch() {
  sideMode.value = "grep";
  nextTick(() => {
    grepEl.value?.focus();
    grepEl.value?.select();
  });
}

// ---- Create, rename, delete ------------------------------------------------------------
const menu = ref<{ row: TreeRow | null; x: number; y: number; armTrash: boolean } | null>(null);
/** Inline name field: a new file / folder, or a rename (the full path can be changed: move). */
const naming = ref<{ kind: "file" | "dir" | "rename"; from?: string; value: string } | null>(null);
const nameEl = ref<HTMLInputElement>();
/** Folder for "+ Fichier": the one clicked last, else the folder of the open file. */
const lastDir = ref("");
function folderOf(r: TreeRow | null) {
  if (r) return r.dir ? r.path : r.path.split("/").slice(0, -1).join("/");
  if (lastDir.value) return lastDir.value;
  return files.active ? files.active.split("/").slice(0, -1).join("/") : "";
}
function startNaming(kind: "file" | "dir" | "rename", r: TreeRow | null = null) {
  menu.value = null;
  if (kind === "rename" && r) naming.value = { kind, from: r.path, value: r.path };
  else {
    const dir = folderOf(r);
    naming.value = { kind, value: dir ? `${dir}/` : "" };
  }
  nextTick(() => {
    const el = nameEl.value;
    if (!el) return;
    el.focus();
    // Rename: select the name, not the folders (like the Finder).
    if (kind === "rename") {
      const v = el.value;
      const slash = v.lastIndexOf("/") + 1;
      const dot = v.lastIndexOf(".");
      el.setSelectionRange(slash, dot > slash ? dot : v.length);
    } else el.setSelectionRange(el.value.length, el.value.length);
  });
}
async function submitNaming() {
  const n = naming.value;
  if (!n) return;
  const value = n.value.trim().replace(/^\/+|\/+$/g, "");
  if (!value) return;
  const ok = n.kind === "rename" ? await renameFile(n.from!, value) : await createFile(value, n.kind === "dir");
  if (ok) naming.value = null;
}
function onRowMenu(e: MouseEvent, r: TreeRow) {
  e.preventDefault();
  const side = (e.currentTarget as HTMLElement).closest(".side")!.getBoundingClientRect();
  // Kept inside the sidebar (menu ≈ 200 × 190 px).
  const y = Math.max(4, Math.min(e.clientY - side.top, side.height - 194));
  menu.value = { row: r, x: e.clientX - side.left, y, armTrash: false };
}
async function menuTrash() {
  const m = menu.value;
  if (!m?.row) return;
  if (!m.armTrash) {
    m.armTrash = true;
    return;
  }
  menu.value = null;
  await trashFile(m.row.path);
}
async function menuCopy() {
  const r = menu.value?.row;
  menu.value = null;
  if (r) {
    await writeText(r.path).catch(() => {});
    toast(`Copié : ${r.path}`);
  }
}

// ---- Git diff of the open file ------------------------------------------------------------
const gitDiff = ref<DiffLine[] | null>(null);
async function toggleGitDiff() {
  if (gitDiff.value) return (gitDiff.value = null);
  if (!files.active) return;
  try {
    gitDiff.value = parseDiff(await invoke<string>("git_diff", { root: files.root, path: files.active }));
  } catch (e) {
    toast(String(e));
  }
}
watch(
  () => files.active,
  () => (gitDiff.value = null),
);

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
function close(force = false) {
  if (!force && dirtyTabs().length) {
    closingAll.value = true;
    return;
  }
  closingAll.value = false;
  files.quitting = false;
  files.open = false;
}
/** Saves every edited file; stops on the first conflict or error (and shows it). */
async function saveAll(): Promise<boolean> {
  for (const t of dirtyTabs()) {
    if (!(await saveEdit(t))) {
      openTab(t);
      closingAll.value = false;
      files.quitting = false;
      return false;
    }
  }
  return true;
}
async function saveAllAndClose() {
  if (await saveAll()) close(true);
}
function abandonAndClose() {
  discardAll();
  close(true);
}
async function saveAllAndQuit() {
  if (await saveAll()) quitNow();
}
function onKey(e: KeyboardEvent) {
  const inEditor = !!(e.target as HTMLElement | null)?.closest?.(".cm-editor");
  if (e.metaKey && e.code === "KeyS") {
    e.preventDefault();
    e.stopPropagation();
    save();
    return;
  }
  if (e.key === "Escape") {
    // In the editor, Échap belongs to it (search panel, completion).
    if (inEditor) return;
    e.preventDefault();
    e.stopPropagation();
    if (menu.value) menu.value = null;
    else if (naming.value) naming.value = null;
    else if (sel.value) sel.value = null;
    else if (gitDiff.value) gitDiff.value = null;
    else if (showDiff.value) showDiff.value = null;
    else if (q.value) q.value = "";
    else close();
  } else if (e.metaKey && e.shiftKey && e.code === "KeyF") {
    e.preventDefault();
    e.stopPropagation();
    openSearch();
  } else if (e.metaKey && e.code === "KeyP" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    searchEl.value?.focus();
    searchEl.value?.select();
  } else if (e.metaKey && e.code === "KeyW" && files.active) {
    // Inside the explorer, ⌘W closes the file, never the terminal pane behind.
    e.preventDefault();
    e.stopPropagation();
    askCloseTab(files.active);
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => searchEl.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close()">
    <div class="modal" role="dialog" aria-label="Fichiers du projet" @mousedown="menu && !($event.target as HTMLElement).closest('.ctxmenu') && (menu = null)">
      <header class="top">
        <span class="title">Fichiers</span>
        <span class="root mono" :title="files.root">{{ shortPath(files.root) }}</span>
        <div class="tabs" role="tablist">
          <div v-for="t in files.tabs" :key="t" class="tab" :class="{ on: t === files.active }" role="tab" :title="t">
            <button class="tab-name" @click="openTab(t)">
              <span v-if="files.status[t]" class="st" :class="'s-' + files.status[t]">●</span>{{ t.split("/").pop() }}
            </button>
            <button
              class="tab-x"
              :class="{ dirty: isDirty(t), arm: closingTab === t }"
              :aria-label="`Fermer ${t}`"
              :title="closingTab === t ? 'Pas enregistré : clique encore pour fermer sans enregistrer' : isDirty(t) ? 'Modifié, pas enregistré' : 'Fermer (⌘W)'"
              @click="askCloseTab(t)"
            ><template v-if="closingTab === t">?</template><template v-else-if="isDirty(t)">●</template><Icon v-else name="x-lg" /></button>
          </div>
        </div>
        <button class="close" aria-label="Fermer (Échap)" @click="close()"><Icon name="x-lg" /></button>
      </header>
      <div v-if="files.quitting && dirtyTabs().length" class="banner warn">
        <span>Quitter Herdr Desk : {{ dirtyTabs().length }} fichier{{ dirtyTabs().length > 1 ? "s" : "" }} pas encore enregistré{{ dirtyTabs().length > 1 ? "s" : "" }} ({{ dirtyTabs().map((t) => t.split("/").pop()).join(", ") }}).</span>
        <button class="tb accent" @click="saveAllAndQuit">Tout enregistrer et quitter</button>
        <button class="tb danger" @click="quitNow">Quitter sans enregistrer</button>
        <button class="tb" @click="files.quitting = false">Annuler</button>
      </div>
      <div v-else-if="closingAll" class="banner warn">
        <span>{{ dirtyTabs().length }} fichier{{ dirtyTabs().length > 1 ? "s" : "" }} modifié{{ dirtyTabs().length > 1 ? "s" : "" }} pas encore enregistré{{ dirtyTabs().length > 1 ? "s" : "" }}.</span>
        <button class="tb accent" @click="saveAllAndClose">Tout enregistrer et fermer</button>
        <button class="tb danger" @click="abandonAndClose">Abandonner les modifications</button>
        <button class="tb" @click="closingAll = false">Annuler</button>
      </div>

      <div class="body" :style="{ gridTemplateColumns: `${settings.filesListWidth}px 5px 1fr` }">
        <aside class="side" @click="menu = null">
          <div class="side-tabs" role="tablist">
            <button :class="{ on: sideMode === 'tree' }" @click="sideMode = 'tree'">Fichiers</button>
            <button :class="{ on: sideMode === 'grep' }" title="Chercher dans le contenu (⇧⌘F)" @click="openSearch">Rechercher</button>
          </div>

          <template v-if="sideMode === 'grep'">
            <div class="search grep">
              <input ref="grepEl" v-model="gq" placeholder="Texte à chercher dans le projet…  ⇧⌘F" spellcheck="false" @keydown.enter.prevent="runGrep" />
              <button class="tg" :class="{ on: gCase }" title="Respecter la casse" @click="gCase = !gCase">Aa</button>
              <button class="tg mono" :class="{ on: gRegex }" title="Expression régulière" @click="gRegex = !gRegex">.*</button>
            </div>
            <div class="opts">
              <span>{{ gBusy ? "Recherche…" : gq.trim().length >= 2 ? `${gHits.length}${gTruncated ? "+" : ""} résultat${gHits.length > 1 ? "s" : ""} dans ${gGroups.length} fichier${gGroups.length > 1 ? "s" : ""}` : "" }}</span>
            </div>
            <div class="list">
              <div v-if="gError" class="empty err">{{ gError }}</div>
              <template v-for="[p, hits] in gGroups" :key="p">
                <button class="g-file" @click="toggleGroup(p)">
                  <span class="chev">{{ gFolded.has(p) ? "▸" : "▾" }}</span>
                  <span class="nm">{{ p.split("/").pop() }}</span>
                  <span class="r-dir mono">{{ p.split("/").slice(0, -1).join("/") }}</span>
                  <span class="g-n">{{ hits.length }}</span>
                </button>
                <template v-if="!gFolded.has(p)">
                  <button v-for="h in hits" :key="p + h.line" class="g-hit mono" :class="{ on: files.active === p && files.line === h.line }" @click="openTab(p, h.line)">
                    <span class="g-line">{{ h.line }}</span>
                    <span class="g-text">{{ hitParts(h.text).pre }}<mark>{{ hitParts(h.text).hit }}</mark>{{ hitParts(h.text).post }}</span>
                  </button>
                </template>
              </template>
              <div v-if="gTruncated" class="empty">Plus de 2 000 résultats : précise la recherche.</div>
            </div>
          </template>

          <template v-else>
          <div class="search">
            <input ref="searchEl" v-model="q" placeholder="Rechercher un fichier…  ⌘P" spellcheck="false" @keydown="onSearchKey" />
          </div>
          <div class="opts">
            <label><input v-model="files.showIgnored" type="checkbox" />Fichiers ignorés</label>
            <span class="opt-tools">
              <button class="link" title="Nouveau fichier" @click.stop="startNaming('file')">+ Fichier</button>
              <button class="link" title="Nouveau dossier" @click.stop="startNaming('dir')">+ Dossier</button>
              <button class="link" title="Relire la liste des fichiers" @click="reloadFiles()">↻</button>
            </span>
          </div>
          <form v-if="naming" class="naming" @submit.prevent="submitNaming" @click.stop>
            <span class="muted">{{ naming.kind === "rename" ? "Renommer / déplacer" : naming.kind === "dir" ? "Nouveau dossier" : "Nouveau fichier" }}</span>
            <input ref="nameEl" v-model="naming.value" class="mono" spellcheck="false" />
            <span class="n-tools">
              <button type="submit" class="tb accent">{{ naming.kind === "rename" ? "Renommer" : "Créer" }} ↵</button>
              <button type="button" class="tb" @click="naming = null">Annuler</button>
            </span>
          </form>
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
                :class="{ on: r.path === files.active, ignored: r.ignored, dir: r.dir, ctx: menu?.row?.path === r.path }"
                :style="{ paddingLeft: `${8 + r.depth * 14}px` }"
                :title="r.status ? `${r.path} · ${statusLabel[r.status] ?? r.status}` : r.path"
                @click="pick(r)"
                @contextmenu="(e) => !r.ignored && onRowMenu(e, r)"
              >
                <span class="chev">{{ r.dir ? (r.ignored ? "" : files.expanded.has(r.path) ? "▾" : "▸") : "" }}</span>
                <span class="nm" :class="r.status ? 's-' + (r.status === '•' ? 'dir' : r.status) : ''">{{ r.name }}</span>
                <span v-if="r.status && !r.dir" class="st" :class="'s-' + r.status">{{ r.status === "?" ? "U" : r.status }}</span>
                <span v-else-if="r.status" class="st s-dir">•</span>
              </button>
              <div v-if="files.truncated" class="empty">Liste limitée aux 50 000 premiers fichiers.</div>
              <div v-if="rows.length" class="hint-row muted">Clic droit sur un fichier : renommer, déplacer, Corbeille…</div>
            </template>
          </div>
          </template>

          <div v-if="menu?.row" class="ctxmenu" :style="{ left: `${Math.min(menu.x, settings.filesListWidth - 200)}px`, top: `${menu.y}px` }" @click.stop>
            <div class="cm-title mono">{{ menu.row.name }}</div>
            <button @click="startNaming('file', menu.row)">Nouveau fichier ici</button>
            <button @click="startNaming('dir', menu.row)">Nouveau dossier ici</button>
            <button @click="startNaming('rename', menu.row)">Renommer / déplacer…</button>
            <button @click="menuCopy">Copier le chemin</button>
            <button class="danger" @click="menuTrash">{{ menu.armTrash ? "Confirmer : à la Corbeille" : menu.row.dir ? "Mettre le dossier à la Corbeille" : "Mettre à la Corbeille" }}</button>
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
              <template v-if="edit">
                <button class="tb accent" :disabled="!dirty || edit.saving" title="Enregistrer (⌘S)" @click="save()">{{ edit.saving ? "Enregistrement…" : "Enregistrer ⌘S" }}</button>
                <button class="tb" :class="{ on: showDiff === 'mine' }" :disabled="!dirty" title="Mes changements depuis l’ouverture" @click="showDiff = showDiff === 'mine' ? null : 'mine'">Diff</button>
                <label class="wrap-t" title="Montrer le diff avant chaque enregistrement"><input v-model="settings.filesDiffBeforeSave" type="checkbox" />Diff avant ⌘S</label>
                <button class="tb" :class="{ arm: leaving }" :title="leaving ? 'Clique encore pour quitter sans enregistrer' : 'Revenir à la lecture'" @click="finishEdit">{{ leaving ? "Quitter sans enregistrer ?" : "Terminer" }}</button>
              </template>
              <button v-else-if="canEdit" class="tb edit" title="Modifier ce fichier" @click="beginEdit"><Icon name="pencil" /> Modifier</button>
              <button v-if="files.git && files.active && files.status[files.active] && files.status[files.active] !== 'D'" class="tb" :class="{ on: gitDiff }" title="Changements de ce fichier par rapport au dernier commit (HEAD)" @click="toggleGitDiff">Diff git</button>
              <div v-if="md && !edit" class="seg" role="radiogroup" aria-label="Affichage Markdown">
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
          <div v-if="gitDiff" class="diff code" :class="settings.codeTheme" :style="{ fontSize: `${settings.codeFontSize}px` }">
            <div class="diff-head">
              <span>Changements depuis le dernier commit (enregistrés sur le disque)</span>
              <button class="tb" @click="gitDiff = null">Fermer</button>
            </div>
            <div v-for="(l, i) in gitDiff" :key="i" class="d-row" :class="l.kind === 'hunk' ? 'gap' : l.kind">
              <span class="d-sign">{{ l.kind === "add" ? "+" : l.kind === "del" ? "−" : "" }}</span>{{ l.text || " " }}
            </div>
            <div v-if="!gitDiff.length" class="empty">Aucun changement par rapport au dernier commit.</div>
          </div>
          <template v-if="edit">
            <div v-if="edit.conflict" class="banner warn">
              <template v-if="edit.diskHash === null && edit.disk === null">
                <span>Ce fichier a été supprimé sur le disque depuis que tu l’as ouvert (par un agent ?).</span>
                <button class="tb danger" @click="save(true)">Le recréer avec ma version</button>
                <button class="tb" @click="finishEdit">Laisser supprimé</button>
              </template>
              <template v-else>
                <span>Ce fichier a été modifié sur le disque depuis que tu l’as ouvert (par un agent ?). Rien n’a été écrasé.</span>
                <button class="tb" :class="{ on: showDiff === 'conflict' }" @click="showDiff = showDiff === 'conflict' ? null : 'conflict'">Voir la différence</button>
                <button class="tb" @click="reloadEdit(files.active!)">Recharger (perdre mes changements)</button>
                <button class="tb danger" @click="save(true)">Écraser avec ma version</button>
              </template>
            </div>
            <div v-else-if="agentBusy" class="banner info">Un agent travaille dans ce projet : il peut modifier ce fichier en même temps (l’app te préviendra).</div>
            <div v-if="showDiff" class="diff code" :class="settings.codeTheme" :style="{ fontSize: `${settings.codeFontSize}px` }">
              <div class="diff-head">
                <span>{{ showDiff === "conflict" ? "Disque (−) → ma version (+)" : "Ouvert (−) → ma version (+)" }}</span>
                <template v-if="showDiff === 'beforeSave'">
                  <button class="tb accent" @click="save(false)">Enregistrer</button>
                  <button class="tb" @click="showDiff = null">Annuler</button>
                </template>
                <button v-else class="tb" @click="showDiff = null">Fermer</button>
              </div>
              <div v-for="(r, i) in diffRows" :key="i" class="d-row" :class="r.kind"><span class="d-sign">{{ r.kind === "add" ? "+" : r.kind === "del" ? "−" : "" }}</span>{{ r.text || " " }}</div>
              <div v-if="!diffRows.some((r) => r.kind !== 'ctx' && r.kind !== 'gap')" class="empty">Aucune différence.</div>
            </div>
            <div class="code editing" :class="settings.codeTheme" :style="{ fontSize: `${settings.codeFontSize}px` }">
              <CodeEditor :key="files.root + files.active" :path="files.active!" :text="edit.original === edit.current ? edit.original : edit.current" :wrap="settings.codeWrap" :line="files.line" @change="onEditorChange" @save="save()" />
            </div>
          </template>
          <div v-else ref="codeEl" class="code" :class="[settings.codeTheme, { wrap: settings.codeWrap }]" :style="{ fontSize: `${settings.codeFontSize}px` }" @mouseup="onMouseUp">
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
            <template v-if="edit">{{ dirty ? "modifié, pas enregistré" : "enregistré" }} · ⌘S enregistrer · ⌘F chercher · ⌘⌥F remplacer · ⌘D occurrence suivante · ⌘Z annuler</template>
            <template v-else>{{ files.status[files.active] ? statusLabel[files.status[files.active]] : files.git ? "à jour avec git" : "hors git" }} · ⌘P chercher · ⌘W fermer l’onglet · ⌘+ / ⌘− taille</template>
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
.tb:disabled { opacity: 0.45; cursor: default; }
.tb.on { border-color: var(--done); color: var(--text); }
.tb.edit { color: var(--text); }
.tb.arm, .tab-x.arm { color: var(--accent); border-color: var(--accent); }
.tb.danger { color: var(--blocked); }
.tab-x.dirty { color: var(--text); font-size: 11px; }
.banner { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; font-size: 12.5px; border-bottom: 1px solid var(--line); }
.banner.warn { background: #2b2213; color: #f6c06a; }
.banner.info { background: #12202e; color: var(--text-2); }
.code.editing { overflow: hidden; }
.diff { flex: 0 0 auto; max-height: 45%; overflow: auto; border-bottom: 1px solid var(--line); white-space: pre; font-family: var(--mono); }
.diff-head { position: sticky; top: 0; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--panel); font-family: var(--sans); font-size: 12px; color: var(--text-2); }
.diff-head span { flex: 1; }
.d-row { padding: 0 10px; }
.d-row.add { background: var(--c-add); }
.d-row.del { background: var(--c-del); }
.d-row.gap { color: var(--c-gutter); }
.d-sign { display: inline-block; width: 16px; color: var(--c-gutter); user-select: none; }
.side { position: relative; }
.side-tabs { display: flex; gap: 2px; padding: 8px 8px 0; }
.side-tabs button { flex: 1; height: 26px; border-radius: 7px; font-size: 12px; color: var(--muted); }
.side-tabs button.on { background: var(--field); color: var(--text); font-weight: 600; }
.search.grep { display: flex; gap: 4px; }
.search.grep input { flex: 1; }
.tg { width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--line-strong); color: var(--muted); font-size: 12px; flex-shrink: 0; }
.tg.on { color: var(--text); border-color: var(--done); background: color-mix(in srgb, var(--done) 15%, transparent); }
.opt-tools { display: flex; gap: 10px; align-items: center; }
.opt-tools .link { font-size: 11.5px; color: var(--done); }
.g-file { width: 100%; display: flex; align-items: baseline; gap: 6px; padding: 5px 8px 3px; text-align: left; font-size: 12.5px; color: var(--text); }
.g-file:hover { background: var(--hover); }
.g-file .r-dir { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-n { font-size: 10.5px; color: var(--muted); background: var(--field); border-radius: 8px; padding: 0 6px; }
.g-hit { width: 100%; display: flex; gap: 8px; padding: 2px 8px 2px 26px; text-align: left; font-size: 11.5px; color: var(--text-2); white-space: nowrap; }
.g-hit:hover, .g-hit.on { background: var(--hover); }
.g-line { color: var(--muted); min-width: 28px; text-align: right; flex-shrink: 0; }
.g-text { overflow: hidden; text-overflow: ellipsis; }
.g-text mark { background: rgba(242, 169, 59, 0.35); color: var(--text); border-radius: 2px; }
.naming { display: flex; flex-direction: column; gap: 6px; margin: 0 8px 8px; padding: 8px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--bg); font-size: 11.5px; }
.naming input { height: 28px; border-radius: 6px; border: 1px solid var(--done); background: var(--field); color: var(--text); padding: 0 8px; font-size: 12px; }
.n-tools { display: flex; gap: 6px; }
.row.ctx { background: var(--hover); }
.hint-row { padding: 10px 12px; font-size: 11px; }
.ctxmenu { position: absolute; z-index: 5; min-width: 200px; padding: 4px; border-radius: 9px; background: #1b1e22; border: 1px solid var(--line-strong); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55); display: flex; flex-direction: column; }
.ctxmenu .cm-title { padding: 4px 8px 6px; font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 1px solid var(--line); margin-bottom: 3px; }
.ctxmenu button { text-align: left; padding: 6px 8px; border-radius: 6px; font-size: 12.5px; color: var(--text); }
.ctxmenu button:hover { background: var(--hover); }
.ctxmenu button.danger { color: var(--blocked); }
.foot { padding: 5px 12px; border-top: 1px solid var(--line); font-size: 11px; }
.muted { color: var(--muted); }
</style>
