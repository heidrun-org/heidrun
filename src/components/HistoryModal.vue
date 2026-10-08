<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { allRuns, daysAgo, history, hm, loadHistory, startOfDay, toCsv, type HistoryRun } from "../stores/history";
import { allPanes, selectPane, toast } from "../stores/session";
import { fold } from "../stores/search";
import SpendTable from "./SpendTable.vue";

type Period = "today" | "7" | "30" | "90" | "365";
const period = ref<Period>("7");
const ws = ref("");
const kind = ref("");
const q = ref("");
const el = ref<HTMLElement>();

const from = computed(() => (period.value === "today" ? startOfDay() : daysAgo(Number(period.value) - 1)));
const inPeriod = computed(() => allRuns.value.filter((r) => r.end >= from.value));
const workspaces = computed(() => [...new Set(inPeriod.value.map((r) => r.ws))].sort());
const kinds = computed(() => [...new Set(inPeriod.value.map((r) => r.kind))].sort());
const matches = (r: HistoryRun) => {
  const f = fold(q.value.trim());
  return (!kind.value || r.kind === kind.value) && (!f || fold(`${r.summary} ${r.agent} ${r.tab} ${r.branch ?? ""}`).includes(f));
};
const runs = computed(() => inPeriod.value.filter((r) => (!ws.value || r.ws === ws.value) && matches(r)));

const totals = computed(() => {
  const m = new Map<string, { ms: number; cost: number; n: number }>();
  // Same filters as the list, except the workspace (the column is how one picks it).
  for (const r of inPeriod.value.filter(matches)) {
    const t = m.get(r.ws) ?? { ms: 0, cost: 0, n: 0 };
    t.ms += r.activeMs;
    t.cost += r.cost ?? 0;
    t.n++;
    m.set(r.ws, t);
  }
  const list = [...m.entries()].map(([name, t]) => ({ name, ...t })).sort((a, b) => b.ms - a.ms);
  const max = Math.max(1, ...list.map((t) => t.ms));
  return { list, max, ms: list.reduce((s, t) => s + t.ms, 0), cost: list.reduce((s, t) => s + t.cost, 0) };
});

// One bar per day (per week beyond 31 days), for the selected runs.
const bars = computed(() => {
  const days = period.value === "today" ? 1 : Number(period.value);
  const step = days > 31 ? 7 : 1;
  const n = Math.ceil(days / step);
  const vals = Array.from({ length: n }, () => 0);
  for (const r of runs.value) {
    // Whole days, rounded: a DST change makes one day 23 or 25 h long.
    const i = Math.floor(Math.round((startOfDay(r.end) - from.value) / 86_400_000) / step);
    if (i >= 0 && i < n) vals[i] += r.activeMs;
  }
  const max = Math.max(1, ...vals);
  return { vals, max, step };
});

const usd = (v: number) => (v >= 10 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);
const d2 = (n: number) => String(n).padStart(2, "0");
const when = (r: HistoryRun) => {
  const s = new Date(r.start);
  const e = new Date(r.end);
  const day = startOfDay(r.end) === startOfDay() ? "aujourd’hui" : `${d2(e.getDate())}/${d2(e.getMonth() + 1)}`;
  const endTxt = r.live ? "…" : `${d2(e.getHours())}:${d2(e.getMinutes())}`;
  return `${day} ${r.startUnknown ? "≤ " : ""}${d2(s.getHours())}:${d2(s.getMinutes())}–${endTxt}`;
};
const alive = (r: HistoryRun) => allPanes.value.find((p) => p.pane_id === r.paneId) ?? null;

function go(r: HistoryRun) {
  const p = alive(r);
  if (!p) return;
  selectPane(p);
  close();
}

async function exportCsv() {
  const d = new Date();
  const name = `herdr-desk-historique-${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}.csv`;
  try {
    const path = await invoke<string>("history_export", { csv: toCsv(runs.value.filter((r) => !r.live)), name });
    toast(`Exporté : ${path}`);
    revealItemInDir(path).catch(() => {});
  } catch (e) {
    toast(`Export impossible : ${e}`);
  }
}

function close() {
  history.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
onMounted(() => {
  loadHistory();
  window.addEventListener("keydown", onKey, true);
  nextTick(() => el.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div ref="el" class="modal" role="dialog" aria-label="Historique" tabindex="-1">
      <header>
        <h2>Historique</h2>
        <div class="seg" role="radiogroup" aria-label="Période">
          <button v-for="[v, l] in ([['today', 'Aujourd’hui'], ['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['365', '1 an']] as [Period, string][])" :key="v" :class="{ on: period === v }" @click="period = v">{{ l }}</button>
        </div>
        <button class="close" aria-label="Fermer (Échap)" @click="close">×</button>
      </header>
      <div class="filters">
        <select v-model="ws" aria-label="Workspace">
          <option value="">Tous les workspaces</option>
          <option v-for="w in workspaces" :key="w" :value="w">{{ w }}</option>
        </select>
        <select v-model="kind" aria-label="Agent">
          <option value="">Tous les agents</option>
          <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
        </select>
        <input v-model="q" placeholder="Rechercher dans les consignes, branches…" spellcheck="false" />
        <button class="btn" :disabled="!runs.length" @click="exportCsv">Export CSV ⤓</button>
      </div>

      <div class="body">
        <aside class="side">
          <div class="eyebrow">Par workspace</div>
          <button v-for="t in totals.list" :key="t.name" class="tot" :class="{ on: ws === t.name }" @click="ws = ws === t.name ? '' : t.name">
            <span class="t-name">{{ t.name || "—" }}</span>
            <span class="mono t-ms">{{ hm(t.ms) }}</span>
            <span class="bar"><span :style="{ width: `${(t.ms / totals.max) * 100}%` }"></span></span>
            <span class="mono t-cost">{{ t.cost ? usd(t.cost) : "" }}</span>
          </button>
          <div v-if="totals.list.length" class="tot total">
            <span class="t-name">Total</span><span class="mono t-ms">{{ hm(totals.ms) }}</span><span></span>
            <span class="mono t-cost">{{ totals.cost ? usd(totals.cost) : "" }}</span>
          </div>
          <svg v-if="bars.vals.length > 1" class="chart" :viewBox="`0 0 ${bars.vals.length * 10} 40`" preserveAspectRatio="none" role="img" aria-label="Temps de travail par jour">
            <rect v-for="(v, i) in bars.vals" :key="i" :x="i * 10 + 1.5" :y="38 - (v / bars.max) * 36" width="7" :height="Math.max(0.6, (v / bars.max) * 36)" rx="1" fill="var(--done)">
              <title>{{ hm(v) }}</title>
            </rect>
          </svg>
          <div v-if="bars.vals.length > 1" class="hint">par {{ bars.step === 7 ? "semaine" : "jour" }}</div>
          <p class="hint">Temps où les agents travaillaient, sans les attentes de ta décision. Coût : sessions Claude suivies.</p>
          <div class="win"><SpendTable fixed="window" /></div>
        </aside>

        <section class="list">
          <div v-if="!history.loaded" class="empty">Lecture…</div>
          <div v-else-if="!runs.length" class="empty">Aucun travail sur cette période. L’historique se remplit à chaque fin de travail d’un agent.</div>
          <button v-for="r in runs" :key="r.id" class="run" :disabled="!alive(r)" :title="alive(r) ? 'Aller au panneau' : 'Panneau fermé depuis'" @click="go(r)">
            <span class="r-top">
              <span class="mono r-when">{{ when(r) }}</span>
              <span class="mono r-dur">{{ hm(r.activeMs) }}</span>
              <span v-if="r.live" class="r-live">en cours</span>
              <span class="r-where">{{ r.ws }} · {{ r.tab }}</span>
              <span class="r-kind">{{ r.agent }}</span>
              <span v-if="r.branch" class="mono r-branch">{{ r.branch }}</span>
              <span v-if="r.cost" class="mono r-cost">{{ usd(r.cost) }}</span>
            </span>
            <span v-if="r.summary" class="r-sum">{{ r.summary }}</span>
            <span v-if="r.blockedMs > 60_000" class="r-wait">dont {{ hm(r.blockedMs) }} d’attente de décision (non comptée)</span>
          </button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 58; background: rgba(0, 0, 0, 0.55); display: flex; padding: 28px; }
.modal {
  flex: 1; min-width: 0; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
h2 { margin: 0; font-size: 16px; font-weight: 600; }
.seg { display: inline-flex; margin-left: auto; border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden; }
.seg button { height: 28px; padding: 0 12px; font-size: 12px; color: var(--text-2); }
.seg button.on { background: var(--field); color: var(--text); font-weight: 600; }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: 18px; }
.close:hover { background: var(--hover); color: var(--text); }
.filters { display: flex; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
.filters select, .filters input { height: 30px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 12.5px; padding: 0 9px; }
.filters input { flex: 1; }
.body { flex: 1; min-height: 0; display: grid; grid-template-columns: 340px 1fr; }
.side { border-right: 1px solid var(--line); padding: 14px 16px; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
.eyebrow { margin-bottom: 4px; }
.tot { display: grid; grid-template-columns: minmax(0, 1fr) 62px 70px 48px; gap: 8px; align-items: center; padding: 5px 6px; border-radius: 6px; font-size: 12.5px; text-align: left; }
button.tot:hover { background: var(--hover); }
.tot.on { background: var(--field); }
.tot.total { border-top: 1px solid var(--line); border-radius: 0; margin-top: 2px; padding-top: 8px; font-weight: 600; }
.t-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-ms, .t-cost { text-align: right; font-size: 11.5px; color: var(--text-2); }
.bar { height: 5px; border-radius: 3px; background: var(--field); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--done); border-radius: 3px; }
.chart { width: 100%; height: 44px; margin-top: 10px; }
.hint { margin: 0; font-size: 11px; color: var(--muted); }
.win { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.list { overflow: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.empty { padding: 40px; text-align: center; color: var(--muted); font-size: 13px; }
.run { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 8px; text-align: left; border-bottom: 1px solid var(--line); }
.run:hover:not(:disabled) { background: var(--hover); }
.r-live { font-size: 10.5px; padding: 1px 6px; border-radius: 6px; background: color-mix(in srgb, var(--working) 18%, transparent); color: var(--working); white-space: nowrap; }
.run:disabled { cursor: default; opacity: 0.85; }
.r-top { display: flex; align-items: baseline; gap: 10px; font-size: 12.5px; min-width: 0; }
.r-when { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
.r-dur { color: var(--text); font-weight: 600; font-size: 12px; white-space: nowrap; min-width: 56px; }
.r-where { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-kind { color: var(--text-2); white-space: nowrap; }
.r-branch { color: var(--ok); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-cost { margin-left: auto; color: var(--text-2); font-size: 11.5px; }
.r-sum { font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-wait { font-size: 11px; color: var(--muted); }
</style>
