<script setup lang="ts">
import { computed, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import AccountUsage from "./AccountUsage.vue";
import {
  addWatch,
  askAgentToFix,
  closePane,
  contextFor,
  selectedPane,
  sendKeys,
  state,
  workspaceLabel,
  workspacePanes,
} from "../stores/session";
import { STATUS_LABEL, clockTime, compactTokens, gaugeLevel, paneName, shortPath } from "../lib/format";

const p = selectedPane;
const ctx = computed(() => (p.value ? contextFor(p.value) : null));
const activity = computed(() => (p.value ? state.activity[p.value.pane_id] ?? [] : []));
const watches = computed(() => state.watches.filter((w) => w.paneId === p.value?.pane_id));
const provider = computed<"claude" | "codex" | null>(() => {
  const a = p.value?.agent ?? "";
  if (a.includes("claude")) return "claude";
  if (a.includes("codex")) return "codex";
  return null;
});
const sessionCost = computed(() => {
  const v = Number(p.value?.tokens?.hd_cost);
  return Number.isFinite(v) && p.value?.tokens?.hd_cost ? v : null;
});

const isClaude = computed(() => p.value?.agent === "claude");

// The agent that will receive "fix it" requests: an available one first.
const fixer = computed(() => {
  const agents = workspacePanes.value.filter((x) => x.agent && x.pane_id !== p.value?.pane_id);
  return agents.find((a) => a.agent_status === "idle" || a.agent_status === "done") ?? agents[0] ?? null;
});

const regex = ref("passed|failed|error");
function watchOutput() {
  if (p.value && regex.value.trim()) addWatch(p.value.pane_id, regex.value.trim());
}

const statusText = computed(() => {
  const x = p.value;
  if (!x) return "";
  if (!x.agent) return "Terminal";
  if (x.agent_status === "blocked") return "Bloqué · attend une décision";
  return STATUS_LABEL[x.agent_status].replace(/^./, (c) => c.toUpperCase());
});
</script>

<template>
  <div class="insp">
    <template v-if="p">
      <div class="block">
        <div class="eyebrow">{{ p.agent ? "Agent sélectionné" : "Terminal sélectionné" }}</div>
        <div class="title">{{ paneName(p) }}</div>
        <div class="chip" :class="p.agent ? p.agent_status : 'process'">● {{ statusText }}</div>
      </div>

      <!-- Approval buttons: keys for Claude Code's menu; Codex accepts Enter / Esc too. -->
      <div v-if="p.agent && p.agent_status === 'blocked'" class="block actions">
        <button class="btn lg primary" @click="sendKeys(p.pane_id, ['enter'])">Autoriser</button>
        <div class="pair">
          <button v-if="isClaude" class="btn lg" @click="sendKeys(p.pane_id, ['2'])">Toujours</button>
          <button class="btn lg" @click="sendKeys(p.pane_id, ['esc'])">Refuser</button>
        </div>
      </div>
      <div v-else-if="p.agent && p.agent_status === 'working'" class="block actions">
        <button class="btn lg" @click="sendKeys(p.pane_id, ['esc'])">Interrompre</button>
      </div>
      <div v-else-if="!p.agent" class="block actions">
        <button v-if="fixer" class="btn lg primary" @click="askAgentToFix(p.pane_id, fixer.pane_id)">
          Demander à {{ paneName(fixer) }} de corriger
        </button>
        <div class="pair">
          <button class="btn lg" @click="sendKeys(p.pane_id, ['up', 'enter'])">Relancer</button>
          <button class="btn lg" @click="sendKeys(p.pane_id, ['ctrl+c'])">Arrêter ⌃C</button>
        </div>
      </div>

      <dl class="facts">
        <dt>Workspace</dt><dd>{{ workspaceLabel(p.workspace_id) }}</dd>
        <dt>Panneau</dt><dd class="mono">{{ p.pane_id }}</dd>
        <dt>Dossier</dt><dd class="mono">{{ shortPath(p.foreground_cwd || p.cwd) }}</dd>
        <template v-if="p.agent"><dt>Agent</dt><dd>{{ p.display_agent || p.agent }}<span v-if="p.tokens?.hd_model"> · {{ p.tokens.hd_model }}</span></dd></template>
        <template v-else-if="p.terminal_title_stripped"><dt>Commande</dt><dd class="mono">{{ p.terminal_title_stripped }}</dd></template>
      </dl>

      <div v-if="ctx" class="block">
        <div class="line">
          <span class="muted">Fenêtre de contexte</span>
          <span class="mono" :class="'lvl-' + gaugeLevel(ctx.percent)">
            <template v-if="ctx.used && ctx.size">{{ compactTokens(ctx.used) }} / {{ compactTokens(ctx.size) }}</template>
            <template v-else>{{ Math.round(ctx.percent) }} %</template>
          </span>
        </div>
        <div class="gauge big" :class="gaugeLevel(ctx.percent)"><span :style="{ width: `${Math.min(100, ctx.percent)}%` }"></span></div>
        <div v-if="ctx.percent >= 80" class="hint">Proche de la limite — pense à /compact</div>
      </div>

      <div v-if="p.agent && sessionCost != null" class="line small">
        <span class="muted">Coût estimé de la session</span>
        <span class="mono">{{ sessionCost.toFixed(2).replace(".", ",") }} $</span>
      </div>

      <AccountUsage v-if="provider" :provider="provider" />

      <div v-if="!p.agent" class="block">
        <div class="eyebrow">Surveillances</div>
        <div v-for="w in watches" :key="w.id" class="watch">
          <span class="mono">{{ w.regex }}</span>
          <span class="muted">Notification à la première correspondance</span>
        </div>
        <form class="watch-form" @submit.prevent="watchOutput">
          <label class="sr" for="regex">Motif à surveiller</label>
          <input id="regex" v-model="regex" class="mono" spellcheck="false" />
          <button class="btn" type="submit">Surveiller</button>
        </form>
      </div>

      <div v-if="activity.length" class="block">
        <div class="eyebrow">Activité</div>
        <div v-for="(a, i) in activity" :key="i" class="act">
          <span :class="'t-' + a.status">●</span>
          <span class="grow">{{ STATUS_LABEL[a.status] }}</span>
          <span class="muted">{{ clockTime(a.at / 1000) }}</span>
        </div>
      </div>

      <div class="spacer"></div>
      <ConfirmButton class="link" label="Fermer ce panneau" armed-label="Cliquer encore pour fermer" aria-label="Fermer ce panneau" @confirm="closePane(p.pane_id)" />
    </template>
    <div v-else class="muted">Sélectionne un panneau.</div>
  </div>
</template>

<style scoped>
.insp { flex: 1; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
.block { display: flex; flex-direction: column; gap: 8px; }
.title { font-size: 20px; font-weight: 600; word-break: break-word; }
.chip {
  align-self: flex-start; height: 24px; padding: 0 10px; border-radius: 12px; display: inline-flex; align-items: center;
  font-size: 12px; font-weight: 600; background: #1d2024; color: var(--text-2);
}
.chip.blocked { background: #2b2213; color: var(--blocked); }
.chip.working { background: #13282a; color: var(--working); }
.chip.done { background: #142033; color: var(--done); }
.pair { display: flex; gap: 8px; }
.pair .btn { flex: 1; }
.actions .btn.primary { width: 100%; }
.facts { display: grid; grid-template-columns: 88px 1fr; row-gap: 10px; margin: 0; font-size: 12px; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: text; }
.line { display: flex; justify-content: space-between; font-size: 12px; }
.gauge.big { height: 8px; border-radius: 4px; }
.hint, .muted { font-size: 11px; color: var(--muted); }
.lvl-warn { color: var(--blocked); }
.lvl-crit { color: var(--fail); }
.watch { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); font-size: 12px; }
.watch-form { display: flex; gap: 6px; }
.watch-form input {
  flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong);
  background: var(--field); outline: none; font-size: 12px;
}
.act { display: flex; gap: 10px; font-size: 12px; }
.grow { flex: 1; }
.spacer { flex: 1; }
.link { align-self: flex-start; font-size: 12px; padding: 0 8px; height: 26px; }
.link:hover { color: var(--fail); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
