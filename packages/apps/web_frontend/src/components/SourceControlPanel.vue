<script setup lang="ts">
// The Source control sidebar section of the left sidebar, as the source control view of VS Code: the message box, the
// commit button, the group "Staged Changes", the group "Changes", then the open pull requests of the forge.
// - issue #305
import { computed } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "./Icon.vue";
import SourceControlMenu from "./SourceControlMenu.vue";
import { askMerge, currentForge, currentGit, git, openGitModal, refreshGit } from "../stores/git";
import { openIssue } from "../stores/issues";
import { openFiles } from "../stores/files";
import {
  commit,
  discardFiles,
  newPullRequestUrl,
  sourceControl,
  splitFiles,
  stageFiles,
  stashChanges,
  syncRepository,
  unstageFiles,
  writeCommitMessage,
  type CommitMode,
  type SourceControlFile,
  type SourceControlGroup,
  type SyncAction,
} from "../stores/source_control";
import { selectedPane, sendPrompt, state, toast, workspaceLabel, workspacePanes } from "../stores/session";
import { fileIconName } from "../lib/chat_files";
import { ago, paneName } from "../lib/format";
import { t } from "../i18n/index";

const groups = computed(() => splitFiles(currentGit.value));
const forgeLabel = computed(() => (currentForge.value?.forge === "github" ? "GitHub" : "GitLab"));
const kind = computed(() => (currentForge.value?.forge === "github" ? "PR" : "MR"));
const pullRequestUrl = computed(() => newPullRequestUrl(currentForge.value, currentGit.value?.branch ?? null));

/** The commit message of the selected workspace. */
const message = computed({
  get: () => (state.selectedWorkspaceId === null ? "" : sourceControl.messages[state.selectedWorkspaceId] ?? ""),
  set: (text: string) => {
    if (state.selectedWorkspaceId !== null) {
      sourceControl.messages[state.selectedWorkspaceId] = text;
    }
  },
});

const placeholder = computed(() =>
  t("sourceControlPanel.messagePlaceholder", { branch: currentGit.value?.branch ?? t("sourceControlPanel.detached") }),
);

const commitItems = computed(() => [
  { id: "commit", label: t("sourceControlPanel.commitMenu.commit") },
  { id: "commitAndPush", label: t("sourceControlPanel.commitMenu.commitAndPush") },
  { id: "amend", label: t("sourceControlPanel.commitMenu.amend"), isDisabled: currentGit.value?.last_sha === null },
]);

const moreItems = computed(() => [
  { id: "pull", label: t("sourceControlPanel.moreMenu.pull", { count: currentGit.value?.behind ?? 0 }) },
  { id: "push", label: t("sourceControlPanel.moreMenu.push", { count: currentGit.value?.ahead ?? 0 }) },
  { id: "fetch", label: t("sourceControlPanel.moreMenu.fetch") },
  { id: "openLarge", label: t("sourceControlPanel.moreMenu.openLarge") },
]);

/** The agent that gets "review this": the selected one, else the first agent of the workspace. */
const reviewer = computed(() => {
  const pane = selectedPane.value;
  if (pane?.agent) {
    return pane;
  }
  return workspacePanes.value.find((workspacePane) => workspacePane.agent) ?? null;
});

/** The class that gives a status letter its color. */
function letterClass(letter: string): string {
  if (letter === "A" || letter === "U") {
    return "added";
  }
  if (letter === "D" || letter === "!") {
    return "deleted";
  }
  if (letter === "R" || letter === "C") {
    return "renamed";
  }
  return "modified";
}

/** The tooltip of a file line: the full path, then the status in words. */
function fileTitle(file: SourceControlFile): string {
  return `${currentGit.value?.root ?? ""}/${file.path} • ${t(`sourceControlPanel.letter.${letterKey(file.letter)}`)}`;
}

/** The key of the translation of a status letter. */
function letterKey(letter: string): string {
  const keys: Record<string, string> = {
    M: "modified",
    A: "added",
    D: "deleted",
    R: "renamed",
    C: "copied",
    T: "typeChanged",
    U: "untracked",
    "!": "conflict",
  };
  return keys[letter] ?? "modified";
}

function toggleGroup(group: SourceControlGroup | "pullRequests") {
  sourceControl.folded[group] = sourceControl.folded[group] === false;
}

function paths(group: SourceControlGroup): string[] {
  return groups.value[group].map((file) => file.path);
}

function openFile(file: SourceControlFile) {
  void openFiles(currentGit.value?.root, { path: file.path });
}

function onCommitKeyDown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void commit("commit");
  }
}

function chooseMore(id: string) {
  if (id === "openLarge") {
    openGitModal();
    return;
  }
  void syncRepository(id as SyncAction);
}

function open(url: string | null | undefined) {
  if (url) {
    openUrl(url).catch(() => {});
  }
}

async function askReview(ref: string, url: string, title: string) {
  const agentPane = reviewer.value;
  if (agentPane === null) {
    toast(t("sourceControlPanel.noAgent"));
    return;
  }
  await sendPrompt(agentPane.pane_id, t("sourceControlPanel.reviewPrompt", { kind: kind.value, ref, title, url }));
  toast(t("sourceControlPanel.reviewSent", { agent: paneName(agentPane) }));
}
</script>

<template>
  <div class="source-control">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("sourceControlPanel.selectWorkspace") }}</div>
    <template v-else-if="currentGit">
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("sourceControlPanel.title") }}</span>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('sourceControlPanel.commit')"
          :title="t('sourceControlPanel.commit')"
          :disabled="sourceControl.isBusy"
          @click="commit('commit')"
        >
          <Icon name="check2" />
        </button>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('sourceControlPanel.createPullRequest', { kind })"
          :title="t('sourceControlPanel.createPullRequest', { kind })"
          :disabled="pullRequestUrl === null"
          @click="open(pullRequestUrl)"
        >
          <Icon name="git" />
        </button>
        <button
          type="button"
          class="btn btn-sm icon-button"
          :aria-label="t('sourceControlPanel.refresh')"
          :title="t('sourceControlPanel.refresh')"
          :disabled="git.loading"
          @click="refreshGit()"
        >
          <Icon name="arrow-clockwise" />
        </button>
        <SourceControlMenu
          button-class="btn btn-sm icon-button"
          icon="three-dots"
          :label="t('sourceControlPanel.moreActions')"
          :items="moreItems"
          :is-disabled="sourceControl.isBusy"
          @choose="chooseMore"
        />
      </header>

      <div class="message position-relative">
        <textarea
          v-model="message"
          class="form-control"
          rows="1"
          :placeholder="placeholder"
          :aria-label="t('sourceControlPanel.messageLabel')"
          @keydown="onCommitKeyDown"
        ></textarea>
        <button
          type="button"
          class="btn btn-sm icon-button write-message position-absolute"
          :aria-label="t('sourceControlPanel.writeMessage')"
          :title="t('sourceControlPanel.writeMessage')"
          :disabled="sourceControl.isWritingMessage"
          @click="writeCommitMessage()"
        >
          <span v-if="sourceControl.isWritingMessage" class="spinner-border spinner-border-sm" role="status"></span>
          <Icon v-else name="stars" />
        </button>
      </div>

      <div class="btn-group d-flex" role="group" :aria-label="t('sourceControlPanel.commit')">
        <button type="button" class="btn btn-primary flex-fill" :disabled="sourceControl.isBusy" @click="commit('commit')">
          <Icon name="check2" /> {{ t("sourceControlPanel.commit") }}
        </button>
        <SourceControlMenu
          button-class="btn btn-primary"
          icon="chevron-down"
          :label="t('sourceControlPanel.commitActions')"
          :items="commitItems"
          :is-disabled="sourceControl.isBusy"
          @choose="(id) => commit(id as CommitMode)"
        />
      </div>

      <div class="groups">
        <template v-for="group in (['staged', 'changes'] as const)" :key="group">
          <section v-if="group === 'changes' || groups.staged.length > 0" class="group">
            <div class="group-header d-flex align-items-center">
              <button
                type="button"
                class="group-toggle d-flex align-items-center gap-2 me-auto"
                :aria-expanded="sourceControl.folded[group] === false"
                @click="toggleGroup(group)"
              >
                <Icon :name="sourceControl.folded[group] ? 'chevron-right' : 'chevron-down'" />
                {{ t(`sourceControlPanel.group.${group}`) }}
              </button>
              <span class="hover-actions">
                <button
                  type="button"
                  class="btn btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.stash')"
                  :title="t('sourceControlPanel.stash')"
                  :disabled="sourceControl.isBusy || groups[group].length === 0"
                  @click="stashChanges(group === 'staged')"
                >
                  <Icon name="archive" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.viewChanges')"
                  :title="t('sourceControlPanel.viewChanges')"
                  :disabled="groups[group].length === 0"
                  @click="openGitModal()"
                >
                  <Icon name="files" />
                </button>
                <button
                  v-if="group === 'changes'"
                  type="button"
                  class="btn btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.discardAll')"
                  :title="t('sourceControlPanel.discardAll')"
                  :disabled="sourceControl.isBusy || groups.changes.length === 0"
                  @click="discardFiles(paths('changes'))"
                >
                  <Icon name="arrow-counterclockwise" />
                </button>
                <button
                  v-if="group === 'changes'"
                  type="button"
                  class="btn btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.stageAll')"
                  :title="t('sourceControlPanel.stageAll')"
                  :disabled="sourceControl.isBusy || groups.changes.length === 0"
                  @click="stageFiles(paths('changes'))"
                >
                  <Icon name="plus-lg" />
                </button>
                <button
                  v-else
                  type="button"
                  class="btn btn-sm icon-button"
                  :aria-label="t('sourceControlPanel.unstageAll')"
                  :title="t('sourceControlPanel.unstageAll')"
                  :disabled="sourceControl.isBusy"
                  @click="unstageFiles(paths('staged'))"
                >
                  <Icon name="dash-lg" />
                </button>
              </span>
              <span class="badge count">{{ groups[group].length }}</span>
            </div>
            <ul v-if="sourceControl.folded[group] === false" class="files">
              <li
                v-for="file in groups[group]"
                :key="`${group}:${file.path}`"
                class="file d-flex align-items-center"
                :title="fileTitle(file)"
              >
                <button type="button" class="file-main d-flex align-items-center gap-2 me-auto" @click="openGitModal(file.path)">
                  <Icon :name="fileIconName(file.name)" />
                  <span class="name">{{ file.name }}</span>
                  <span v-if="file.folder !== ''" class="folder">{{ file.folder }}</span>
                </button>
                <span class="hover-actions">
                  <button
                    type="button"
                    class="btn btn-sm icon-button"
                    :aria-label="t('sourceControlPanel.openFile')"
                    :title="t('sourceControlPanel.openFile')"
                    @click="openFile(file)"
                  >
                    <Icon name="file-earmark-arrow-up" />
                  </button>
                  <template v-if="group === 'changes'">
                    <button
                      type="button"
                      class="btn btn-sm icon-button"
                      :aria-label="t('sourceControlPanel.discard')"
                      :title="t('sourceControlPanel.discard')"
                      :disabled="sourceControl.isBusy"
                      @click="discardFiles([file.path])"
                    >
                      <Icon name="arrow-counterclockwise" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm icon-button"
                      :aria-label="t('sourceControlPanel.stage')"
                      :title="t('sourceControlPanel.stage')"
                      :disabled="sourceControl.isBusy"
                      @click="stageFiles([file.path])"
                    >
                      <Icon name="plus-lg" />
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="btn btn-sm icon-button"
                    :aria-label="t('sourceControlPanel.unstage')"
                    :title="t('sourceControlPanel.unstage')"
                    :disabled="sourceControl.isBusy"
                    @click="unstageFiles([file.path])"
                  >
                    <Icon name="dash-lg" />
                  </button>
                </span>
                <span class="letter" :class="letterClass(file.letter)">{{ file.letter }}</span>
              </li>
            </ul>
          </section>
        </template>

        <section class="group">
          <div class="group-header d-flex align-items-center">
            <button
              type="button"
              class="group-toggle d-flex align-items-center gap-2 me-auto"
              :aria-expanded="sourceControl.folded.pullRequests === false"
              @click="toggleGroup('pullRequests')"
            >
              <Icon :name="sourceControl.folded.pullRequests ? 'chevron-right' : 'chevron-down'" />
              {{ t("sourceControlPanel.openRequests", { kind }) }}
            </button>
            <span v-if="currentForge" class="badge count">{{ currentForge.requests.length }}</span>
          </div>
          <div v-if="sourceControl.folded.pullRequests === false" class="requests d-flex flex-column gap-2">
            <div v-if="!currentGit.remote" class="muted">{{ t("sourceControlPanel.noRemote") }}</div>
            <div v-else-if="!currentForge" class="muted">{{ t("sourceControlPanel.loading") }}</div>
            <div v-else-if="currentForge.error" class="err">{{ currentForge.error }}</div>
            <div v-else-if="!currentForge.requests.length" class="muted">{{ t("sourceControlPanel.noOpenRequest", { kind }) }}</div>
            <div v-for="request in currentForge?.requests ?? []" :key="request.ref" class="req" :class="{ mine: request.branch === currentGit.branch }">
              <button class="req-main" :title="t('sourceControlPanel.openRefOn', { ref: request.ref, forge: forgeLabel })" @click="open(request.url)">
                <span class="req-top">
                  <span class="mono ref">{{ request.ref }}</span>
                  <span class="chip sm" :class="request.level">{{ request.state }}</span>
                  <span v-if="request.review" class="chip sm" :class="request.review.level">{{ request.review.label }}</span>
                </span>
                <span class="req-title">{{ request.title }}</span>
                <span class="muted mono">{{ request.branch }}<template v-if="request.author"> · {{ request.author }}</template></span>
              </button>
              <span class="req-actions">
                <button class="link" :title="t('sourceControlPanel.previewTitle')" @click="openIssue(currentGit.root, { type: 'mr', number: request.number }, request.url)">{{ t("sourceControlPanel.preview") }}</button>
                <button
                  v-if="reviewer"
                  class="link"
                  :title="t('sourceControlPanel.askReviewTitle', { agent: paneName(reviewer) })"
                  @click="askReview(request.ref, request.url, request.title)"
                >{{ t("sourceControlPanel.askReview") }}</button>
                <button
                  v-if="!request.draft"
                  class="link merge"
                  :class="{ ready: request.level === 'ok' }"
                  :title="t('sourceControlPanel.mergeTitle', { ref: request.ref })"
                  @click="askMerge(state.selectedWorkspaceId!, request)"
                >{{ t("sourceControlPanel.merge") }}</button>
              </span>
            </div>
            <div v-if="currentForge && !currentForge.error" class="muted">{{ forgeLabel }} · {{ t("sourceControlPanel.updated", { time: ago(currentForge.at) }) }} · {{ workspaceLabel(state.selectedWorkspaceId) }}</div>
          </div>
        </section>
      </div>
    </template>
    <div v-else class="muted">{{ t("sourceControlPanel.notRepository") }}</div>
  </div>
</template>

<style scoped>
.source-control { flex: 1; min-height: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.title { font-weight: 600; text-transform: uppercase; font-size: var(--font-size); color: var(--text-2); }
.icon-button { padding: 2px 6px; color: var(--muted); border: none; }
.icon-button:hover:not(:disabled) { background: var(--hover); color: var(--text); }
.message textarea { resize: vertical; padding-right: 32px; min-height: 34px; }
.write-message { top: 4px; right: 4px; }
.groups { display: flex; flex-direction: column; gap: 4px; margin: 0 -8px; }
.group-header { padding: 2px 8px; border-radius: 5px; min-height: 26px; }
.group-header:hover { background: var(--hover-soft); }
.group-toggle, .file-main { border: none; background: none; padding: 0; color: var(--text); font-size: var(--font-size); text-align: left; min-width: 0; }
.group-toggle { font-weight: 600; }
.count { background: var(--line-strong); color: var(--text-2); margin-left: 4px; }
.hover-actions { display: none; align-items: center; }
.group-header:hover .hover-actions, .file:hover .hover-actions, .hover-actions:focus-within { display: inline-flex; }
.files { list-style: none; margin: 0; padding: 0; }
.file { padding: 1px 8px 1px 24px; border-radius: 5px; min-height: 24px; }
.file:hover { background: var(--hover-soft); }
.file-main { flex: 1 1 auto; overflow: hidden; white-space: nowrap; }
.name { flex-shrink: 0; }
.folder { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.letter { width: 18px; flex-shrink: 0; text-align: center; font: 600 var(--font-size) var(--mono); }
.letter.modified { color: var(--accent); }
.letter.added { color: var(--ok); }
.letter.deleted { color: var(--blocked); }
.letter.renamed { color: var(--done); }
.requests { padding: 4px 8px; }
.link { border: none; background: none; padding: 0; color: var(--faint); font-size: var(--font-size); }
.link:hover:not(:disabled) { color: var(--text-2); }
.chip {
  height: 18px; padding: 0 7px; border-radius: 11px; display: inline-flex; align-items: center; font-size: var(--font-size); font-weight: 600;
  background: var(--chip); color: var(--text-2); border: none;
}
.chip.ok { background: var(--tint-ok); color: var(--ok); }
.chip.warn { background: var(--tint-warn); color: var(--accent); }
.chip.crit { background: var(--tint-crit); color: var(--blocked); }
.chip.pending { background: var(--tint-working); color: var(--working); }
.chip.muted { color: var(--muted); }
.req { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--field); }
.req.mine { box-shadow: inset 0 0 0 1px #33506f; }
.req-main { display: flex; flex-direction: column; gap: 4px; border: none; background: none; padding: 0; text-align: left; color: var(--text); }
.req-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ref { color: var(--question); font-size: var(--font-size); }
.req-title { font-size: var(--font-size); font-weight: 500; }
.req-actions { display: flex; gap: 14px; }
.merge.ready { color: var(--question); }
.err { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); }
</style>
