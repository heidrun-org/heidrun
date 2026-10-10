<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { GitStatus } from "../stores/git";
import ConfirmButton from "./ConfirmButton.vue";
import { openFiles } from "../stores/files";
import RemoteControl from "./RemoteControl.vue";
import {
  addWatch,
  answerChoice,
  askAgentToFix,
  closePane,
  contextFor,
  selectedPane,
  sendKeys,
  state,
  tabLabel,
  workspaceLabel,
  workspacePanes,
} from "../stores/session";
import { statusLabel, agentKind, compactTokens, gaugeLevel, paneName, shortPath } from "../lib/format";
import { locale, t } from "../i18n/index";

const p = selectedPane;
const ctx = computed(() => (p.value ? contextFor(p.value) : null));

// Git branch of the pane's folder, refreshed every few seconds while shown.
const paneGit = ref<GitStatus | null>(null);
let gitSeq = 0;
async function loadPaneGit() {
  const cwd = p.value?.foreground_cwd || p.value?.cwd;
  const my = ++gitSeq;
  if (!cwd) return (paneGit.value = null);
  const st = await invoke<GitStatus | null>("git_status", { cwd }).catch(() => null);
  if (my === gitSeq) paneGit.value = st;
}
watch(() => p.value?.foreground_cwd || p.value?.cwd, loadPaneGit, { immediate: true });
const gitTicker = window.setInterval(loadPaneGit, 8000);
onBeforeUnmount(() => window.clearInterval(gitTicker));

/** Green: all committed and pushed. Orange: changes not committed. Blue: commits not pushed. */
const branchState = computed(() => {
  const g = paneGit.value;
  if (!g) return { level: "", badge: "", title: "" };
  const dirty = g.changed + g.untracked;
  const parts: string[] = [];
  if (dirty) parts.push(t("inspector.git.uncommitted", { count: dirty }));
  if (g.ahead) parts.push(t("inspector.git.toPush", { count: g.ahead }));
  if (g.behind) {
    parts.push(g.upstream ? t("inspector.git.behind", { commits: g.behind, upstream: g.upstream }) : t("inspector.git.behindRemote", { commits: g.behind }));
  }
  if (!g.upstream) parts.push(t("inspector.git.noUpstream"));
  const level = dirty ? "dirty" : g.ahead || !g.upstream ? "ahead" : "clean";
  const badge = [dirty ? `±${dirty}` : "", g.ahead ? `↑${g.ahead}` : "", g.behind ? `↓${g.behind}` : ""].filter(Boolean).join(" ");
  return { level, badge, title: `${g.branch}${g.upstream ? ` → ${g.upstream}` : ""}\n${parts.length ? parts.join(" · ") : t("inspector.git.clean")}` };
});

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
  if (!x.agent) return t("inspector.terminal");
  if (x.agent_status === "blocked") return t("inspector.blockedWaiting");
  return statusLabel(x.agent_status).replace(/^./, (c) => c.toUpperCase());
});
</script>

<template>
  <div class="insp">
    <template v-if="p">
      <!-- 1. This session: everything tied to the selected pane. -->
      <section class="sec" aria-labelledby="sec-session">
        <header class="sec-head">
          <span id="sec-session" class="eyebrow">{{ t("inspector.session") }}</span>
          <span class="sec-where">{{ workspaceLabel(p.workspace_id) }}<template v-if="tabName"> · {{ tabName }}</template></span>
        </header>

        <div class="block">
          <div class="title">{{ paneName(p) }}</div>
          <div class="chip" :class="p.agent ? p.agent_status : 'process'"><Icon name="circle-fill" /> {{ statusText }}</div>
        </div>

        <!-- Approval buttons: keys for Claude Code's menu; Codex accepts Enter / Esc too. -->
        <div v-if="p.agent && p.agent_status === 'blocked' && state.choices[p.pane_id]" class="block actions">
          <pre v-if="state.choices[p.pane_id].detail" class="detail mono">{{ state.choices[p.pane_id].detail }}</pre>
          <div v-if="state.choices[p.pane_id].question" class="q">{{ state.choices[p.pane_id].question }}</div>
          <button
            v-for="o in state.choices[p.pane_id].options"
            :key="o.n"
            class="btn lg opt"
            :class="{ primary: o.n === 1 }"
            :title="o.label"
            @click="answerChoice(p.pane_id, o.n)"
          >
            <span class="opt-n">{{ o.n }}</span><span class="opt-l">{{ o.label }}</span>
          </button>
          <button :title="t('inspector.escapeTitle')" class="btn" @click="sendKeys(p.pane_id, ['esc'])">{{ t("inspector.escape") }}</button>
        </div>
        <div v-else-if="p.agent && p.agent_status === 'blocked'" class="block actions">
          <button :title="t('inspector.allowTitle')" class="btn lg primary" @click="sendKeys(p.pane_id, ['enter'])">{{ t("inspector.allow") }}</button>
          <div class="pair">
            <button :title="t('inspector.alwaysTitle')" v-if="isClaude" class="btn lg" @click="sendKeys(p.pane_id, ['2'])">{{ t("inspector.always") }}</button>
            <button :title="t('inspector.refuseTitle')" class="btn lg" @click="sendKeys(p.pane_id, ['esc'])">{{ t("inspector.refuse") }}</button>
          </div>
        </div>
        <div v-else-if="p.agent && p.agent_status === 'working'" class="block actions">
          <button :title="t('inspector.interruptTitle')" class="btn lg" @click="sendKeys(p.pane_id, ['esc'])">{{ t("inspector.interrupt") }}</button>
        </div>
        <div v-else-if="!p.agent" class="block actions">
          <button :title="t('inspector.askFixTitle')" v-if="fixer" class="btn lg primary" @click="askAgentToFix(p.pane_id, fixer.pane_id)">
            {{ t("inspector.askFix", { agent: paneName(fixer) }) }}
          </button>
          <div class="pair">
            <button :title="t('inspector.rerunTitle')" class="btn lg" @click="sendKeys(p.pane_id, ['up', 'enter'])">{{ t("inspector.rerun") }}</button>
            <button :title="t('inspector.stopTitle')" class="btn lg" @click="sendKeys(p.pane_id, ['ctrl+c'])">{{ t("inspector.stop") }} ⌃C</button>
          </div>
        </div>

        <dl class="facts">
          <template v-if="p.agent"><dt>{{ t("inspector.agent") }}</dt><dd>{{ agentKind(p) }}<span v-if="p.tokens?.hd_model"> · {{ p.tokens.hd_model }}</span></dd></template>
          <template v-else-if="p.terminal_title_stripped">
            <dt>{{ t("inspector.command") }}</dt>
            <dd class="mono full" tabindex="0" :title="p.terminal_title_stripped">{{ p.terminal_title_stripped }}</dd>
          </template>
          <dt>{{ t("inspector.folder") }}</dt>
          <dd class="mono full dir-dd" tabindex="0" :title="p.foreground_cwd || p.cwd || ''">
            <span>{{ shortPath(p.foreground_cwd || p.cwd) }}</span>
            <button type="button" class="dir-open" :title="t('inspector.projectFilesTitle')" :aria-label="t('inspector.projectFiles')" @click="openFiles(p.foreground_cwd || p.cwd)">
              <Icon name="folder" />
            </button>
          </dd>
          <template v-if="paneGit?.branch">
            <dt>{{ t("inspector.branch") }}</dt>
            <dd class="mono full branch" :class="branchState.level" tabindex="0" :title="branchState.title">
              <span class="b-dot"></span>{{ paneGit.branch }}<span v-if="branchState.badge" class="b-badge">{{ branchState.badge }}</span>
            </dd>
          </template>
          <dt>{{ t("inspector.pane") }}</dt><dd class="mono">{{ p.pane_id }}</dd>
        </dl>

        <div v-if="ctx" class="block">
          <div class="line">
            <span class="muted">{{ t("inspector.contextWindow") }}</span>
            <span class="mono" :class="'lvl-' + gaugeLevel(ctx.percent)">
              <template v-if="ctx.used && ctx.size">{{ compactTokens(ctx.used) }} / {{ compactTokens(ctx.size) }}</template>
              <template v-else>{{ t("inspector.percent", { percent: Math.round(ctx.percent) }) }}</template>
            </span>
          </div>
          <div class="gauge lg" :class="gaugeLevel(ctx.percent)"><span :style="{ width: `${Math.min(100, ctx.percent)}%` }"></span></div>
          <div v-if="ctx.percent > 80" class="hint lvl-crit">{{ t("inspector.contextNearLimit") }}</div>
          <div v-else-if="ctx.percent >= 60" class="hint">{{ t("inspector.contextOverHalf") }}</div>
        </div>

        <div v-if="p.agent && sessionCost != null" class="line small">
          <span class="muted">{{ t("inspector.sessionCost") }}</span>
          <span class="mono">{{ t("inspector.dollars", { amount: sessionCost.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }) }}</span>
        </div>

        <RemoteControl v-if="provider === 'claude'" :pane="p" />

        <div v-if="!p.agent" class="block">
          <div class="eyebrow">{{ t("inspector.watches") }}</div>
          <div v-for="w in watches" :key="w.id" class="watch">
            <span class="mono">{{ w.regex }}</span>
            <span class="muted">{{ t("inspector.watchNotice") }}</span>
          </div>
          <form class="watch-form" @submit.prevent="watchOutput">
            <label class="sr" for="regex">{{ t("inspector.watchPattern") }}</label>
            <input id="regex" v-model="regex" class="mono" spellcheck="false" />
            <button :title="t('inspector.watchTitle')" class="btn" type="submit">{{ t("inspector.watch") }}</button>
          </form>
        </div>

        <ConfirmButton class="link" :label="t('inspector.closePane')" :confirm-label="t('inspector.closePaneConfirm')" :question="t('inspector.closePane')" @confirm="closePane(p.pane_id)" />
      </section>
    </template>
    <div v-else class="muted">{{ t("inspector.selectPane") }}</div>

  </div>
</template>

<style scoped>
.insp { flex: 1; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 22px; overflow-y: auto; }
.block { display: flex; flex-direction: column; gap: 8px; }
.title { font-size: var(--font-size); font-weight: 600; word-break: break-word; }
.chip {
  align-self: flex-start; height: 24px; padding: 0 10px; border-radius: 12px; display: inline-flex; align-items: center;
  font-size: var(--font-size); font-weight: 600; background: var(--chip); color: var(--text-2);
}
.chip.blocked { background: var(--tint-crit); color: var(--blocked); }
.chip.working { background: var(--tint-working); color: var(--working); }
.chip.done { background: var(--tint-done); color: var(--done); }
.pair { display: flex; gap: 8px; }
.q { font-size: var(--font-size); color: var(--text); }
.detail {
  margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line-strong);
  font-size: var(--font-size); white-space: pre-wrap; word-break: break-all; max-height: 160px; overflow: auto; user-select: text;
}
.btn.opt { justify-content: flex-start; gap: 10px; text-align: left; height: auto; min-height: 40px; padding: 8px 12px; }
.opt-n { flex-shrink: 0; font: 600 var(--font-size) var(--mono); opacity: 0.8; }
.opt-l { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pair .btn { flex: 1; }
.actions .btn.primary { width: 100%; }
.facts { display: grid; grid-template-columns: 88px 1fr; row-gap: 10px; margin: 0; font-size: var(--font-size); }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: text; }
/* Long command or path: shown whole on hover or focus. */
.facts dd.full { border-radius: 4px; outline: none; }
.facts dd.full:hover, .facts dd.full:focus { white-space: normal; word-break: break-all; overflow: visible; }
.facts dd.full:focus-visible { box-shadow: 0 0 0 1px var(--line-strong); }
.dir-dd { display: flex; align-items: flex-start; gap: 6px; }
.dir-dd > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.facts dd.full.dir-dd:hover > span, .facts dd.full.dir-dd:focus > span { white-space: normal; word-break: break-all; }
.dir-open { flex-shrink: 0; width: 24px; height: 20px; margin-top: -2px; border: 1px solid var(--line-strong); border-radius: 6px; background: transparent; color: var(--text-2); display: inline-flex; align-items: center; justify-content: center; padding: 0; }
.dir-open:hover { background: var(--hover); color: var(--text); border-color: var(--done); }
.branch { display: flex; align-items: center; gap: 6px; }
.b-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--muted); }
.branch.clean { color: var(--ok); } .branch.clean .b-dot { background: var(--ok); }
.branch.dirty { color: var(--accent); } .branch.dirty .b-dot { background: var(--accent); }
.branch.ahead { color: var(--done); } .branch.ahead .b-dot { background: var(--done); }
.b-badge { font-size: var(--font-size); padding: 0 5px; border-radius: 5px; background: var(--field); color: var(--text-2); }
.line { display: flex; justify-content: space-between; font-size: var(--font-size); }
.gauge.big { height: 8px; border-radius: 4px; }
.hint, .muted { font-size: var(--font-size); color: var(--muted); }
.watch { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); font-size: var(--font-size); }
.watch-form { display: flex; gap: 6px; }
.watch-form input {
  flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong);
  background: var(--field); outline: none; font-size: var(--font-size);
}
.sec { display: flex; flex-direction: column; gap: 18px; }
.sec-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.sec-where { font-size: var(--font-size); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link { align-self: flex-start; font-size: var(--font-size); padding: 0 8px; height: 26px; }
.link:hover { color: var(--fail); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
