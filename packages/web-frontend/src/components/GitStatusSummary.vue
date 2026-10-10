<script setup lang="ts">
import { currentGit } from "../stores/git";
import { ago } from "../lib/format";
import { computed } from "vue";
import Icon from "./Icon.vue";
import { t } from "../i18n/index";

// The Git state of the selected workspace in the status bar, in the order of the Visual Studio Code status bar:
// the Git icon, the branch name, the commits to download, then the commits to upload.
// Hovering or focusing it shows a card with the details.
// A star after the branch name means the working folder has an uncommitted change: a changed or an untracked file.
const isDirty = computed(() => currentGit.value !== null && currentGit.value.changed + currentGit.value.untracked > 0);
</script>

<template>
  <span v-if="currentGit !== null && currentGit.branch !== null" class="git-status" tabindex="0">
    <Icon name="git" />
    <span class="branch">{{ currentGit.branch }}<span v-if="isDirty" class="dirty">*</span></span>
    <span class="behind"><span class="count">{{ currentGit.behind }}</span><Icon name="arrow-down" /></span>
    <span class="ahead"><span class="count">{{ currentGit.ahead }}</span><Icon name="arrow-up" /></span>
    <span class="card" role="tooltip">
      <span class="card-title"><Icon name="git" />{{ currentGit.branch }}<span v-if="isDirty" class="dirty">*</span></span>
      <span class="line">
        <span class="line-name">{{ t("statusBar.gitUpstream") }}</span>
        <span class="line-value upstream">{{ currentGit.upstream ?? t("statusBar.gitNoUpstream") }}</span>
      </span>
      <span class="line">
        <span class="line-name">{{ t("statusBar.gitToDownload") }}</span>
        <span class="line-value to-download">{{ currentGit.behind }}</span>
      </span>
      <span class="line">
        <span class="line-name">{{ t("statusBar.gitToUpload") }}</span>
        <span class="line-value to-upload">{{ currentGit.ahead }}</span>
      </span>
      <span class="line">
        <span class="line-name">{{ t("statusBar.gitChangedFiles") }}</span>
        <span class="line-value changed">{{ currentGit.changed }}</span>
      </span>
      <span class="line">
        <span class="line-name">{{ t("statusBar.gitUntrackedFiles") }}</span>
        <span class="line-value untracked">{{ currentGit.untracked }}</span>
      </span>
      <span v-if="currentGit.last_subject !== null" class="last-commit">
        <span class="line-name">{{ t("statusBar.gitLastCommit") }}</span>
        <span class="last-subject">{{ currentGit.last_subject }}</span>
        <span v-if="currentGit.last_time !== null" class="last-time">{{ ago(currentGit.last_time * 1000) }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.git-status {
  position: relative; display: flex; align-items: center; gap: 8px; color: var(--muted-2); font-weight: 600;
  cursor: default; outline-offset: 3px;
}
.behind, .ahead { display: flex; align-items: center; gap: 1px; }
.count { font-variant-numeric: tabular-nums; }
.card {
  display: flex; visibility: hidden; transition: visibility 0s linear 0.4s; position: absolute; bottom: calc(100% + 12px); left: 0; z-index: 20; width: 340px;
  flex-direction: column; gap: 8px; padding: 16px 18px; white-space: normal; font-weight: 400;
  border: 1px solid var(--line-modal); border-radius: 8px; background: var(--panel); color: var(--text-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); font-size: 14.5px;
}
.card::after {
  content: ""; position: absolute; top: 100%; left: 18px; width: 10px; height: 10px; margin-top: -6px;
  transform: rotate(45deg); border: solid var(--line-modal); border-width: 0 1px 1px 0; background: var(--panel);
}
.git-status:hover .card, .git-status:focus-visible .card { visibility: visible; transition-delay: 0s; }
.card-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text); }
.line { display: flex; justify-content: space-between; gap: 16px; }
.line-name { color: var(--muted); }
.line-value { color: var(--text); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; text-align: right; }
.last-commit { display: flex; flex-direction: column; gap: 2px; padding-top: 8px; border-top: 1px solid var(--line); }
.last-subject { color: var(--text); }
.last-time { color: var(--muted); }
</style>
