<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { currentForge, currentGit, git, refreshGit } from "../stores/git";
import { settings } from "../stores/settings";
import { ago } from "../lib/format";
import { diffStats, parseDiff, splitDiff, type DiffLine } from "../lib/diff";
import { CODE_THEMES, highlightFile, highlightLine, languageFor } from "../lib/highlight";

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
const error = ref("");
const loading = ref(false);
let seq = 0;

async function load() {
  const path = selected.value;
  const root = st.value?.root;
  diff.value = [];
  diffHtml.value = [];
  fileLines.value = [];
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
    if (settings.diffMode === "file") {
      // A deleted file: show it as it was in HEAD.
      const deleted = selectedFile.value?.status.includes("D") ?? false;
      const text = await invoke<string>("git_file", { root, path, rev: deleted ? "HEAD" : null });
      if (my !== seq) return;
      const all = text.replace(/\n$/, "");
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
watch([() => selected.value, () => settings.diffMode, () => st.value?.root], load, { immediate: true });
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
          <button v-if="fg?.base" class="repo" @click="open(fg.base)">{{ repoName }} ↗</button>
          <span v-else class="repo plain">{{ repoName }}</span>
          <span v-if="st" class="mono branch">{{ st.branch ?? "(détachée)" }}</span>
          <span v-if="st?.ahead" class="chip warn">↑ {{ st.ahead }}</span>
          <span v-if="st?.behind" class="chip pending">↓ {{ st.behind }}</span>
          <button v-if="fg?.ci" class="chip" :class="fg.ci.level" @click="open(fg.ci.url)">{{ fg.ci.label }}</button>
        </div>
        <div class="tools">
          <button class="btn" :disabled="git.loading" @click="refreshGit()">{{ git.loading ? "…" : "Rafraîchir" }}</button>
          <button class="close" aria-label="Fermer (Échap)" @click="git.modal.open = false">×</button>
        </div>
      </header>

      <div class="body">
        <aside class="left">
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

        <section class="viewer">
          <div class="bar">
            <div class="path mono" :title="selected ?? ''">
              <template v-if="selected">{{ selected }}</template>
              <span v-if="selected && diff.length" class="stats"><span class="plus">+{{ stats.added }}</span> <span class="minus">−{{ stats.removed }}</span></span>
            </div>
            <div class="seg" role="radiogroup" aria-label="Affichage">
              <button :class="{ on: settings.diffMode === 'unified' }" @click="settings.diffMode = 'unified'">Diff</button>
              <button :class="{ on: settings.diffMode === 'split' }" @click="settings.diffMode = 'split'">Côte à côte</button>
              <button :class="{ on: settings.diffMode === 'file' }" @click="settings.diffMode = 'file'">Fichier</button>
            </div>
            <label class="sr" for="code-theme">Thème</label>
            <select id="code-theme" v-model="settings.codeTheme" class="theme">
              <option v-for="t in CODE_THEMES" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
            <label class="wrap-t"><input v-model="settings.codeWrap" type="checkbox" />Retour à la ligne</label>
          </div>

          <div class="code" :class="[settings.codeTheme, { wrap: settings.codeWrap }]">
            <div v-if="!selected" class="empty">Choisis un fichier à gauche.</div>
            <div v-else-if="error" class="empty err">{{ error }}</div>
            <div v-else-if="loading && !diff.length && !fileLines.length" class="empty">Chargement…</div>

            <!-- Unified diff -->
            <table v-else-if="settings.diffMode === 'unified'" class="tbl">
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

            <!-- Side by side -->
            <table v-else-if="settings.diffMode === 'split'" class="tbl split">
              <tbody>
                <tr v-for="(r, i) in split" :key="i">
                  <template v-if="r.hunk"><td colspan="4" class="hunk mono">{{ r.hunk }}</td></template>
                  <template v-else>
                    <td class="no" :class="r.left?.kind">{{ r.left?.old ?? "" }}</td>
                    <td class="src half" :class="r.left ? r.left.kind : 'none'" v-html="hl(r.left)"></td>
                    <td class="no sepl" :class="r.right?.kind">{{ r.right?.new ?? "" }}</td>
                    <td class="src half" :class="r.right ? r.right.kind : 'none'" v-html="hl(r.right)"></td>
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
            <div v-if="selected && !error && !loading && settings.diffMode !== 'file' && !diff.length" class="empty">Pas de différence textuelle (fichier binaire, renommage ou droits).</div>
          </div>
          <div v-if="selectedFile" class="foot muted">
            {{ selectedFile.status === "??" ? "Nouveau fichier, pas encore suivi" : "Comparé au dernier commit (HEAD)" }}
            <template v-if="st?.last_time"> · dernier commit {{ ago(st.last_time * 1000) }}</template>
            · ↑ / ↓ pour changer de fichier · Échap pour fermer
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
.left { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-right: 1px solid var(--line); min-height: 0; }
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
.code { flex: 1; min-height: 0; overflow: auto; font: 12.5px/1.55 var(--mono); }
.tbl { border-collapse: collapse; width: 100%; }
.tbl td { padding: 0 10px; vertical-align: top; }
.no { width: 1%; min-width: 40px; text-align: right; color: var(--c-gutter); user-select: none; white-space: nowrap; }
.sign, .mark { width: 1%; padding: 0 4px !important; color: var(--c-gutter); user-select: none; }
.mark { color: var(--ok); }
.src { white-space: pre; user-select: text; }
.code.wrap .src { white-space: pre-wrap; word-break: break-all; }
.half { width: 49%; }
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
