<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { allRuns, byFeature, byHour, daysAgo, history, hm, kpis, loadHistory, monthSpend, rework, startOfDay, tick, toCsv, type HistoryRun } from "../stores/history";
import { workspaces as liveWorkspaces } from "../stores/session";
import { settings } from "../stores/settings";
import { allPanes, selectPane, toast } from "../stores/session";
import { fold } from "../stores/search";
import SpendTable from "./SpendTable.vue";

type Period = "today" | "7" | "30" | "90" | "365";
const period = ref<Period>("today");
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

// ---- KPI cards (same filters as the list) -------------------------------------
const span = computed(() => tick.value - from.value);
/** The same stretch of time just before: today so far vs yesterday at this hour. */
const prevRuns = computed(() =>
  allRuns.value.filter((r) => r.end >= from.value - span.value && r.end < tick.value - span.value && (!ws.value || r.ws === ws.value) && matches(r)),
);
const k = computed(() => kpis(runs.value));
const kp = computed(() => kpis(prevRuns.value));
const humanMs = computed(() => k.value.agentMs * settings.histHumanFactor);
const yourMs = computed(() => (k.value.prompts * settings.histPromptMin + k.value.decisions * settings.histDecisionMin) * 60_000);
const leverage = computed(() => (yourMs.value > 0 ? humanMs.value / yourMs.value : null));
/** "+20 %" vs the previous stretch (null when there is nothing to compare). */
function delta(now: number, before: number): { txt: string; up: boolean } | null {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return { txt: `${pct > 0 ? "+" : ""}${pct} %`, up: pct > 0 };
}
const prevLabel = computed(() => (period.value === "today" ? "vs hier à la même heure" : `vs les ${period.value} jours d’avant`));
/** Cost over day / week / month, whatever the period chosen (same workspace and agent filters). */
const costBy = computed(() => {
  const sum = (since: number) =>
    allRuns.value.filter((r) => r.end >= since && (!ws.value || r.ws === ws.value) && matches(r)).reduce((s, r) => s + (r.cost ?? 0), 0);
  return { day: sum(startOfDay()), week: sum(daysAgo(6)), month: sum(daysAgo(29)) };
});
const showCalib = ref(false);

// Left column: by workspace, or by feature (branch, with its issue / MR).
const groupBy = ref<"ws" | "feature">("ws");
const features = computed(() => byFeature(inPeriod.value.filter((r) => (!ws.value || r.ws === ws.value) && matches(r))));
const featMax = computed(() => Math.max(1, ...features.value.map((f) => f.ms)));
function pickFeature(branch: string) {
  q.value = q.value === branch ? "" : branch === "sans branche" ? "" : branch;
}

const rw = computed(() => rework(runs.value));
const hours = computed(() => byHour(runs.value));
const hourMax = computed(() => Math.max(1, ...hours.value.active.map((a, i) => a + hours.value.blocked[i])));

// Budgets: every workspace known (open now or in the history).
const budgetNames = computed(() => [...new Set([...liveWorkspaces.value.map((w) => w.label), ...allRuns.value.map((r) => r.ws)].filter(Boolean))].sort());
function setBudget(name: string, v: string) {
  const n = Number(v.replace(",", "."));
  const next = { ...settings.budgets };
  if (!v.trim() || !Number.isFinite(n) || n <= 0) delete next[name];
  else next[name] = n;
  settings.budgets = next;
}
const budgetLevel = (name: string) => {
  const b = settings.budgets[name];
  if (!b) return "";
  const p = (monthSpend.value.get(name) ?? 0) / b;
  return p >= 1 ? "crit" : p >= 0.8 ? "warn" : "ok";
};
const showBudgets = ref(false);

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
        <button class="btn" :class="{ on: showCalib }" title="Hypothèses des estimations" @click="showCalib = !showCalib">⚙ Hypothèses</button>
        <button class="btn" :disabled="!runs.length" @click="exportCsv">Export CSV ⤓</button>
      </div>

      <div v-if="showCalib" class="calib">
        <label>1 h d’agent ≈ <input v-model.number="settings.histHumanFactor" type="number" min="0.5" max="20" step="0.5" /> h de développeur</label>
        <label>Une consigne écrite ≈ <input v-model.number="settings.histPromptMin" type="number" min="0" max="60" step="0.5" /> min de ton temps</label>
        <label>Une décision (autoriser, choisir) ≈ <input v-model.number="settings.histDecisionMin" type="number" min="0" max="30" step="0.5" /> min</label>
        <span class="hint">Estimations, à ajuster à ton expérience. « Ton temps » ne compte que l’écriture des consignes et les décisions, pas la relecture ni les tests faits à côté.</span>
      </div>

      <div class="cards" aria-label="Synthèse">
        <div class="card">
          <span class="c-label">Coût agents</span>
          <span class="c-value">{{ usd(k.cost) }}</span>
          <span v-if="delta(k.cost, kp.cost)" class="c-delta" :class="{ up: delta(k.cost, kp.cost)!.up }">{{ delta(k.cost, kp.cost)!.txt }} {{ prevLabel }}</span>
          <span class="c-sub">jour {{ usd(costBy.day) }} · 7 j {{ usd(costBy.week) }} · 30 j {{ usd(costBy.month) }}</span>
        </div>
        <div class="card">
          <span class="c-label">Temps agents</span>
          <span class="c-value">{{ hm(k.agentMs) }}</span>
          <span v-if="delta(k.agentMs, kp.agentMs)" class="c-delta neutral">{{ delta(k.agentMs, kp.agentMs)!.txt }} {{ prevLabel }}</span>
          <span class="c-sub">{{ k.runs }} travau{{ k.runs > 1 ? "x" : "" }} · {{ k.projects }} projet{{ k.projects > 1 ? "s" : "" }}<template v-if="k.agentMs > 60_000"> · {{ usd(k.cost / (k.agentMs / 3_600_000)) }} / h</template></span>
        </div>
        <div class="card">
          <span class="c-label">Temps homme estimé</span>
          <span class="c-value">{{ hm(humanMs) }}</span>
          <span class="c-sub">si un développeur l’avait fait seul · × {{ settings.histHumanFactor }}</span>
        </div>
        <div class="card">
          <span class="c-label">Ton temps estimé</span>
          <span class="c-value">{{ hm(yourMs) }}</span>
          <span class="c-sub">{{ k.prompts }} consigne{{ k.prompts > 1 ? "s" : "" }} · {{ k.decisions }} décision{{ k.decisions > 1 ? "s" : "" }}</span>
        </div>
        <div class="card accent">
          <span class="c-label">Effet de levier</span>
          <span class="c-value">{{ leverage ? `× ${leverage >= 10 ? Math.round(leverage) : leverage.toFixed(1)}` : "—" }}</span>
          <span class="c-sub">temps homme estimé / ton temps<template v-if="leverage"> · {{ hm(Math.max(0, humanMs - yourMs)) }} gagnées</template></span>
        </div>
        <div class="card" :class="{ warn: rw.total >= 5 && rw.reworked / rw.total > 0.25 }">
          <span class="c-label">Taux de reprise</span>
          <span class="c-value">{{ rw.total ? `${Math.round((rw.reworked / rw.total) * 100)} %` : "—" }}</span>
          <span class="c-sub">{{ rw.reworked }} travau{{ rw.reworked > 1 ? "x" : "" }} suivi{{ rw.reworked > 1 ? "s" : "" }} d’une correction dans l’heure</span>
        </div>
        <div class="card" :class="{ warn: k.blockedMs > 0.2 * Math.max(1, k.agentMs + k.blockedMs) }">
          <span class="c-label">Agents qui t’attendaient</span>
          <span class="c-value">{{ hm(k.blockedMs) }}</span>
          <span class="c-sub">en attente de ta décision<template v-if="k.agentMs + k.blockedMs > 0"> · {{ Math.round((k.blockedMs / (k.agentMs + k.blockedMs)) * 100) }} % du temps</template></span>
        </div>
      </div>

      <div class="body">
        <aside class="side">
          <div class="side-head">
            <span class="seg small" role="radiogroup" aria-label="Regrouper">
              <button :class="{ on: groupBy === 'ws' }" @click="groupBy = 'ws'">Par workspace</button>
              <button :class="{ on: groupBy === 'feature' }" @click="groupBy = 'feature'">Par fonctionnalité</button>
            </span>
          </div>
          <template v-if="groupBy === 'feature'">
            <button v-for="f in features" :key="f.key" class="tot feat" :class="{ on: q === f.branch }" :title="`${f.ws} · ${f.branch} · ${f.n} travau${f.n > 1 ? 'x' : ''}`" @click="pickFeature(f.branch)">
              <span class="t-name"><span v-if="f.ref" class="f-ref">{{ f.ref }}</span>{{ f.branch }}<span class="f-ws">{{ f.ws }}</span></span>
              <span class="mono t-ms">{{ hm(f.ms) }}</span>
              <span class="bar"><span :style="{ width: `${(f.ms / featMax) * 100}%` }"></span></span>
              <span class="mono t-cost">{{ f.cost ? usd(f.cost) : "" }}</span>
            </button>
            <p v-if="!features.length" class="hint">Rien sur cette période.</p>
          </template>
          <template v-else>
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
          </template>
          <svg v-if="bars.vals.length > 1" class="chart" :viewBox="`0 0 ${bars.vals.length * 10} 40`" preserveAspectRatio="none" role="img" aria-label="Temps de travail par jour">
            <rect v-for="(v, i) in bars.vals" :key="i" :x="i * 10 + 1.5" :y="38 - (v / bars.max) * 36" width="7" :height="Math.max(0.6, (v / bars.max) * 36)" rx="1" fill="var(--done)">
              <title>{{ hm(v) }}</title>
            </rect>
          </svg>
          <div v-if="bars.vals.length > 1" class="hint">par {{ bars.step === 7 ? "semaine" : "jour" }}</div>
          <p class="hint">Temps où les agents travaillaient, sans les attentes de ta décision. Coût : sessions Claude suivies.</p>

          <div class="eyebrow sub-h">Heures productives</div>
          <svg class="chart hours" viewBox="0 0 240 44" preserveAspectRatio="none" role="img" aria-label="Temps des agents par heure de la journée">
            <g v-for="h in 24" :key="h">
              <title>{{ h - 1 }} h : {{ hm(hours.active[h - 1]) }} de travail, {{ hm(hours.blocked[h - 1]) }} d’attente</title>
              <rect :x="(h - 1) * 10 + 1" y="0" width="8" height="44" fill="transparent" />
              <rect :x="(h - 1) * 10 + 1" :y="40 - (hours.active[h - 1] / hourMax) * 38" width="8" :height="Math.max(0.5, (hours.active[h - 1] / hourMax) * 38)" fill="var(--done)" rx="1" />
              <rect :x="(h - 1) * 10 + 1" :y="40 - ((hours.active[h - 1] + hours.blocked[h - 1]) / hourMax) * 38" width="8" :height="(hours.blocked[h - 1] / hourMax) * 38" fill="var(--accent)" rx="1" />
            </g>
          </svg>
          <div class="hours-axis mono"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
          <div class="hint"><span class="sw done"></span>travail <span class="sw wait"></span>en attente de ta décision</div>

          <div class="eyebrow sub-h budget-h">
            Budgets du mois
            <button class="link" @click="showBudgets = !showBudgets">{{ showBudgets ? "OK" : "Modifier" }}</button>
          </div>
          <div v-for="n in budgetNames.filter((x) => showBudgets || settings.budgets[x])" :key="n" class="budget" :class="budgetLevel(n)">
            <span class="t-name">{{ n }}</span>
            <template v-if="showBudgets">
              <input :value="settings.budgets[n] ?? ''" placeholder="—" inputmode="decimal" @change="(e) => setBudget(n, (e.target as HTMLInputElement).value)" />
              <span class="muted">$ / mois</span>
            </template>
            <template v-else>
              <span class="bar"><span :style="{ width: `${Math.min(100, ((monthSpend.get(n) ?? 0) / settings.budgets[n]) * 100)}%` }"></span></span>
              <span class="mono t-cost">{{ usd(monthSpend.get(n) ?? 0) }} / {{ usd(settings.budgets[n]) }}</span>
            </template>
          </div>
          <p v-if="!showBudgets && !Object.keys(settings.budgets).length" class="hint">Aucun budget. « Modifier » pour en fixer un par workspace : notification à 80 % et à 100 %.</p>
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
.calib { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); background: var(--bg); font-size: 12px; color: var(--text-2); }
.calib input { width: 56px; height: 26px; margin: 0 4px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); text-align: right; padding: 0 6px; }
.btn.on { border-color: var(--done); color: var(--text); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.card { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); min-width: 0; }
.card.accent { border-color: color-mix(in srgb, var(--done) 45%, var(--line)); }
.card.warn { border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); }
.card.warn .c-value { color: var(--accent); }
.c-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
.c-value { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.c-delta { font-size: 11px; color: var(--ok); }
.c-delta.up { color: var(--accent); }
.c-delta.neutral { color: var(--text-2); }
.c-sub { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.side-head { margin-bottom: 4px; }
.seg.small { margin-left: 0; }
.seg.small button { height: 24px; padding: 0 9px; font-size: 11px; }
.feat .t-name { display: flex; align-items: baseline; gap: 6px; }
.f-ref { font-size: 10.5px; padding: 0 5px; border-radius: 5px; background: var(--field); color: var(--done); flex-shrink: 0; }
.f-ws { font-size: 10.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.sub-h { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); }
.chart.hours { height: 48px; margin-top: 6px; }
.hours-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); }
.sw { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin: 0 3px 0 8px; vertical-align: middle; }
.sw.done { background: var(--done); margin-left: 0; } .sw.wait { background: var(--accent); }
.budget-h { display: flex; justify-content: space-between; align-items: center; }
.budget-h .link { font-size: 11px; color: var(--done); text-transform: none; letter-spacing: 0; }
.budget { display: grid; grid-template-columns: minmax(0, 1fr) 70px 96px; gap: 8px; align-items: center; padding: 4px 6px; font-size: 12.5px; }
.budget input { height: 24px; width: 70px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); text-align: right; padding: 0 6px; }
.budget.ok .bar span { background: var(--ok); }
.budget.warn .bar span { background: var(--accent); } .budget.warn .t-cost { color: var(--accent); }
.budget.crit .bar span { background: var(--blocked); } .budget.crit .t-cost { color: var(--blocked); }
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
