<script setup lang="ts">
import { computed, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import AccountUsage from "./AccountUsage.vue";
import RemoteControl from "./RemoteControl.vue";
import {
  addWatch,
  allPanes,
  askAgentToFix,
  closePane,
  contextFor,
  selectPane,
  selectedPane,
  sendKeys,
  state,
  tabLabel,
  workspaceLabel,
  workspacePanes,
} from "../stores/session";
import { STATUS_LABEL, agentKind, clockTime, compactTokens, gaugeLevel, paneName, shortPath } from "../lib/format";

const p = selectedPane;
const ctx = computed(() => (p.value ? contextFor(p.value) : null));
// Activity: all agents by default, or only the selected pane.
const activityScope = ref<"all" | "pane">("all");
const activity = computed(() =>
  state.activity
    .filter((a) => activityScope.value === "all" || a.paneId === p.value?.pane_id)
    .slice(0, 20)
    .map((a) => {
      // Live names (renames show up at once); the stored ones if the pane is gone.
      const pane = allPanes.value.find((x) => x.pane_id === a.paneId);
      const ws = pane ? workspaceLabel(pane.workspace_id) : a.workspace;
      const tab = pane ? tabLabel(pane.tab_id) : a.tab;
      const kind = pane ? agentKind(pane) : a.kind;
      const name = pane ? paneName(pane) : a.name;
      return {
        ...a,
        pane,
        where: [ws, tab].filter(Boolean).join(" · "),
        kind,
        // The custom name, when it says more than the agent kind.
        name: name.toLowerCase() === kind.toLowerCase() || name === pane?.agent ? "" : name,
      };
    }),
);
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

// Account quotas are shared by all agents of a provider: shown for every provider in use.
const providers = computed(() => {
  const list: ("claude" | "codex")[] = [];
  const kinds = allPanes.value.map((x) => x.agent ?? "");
  if (provider.value === "claude" || kinds.some((k) => k.includes("claude"))) list.push("claude");
  if (provider.value === "codex" || kinds.some((k) => k.includes("codex"))) list.push("codex");
  return list;
});
const tabName = computed(() => (p.value ? tabLabel(p.value.tab_id) : ""));

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
      <!-- 1. This session: everything tied to the selected pane. -->
      <section class="sec" aria-labelledby="sec-session">
        <header class="sec-head">
          <span id="sec-session" class="eyebrow">Session</span>
          <span class="sec-where">{{ workspaceLabel(p.workspace_id) }}<template v-if="tabName"> · {{ tabName }}</template></span>
        </header>

        <div class="block">
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
          <template v-if="p.agent"><dt>Agent</dt><dd>{{ agentKind(p) }}<span v-if="p.tokens?.hd_model"> · {{ p.tokens.hd_model }}</span></dd></template>
          <template v-else-if="p.terminal_title_stripped"><dt>Commande</dt><dd class="mono">{{ p.terminal_title_stripped }}</dd></template>
          <dt>Dossier</dt><dd class="mono">{{ shortPath(p.foreground_cwd || p.cwd) }}</dd>
          <dt>Panneau</dt><dd class="mono">{{ p.pane_id }}</dd>
        </dl>

        <div v-if="ctx" class="block">
          <div class="line">
            <span class="muted">Fenêtre de contexte</span>
            <span class="mono" :class="'lvl-' + gaugeLevel(ctx.percent)">
              <template v-if="ctx.used && ctx.size">{{ compactTokens(ctx.used) }} / {{ compactTokens(ctx.size) }}</template>
              <template v-else>{{ Math.round(ctx.percent) }} %</template>
            </span>
          </div>
          <div class="gauge lg" :class="gaugeLevel(ctx.percent)"><span :style="{ width: `${Math.min(100, ctx.percent)}%` }"></span></div>
          <div v-if="ctx.percent > 80" class="hint lvl-crit">Proche de la limite — pense à /compact</div>
          <div v-else-if="ctx.percent >= 60" class="hint">Plus de la moitié utilisée</div>
        </div>

        <div v-if="p.agent && sessionCost != null" class="line small">
          <span class="muted">Coût estimé de la session</span>
          <span class="mono">{{ sessionCost.toFixed(2).replace(".", ",") }} $</span>
        </div>

        <RemoteControl v-if="provider === 'claude'" :pane="p" />

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

        <ConfirmButton class="link" label="Fermer ce panneau" armed-label="Cliquer encore pour fermer" aria-label="Fermer ce panneau" @confirm="closePane(p.pane_id)" />
      </section>
    </template>
    <div v-else class="muted">Sélectionne un panneau.</div>

    <!-- 2. Everything shared by all agents: account quotas and activity. -->
    <section v-if="providers.length || state.activity.length" class="sec global" aria-labelledby="sec-global">
      <header class="sec-head">
        <span id="sec-global" class="eyebrow">Tous les agents</span>
        <span class="sec-where">quotas du compte et activité</span>
      </header>

      <AccountUsage v-for="pr in providers" :key="pr" :provider="pr" />

      <div v-if="state.activity.length" class="block">
        <div class="act-head">
          <span class="eyebrow">Activité</span>
          <span v-if="p" class="seg" role="group" aria-label="Activité affichée">
            <button type="button" :class="{ on: activityScope === 'all' }" @click="activityScope = 'all'">Tous</button>
            <button type="button" :class="{ on: activityScope === 'pane' }" @click="activityScope = 'pane'">Ce panneau</button>
          </span>
        </div>
        <button
          v-for="a in activity"
          :key="a.at + a.paneId + a.status"
          type="button"
          class="act"
          :class="{ current: a.paneId === p?.pane_id, gone: !a.pane }"
          :disabled="!a.pane"
          :title="a.pane ? 'Aller à ce panneau' : 'Panneau fermé'"
          @click="a.pane && selectPane(a.pane)"
        >
          <span class="dot-s" :class="'t-' + a.status">●</span>
          <span class="act-main">
            <span class="act-where">{{ a.where || "—" }}</span>
            <span class="act-who">
              <span class="act-kind">{{ a.kind }}</span>
              <span v-if="a.name" class="act-name">{{ a.name }}</span>
              <span class="act-status" :class="'t-' + a.status">{{ STATUS_LABEL[a.status] }}</span>
            </span>
          </span>
          <span class="act-time mono">{{ clockTime(a.at / 1000) }}</span>
        </button>
        <div v-if="!activity.length" class="muted">Rien pour ce panneau depuis l’ouverture de l’app.</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.insp { flex: 1; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 22px; overflow-y: auto; }
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
.watch { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); font-size: 12px; }
.watch-form { display: flex; gap: 6px; }
.watch-form input {
  flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong);
  background: var(--field); outline: none; font-size: 12px;
}
.sec { display: flex; flex-direction: column; gap: 18px; }
.sec.global { padding-top: 18px; border-top: 1px solid var(--line); }
.sec-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.sec-where { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-head { display: flex; align-items: center; justify-content: space-between; }
.seg { display: inline-flex; padding: 2px; border-radius: 7px; background: var(--field); }
.seg button {
  border: none; background: transparent; color: var(--muted); font-size: 11px; padding: 2px 8px; border-radius: 5px;
}
.seg button.on { background: var(--hover); color: var(--text); }
.act {
  display: flex; align-items: flex-start; gap: 8px; width: calc(100% + 12px); padding: 6px; margin: 0 -6px;
  border: none; border-radius: 7px; background: transparent; color: var(--text); text-align: left; font-size: 12px;
}
.act:hover:not(:disabled) { background: var(--hover); }
.act.current { background: rgba(110, 168, 254, 0.07); }
.act.gone { opacity: 0.55; }
.dot-s { line-height: 18px; }
.act-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.act-where { font-weight: 600; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 18px; }
.act-who { display: flex; gap: 6px; align-items: baseline; min-width: 0; font-size: 11px; color: var(--text-2); }
.act-kind { white-space: nowrap; }
.act-name { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.act-status { white-space: nowrap; margin-left: auto; padding-left: 6px; }
.act-time { font-size: 11px; color: var(--muted); line-height: 18px; }
.grow { flex: 1; }
.link { align-self: flex-start; font-size: 12px; padding: 0 8px; height: 26px; }
.link:hover { color: var(--fail); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
