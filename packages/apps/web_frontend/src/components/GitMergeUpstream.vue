<script setup lang="ts">
import { computed, ref } from "vue";
import { currentGit } from "../stores/git";
import { mergeUpstream, runMergeUpstream } from "../stores/git_merge_upstream";
import { useStatusCard } from "../lib/status_card";
import { t } from "../i18n/index";
import Icon from "./Icon.vue";

// The merge zone of the Git status bar section: the turning-arrows icon, like "Synchronize Changes" of Visual Studio
// Code. A click on it opens its information card and starts the merge with the upstream branch: the upstream branch is
// fetched, then merged into the current branch. The next click closes the card. A branch without upstream branch has
// the icon faded, and the card says why, and nothing starts.
// - issue #348
const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, close, onFocusOut } = useStatusCard(root);

/** True when the current branch has an upstream branch to merge. */
const hasUpstream = computed(() => currentGit.value?.upstream !== null && currentGit.value?.upstream !== undefined);

/** Opens the card and starts the merge, or closes the card when it is open. */
function onClick() {
  if (isOpen.value === true) {
    close();
    return;
  }
  toggle();
  if (hasUpstream.value === true) {
    void runMergeUpstream();
  }
}
</script>

<template>
  <div
    ref="root"
    class="git-merge-zone status-section d-flex align-items-center"
    :class="{ show: isOpen, 'git-merge-zone-disabled': hasUpstream === false }"
    role="button"
    tabindex="0"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
    :aria-disabled="hasUpstream === false"
    :title="isOpen ? undefined : t('statusBar.gitMergeUpstreamTitle')"
    @click="onClick"
    @keydown.enter.self.prevent="onClick"
    @keydown.space.self.prevent="onClick"
    @focusout="onFocusOut"
  >
    <span v-if="mergeUpstream.isBusy" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
    <Icon v-else name="arrow-repeat" />
    <div
      v-if="isOpen"
      class="popover popover-instant show bs-popover-top position-absolute bottom-100"
      role="dialog"
      :aria-label="t('statusBar.gitMergeUpstreamTitle')"
      @click.stop
    >
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-2" data-field="merge-card">
        <span v-if="hasUpstream === false" data-field="merge-no-upstream">{{ t("statusBar.gitMergeNoUpstream") }}</span>
        <span v-else-if="mergeUpstream.isBusy" data-field="merge-busy">
          {{ t("statusBar.gitMergeBusy", { upstream: currentGit?.upstream ?? "" }) }}
        </span>
        <div v-else-if="mergeUpstream.error !== null" class="alert theme-danger text-break" data-field="merge-error">
          {{ mergeUpstream.error }}
        </div>
        <span v-else-if="mergeUpstream.result?.outcome === 'merged'" data-field="merge-merged">
          {{ t("statusBar.gitMergeMerged", { upstream: mergeUpstream.result.upstream, branch: currentGit?.branch ?? "" }) }}
        </span>
        <span v-else-if="mergeUpstream.result?.outcome === 'up_to_date'" data-field="merge-up-to-date">
          {{ t("statusBar.gitMergeUpToDate", { upstream: mergeUpstream.result.upstream }) }}
        </span>
        <template v-else-if="mergeUpstream.result?.outcome === 'conflict'">
          <span data-field="merge-conflict">
            {{ t("statusBar.gitMergeConflict", { upstream: mergeUpstream.result.upstream, count: mergeUpstream.result.conflicts.length }) }}
          </span>
          <ul class="list-unstyled mb-0 text-break" data-field="merge-conflict-files">
            <li v-for="path in mergeUpstream.result.conflicts" :key="path">{{ path }}</li>
          </ul>
          <span class="text-body-secondary">{{ t("statusBar.gitMergeConflictHelp") }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Both sides of the zone keep 4 pixels of background: the branch zone and the counts zone touch it. */
.git-merge-zone { margin: 6px -4px; padding: 0 4px; }
/* The merge cannot start without upstream branch: the icon fades itself, because the application never fades a disabled control. */
.git-merge-zone-disabled { opacity: 0.35; }
</style>
