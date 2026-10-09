<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { currentForge, currentGit, git, refreshGit } from "../stores/git";
import { settings } from "../stores/settings";
import { ago } from "../lib/format";
import { diffStats, parseDiff, splitDiff, type DiffLine } from "../lib/diff";
import { CODE_THEMES, highlightFile, highlightLine, languageFor } from "../lib/highlight";
import { isMarkdown, renderMarkdown } from "../lib/markdown";
import Resizer from "./Resizer.vue";

const st = currentGit;
const fg = currentForge;
const filter = ref("");
const listEl = ref<HTMLElement>();

const files = computed(() => {
  const q = filter.value.trim().toLowerCase();
  const all = st.value?.files ?? [];
  return q ? all.filter((f) => f.path.toLowerCase().includes(q)) : all;
});
const selected = computed(() => git.modal.path);
const selectedFile = computed(() => st.value?.files.find((f) => f.path === selected.value) ?? null);
const lang = computed(() => (selected.value ? languageFor(selected.value) : null));
const repoName = computed(() => (fg.value?.base ? fg.value.base.replace(/^https?:\/\/[^/]+\//, "") : st.value?.root.split("/").pop() ?? ""));
const kind = computed(() => (fg.value?.forge === "github" ? "PR" : "MR"));

// ---- Loading ------------------------------------------------------------------
const MAX_ROWS = 6000;
const diff = ref<DiffLine[]>([]);
/** Highlighted HTML, computed once per load (not on every render). */
const diffHtml = ref<string[]>([]);
const fileLines = ref<string[]>([]);
const truncated = ref(false);
const rendered = ref("");
const md = computed(() => isMarkdown(selected.value));
// "Lecture" only exists for Markdown: elsewhere it falls back to the file view.
const mode = computed(() => (settings.diffMode === "read" && !md.value ? "file" : settings.diffMode));
const error = ref("");
const loading = ref(false);
let seq = 0;

async function load() {
  const path = selected.value;
  const root = st.value?.root;
  diff.value = [];
  diffHtml.value = [];
  fileLines.value = [];
  rendered.value = "";
  truncated.value = false;
  error.value = "";
  if (!path || !root) return;
  const my = ++seq;
  loading.value = true;
  try {
    const d = await invoke<string>("git_diff", { root, path });
    if (my !== seq) return;
    const lines = parseDiff(d);
    truncated.value = lines.length > MAX_ROWS;
    diff.value = lines.slice(0, MAX_ROWS);
    diffHtml.value = diff.value.map((l) => (l.kind === "hunk" ? "" : highlightLine(l.text, lang.value)));
    if (mode.value === "file" || mode.value === "read") {
      // A deleted file: show it as it was in HEAD.
      const deleted = selectedFile.value?.status.includes("D") ?? false;
      const text = await invoke<string>("git_file", { root, path, rev: deleted ? "HEAD" : null });
      if (my !== seq) return;
      const all = text.replace(/\n$/, "");
      if (mode.value === "read") {
        rendered.value = renderMarkdown(all);
        return;
      }
      // Big files: plain text (highlighting a whole megabyte would freeze the window).
      const rows = all.length > 400_000 ? highlightFile(all, null) : highlightFile(all, lang.value);
      truncated.value = rows.length > MAX_ROWS;
      fileLines.value = rows.slice(0, MAX_ROWS);
    }
  } catch (e) {
    if (my === seq) error.value = String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
// Separate getters: the status object is replaced every few seconds by polling,
// which must not reload (and flash) the file being read.
watch([() => selected.value, () => mode.value, () => st.value?.root], load, { immediate: true });

// Links in rendered Markdown open in the browser, never inside the app.
function onMdClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) openUrl(href).catch(() => {});
}
// Another workspace (or the file left the list): show its first file.
watch(
  () => st.value?.root,
  () => {
    const list = st.value?.files ?? [];
    if (!list.some((f) => f.path === git.modal.path)) git.modal.path = list[0]?.path ?? null;
  },
);

const stats = computed(() => diffStats(diff.value));
const htmlOf = computed(() => new Map(diff.value.map((l, i) => [l, diffHtml.value[i] ?? ""])));
const split = computed(() => splitDiff(diff.value));
const hl = (l?: DiffLine) => (l ? htmlOf.value.get(l) ?? "" : "");
// Lines added or changed, for the gutter of the file view.
const changedNew = computed(() => new Set(diff.value.filter((l) => l.kind === "add").map((l) => l.new!)));

// ---- Keyboard -----------------------------------------------------------------
function select(path: string) {
  git.modal.path = path;
}
function move(delta: number) {
  const list = files.value;
  if (!list.length) return;
  const i = list.findIndex((f) => f.path === selected.value);
  const next = list[Math.max(0, Math.min(list.length - 1, (i === -1 ? -1 : i) + delta))];
  select(next.path);
  nextTick(() => listEl.value?.querySelector(".file.on")?.scrollIntoView({ block: "nearest" }));
}
const modalEl = ref<HTMLElement>();

// Divider of the side-by-side view.
const splitEl = ref<HTMLElement>();
function startSplit(e: PointerEvent) {
  const el = splitEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const bar = e.target as HTMLElement;
  bar.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    settings.splitRatio = Math.min(0.85, Math.max(0.15, (ev.clientX - rect.left) / rect.width));
  };
  const end = () => {
    bar.removeEventListener("pointermove", move);
    bar.removeEventListener("pointerup", end);
    bar.removeEventListener("pointercancel", end);
    bar.removeEventListener("lostpointercapture", end);
  };
  bar.addEventListener("pointermove", move);
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
  bar.addEventListener("lostpointercapture", end);
  e.preventDefault();
}
function onKey(e: KeyboardEvent) {
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.closest("select, textarea, [contenteditable]") || (t instanceof HTMLInputElement && e.key !== "Escape"))) {
    if (e.key !== "Escape") return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    git.modal.open = false;
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    move(e.key === "ArrowDown" ? 1 : -1);
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  // Take the focus from the terminal, so arrows do not reach the agent.
  nextTick(() => modalEl.value?.focus());
  if (!selected.value && st.value?.files[0]) select(st.value.files[0].path);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));

function statusClass(x: string) {
  if (x === "??") return "new";
  if (x.includes("D")) return "del";
  if (x.includes("A")) return "add";
  if (x.includes("R")) return "ren";
  if (x.includes("U")) return "conf";
  return "mod";
}
const statusLetter = (x: string) => (x === "??" ? "N" : (x.replace(/\./g, "")[0] ?? "M").toUpperCase());
const dir = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const open = (url?: string | null) => url && openUrl(url).catch(() => {});
</script>

<template>
  <div class="overlay" @mousedown.self="git.modal.open = false">
    <div ref="modalEl" class="modal" role="dialog" aria-label="Git" tabindex="-1">
      <header class="top">
        <div class="title">
          <button title="Open the repository in the browser" v-if="fg?.base" class="repo" @click="open(fg.base)">{{ repoName }} <Icon name="box-arrow-up-right" /></button>
          <span v-else class="repo plain">{{ repoName }}</span>
          <span v-if="st" class="mono branch">{{ st.branch ?? "(détachée)" }}</span>
          <span v-if="st?.ahead" class="chip warn">↑ {{ st.ahead }}</span>
          <span v-if="st?.behind" class="chip pending">↓ {{ st.behind }}</span>
          <button title="Open the continuous integration result in the browser" v-if="fg?.ci" class="chip" :class="fg.ci.level" @click="open(fg.ci.url)">{{ fg.ci.label }}</button>
        </div>
        <div class="tools">
          <button title="Refresh the Git status" class="btn" :disabled="git.loading" @click="refreshGit()">{{ git.loading ? "…" : "Rafraîchir" }}</button>
          <button title="Close the Git window (Escape)" class="close" aria-label="Fermer (Échap)" @click="git.modal.open = false"><Icon name="x-lg" /></button>
        </div>
      </header>

      <div class="body">
        <aside v-show="!settings.gitListHidden" class="left" :style="{ width: `${settings.gitListWidth}px` }">
          <input v-model="filter" class="filter" placeholder="Filtrer les fichiers…" spellcheck="false" />
          <div class="eyebrow">Modifications <span class="count">{{ st ? st.changed + st.untracked : 0 }}</span></div>
          <div ref="listEl" class="files">
            <button
              v-for="f in files"
              :key="f.path"
              class="file"
              :class="{ on: f.path === selected }"
              :title="f.path"
              @click="select(f.path)"
            >
              <span class="st" :class="statusClass(f.status)">{{ statusLetter(f.status) }}</span>
              <span class="name">{{ base(f.path) }}</span>
              <span class="dir mono">{{ dir(f.path) }}</span>
            </button>
            <div v-if="!files.length" class="muted pad">{{ filter ? "Aucun fichier ne correspond." : "Aucune modification locale." }}</div>
          </div>
          <div v-if="fg && !fg.error && fg.requests.length" class="reqs">
            <div class="eyebrow">{{ kind }} ouvertes <span class="count">{{ fg.requests.length }}</span></div>
            <button v-for="r in fg.requests" :key="r.ref" class="req" :class="{ mine: r.branch === st?.branch }" :title="r.title" @click="open(r.url)">
              <span class="mono ref">{{ r.ref }}</span>
              <span class="chip sm" :class="r.level">{{ r.state }}</span>
              <span v-if="r.review" class="chip sm" :class="r.review.level" :title="r.review.label">{{ r.review.level === "ok" ? "✓" : r.review.level === "crit" ? "✗" : "…" }}</span>
              <span class="req-t">{{ r.title }}</span>
            </button>
          </div>
        </aside>

        <Resizer v-show="!settings.gitListHidden" v-model:width="settings.gitListWidth" side="left" :min="220" :max="900" :default-width="340" />
        <section class="viewer">
          <div class="bar">
            <button
              type="button"
              class="icon"
              :title="settings.gitListHidden ? 'Afficher la liste des fichiers' : 'Masquer la liste : plein écran'"
              @click="settings.gitListHidden = !settings.gitListHidden"
            >{{ settings.gitListHidden ? "⇥" : "⇤" }}</button>
            <div class="path mono" :title="selected ?? ''">
              <template v-if="selected">{{ selected }}</template>
              <span v-if="selected && diff.length" class="stats"><span class="plus">+{{ stats.added }}</span> <span class="minus">−{{ stats.removed }}</span></span>
            </div>
            <div class="seg" role="radiogroup" aria-label="Affichage">
              <button title="Show the changes as a unified diff" :class="{ on: mode === 'unified' }" @click="settings.diffMode = 'unified'">Diff</button>
              <button title="Show the changes side by side" :class="{ on: mode === 'split' }" @click="settings.diffMode = 'split'">Côte à côte</button>
              <button title="Show the whole file" :class="{ on: mode === 'file' }" @click="settings.diffMode = 'file'">Fichier</button>
              <button v-if="md" :class="{ on: mode === 'read' }" title="Markdown mis en forme" @click="settings.diffMode = 'read'">Lecture</button>
            </div>
            <div v-if="mode === 'read'" class="seg" role="radiogroup" aria-label="Largeur de lecture">
              <button :class="{ on: settings.mdWidth === 'center' }" title="Colonne centrée, confortable à lire" @click="settings.mdWidth = 'center'">Centré</button>
              <button :class="{ on: settings.mdWidth === 'full' }" title="Toute la largeur (grands tableaux)" @click="settings.mdWidth = 'full'">Pleine largeur</button>
            </div>
            <label class="sr" for="code-theme">Thème</label>
            <select id="code-theme" v-model="settings.codeTheme" class="theme">
              <option v-for="t in CODE_THEMES" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
            <label class="wrap-t"><input v-model="settings.codeWrap" type="checkbox" />Retour à la ligne</label>
            <span class="size mono" title="⌘+ / ⌘− / ⌘0">{{ settings.codeFontSize }} px</span>
          </div>

          <div class="code" :class="[settings.codeTheme, { wrap: settings.codeWrap }]" :style="{ fontSize: `${settings.codeFontSize}px` }">
            <div v-if="!selected" class="empty">Choisis un fichier à gauche.</div>
            <div v-else-if="error" class="empty err">{{ error }}</div>
            <div v-else-if="loading && !diff.length && !fileLines.length" class="empty">Chargement…</div>

            <!-- Markdown, rendered -->
            <article v-else-if="mode === 'read'" class="md" :class="{ full: settings.mdWidth === 'full' }" @click="onMdClick" v-html="rendered"></article>

            <!-- Unified diff -->
            <table v-else-if="mode === 'unified'" class="tbl">
              <tbody>
                <tr v-for="(l, i) in diff" :key="i" :class="l.kind">
                  <template v-if="l.kind === 'hunk'"><td colspan="4" class="hunk mono">{{ l.text }}</td></template>
                  <template v-else>
                    <td class="no">{{ l.old ?? "" }}</td>
                    <td class="no">{{ l.new ?? "" }}</td>
                    <td class="sign">{{ l.kind === "add" ? "+" : l.kind === "del" ? "−" : "" }}</td>
                    <td class="src" v-html="diffHtml[i]"></td>
                  </template>
                </tr>
              </tbody>
            </table>

            <!-- Side by side: two columns split where you want (drag the bar, double-click = middle).
                 Without wrapping each side scrolls sideways on its own; rows stay aligned. -->
            <div
              v-else-if="mode === 'split' && !settings.codeWrap"
              ref="splitEl"
              class="split2"
              :style="{ gridTemplateColumns: `minmax(0, ${settings.splitRatio}fr) 6px minmax(0, ${1 - settings.splitRatio}fr)` }"
            >
              <div class="side">
                <table class="tbl">
                  <tbody>
                    <tr v-for="(r, i) in split" :key="i">
                      <td v-if="r.hunk" colspan="2" class="hunk mono">{{ r.hunk }}</td>
                      <template v-else>
                        <td class="no" :class="r.left?.kind">{{ r.left?.old ?? "" }}</td>
                        <td class="src" :class="r.left ? r.left.kind : 'none'" v-html="hl(r.left) || '&#8203;'"></td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="split-bar" title="Glisser pour redimensionner · double-clic : au centre" @pointerdown="startSplit" @dblclick="settings.splitRatio = 0.5"></div>
              <div class="side">
                <table class="tbl">
                  <tbody>
                    <tr v-for="(r, i) in split" :key="i">
                      <td v-if="r.hunk" colspan="2" class="hunk mono">&#8203;</td>
                      <template v-else>
                        <td class="no" :class="r.right?.kind">{{ r.right?.new ?? "" }}</td>
                        <td class="src" :class="r.right ? r.right.kind : 'none'" v-html="hl(r.right) || '&#8203;'"></td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <table v-else-if="mode === 'split'" class="tbl split fixed">
              <colgroup>
                <col class="c-no" />
                <col :style="{ width: `${settings.splitRatio * 100}%` }" />
                <col class="c-no" />
                <col :style="{ width: `${(1 - settings.splitRatio) * 100}%` }" />
              </colgroup>
              <tbody>
                <tr v-for="(r, i) in split" :key="i">
                  <template v-if="r.hunk"><td colspan="4" class="hunk mono">{{ r.hunk }}</td></template>
                  <template v-else>
                    <td class="no" :class="r.left?.kind">{{ r.left?.old ?? "" }}</td>
                    <td class="src" :class="r.left ? r.left.kind : 'none'" v-html="hl(r.left)"></td>
                    <td class="no sepl" :class="r.right?.kind">{{ r.right?.new ?? "" }}</td>
                    <td class="src" :class="r.right ? r.right.kind : 'none'" v-html="hl(r.right)"></td>
                  </template>
                </tr>
              </tbody>
            </table>

            <!-- Whole file, changed lines marked -->
            <table v-else class="tbl">
              <tbody>
                <tr v-for="(h, i) in fileLines" :key="i" :class="{ add: changedNew.has(i + 1) }">
                  <td class="no">{{ i + 1 }}</td>
                  <td class="mark">{{ changedNew.has(i + 1) ? "▎" : "" }}</td>
                  <td class="src" v-html="h"></td>
                </tr>
              </tbody>
            </table>
            <div v-if="truncated" class="empty">Affichage limité aux {{ MAX_ROWS }} premières lignes.</div>
            <div v-if="selected && !error && !loading && mode !== 'file' && mode !== 'read' && !diff.length" class="empty">Pas de différence textuelle (fichier binaire, renommage ou droits).</div>
          </div>
          <div v-if="selectedFile" class="foot muted">
            <template v-if="mode === 'read'">Markdown mis en forme · </template>
            {{ selectedFile.status === "??" ? "Nouveau fichier, pas encore suivi" : "Comparé au dernier commit (HEAD)" }}
            <template v-if="st?.last_time"> · dernier commit {{ ago(st.last_time * 1000) }}</template>
            · ↑ / ↓ fichier suivant · ⌘+ / ⌘− taille du code · Échap pour fermer
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; }
.modal {
  outline: none;
  width: 94vw; height: 90vh; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid #33383e; box-shadow: 0 24px 72px rgba(0, 0, 0, 0.6);
}
.top { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.title { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.repo { border: none; background: none; padding: 0; color: var(--text); font-size: 15px; font-weight: 600; }
.repo:hover { color: var(--done); }
.repo.plain:hover { color: var(--text); }
.branch { font-size: 12.5px; color: var(--text-2); }
.tools { display: flex; align-items: center; gap: 8px; }
.close { width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-size: 20px; }
.close:hover { background: var(--hover); color: var(--text); }
.body { flex: 1; min-height: 0; display: flex; }
.left { flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-right: 1px solid var(--line); min-height: 0; }
.filter { height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); outline: none; font-size: 12.5px; }
.count { color: var(--muted); margin-left: 4px; }
.files { flex: 1; min-height: 80px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.file { display: flex; align-items: baseline; gap: 8px; min-width: 0; padding: 5px 8px; border: none; border-radius: 6px; background: transparent; color: var(--text-2); text-align: left; font-size: 12.5px; }
.file:hover { background: #181b1e; }
.file.on { background: var(--hover); color: var(--text); }
.st { width: 14px; flex-shrink: 0; font: 600 11px var(--mono); text-align: center; }
.st.mod { color: #f2a93b; } .st.add, .st.new { color: var(--ok); } .st.del { color: var(--blocked); } .st.ren { color: var(--done); } .st.conf { color: var(--blocked); }
.name { flex-shrink: 0; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dir { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--muted); direction: rtl; text-align: left; }
.reqs { max-height: 38%; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--line); padding-top: 10px; }
.req { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 5px 6px; border: none; border-radius: 6px; background: transparent; color: var(--text-2); text-align: left; font-size: 12px; }
.req:hover { background: #181b1e; }
.req.mine { box-shadow: inset 0 0 0 1px #33506f; }
.ref { color: #c29bf0; font-size: 11.5px; flex-shrink: 0; }
.req-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.viewer { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bar { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.path { flex: 1; min-width: 0; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats { margin-left: 10px; font-size: 12px; }
.plus { color: var(--ok); } .minus { color: var(--blocked); }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg); gap: 2px; }
.seg button { border: none; background: transparent; color: var(--muted); font-size: 12px; padding: 4px 10px; border-radius: 6px; }
.seg button.on { background: var(--hover); color: var(--text); }
.theme { height: 28px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 12px; padding: 0 6px; }
.wrap-t { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.wrap-t input { accent-color: var(--done); }
.code { flex: 1; min-height: 0; overflow: auto; font-family: var(--mono); line-height: 1.55; }
.size { font-size: 11px; color: var(--muted); }
/* Rendered Markdown: a reading column, GitHub-like. */
.md { max-width: 860px; margin: 0 auto; padding: 28px 36px 60px; font: 15px/1.7 var(--sans); font-size: calc(1em + 2.5px); color: var(--c-fg); user-select: text; }
.md.full { max-width: none; padding: 24px 40px 60px; }
.md.full :deep(table) { display: table; width: 100%; }
.icon { width: 28px; height: 28px; flex-shrink: 0; border: none; border-radius: 7px; background: transparent; color: var(--muted); font-size: 15px; }
.icon:hover { background: var(--hover); color: var(--text); }
.md :deep(h1), .md :deep(h2) { padding-bottom: 0.3em; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.md :deep(h1) { font-size: 1.9em; margin: 0.2em 0 0.7em; }
.md :deep(h2) { font-size: 1.45em; margin: 1.6em 0 0.6em; }
.md :deep(h3) { font-size: 1.2em; margin: 1.4em 0 0.5em; }
.md :deep(h4), .md :deep(h5), .md :deep(h6) { font-size: 1em; margin: 1.2em 0 0.4em; }
.md :deep(p), .md :deep(ul), .md :deep(ol), .md :deep(blockquote), .md :deep(table), .md :deep(pre) { margin: 0 0 1em; }
.md :deep(ul), .md :deep(ol) { padding-left: 1.6em; }
.md :deep(li) { margin: 0.2em 0; }
.md :deep(li input[type="checkbox"]) { margin-right: 0.4em; accent-color: var(--done); }
.md :deep(a) { color: #58a6ff; text-decoration: none; }
.md :deep(a:hover) { text-decoration: underline; }
.md :deep(code) { font-family: var(--mono); font-size: 0.86em; padding: 0.15em 0.4em; border-radius: 5px; background: rgba(255, 255, 255, 0.08); }
.md :deep(pre.md-code) { padding: 14px 16px; border-radius: 8px; background: rgba(0, 0, 0, 0.3); overflow: auto; font-size: 0.82em; line-height: 1.55; }
.md :deep(pre.md-code code) { padding: 0; background: none; font-size: inherit; }
.md :deep(blockquote) { padding: 0.2em 1em; border-left: 3px solid rgba(255, 255, 255, 0.2); color: var(--c-gutter); }
.md :deep(table) { border-collapse: collapse; display: block; overflow-x: auto; font-size: 0.92em; }
.md :deep(th), .md :deep(td) { padding: 6px 12px; border: 1px solid rgba(255, 255, 255, 0.12); }
.md :deep(th) { background: rgba(255, 255, 255, 0.05); font-weight: 600; }
.md :deep(tr:nth-child(2n) td) { background: rgba(255, 255, 255, 0.02); }
.md :deep(hr) { border: none; border-top: 1px solid rgba(255, 255, 255, 0.12); margin: 2em 0; }
.md :deep(img) { max-width: 100%; }
.tbl { border-collapse: collapse; width: 100%; }
.tbl td { padding: 0 10px; vertical-align: top; }
.no { width: 1%; min-width: 40px; text-align: right; color: var(--c-gutter); user-select: none; white-space: nowrap; }
.sign, .mark { width: 1%; padding: 0 4px !important; color: var(--c-gutter); user-select: none; }
.mark { color: var(--ok); }
.src { white-space: pre; user-select: text; }
.code.wrap .src { white-space: pre-wrap; word-break: break-all; }
.split2 { display: grid; min-width: 0; align-items: start; }
.side { min-width: 0; overflow-x: auto; }
.side .tbl { width: max-content; min-width: 100%; }
.split-bar { align-self: stretch; cursor: col-resize; background: rgba(255, 255, 255, 0.06); }
.split-bar:hover { background: rgba(110, 168, 254, 0.45); }
.tbl.fixed { table-layout: fixed; }
.c-no { width: 52px; }
.sepl { border-left: 1px solid rgba(255, 255, 255, 0.06); }
tr.add > td, td.add { background: var(--c-add); }
tr.del > td, td.del { background: var(--c-del); }
tr.add .sign, td.add.no { color: var(--ok); }
tr.del .sign, td.del.no { color: var(--blocked); }
td.none { background: rgba(255, 255, 255, 0.02); }
.hunk { background: var(--c-hunk); color: var(--c-hunk-fg); padding: 2px 10px !important; }
.empty { padding: 24px; color: var(--c-gutter); font-family: var(--sans); font-size: 13px; }
.err { color: var(--fail); }
.foot { flex-shrink: 0; padding: 6px 12px; border-top: 1px solid var(--line); font-size: 11px; }
.muted { color: var(--muted); }
.pad { padding: 8px; font-size: 12px; }
.chip { height: 22px; padding: 0 8px; border-radius: 11px; display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; background: #1d2024; color: var(--text-2); border: none; }
.chip.sm { height: 18px; font-size: 10.5px; padding: 0 7px; flex-shrink: 0; }
.chip.ok { background: #132a1c; color: var(--ok); } .chip.warn { background: #2b2213; color: #f2a93b; }
.chip.crit { background: #301817; color: var(--blocked); } .chip.pending { background: #13282a; color: var(--working); }
.chip.muted { color: var(--muted); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
