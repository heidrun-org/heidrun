<script setup lang="ts">
// The Code hosting sidebar section of the left sidebar: the open issues, and the open pull requests (GitHub) or merge
// requests (GitLab), of the repository of the selected workspace, in two collapsible lists. A row has three lines of the
// same height: the number and the title, then two small detail lines. A click on a row opens an information card at its
// right, with the details that the forge gives (see `ChatReferenceDetails.vue`), and a button that opens the web page of
// the item in the web browser.
// - issue #370
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
import {
  CODE_HOSTING_LIMIT,
  codeHosting,
  itemPrefix,
  loadCodeHosting,
  type CodeHostingGroup,
  type CodeHostingItem,
} from "../stores/code_hosting";
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

/** The text of an empty list. */
function emptyText(group: CodeHostingGroup): string {
  if (group === "issues") {
    return t("codeHostingPanel.empty.issues");
  }
  return t(codeHosting.forge === "gitlab" ? "codeHostingPanel.empty.mergeRequests" : "codeHostingPanel.empty.pullRequests");
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
      </header>

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
