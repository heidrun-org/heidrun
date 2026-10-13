<script setup lang="ts">
import { currentGit } from "../stores/git";
import { ago } from "../lib/format";
import { computed, ref } from "vue";
import Icon from "./Icon.vue";
import GitBranchPicker from "./GitBranchPicker.vue";
import GitMergeUpstream from "./GitMergeUpstream.vue";
import { t } from "../i18n/index";
import { useStatusCard } from "../lib/status_card";

// The Git state of the selected workspace in the status bar, in the order of the Visual Studio Code status bar:
// the branch zone (the Git icon and the branch name, see GitBranchPicker.vue), then the merge zone
// (the turning-arrows icon, see GitMergeUpstream.vue), then the counts zone.
// The counts zone shows the commits to download, then the commits to upload. A click on it shows a Bootstrap popover
// with the details of the Git repository.

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
  <div v-if="currentGit !== null && currentGit.branch !== null" class="git-status d-flex align-items-center gap-2">
    <GitBranchPicker />
    <GitMergeUpstream />
    <div
      ref="root"
      class="git-counts-zone status-section d-flex align-items-center gap-2"
      :class="{ show: isOpen }"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :title="t('statusBar.gitCountsTitle')"
      @click="toggle"
      @keydown.enter.self.prevent="toggle"
      @keydown.space.self.prevent="toggle"
      @focusout="onFocusOut"
    >
      <span class="behind"><span class="count">{{ currentGit.behind }}</span><Icon name="arrow-down" /></span>
      <span class="ahead"><span class="count">{{ currentGit.ahead }}</span><Icon name="arrow-up" /></span>
      <div v-if="isOpen" class="popover popover-instant show bs-popover-top position-absolute bottom-100" role="tooltip" @click.stop>
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
  </div>
</template>

<style scoped>
.git-status { align-self: stretch; color: var(--muted-2); font-weight: 600; }
/* The two zones touch each other: the inner sides keep 4 pixels of background, the outer sides keep the 11 pixels of the
   other status bar sections, so the text of the zones stays in place. */
.git-counts-zone { margin-left: -4px; padding-left: 4px; }
.behind, .ahead { display: flex; align-items: center; gap: 1px; }
.count { font-variant-numeric: tabular-nums; }
</style>
