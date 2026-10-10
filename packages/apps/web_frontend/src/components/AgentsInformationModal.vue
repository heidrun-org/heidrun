<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import AccountUsage from "./AccountUsage.vue";
import { closeAgentsInformationModal } from "../stores/agentsInformation";
import { history, hm, todaySummary } from "../stores/history";
import { allPanes, clearFinishedRuns, dismissRun, selectPane, selectedPane, state, tabLabel, workspaceLabel } from "../stores/session";
import { agentKind, clockTime, duration, paneName } from "../lib/format";
import { t } from "../i18n/index";

const p = selectedPane;
const el = ref<HTMLElement>();

// Activity: all agents by default, or only the selected pane.
const activityScope = ref<"all" | "pane">("all");
const activity = computed(() =>
  state.activity
    .filter((a) => activityScope.value === "all" || a.paneId === p.value?.pane_id)
    // Running first (blocked ones on top: they wait for you), then finished, newest first.
    .map((a, i) => ({ a, i, rank: a.status === "blocked" ? 0 : a.status === "working" ? 1 : 2 }))
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .map((x) => x.a)
    .slice(0, 20)
    .map((a) => {
      // Live names (renames show up at once); the stored ones if the pane is gone.
      const pane = allPanes.value.find((x) => x.pane_id === a.paneId);
      const ws = pane ? workspaceLabel(pane.workspace_id) : a.workspace;
      const tab = pane ? tabLabel(pane.tab_id) : a.tab;
      const kind = pane ? agentKind(pane) : a.kind;
      const name = pane ? paneName(pane) : a.name;
      const same = (x: string) => !x || x.toLowerCase() === kind.toLowerCase() || x === pane?.agent;
      return {
        ...a,
        pane,
        // An automatic tab name ("Claude") says nothing more than the agent kind.
        where: [ws, same(tab) ? "" : tab].filter(Boolean).join(" · "),
        kind,
        name: same(name) || name === tab ? "" : name,
        state: runLabel(a),
      };
    }),
);
const hasFinished = computed(() => state.activity.some((a) => a.end !== null));

// Ticks so "running · 3 min" stays current.
const now = ref(Date.now());
const ticker = window.setInterval(() => (now.value = Date.now()), 30_000);
onBeforeUnmount(() => window.clearInterval(ticker));

function runLabel(a: (typeof state.activity)[number]): string {
  if (a.status === "blocked") return t("agentsInformationModal.run.blocked");
  if (a.status === "working") {
    return a.startUnknown
      ? t("agentsInformationModal.run.working")
      : t("agentsInformationModal.run.workingFor", { duration: duration(now.value - a.start) });
  }
  const closed = a.status === "closed";
  if (a.end && !a.startUnknown) {
    const took = duration(a.end - a.start);
    return closed
      ? t("agentsInformationModal.run.closedAfter", { duration: took })
      : t("agentsInformationModal.run.doneAfter", { duration: took });
  }
  return closed ? t("agentsInformationModal.run.closed") : t("agentsInformationModal.run.done");
}

// Account quotas are shared by all agents of a provider: shown for every provider in use.
const providers = computed(() => {
  const list: ("claude" | "codex")[] = [];
  const kinds = allPanes.value.map((x) => x.agent ?? "");
  if (kinds.some((k) => k.includes("claude"))) list.push("claude");
  if (kinds.some((k) => k.includes("codex"))) list.push("codex");
  return list;
});

function close() {
  closeAgentsInformationModal();
}
function onKey(e: KeyboardEvent) {
  // The window History is on top of this window: Escape closes only that window.
  if (e.key === "Escape" && history.open === false) {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => el.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div ref="el" class="modal" role="dialog" :aria-label="t('agentsInformationModal.dialogLabel')" tabindex="-1">
      <header>
        <h2>{{ t("agentsInformationModal.title") }}</h2>
        <span class="detail">{{ t("agentsInformationModal.detail") }}</span>
        <button :title="t('agentsInformationModal.closeTitle')" class="close" :aria-label="t('agentsInformationModal.closeLabel')" @click="close"><Icon name="x-lg" /></button>
      </header>

      <div class="content">
        <button type="button" class="hist-line" :title="t('agentsInformationModal.historyTitle')" @click="history.open = true">
          <span class="muted">{{ t("agentsInformationModal.today") }}</span>
          <strong v-if="todaySummary.total">{{ hm(todaySummary.total) }}<template v-if="todaySummary.cost"> · ${{ todaySummary.cost.toFixed(2) }}</template></strong>
          <!-- On one line: the workspaces end with "…" rather than wrapping. -->
          <span class="hist-ws" :title="todaySummary.top.map(([w, ms]) => `${w} ${hm(ms)}`).join(' · ')">
            <template v-if="todaySummary.total">{{ todaySummary.top.map(([w, ms]) => `· ${w} ${hm(ms)}`).join("  ") }}</template>
            <template v-else>{{ t("agentsInformationModal.noWorkYet") }}</template>
          </span>
          <span class="hist-go">{{ t("agentsInformationModal.history") }} <Icon name="box-arrow-up-right" /></span>
        </button>

        <AccountUsage v-for="pr in providers" :key="pr" :provider="pr" />

        <div v-if="state.activity.length" class="block">
          <div class="act-head">
            <span class="eyebrow">{{ t("agentsInformationModal.activity") }}</span>
            <button v-if="hasFinished" type="button" class="clear" :title="t('agentsInformationModal.clearFinishedTitle')" @click="clearFinishedRuns()">{{ t("agentsInformationModal.clearFinished") }}</button>
            <span class="grow"></span>
            <span v-if="p" class="seg" role="group" :aria-label="t('agentsInformationModal.activityShown')">
              <button :title="t('agentsInformationModal.scopeAllTitle')" type="button" :class="{ on: activityScope === 'all' }" @click="activityScope = 'all'">{{ t("agentsInformationModal.scopeAll") }}</button>
              <button :title="t('agentsInformationModal.scopePaneTitle')" type="button" :class="{ on: activityScope === 'pane' }" @click="activityScope = 'pane'">{{ t("agentsInformationModal.scopePane") }}</button>
            </span>
          </div>
          <div v-for="a in activity" :key="a.id" class="act-row">
            <button
              type="button"
              class="act"
              :class="{ current: a.paneId === p?.pane_id, gone: !a.pane }"
              :disabled="!a.pane"
              :title="a.pane ? t('agentsInformationModal.goToPane') : t('agentsInformationModal.paneClosed')"
              @click="a.pane && (selectPane(a.pane), close())"
            >
              <span class="dot-s" :class="'t-' + (a.status === 'closed' ? 'idle' : a.status)"><Icon name="circle-fill" /></span>
              <span class="act-main">
                <span class="act-where">{{ a.where || "—" }}</span>
                <span class="act-who">
                  <span class="act-kind">{{ a.kind }}</span>
                  <span v-if="a.name" class="act-name">{{ a.name }}</span>
                  <span class="act-status" :class="'t-' + (a.status === 'closed' ? 'idle' : a.status)">{{ a.state }}</span>
                </span>
              </span>
              <span class="act-time mono">
                <template v-if="a.end && !a.startUnknown">{{ clockTime(a.start / 1000) }}–{{ clockTime(a.end / 1000) }}</template>
                <template v-else>{{ clockTime((a.end ?? a.start) / 1000) }}</template>
              </span>
            </button>
            <button
              v-if="a.end"
              type="button"
              class="act-x"
              :aria-label="t('agentsInformationModal.removeFromListLabel', { name: a.where || a.kind })"
              :title="t('agentsInformationModal.removeFromList')"
              @click="dismissRun(a.id)"
            ><Icon name="x-lg" /></button>
          </div>
          <div v-if="!activity.length" class="muted">{{ t("agentsInformationModal.paneNoActivity") }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 57; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 32px; }
.modal {
  width: min(560px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: baseline; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.detail { flex: 1; min-width: 0; font-size: var(--font-size); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close { align-self: center; width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: calc(var(--font-size) * 1.5); }
.close:hover { background: var(--hover); color: var(--text); }
.content { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 22px; }
.block { display: flex; flex-direction: column; gap: 8px; }
.muted { font-size: var(--font-size); color: var(--muted); }
.hist-line {
  display: flex; align-items: baseline; gap: 6px; flex-wrap: nowrap; white-space: nowrap; min-width: 0; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--line); background: transparent; text-align: left; font-size: var(--font-size); color: var(--text);
}
.hist-line:hover { border-color: var(--line-strong); background: var(--hover); }
.hist-ws { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); }
.hist-go { flex-shrink: 0; color: var(--done); font-size: var(--font-size); }
.act-head { display: flex; align-items: center; gap: 10px; }
.clear { border: none; background: none; padding: 0; font-size: var(--font-size); color: var(--faint); }
.clear:hover { color: var(--text-2); }
.act-row { position: relative; }
.act-x {
  position: absolute; bottom: 5px; right: 0; width: 22px; height: 22px; border: none; border-radius: 6px;
  background: var(--panel); color: var(--muted); font-size: var(--font-size); line-height: 1; padding: 0;
  display: none; align-items: center; justify-content: center;
}
.act-row:hover .act-x { display: inline-flex; }
.act-x:hover { background: var(--hover); color: var(--text); }
.seg { display: inline-flex; padding: 2px; border-radius: 7px; background: var(--field); }
.seg button {
  border: none; background: transparent; color: var(--muted); font-size: var(--font-size); padding: 2px 8px; border-radius: 5px;
}
.seg button.on { background: var(--hover); color: var(--text); }
.act {
  display: flex; align-items: flex-start; gap: 8px; width: calc(100% + 12px); padding: 6px; margin: 0 -6px;
  border: none; border-radius: 7px; background: transparent; color: var(--text); text-align: left; font-size: var(--font-size);
}
.act:hover:not(:disabled) { background: var(--hover); }
.act.current { background: rgba(110, 168, 254, 0.07); }
.act.gone { opacity: 0.55; }
.dot-s { line-height: 18px; }
.act-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.act-where { font-weight: 600; font-size: var(--font-size); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 18px; }
.act-who { display: flex; gap: 6px; align-items: baseline; min-width: 0; font-size: var(--font-size); color: var(--text-2); }
.act-kind { white-space: nowrap; }
.act-name { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.act-status { white-space: nowrap; margin-left: auto; padding-left: 6px; }
.act-time { font-size: var(--font-size); color: var(--muted); line-height: 18px; white-space: nowrap; }
.grow { flex: 1; }
</style>
