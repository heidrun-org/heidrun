<script setup lang="ts">
import { currentGit } from "../stores/git";
import Icon from "./Icon.vue";
import { t } from "../i18n/index";

// The Git state of the selected workspace in the status bar, in the order of the Visual Studio Code status bar:
// the Git icon, the branch name, the commits to download, then the commits to upload.
</script>

<template>
  <span
    v-if="currentGit !== null && currentGit.branch !== null"
    class="git-status"
    :title="t('statusBar.gitTitle', { branch: currentGit.branch, behind: currentGit.behind, ahead: currentGit.ahead })"
  >
    <Icon name="git" />
    <span class="branch">{{ currentGit.branch }}</span>
    <span class="behind"><span class="count">{{ currentGit.behind }}</span><Icon name="arrow-down" /></span>
    <span class="ahead"><span class="count">{{ currentGit.ahead }}</span><Icon name="arrow-up" /></span>
  </span>
</template>

<style scoped>
.git-status { display: flex; align-items: center; gap: 8px; color: var(--muted-2); font-weight: 600; }
.behind, .ahead { display: flex; align-items: center; gap: 1px; }
.count { font-variant-numeric: tabular-nums; }
</style>
