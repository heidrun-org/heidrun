<script setup lang="ts">
import { currentGit } from "../stores/git";
import { ago } from "../lib/format";
import { computed, ref } from "vue";
import Icon from "./Icon.vue";
import { t } from "../i18n/index";
import { useStatusCard } from "../lib/status_card";

// The Git state of the selected workspace in the status bar, in the order of the Visual Studio Code status bar:
// the Git icon, the branch name, the commits to download, then the commits to upload.
// A click on it shows a Bootstrap popover with the details.
// A star after the branch name means the working folder has an uncommitted change: a changed or an untracked file.
const isDirty = computed(() => currentGit.value !== null && currentGit.value.changed + currentGit.value.untracked > 0);

const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, onFocusOut } = useStatusCard(root);

const detailRows = computed(() => {
  if (currentGit.value === null) {
    return [];
  }
  return [
    { field: "upstream", name: t("statusBar.gitUpstream"), value: currentGit.value.upstream ?? t("statusBar.gitNoUpstream") },
    { field: "to-download", name: t("statusBar.gitToDownload"), value: currentGit.value.behind },
    { field: "to-upload", name: t("statusBar.gitToUpload"), value: currentGit.value.ahead },
    { field: "changed", name: t("statusBar.gitChangedFiles"), value: currentGit.value.changed },
    { field: "untracked", name: t("statusBar.gitUntrackedFiles"), value: currentGit.value.untracked },
  ];
});
</script>

<template>
  <div
    v-if="currentGit !== null && currentGit.branch !== null"
    ref="root"
    class="git-status"
    tabindex="0"
    @click="toggle"
    @keydown.enter.self.prevent="toggle"
    @keydown.space.self.prevent="toggle"
    @focusout="onFocusOut"
  >
    <Icon name="git" />
    <span class="branch">{{ currentGit.branch }}<span v-if="isDirty" class="dirty">*</span></span>
    <span class="behind"><span class="count">{{ currentGit.behind }}</span><Icon name="arrow-down" /></span>
    <span class="ahead"><span class="count">{{ currentGit.ahead }}</span><Icon name="arrow-up" /></span>
    <div v-if="isOpen" class="popover bs-popover-top position-absolute bottom-100" role="tooltip" @click.stop>
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-2">
        <div v-for="row in detailRows" :key="row.field" class="d-flex justify-content-between gap-3">
          <span class="text-body-secondary">{{ row.name }}</span>
          <span class="text-end text-break" :data-field="row.field">{{ row.value }}</span>
        </div>
        <div v-if="currentGit.last_subject !== null" class="d-flex flex-column border-top pt-2">
          <span class="text-body-secondary">{{ t("statusBar.gitLastCommit") }}</span>
          <span data-field="last-subject">{{ currentGit.last_subject }}</span>
          <span v-if="currentGit.last_time !== null" class="text-body-secondary">{{ ago(currentGit.last_time * 1000) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.git-status {
  align-self: stretch; margin: 0 -11px; padding: 0 11px;
  display: flex; align-items: center; gap: 8px; color: var(--muted-2); font-weight: 600;
  cursor: pointer; outline-offset: 3px;
}
.behind, .ahead { display: flex; align-items: center; gap: 1px; }
.count { font-variant-numeric: tabular-nums; }
</style>
