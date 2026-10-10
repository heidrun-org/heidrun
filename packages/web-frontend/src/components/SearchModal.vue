<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { clearSearchCache, requestJump, runSearch, search, type SearchGroup } from "../stores/search";
import { selectPane, state, workspaceLabel } from "../stores/session";
import { CODE_FONT_SIZE } from "../stores/settings";
import { t } from "../i18n/index";

const q = ref("");
const regex = ref(false);
const agentsOnly = ref(false);
const here = ref(false);
const groups = ref<SearchGroup[]>([]);
const error = ref("");
const busy = ref(false);
const ms = ref(0);
const input = ref<HTMLInputElement>();
const active = ref(0);

const flat = computed(() => groups.value.flatMap((g) => g.hits.map((h) => ({ g, h }))));
const totalHits = computed(() => groups.value.reduce((n, g) => n + g.total, 0));
const summary = computed(() => {
  const results = t("searchModal.results", { count: totalHits.value });
  const panes = t("searchModal.panes", { count: groups.value.length });
  return t("searchModal.summary", { results, panes, ms: ms.value });
});

let timer = 0;
let seq = 0;
async function go() {
  const query = q.value.trim();
  const my = ++seq;
  if (query.length < 2) {
    groups.value = [];
    error.value = "";
    busy.value = false;
    return;
  }
  busy.value = true;
  const t0 = performance.now();
  const r = await runSearch(query, { regex: regex.value, agentsOnly: agentsOnly.value, workspaceId: here.value ? state.selectedWorkspaceId : null });
  if (my !== seq) return;
  groups.value = r.groups;
  error.value = r.error ?? "";
  ms.value = Math.round(performance.now() - t0);
  active.value = 0;
  busy.value = false;
}
watch([q, regex, agentsOnly, here], () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = 0;
    go();
  }, 220);
});

onMounted(() => {
  clearSearchCache();
  nextTick(() => input.value?.focus());
});

function close() {
  search.open = false;
}
function open(i: number) {
  const it = flat.value[i];
  if (!it) return;
  close();
  selectPane(it.g.pane);
  requestJump(it.g.pane.pane_id, it.h.line, it.h.start, it.h.end);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    active.value = Math.min(flat.value.length - 1, active.value + 1);
    nextTick(() => document.querySelector(".hit.active")?.scrollIntoView({ block: "nearest" }));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    active.value = Math.max(0, active.value - 1);
    nextTick(() => document.querySelector(".hit.active")?.scrollIntoView({ block: "nearest" }));
  } else if (e.key === "Enter") {
    e.preventDefault();
    // Typed faster than the debounce: search the current text first.
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
      go().then(() => open(0));
    } else open(active.value);
  }
}

const indexOf = (g: SearchGroup, j: number) => flat.value.findIndex((x) => x.g === g && x.h === g.hits[j]);
const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n) + "…" : s);
function parts(line: string, s: number, e: number) {
  // Long lines: centred on the match.
  const from = Math.max(0, s - 80);
  const pre = (from ? "…" : "") + line.slice(from, s);
  return { pre, hit: line.slice(s, e), post: clip(line.slice(e), 160) };
}
</script>

<template>
  <div class="overlay" @mousedown.self="close" @keydown="onKey">
    <div class="modal" role="dialog" :aria-label="t('searchModal.dialogLabel')">
      <div class="bar">
        <input ref="input" v-model="q" class="q" :placeholder="t('searchModal.placeholder')" spellcheck="false" />
        <label class="opt"><input v-model="here" type="checkbox" />{{ t("searchModal.thisWorkspace") }}</label>
        <label class="opt"><input v-model="agentsOnly" type="checkbox" />{{ t("searchModal.agentsOnly") }}</label>
        <label class="opt mono" :title="t('searchModal.regex')"><input v-model="regex" type="checkbox" />.*</label>
      </div>
      <div class="status">
        <span v-if="error" class="err">{{ error }}</span>
        <span v-else-if="busy">{{ t("searchModal.searching") }}</span>
        <span v-else-if="q.trim().length >= 2">{{ summary }}</span>
        <span v-else>{{ t("searchModal.help") }}</span>
      </div>
      <div class="results" :style="{ fontSize: `${CODE_FONT_SIZE}px` }">
        <section v-for="g in groups" :key="g.pane.pane_id" class="group">
          <h3>
            <span>{{ g.where }}</span>
            <span v-if="g.pane.agent" class="tag">{{ g.pane.agent }}</span>
            <span v-if="g.pane.workspace_id !== state.selectedWorkspaceId" class="muted ws">{{ workspaceLabel(g.pane.workspace_id) }}</span>
            <span class="count">{{ g.total }}</span>
          </h3>
          <button :title="t('searchModal.openResult')"
            v-for="(h, j) in g.hits"
            :key="j"
            class="hit mono"
            :class="{ active: indexOf(g, j) === active }"
            @mouseenter="active = indexOf(g, j)"
            @click="open(indexOf(g, j))"
          >
            <span v-if="h.before" class="ctx">{{ clip(h.before) }}</span>
            <span class="line">{{ parts(h.line, h.start, h.end).pre }}<mark>{{ parts(h.line, h.start, h.end).hit }}</mark>{{ parts(h.line, h.start, h.end).post }}</span>
            <span v-if="h.after" class="ctx">{{ clip(h.after) }}</span>
          </button>
          <div v-if="g.total > g.hits.length" class="more muted">{{ t("searchModal.more", { count: g.total - g.hits.length }) }}</div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 58; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; padding: 56px 24px 24px; }
.modal {
  width: min(980px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
.bar { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.q { flex: 1; height: 36px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 14px; padding: 0 12px; }
.opt { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.opt input { accent-color: var(--accent); }
.status { padding: 6px 16px; font-size: 11.5px; color: var(--muted); border-bottom: 1px solid var(--line); }
.err { color: var(--fail); }
.results { overflow: auto; padding: 6px 8px 12px; }
.group h3 { display: flex; align-items: center; gap: 8px; margin: 10px 8px 4px; font-size: 12px; font-weight: 600; color: var(--text); font-family: var(--font-ui, inherit); }
.tag { font-size: 10.5px; font-weight: 500; padding: 1px 6px; border-radius: 6px; background: var(--field); color: var(--muted); }
.count { margin-left: auto; font-size: 11px; color: var(--muted); font-weight: 500; }
.hit { display: flex; flex-direction: column; width: 100%; text-align: left; padding: 5px 10px; border-radius: 7px; gap: 1px; }
.hit.active { background: var(--field); }
.hit span { white-space: pre; overflow: hidden; text-overflow: ellipsis; }
.ctx { color: var(--muted); opacity: 0.75; }
.line { color: var(--text); }
mark { background: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--text); border-radius: 3px; padding: 0 1px; }
.more { padding: 2px 10px 4px; font-size: 11.5px; }
.muted { color: var(--muted); }
.ws { font-weight: 400; }
</style>
