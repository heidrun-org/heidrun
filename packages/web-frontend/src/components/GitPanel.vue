<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import { askMerge, currentForge, currentGit, git, openGitModal, refreshGit } from "../stores/git";
import { openIssue } from "../stores/issues";
import { selectedPane, sendPrompt, state, toast, workspaceLabel, workspacePanes } from "../stores/session";
import { ago, paneName } from "../lib/format";
import { t } from "../i18n/index";

const st = currentGit;
const fg = currentForge;

const repoName = computed(() => {
  const b = fg.value?.base;
  return b ? b.replace(/^https?:\/\/[^/]+\//, "") : st.value?.root.split("/").pop() ?? "";
});
const forgeLabel = computed(() => (fg.value?.forge === "github" ? "GitHub" : "GitLab"));
const kind = computed(() => (fg.value?.forge === "github" ? "PR" : "MR"));

// The agent that gets "review this": the selected one, else the first agent of the workspace.
const reviewer = computed(() => {
  const s = selectedPane.value;
  if (s?.agent) return s;
  return workspacePanes.value.find((p) => p.agent) ?? null;
});

function statusClass(x: string) {
  if (x === "??") return "new";
  if (x.includes("D")) return "del";
  if (x.includes("A")) return "add";
  if (x.includes("R")) return "ren";
  if (x.includes("U")) return "conf";
  return "mod";
}
function statusLetter(x: string) {
  if (x === "??") return "N";
  return (x.replace(/\./g, "")[0] ?? "M").toUpperCase();
}

function open(url: string | null | undefined) {
  if (url) openUrl(url).catch(() => {});
}

async function askReview(ref: string, url: string, title: string) {
  const a = reviewer.value;
  if (!a) return toast(t("gitPanel.noAgent"));
  await sendPrompt(a.pane_id, t("gitPanel.reviewPrompt", { kind: kind.value, ref, title, url }));
  toast(t("gitPanel.reviewSent", { agent: paneName(a) }));
}
</script>

<template>
  <div class="gitp">
    <div v-if="!state.selectedWorkspaceId" class="muted">{{ t("gitPanel.selectWorkspace") }}</div>
    <template v-else-if="st">
      <section class="block">
        <header class="head">
          <span class="eyebrow">{{ t("gitPanel.repository") }}</span>
          <button class="link" :disabled="git.loading" :title="t('gitPanel.refresh')" @click="refreshGit()"><span :class="{ 'label-hidden': git.loading }">{{ t("gitPanel.refresh") }}</span><span v-if="git.loading" class="spinner-border" role="status" :aria-label="t('gitPanel.refreshing')"></span></button>
        </header>
        <button v-if="fg?.base" class="repo" :title="t('gitPanel.openOn', { forge: forgeLabel })" @click="open(fg.base)">{{ repoName }} <Icon name="box-arrow-up-right" /></button>
        <div v-else class="repo plain">{{ repoName }}</div>
        <div class="branch">
          <span class="mono b">{{ st.branch ?? t("gitPanel.detached") }}</span>
          <span v-if="st.upstream" class="muted mono">→ {{ st.upstream }}</span>
          <span v-else class="muted">{{ t("gitPanel.noUpstream") }}</span>
        </div>
        <div class="chips">
          <span v-if="st.ahead" class="chip warn" :title="t('gitPanel.aheadTitle')">↑ {{ t("gitPanel.ahead", { count: st.ahead }) }}</span>
          <span v-if="st.behind" class="chip pending" :title="t('gitPanel.behindTitle')">↓ {{ t("gitPanel.behind", { count: st.behind }) }}</span>
          <span v-if="!st.ahead && !st.behind && st.upstream" class="chip ok">{{ t("gitPanel.upToDate") }}</span>
          <button v-if="fg?.ci" class="chip" :class="fg.ci.level" :title="t('gitPanel.ciTitle')" @click="open(fg.ci.url)">{{ fg.ci.label }}</button>
        </div>
        <div v-if="st.last_sha" class="last">
          <span class="mono muted">{{ st.last_sha }}</span>
          <span class="subject">{{ st.last_subject }}</span>
          <span v-if="st.last_time" class="muted">{{ ago(st.last_time * 1000) }}</span>
        </div>
      </section>

      <section class="block">
        <header class="head">
          <span class="eyebrow">{{ t("gitPanel.changes") }} <span class="count">{{ st.changed + st.untracked }}</span></span>
          <button v-if="st.files.length" class="link" :title="t('gitPanel.expandTitle')" @click="openGitModal()">{{ t("gitPanel.expand") }} ⤢</button>
        </header>
        <div v-if="!st.files.length" class="muted">{{ t("gitPanel.noChanges") }}</div>
        <ul v-else class="files">
          <li v-for="f in st.files.slice(0, 14)" :key="f.path">
            <button class="file" :title="t('gitPanel.viewDiff', { path: f.path })" @click="openGitModal(f.path)">
              <span class="st" :class="statusClass(f.status)">{{ statusLetter(f.status) }}</span>
              <span class="mono path">{{ f.path }}</span>
            </button>
          </li>
          <li v-if="st.files.length > 14">
            <button :title="t('gitPanel.showAllTitle')" class="link more" @click="openGitModal()">{{ t("gitPanel.showAll", { count: st.changed + st.untracked - 14 }) }}</button>
          </li>
        </ul>
      </section>

      <section class="block">
        <div class="eyebrow">{{ t("gitPanel.openRequests", { kind }) }} <span v-if="fg" class="count">{{ fg.requests.length }}</span></div>
        <div v-if="!st.remote" class="muted">{{ t("gitPanel.noRemote") }}</div>
        <div v-else-if="!fg" class="muted">{{ t("gitPanel.loading") }}</div>
        <div v-else-if="fg.error" class="err">{{ fg.error }}</div>
        <div v-else-if="!fg.requests.length" class="muted">{{ t("gitPanel.noOpenRequest", { kind }) }}</div>
        <div v-for="r in fg?.requests ?? []" :key="r.ref" class="req" :class="{ mine: r.branch === st.branch }">
          <button class="req-main" :title="t('gitPanel.openRefOn', { ref: r.ref, forge: forgeLabel })" @click="open(r.url)">
            <span class="req-top">
              <span class="mono ref">{{ r.ref }}</span>
              <span class="chip sm" :class="r.level">{{ r.state }}</span>
              <span v-if="r.review" class="chip sm" :class="r.review.level">{{ r.review.label }}</span>
            </span>
            <span class="req-title">{{ r.title }}</span>
            <span class="muted mono">{{ r.branch }}<template v-if="r.author"> · {{ r.author }}</template></span>
          </button>
          <span class="req-actions">
            <button class="link" :title="t('gitPanel.previewTitle')" @click="openIssue(st.root, { type: 'mr', number: r.number }, r.url)">{{ t("gitPanel.preview") }}</button>
            <button
              v-if="reviewer"
              class="link"
              :title="t('gitPanel.askReviewTitle', { agent: paneName(reviewer) })"
              @click="askReview(r.ref, r.url, r.title)"
            >{{ t("gitPanel.askReview") }}</button>
            <button
              v-if="!r.draft"
              class="link merge"
              :class="{ ready: r.level === 'ok' }"
              :title="t('gitPanel.mergeTitle', { ref: r.ref })"
              @click="askMerge(state.selectedWorkspaceId!, r)"
            >{{ t("gitPanel.merge") }}</button>
          </span>
        </div>
        <template v-if="fg && fg.recent.length">
          <div class="eyebrow recent-h">{{ t("gitPanel.recent") }}</div>
          <button v-for="r in fg.recent" :key="r.ref" class="recent" :title="t('gitPanel.openRefOn', { ref: r.ref, forge: forgeLabel })" @click="open(r.url)">
            <span class="mono ref">{{ r.ref }}</span>
            <span class="chip sm" :class="r.status === 'merged' ? 'merged' : 'muted'">{{ r.state }}</span>
            <span class="recent-t">{{ r.title }}</span>
            <span v-if="r.at" class="muted when">{{ ago(r.at) }}</span>
          </button>
        </template>
        <div v-if="fg && !fg.error" class="muted foot">{{ forgeLabel }} · {{ t("gitPanel.updated", { time: ago(fg.at) }) }} · {{ workspaceLabel(state.selectedWorkspaceId) }}</div>
      </section>
    </template>
    <div v-else class="muted">{{ t("gitPanel.notRepository") }}</div>
  </div>
</template>

<style scoped>
.gitp { flex: 1; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 22px; overflow-y: auto; }
.block { display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.link { border: none; background: none; padding: 0; color: var(--faint); font-size: var(--font-size); }
.link:hover:not(:disabled) { color: var(--text-2); }
.link { position: relative; }
.label-hidden { visibility: hidden; }
.spinner-border {
  position: absolute; top: 50%; left: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px;
  border: 0.15em solid currentcolor; border-right-color: transparent; border-radius: 50%;
  animation: spinner-border 0.75s linear infinite;
}
@keyframes spinner-border { to { transform: rotate(360deg); } }
.repo { align-self: flex-start; border: none; background: none; padding: 0; color: var(--text); font-size: var(--font-size); font-weight: 600; text-align: left; }
.repo:hover { color: var(--done); }
.repo.plain:hover { color: var(--text); }
.branch { display: flex; gap: 8px; flex-wrap: wrap; font-size: var(--font-size); }
.b { color: var(--text); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  height: 22px; padding: 0 8px; border-radius: 11px; display: inline-flex; align-items: center; font-size: var(--font-size); font-weight: 600;
  background: var(--chip); color: var(--text-2); border: none;
}
.chip.sm { height: 18px; font-size: var(--font-size); padding: 0 7px; }
.chip.ok { background: var(--tint-ok); color: var(--ok); }
.chip.warn { background: var(--tint-warn); color: var(--accent); }
.chip.crit { background: var(--tint-crit); color: var(--blocked); }
.chip.pending { background: var(--tint-working); color: var(--working); }
.chip.muted { color: var(--muted); }
.chip.merged { background: var(--tint-merged); color: var(--question); }
.req-top { flex-wrap: wrap; }
.recent-h { margin-top: 10px; }
.recent { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 4px 6px; margin: 0 -6px; border: none; border-radius: 6px; background: transparent; color: var(--text-2); text-align: left; font-size: var(--font-size); }
.recent:hover { background: var(--hover); }
.recent-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.when { flex-shrink: 0; font-size: var(--font-size); }
button.chip { cursor: pointer; }
.last { display: flex; gap: 8px; font-size: var(--font-size); align-items: baseline; min-width: 0; }
.subject { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { color: var(--muted); margin-left: 4px; }
.files { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: var(--font-size); }
.files li { display: flex; min-width: 0; }
.file { display: flex; gap: 8px; align-items: center; min-width: 0; width: 100%; border: none; background: none; padding: 2px 4px; margin: 0 -4px; border-radius: 5px; text-align: left; color: inherit; }
.file:hover { background: var(--hover); }
.head-tools { display: flex; gap: 12px; }
.more { font-size: var(--font-size); color: var(--done); }
.st { width: 16px; flex-shrink: 0; font: 600 var(--font-size) var(--mono); text-align: center; }
.st.mod { color: var(--accent); } .st.add, .st.new { color: var(--ok); } .st.del { color: var(--blocked); } .st.ren { color: var(--done); } .st.conf { color: var(--blocked); }
.path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
.req { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); }
.req.mine { box-shadow: inset 0 0 0 1px #33506f; }
.req-main { display: flex; flex-direction: column; gap: 4px; border: none; background: none; padding: 0; text-align: left; color: var(--text); }
.req-top { display: flex; gap: 8px; align-items: center; }
.ref { color: var(--question); font-size: var(--font-size); }
.req-title { font-size: var(--font-size); font-weight: 500; }
.req .muted { font-size: var(--font-size); }
.req-actions { display: flex; gap: 14px; }
.merge.ready { color: var(--question); }
.merge.ready:hover { color: #d6b8f6; }
.err { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); }
.foot { font-size: var(--font-size); }
</style>
