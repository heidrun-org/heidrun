<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import { currentGit } from "../stores/git";
import { checkoutGitBranch, filterGitBranches, listGitBranches, selectedRoot, type GitBranch } from "../stores/git_branches";
import { isOnRemote, loadRemoteBranchNames } from "../stores/git_remote_branches";
import AbbreviatedTime from "./AbbreviatedTime.vue";
import { branchUrl, webOfRemote } from "../lib/refs";
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

/** The web page of the remote repository, and the forge that hosts it, or null when the remote is unknown. */
const web = computed(() => webOfRemote(currentGit.value?.remote ?? null));

/** The address of the page of a branch on the forge, or null when the remote is unknown. */
function pageOf(branch: GitBranch): string | null {
  return web.value === null ? null : branchUrl(web.value.base, web.value.forge, branch.name);
}

/** True when the page of the branch can exist: the branch is not known to be only local. */
function isLinkEnabled(branch: GitBranch): boolean {
  return isOnRemote(selectedRoot(), branch.name, branch.has_remote_tracking);
}

/** Opens the page of the branch on the forge in the web browser. The picker stays open. */
async function openPage(branch: GitBranch) {
  const address = pageOf(branch);
  if (address !== null) {
    await openUrl(address).catch(() => {});
  }
}

watch(isOpen, async (isNowOpen) => {
  if (isNowOpen === false) {
    return;
  }
  query.value = "";
  branches.value = await listGitBranches();
  const root = selectedRoot();
  if (root !== null) {
    void loadRemoteBranchNames(root);
  }
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
    :title="isOpen ? undefined : t('statusBar.gitBranchPickerTitle')"
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
      <div class="popover-body branch-picker-body d-flex flex-column">
        <div class="branch-search">
          <input
            ref="searchField"
            v-model="query"
            type="text"
            class="form-control form-control-sm"
            :placeholder="t('statusBar.gitBranchPickerPlaceholder')"
            :aria-label="t('statusBar.gitBranchPickerPlaceholder')"
            @keydown.enter.prevent="chooseFirst"
          />
        </div>
        <div class="list-group list-group-flush branch-list" role="listbox">
          <div v-for="branch in shownBranches" :key="branch.name" class="branch-item">
            <button
              type="button"
              class="list-action list-group-item list-group-item-action branch-row d-flex flex-column text-start"
              role="option"
              :aria-selected="branch.is_current"
              :data-branch="branch.name"
              @click="choose(branch)"
            >
              <span class="branch-first-line d-flex align-items-center gap-2">
                <Icon name="git" />
                <span class="fw-semibold branch-name">{{ branch.name }}</span>
                <Icon v-if="branch.is_current" name="check2" :title="t('statusBar.gitBranchPickerCurrent')" />
                <span class="text-body-secondary branch-time"><AbbreviatedTime :milliseconds="branch.last_time * 1000" /></span>
              </span>
              <span class="text-body-secondary branch-subject">
                {{ branch.last_author }} • {{ branch.last_sha }} • {{ branch.last_subject }}
              </span>
            </button>
            <button
              v-if="web !== null"
              type="button"
              class="btn btn-outline theme-secondary border-0 branch-link"
              :data-link="branch.name"
              :disabled="isLinkEnabled(branch) === false"
              :title="
                isLinkEnabled(branch)
                  ? t('statusBar.gitBranchPickerOpenOn', { forge: web.forge === 'github' ? 'GitHub' : 'GitLab' })
                  : t('statusBar.gitBranchPickerOnlyLocal')
              "
              :aria-label="t('statusBar.gitBranchPickerOpenOn', { forge: web.forge === 'github' ? 'GitHub' : 'GitLab' })"
              @click.stop="openPage(branch)"
            >
              <Icon :name="web.forge" />
            </button>
          </div>
          <div v-if="shownBranches.length === 0" class="text-body-secondary branch-row" data-field="no-branch">
            {{ t("statusBar.gitBranchPickerEmpty") }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The zone is the first of a button group: its left corners are round, and its right corners, where the next zone touches it, are square. */
.git-branch-zone { margin-right: -4px; padding-right: 4px; border-radius: 6px 0 0 6px; }
/* The list touches the borders of the card: the body has no padding, so the separators and the scroll bar reach the edges. */
.branch-picker-body { padding: 0; overflow: hidden; }
.branch-search { padding: 12px; }
.branch-list { max-height: min(560px, 60vh); overflow-y: auto; }
.branch-item { position: relative; }
.branch-row { padding: 10px 12px; row-gap: 4px; }
/* The first line leaves room for the link: 32 pixels, so the link ends 44 pixels from the edge. The second line goes to the edge. */
.branch-first-line { min-height: 28px; padding-right: 32px; }
/* Each row sits in its own wrapper, so the rows draw their own separator: one line under each row, edge to edge. */
.branch-item .branch-row { width: 100%; border-width: 0 0 var(--border-width) 0; border-radius: 0; }
.branch-name, .branch-subject { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.branch-time { margin-left: auto; white-space: nowrap; }
/* The link is only the icon, always visible, on the first line of the row, just after the time. Bootstrap draws the button:
   the classes "btn btn-outline theme-secondary border-0" (Bootstrap 6 writes the outline button this way). */
.branch-link {
  position: absolute; right: 8px; top: 10px; width: 28px; height: 28px; padding: 0;
  /* Bootstrap raises a hovered row of a list group to z-index 1: the link stays above it. */
  z-index: 2;
  display: flex; align-items: center; justify-content: center;
}
/* The application never fades a disabled button, so the link of a branch that is only local fades itself. */
.branch-link:disabled { cursor: default; }
</style>
