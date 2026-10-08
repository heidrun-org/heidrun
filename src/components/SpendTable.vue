<script setup lang="ts">
import { computed, ref } from "vue";
import { spendSlots, spendToday, spendWindow } from "../stores/spend";
import { clockTime } from "../lib/format";

// `fixed`: always the 5 h window (in the history window), no toggle.
const props = defineProps<{ fixed?: "window" }>();
const scope = ref<"window" | "today">(props.fixed ?? "window");
const data = computed(() => (scope.value === "window" ? spendWindow.value : spendToday.value));
const usd = (v: number) => (v >= 10 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);

// Top workspaces of the 5 h window get a colour, the rest share one grey.
const PALETTE = ["var(--done)", "var(--working)", "var(--accent)", "var(--question)", "var(--ok)"];
const colorOf = computed(() => {
  const m = new Map<string, string>();
  spendWindow.value.rows.slice(0, PALETTE.length).forEach((r, i) => m.set(r.ws, PALETTE[i]));
  return (ws: string) => m.get(ws) ?? "var(--idle)";
});

const chart = computed(() => {
  const { slots, from } = spendSlots.value;
  const totals = slots.map((s) => [...s.values()].reduce((a, b) => a + b, 0));
  const max = Math.max(...totals, 0.0001);
  const nowSlot = Math.min(19, Math.floor((Date.now() - from) / (15 * 60_000)));
  return {
    from,
    nowSlot,
    bars: slots.map((s, i) => {
      let y = 0;
      const parts = [...s.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([ws, v]) => {
          const h = (v / max) * 34;
          const part = { ws, y: 36 - y - h, h };
          y += h;
          return part;
        });
      return { x: i * 12, parts, total: totals[i] };
    }),
  };
});

const title = (r: { label: string; agents: { who: string; cost: number }[] }) =>
  `${r.label}\n` + r.agents.map((a) => `  ${a.who} : ${usd(a.cost)}`).join("\n");
</script>

<template>
  <div class="block">
    <div class="head">
      <span class="eyebrow">{{ fixed ? "Fenêtre 5 h en cours" : "Consommation par workspace" }}</span>
      <span v-if="!fixed" class="seg">
        <button type="button" :class="{ on: scope === 'window' }" @click="scope = 'window'">5 h</button>
        <button type="button" :class="{ on: scope === 'today' }" @click="scope = 'today'">Aujourd’hui</button>
      </span>
    </div>

    <template v-if="data.rows.length">
      <svg v-if="scope === 'window'" class="chart" viewBox="0 0 240 40" preserveAspectRatio="none" role="img" aria-label="Coût par quart d’heure sur la fenêtre de 5 h">
        <rect x="0" y="36" width="240" height="1" fill="var(--line-strong)" />
        <g v-for="(b, i) in chart.bars" :key="i">
          <title>{{ clockTime((chart.from + i * 15 * 60_000) / 1000) }} · {{ usd(b.total) }}</title>
          <rect :x="b.x" y="0" width="12" height="40" fill="transparent" />
          <rect v-for="p in b.parts" :key="p.ws" :x="b.x + 1.5" :y="p.y" width="9" :height="Math.max(0.8, p.h)" :fill="colorOf(p.ws)" rx="1" />
        </g>
        <rect :x="chart.nowSlot * 12 + 11.5" y="0" width="1" height="37" fill="var(--faint)" opacity="0.5" />
      </svg>
      <div v-for="r in data.rows" :key="r.ws" class="row" :title="title(r)">
        <span class="sw" :style="{ background: colorOf(r.ws) }"></span>
        <span class="name">{{ r.label }}</span>
        <span class="bar"><span :style="{ width: `${Math.max(2, r.share * 100)}%`, background: colorOf(r.ws) }"></span></span>
        <span class="mono pct">{{ Math.round(r.share * 100) }} %</span>
        <span class="mono cost">{{ usd(r.cost) }}</span>
      </div>
      <div class="foot">
        <span>Total {{ usd(data.total) }}</span>
        <span v-if="scope === 'window' && data.rows[0]?.quota != null" class="muted">
          · part estimée du quota 5 h : {{ data.rows.map((r) => `${r.label} ${Math.round(r.quota ?? 0)} pts`).slice(0, 3).join(", ") }}
        </span>
      </div>
    </template>
    <p v-else class="hint">
      Rien encore {{ scope === "window" ? "sur la fenêtre de 5 h" : "aujourd’hui" }} : le coût de chaque session Claude est relevé à chaque réponse
      (suivi Claude activé).
    </p>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.block { display: flex; flex-direction: column; gap: 6px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 6px; overflow: hidden; }
.seg button { height: 20px; padding: 0 8px; font-size: 10.5px; color: var(--muted); }
.seg button.on { background: var(--field); color: var(--text); }
.chart { width: 100%; height: 40px; display: block; margin: 2px 0 4px; }
.row { display: grid; grid-template-columns: 8px minmax(0, 1fr) 60px 34px 46px; gap: 6px; align-items: center; font-size: 12px; cursor: default; }
.sw { width: 8px; height: 8px; border-radius: 2px; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar { height: 4px; border-radius: 2px; background: var(--field); overflow: hidden; }
.bar span { display: block; height: 100%; border-radius: 2px; }
.pct, .cost { text-align: right; color: var(--text-2); font-size: 11px; }
.foot { font-size: 11px; color: var(--text-2); }
.muted { color: var(--muted); }
.hint { margin: 0; font-size: 11.5px; color: var(--muted); }
</style>
