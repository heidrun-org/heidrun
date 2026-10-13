<script setup lang="ts">
// The Code hosting sidebar section of the left sidebar: the open issues, and the open pull requests (GitHub) or merge
// requests (GitLab), of the repository of the selected workspace, in two collapsible lists. A row has three lines of the
// same height: the number and the title, then two small detail lines. A click on a row opens an information card at its
// right, with the details that the forge gives (see `ChatReferenceDetails.vue`), and a button that opens the web page of
// the item in the web browser. A search field above the lists filters them, and the developer keeps a search under a
// name as a saved search. The buttons of the header save a search, edit the saved search that runs, and refresh the
// lists. Saving and editing open a modal window (see `SavedSearchModal.vue`).
// - issue #370
// - issue #374
// - issue #378
import { computed, ref, watch } from "vue";
import ChatReferenceDetails from "./ChatReferenceDetails.vue";
import Icon from "./Icon.vue";
import InformationCard from "./InformationCard.vue";
import ScrollingLine from "./ScrollingLine.vue";
import { codeHostingDetailLines } from "../lib/code_hosting_rows";
import { referenceLabelStyle, type ChatReference } from "../lib/chat_references";
import type { Forge } from "../lib/refs";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import {
  loadChatReferenceDetails,
  type ChatReferenceDetails as Details,
  type ChatReferenceLabel,
} from "../stores/chat_references";
import { currentGit } from "../stores/git";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import {
  CODE_HOSTING_LIMIT,
  codeHosting,
  itemPrefix,
  loadCodeHosting,
  searchCodeHosting,
  type CodeHostingGroup,
  type CodeHostingItem,
} from "../stores/code_hosting";
import { openEditSavedSearchModal, openSaveSearchModal } from "../stores/saved_search_modal";
import { t } from "../i18n/index";

/** The two lists, from the top. */
const GROUPS: CodeHostingGroup[] = ["issues", "requests"];

/** One row of a list, ready to show. */
type Row = {
  /** The key of the row, for the list of the answers. */
  key: string;
  /** The issue, the pull request, or the merge request. */
  item: CodeHostingItem;
  /** The number with its mark: "#370", or "!5" for a merge request of GitLab. */
  name: string;
  /** The first small detail line. */
  opened: string;
  /** The labels of an issue, shown in their colors on the second small detail line. */
  labels: ChatReferenceLabel[];
  /** The text of the second small detail line when it holds no label. */
  extra: string;
  /** The item as the card of the Chats sidebar section knows it. */
  reference: ChatReference;
};

/** One list with its rows, ready to show. */
type Section = {
  group: CodeHostingGroup;
  rows: Row[];
};

watch(
  () => currentGit.value?.root ?? null,
  (folder) => {
    void loadCodeHosting(folder);
  },
  { immediate: true },
);

/** The hosting service of the repository. A repository that is not on GitHub is read as GitLab, as everywhere else. */
const forge = computed<Forge>(() => codeHosting.forge ?? "github");

/** The two lists with their rows. */
const sections = computed((): Section[] => {
  const now = Date.now();
  return GROUPS.map((group) => ({
    group,
    rows: codeHosting[group].map((item) => {
      const lines = codeHostingDetailLines(group, item, now);
      return {
        key: `${group}-${item.number}`,
        item,
        name: `${itemPrefix(group, codeHosting.forge)}${item.number}`,
        opened: lines.opened,
        labels: lines.labels,
        extra: lines.extra,
        reference: { kind: group === "issues" ? "issue" : "pull_request", number: item.number, url: item.url },
      };
    }),
  }));
});

/** What the forge said about each item that has an open card, by key. A key is missing until the forge answered. */
const answers = ref<Record<string, Details | null>>({});

/** The title of a list: "Issues", then "Pull requests" on GitHub or "Merge requests" on GitLab. */
function groupTitle(group: CodeHostingGroup): string {
  if (group === "issues") {
    return t("codeHostingPanel.group.issues");
  }
  return t(codeHosting.forge === "gitlab" ? "codeHostingPanel.group.mergeRequests" : "codeHostingPanel.group.pullRequests");
}

/** The text of an empty list: "No open issue.", or "No issue matches the search." while a search runs. */
function emptyText(group: CodeHostingGroup): string {
  const kind = codeHosting.search === "" ? "empty" : "emptySearch";
  if (group === "issues") {
    return t(`codeHostingPanel.${kind}.issues`);
  }
  return t(`codeHostingPanel.${kind}.${codeHosting.forge === "gitlab" ? "mergeRequests" : "pullRequests"}`);
}

/** The text of the search field. It is the search that runs after the key Enter, not always the search that runs now. */
const searchText = ref(codeHosting.search);

// A search that runs from elsewhere (the window "Save this search", a saved search button) shows in the search field.
watch(
  () => codeHosting.search,
  (search) => {
    searchText.value = search;
  },
);

/** The saved search that runs now, or undefined when no saved search runs. */
const runningSearch = computed(() => {
  if (codeHosting.search === "") {
    return undefined;
  }
  return settings.codeHostingSavedSearches.find((saved) => saved.query === codeHosting.search);
});

/** The button "Save this search" works when the field holds a search that no saved search already holds. */
const canSaveSearch = computed(() => {
  const search = searchText.value.trim();
  return search !== "" && settings.codeHostingSavedSearches.some((saved) => saved.query === search) === false;
});

/** Runs the search of the search field. */
function runSearch() {
  void searchCodeHosting(currentGit.value?.root ?? null, searchText.value);
}

/**
 * Puts a search in the search field and runs it.
 * @param query - the search, or an empty text for all the open items
 */
function applySearch(query: string) {
  searchText.value = query;
  runSearch();
}

/** Opens the window "Save this search" for the search of the search field. */
function saveCurrentSearch() {
  openSaveSearchModal(searchText.value.trim());
}

/** Opens the window "Edit the saved search" for the saved search that runs now. */
function editRunningSearch() {
  if (runningSearch.value !== undefined) {
    openEditSavedSearchModal(runningSearch.value.name);
  }
}
function toggleGroup(group: CodeHostingGroup) {
  codeHosting.folded[group] = codeHosting.folded[group] === false;
}

/** Reads the details of a row from the forge when its card opens. The Tauri command keeps each answer for ten minutes. */
async function readDetails(row: Row) {
  const folder = currentGit.value?.root;
  if (folder === undefined) {
    return;
  }
  const { [row.key]: _forgotten, ...others } = answers.value;
  answers.value = others;
  const answer = await loadChatReferenceDetails(folder, forge.value, row.reference);
  answers.value = { ...answers.value, [row.key]: answer };
}
</script>

<template>
  <div class="code-hosting">
    <div v-if="state.selectedWorkspaceId === null" class="muted">{{ t("codeHostingPanel.selectWorkspace") }}</div>
    <div v-else-if="currentGit === null" class="muted">{{ t("codeHostingPanel.notRepository") }}</div>
    <template v-else>
      <header class="d-flex align-items-center">
        <span class="title me-auto">{{ t("codeHostingPanel.title") }}</span>
        <div class="btn-group" role="group" :aria-label="t('codeHostingPanel.buttonsLabel')">
          <template v-if="codeHosting.status !== 'noRemote'">
            <button
              type="button"
              class="btn btn-sm icon-button"
              data-save-search
              :aria-label="t('codeHostingPanel.saveSearch')"
              :title="t('codeHostingPanel.saveSearch')"
              :disabled="canSaveSearch === false"
              @click="saveCurrentSearch"
            >
              <Icon name="bookmark-plus" />
            </button>
            <button
              type="button"
              class="btn btn-sm icon-button"
              data-edit-saved-search
              :aria-label="t('codeHostingPanel.editSearch')"
              :title="t('codeHostingPanel.editSearch')"
              :disabled="runningSearch === undefined"
              @click="editRunningSearch"
            >
              <Icon name="pencil" />
            </button>
          </template>
          <button
            type="button"
            class="btn btn-sm icon-button"
            :aria-label="t('codeHostingPanel.refresh')"
            :title="t('codeHostingPanel.refresh')"
            :disabled="codeHosting.status === 'loading'"
            @click="loadCodeHosting(currentGit.root, true)"
          >
            <Icon name="arrow-clockwise" />
          </button>
        </div>
      </header>

      <template v-if="codeHosting.status !== 'noRemote'">
        <form class="search d-flex align-items-center gap-1" role="search" @submit.prevent="runSearch">
          <input
            v-model="searchText"
            type="text"
            class="form-control form-control-sm"
            spellcheck="false"
            autocomplete="off"
            :placeholder="t('codeHostingPanel.searchPlaceholder')"
            :title="t('codeHostingPanel.searchHint')"
            :aria-label="t('codeHostingPanel.searchLabel')"
          />
          <button
            type="submit"
            class="btn btn-sm icon-button"
            :aria-label="t('codeHostingPanel.searchRun')"
            :title="t('codeHostingPanel.searchRun')"
          >
            <Icon name="search" />
          </button>
        </form>
        <div
          v-if="settings.codeHostingSavedSearches.length > 0"
          class="saved d-flex flex-wrap align-items-center gap-1"
          role="group"
          :aria-label="t('codeHostingPanel.savedSearches')"
        >
          <button
            type="button"
            class="btn btn-sm saved-button"
            data-saved-search="all"
            :class="{ active: codeHosting.search === '' }"
            :aria-pressed="codeHosting.search === ''"
            @click="applySearch('')"
          >
            {{ t("codeHostingPanel.allItems") }}
          </button>
          <button
            v-for="saved in settings.codeHostingSavedSearches"
            :key="saved.name"
            type="button"
            class="btn btn-sm saved-button"
            data-saved-search
            :class="{ active: codeHosting.search === saved.query }"
            :aria-pressed="codeHosting.search === saved.query"
            :title="saved.query"
            @click="applySearch(saved.query)"
          >
            <span class="saved-name">{{ saved.name }}</span>
          </button>
        </div>
      </template>

      <div v-if="codeHosting.status === 'noRemote'" class="muted">{{ t("codeHostingPanel.noRemote") }}</div>
      <div v-else-if="codeHosting.status === 'failed'" class="failure">{{ codeHosting.error }}</div>
      <div v-else-if="codeHosting.status !== 'ready'" class="muted">{{ t("codeHostingPanel.loading") }}</div>
      <div v-else class="groups">
        <section v-for="section in sections" :key="section.group" class="group">
          <div class="group-header d-flex align-items-center">
            <button
              type="button"
              class="group-toggle d-flex align-items-center gap-2 me-auto"
              :aria-expanded="codeHosting.folded[section.group] === false"
              @click="toggleGroup(section.group)"
            >
              <Icon :name="codeHosting.folded[section.group] ? 'chevron-right' : 'chevron-down'" />
              {{ groupTitle(section.group) }}
            </button>
            <span class="badge count">{{ section.rows.length }}</span>
          </div>
          <template v-if="codeHosting.folded[section.group] === false">
            <ul v-if="section.rows.length > 0" class="items">
              <li v-for="row in section.rows" :key="row.key">
                <InformationCard
                  class="row-card"
                  placement="end"
                  :label="t('codeHostingPanel.cardLabel', { name: row.name })"
                  @open="readDetails(row)"
                >
                  <div
                    class="item d-flex align-items-center gap-2"
                    data-code-hosting-item
                    @pointerenter="startScrolling"
                    @pointerleave="stopScrolling"
                  >
                    <div class="item-lines">
                      <div class="title-line">
                        <span class="number">{{ row.name }}</span>
                        <ScrollingLine class="title-text">{{ row.item.title }}</ScrollingLine>
                      </div>
                      <div class="detail-line">{{ row.opened }}</div>
                      <div v-if="row.labels.length > 0" class="detail-line labels-line">
                        <span
                          v-for="label in row.labels"
                          :key="label.name"
                          class="badge label-badge"
                          :style="referenceLabelStyle(label.color)"
                        >
                          {{ label.name }}
                        </span>
                      </div>
                      <div v-else class="detail-line">{{ row.extra }}</div>
                    </div>
                  </div>
                  <template #card>
                    <div class="card-content">
                      <ChatReferenceDetails
                        :reference="row.reference"
                        :details="answers[row.key]"
                        :folder="currentGit.root"
                        :forge="forge"
                        :web-base="codeHosting.webBase"
                      />
                    </div>
                  </template>
                </InformationCard>
              </li>
            </ul>
            <div v-else class="muted empty">{{ emptyText(section.group) }}</div>
            <div v-if="section.rows.length >= CODE_HOSTING_LIMIT" class="muted empty">
              {{ t("codeHostingPanel.truncated", { limit: CODE_HOSTING_LIMIT }) }}
            </div>
          </template>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.code-hosting { flex: 1; min-height: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.code-hosting :deep(.icon-button) { height: 22px; padding: 0 5px; color: var(--muted); border: none; }
.code-hosting :deep(.icon-button:hover:not(:disabled)) { background: var(--hover); color: var(--text); }
.search .form-control { flex: 1 1 auto; min-width: 0; }
/* A saved search is a small button with a round border: the one that runs now is filled. */
.saved-button { display: inline-flex; align-items: center; height: 22px; padding: 0 10px; border: 1px solid var(--line); border-radius: 11px; color: var(--text-2); max-width: 100%; white-space: nowrap; }
/* A name that does not fit ends with an ellipsis. A button cannot show one itself, so the name is in its own span. */
.saved-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.saved-button:hover { background: var(--hover-soft); color: var(--text); }
.saved-button.active { background: var(--hover); border-color: var(--line-strong); color: var(--text); }
.groups { display: flex; flex-direction: column; gap: 4px; margin: 0 -16px; }
.group-header { height: 26px; margin: 0 8px; padding: 0 8px; border-radius: 5px; }
.group-header:hover { background: var(--hover-soft); }
.group-toggle { border: none; background: none; padding: 0; color: var(--text); font-size: var(--font-size); text-align: left; min-width: 0; font-weight: 600; }
.count { background: var(--line-strong); color: var(--text-2); margin-left: 4px; }
.items { list-style: none; margin: 0; padding: 0; }
/* A row takes the whole width of the sidebar section, has square corners, and has a very light line under it. */
.items .row-card { margin: 0; padding: 0; border-radius: 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 50%, transparent); }
/* Every row has the same height: each line has its own height, and a text that does not fit ends with an ellipsis. */
.item { padding: 4px 16px 4px 32px; }
.item-lines { flex: 1 1 auto; min-width: 0; }
.title-line, .detail-line { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.title-line { display: flex; gap: 0.35em; height: 1.5em; line-height: 1.5; }
.title-text { flex: 1 1 0; min-width: 0; }
/* The pills of the labels are as high as their line, less one pixel above and below, so that their border is never cut. */
.labels-line { display: flex; align-items: center; gap: 0.35em; }
/* Bootstrap gives a badge a minimum height of 1.375rem, which is higher than the line. */
.label-badge { flex: 0 0 auto; box-sizing: border-box; min-height: 0; height: calc(100% - 2px); border: 1px solid; padding: 0 0.5em; line-height: 1; }
.detail-line { height: 1.35em; line-height: 1.35; font-size: 0.85em; color: var(--muted); }
.number { color: var(--muted); }
/* The card has no padding of its own: its content decides it. */
.card-content { padding: 12px 16px; }
.empty { padding: 0 16px 0 32px; }
.failure { font-size: var(--font-size); color: var(--fail); }
.muted { font-size: var(--font-size); color: var(--muted); }
</style>
