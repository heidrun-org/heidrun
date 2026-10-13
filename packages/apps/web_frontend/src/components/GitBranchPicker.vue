<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { currentGit } from "../stores/git";
import { checkoutGitBranch, filterGitBranches, listGitBranches, type GitBranch } from "../stores/git_branches";
import { ago } from "../lib/format";
import { useStatusCard } from "../lib/status_card";
import { t } from "../i18n/index";
import Icon from "./Icon.vue";

// The branch zone of the Git status bar section: the Git icon, the branch name, and a star when the working folder has
// an uncommitted change. A click on it opens the branch picker, as the branch picker of Visual Studio Code does: a
// search field, then the local branches, the most recently committed first. A click on a branch checks it out.
// - issue #350
const root = ref<HTMLElement | null>(null);
const searchField = ref<HTMLInputElement | null>(null);
const { isOpen, toggle, close, onFocusOut } = useStatusCard(root);

// The width of the card, in pixels: the same as the card of the usage of Claude, so the last commit fits on one line.
const CARD_WIDTH_PIXELS = 408;
const cardStyle = { width: `${CARD_WIDTH_PIXELS}px`, "--popover-max-width": `${CARD_WIDTH_PIXELS}px` };

/** The local branches, read each time the picker opens. */
const branches = ref<GitBranch[]>([]);
/** The text in the search field. */
const query = ref("");

const isDirty = computed(() => currentGit.value !== null && currentGit.value.changed + currentGit.value.untracked > 0);
const shownBranches = computed(() => filterGitBranches(branches.value, query.value));

watch(isOpen, async (isNowOpen) => {
  if (isNowOpen === false) {
    return;
  }
  query.value = "";
  branches.value = await listGitBranches();
  await nextTick();
  searchField.value?.focus();
});

/** Checks out the branch, and closes the picker. A click on the current branch only closes the picker. */
async function choose(branch: GitBranch) {
  close();
  if (branch.is_current === true) {
    return;
  }
  await checkoutGitBranch(branch.name);
}

/** The key Enter checks out the first branch of the list. */
function chooseFirst() {
  const first = shownBranches.value[0];
  if (first !== undefined) {
    void choose(first);
  }
}
</script>

<template>
  <div
    ref="root"
    class="git-branch-zone status-section d-flex align-items-center gap-2"
    :class="{ show: isOpen }"
    role="button"
    tabindex="0"
    aria-haspopup="listbox"
    :aria-expanded="isOpen"
    :aria-label="t('statusBar.gitBranchPickerLabel')"
    :title="t('statusBar.gitBranchPickerTitle')"
    @click="toggle"
    @keydown.enter.self.prevent="toggle"
    @keydown.space.self.prevent="toggle"
    @focusout="onFocusOut"
  >
    <Icon name="git" />
    <span class="branch">{{ currentGit?.branch }}<span v-if="isDirty" class="dirty">*</span></span>
    <div
      v-if="isOpen"
      class="popover popover-instant show bs-popover-top position-absolute bottom-100"
      :style="cardStyle"
      role="dialog"
      :aria-label="t('statusBar.gitBranchPickerLabel')"
      @click.stop
    >
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-2">
        <input
          ref="searchField"
          v-model="query"
          type="text"
          class="form-control form-control-sm"
          :placeholder="t('statusBar.gitBranchPickerPlaceholder')"
          :aria-label="t('statusBar.gitBranchPickerPlaceholder')"
          @keydown.enter.prevent="chooseFirst"
        />
        <div class="list-group list-group-flush overflow-auto branch-list" role="listbox">
          <button
            v-for="branch in shownBranches"
            :key="branch.name"
            type="button"
            class="list-group-item list-group-item-action d-flex flex-column px-2 py-1"
            role="option"
            :aria-selected="branch.is_current"
            :data-branch="branch.name"
            @click="choose(branch)"
          >
            <span class="d-flex align-items-center gap-2">
              <Icon name="git" />
              <span class="fw-semibold text-truncate">{{ branch.name }}</span>
              <Icon v-if="branch.is_current" name="check2" :title="t('statusBar.gitBranchPickerCurrent')" />
              <span class="ms-auto text-body-secondary text-nowrap">{{ ago(branch.last_time * 1000) }}</span>
            </span>
            <span class="text-body-secondary text-truncate">
              {{ branch.last_author }} • {{ branch.last_sha }} • {{ branch.last_subject }}
            </span>
          </button>
          <div v-if="shownBranches.length === 0" class="text-body-secondary px-2 py-1" data-field="no-branch">
            {{ t("statusBar.gitBranchPickerEmpty") }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The inner side of the zone keeps 4 pixels of background: the counts zone touches it. */
.git-branch-zone { margin-right: -4px; padding-right: 4px; }
.branch-list { max-height: 320px; }
</style>
