<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  canShowLessChats,
  canShowMoreChats,
  CHAT_AGENTS,
  chats,
  chooseChatAgent,
  loadChats,
  selectedChatAgent,
  shownChats,
  showLessChats,
  showMoreChats,
  type ChatAgent,
} from "../stores/chats";
import { chatReferences } from "../lib/chat_references";
import { chatSummaryLines } from "../lib/chat_summary";
import { EMPTY_CONTEXT, refContext, type RefContext } from "../lib/refs";
import { workspaceCwd } from "../stores/project";
import { state } from "../stores/session";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";
import ChatDatesLine from "./ChatDatesLine.vue";
import ChatFilesLine from "./ChatFilesLine.vue";
import ChatReferencesLine from "./ChatReferencesLine.vue";
import Icon from "./Icon.vue";
import { openChatInApp, openChatInHeidrun } from "../stores/chat_open";

/** How often the list reads the files of the coding agents again while it is on the screen, in milliseconds. */
const REFRESH_DELAY = 10_000;

const folder = computed(() => (state.selectedWorkspaceId === null ? null : workspaceCwd(state.selectedWorkspaceId)));

/** The address and the forge of the repository of the folder, for the buttons that open a file on the web. */
const repository = ref<RefContext>(EMPTY_CONTEXT);

watch(folder, (value) => loadChats(value), { immediate: true });
watch(
  folder,
  async (value) => {
    repository.value = EMPTY_CONTEXT;
    if (value === null) {
      return;
    }
    const context = await refContext(value);
    if (folder.value === value) {
      repository.value = context;
    }
  },
  { immediate: true },
);
const refreshTimer = setInterval(() => loadChats(folder.value), REFRESH_DELAY);
onBeforeUnmount(() => clearInterval(refreshTimer));

/** The name of a coding agent, as the selector shows it. */
function agentLabel(agent: ChatAgent): string {
  return t(`chatsPanel.agent.${agent}`);
}

/** The chats that the list shows, each with the three lines of its summary. */
const rows = computed(() =>
  shownChats.value.map((chat) => ({
    chat,
    lines: chatSummaryLines(chat.meta, new Date(), chats.root),
    references: chatReferences(chat.meta.issues, chat.meta.pull_requests, repository.value.base, repository.value.forge),
  })),
);

/** The coding agent of the selector. */
const agent = computed<ChatAgent>({
  get: () => selectedChatAgent.value ?? chats.agent,
  set: (value) => chooseChatAgent(value),
});

/** The title of the button that opens a chat in the desktop application of the coding agent of the list. */
const appTitle = computed(() => t("chatsPanel.openInAppTitle", { app: agentLabel(agent.value) }));

/** The view of the list: "expanded" gives more air to the rows, and every other saved value gives the compact view. */
const view = computed<"compact" | "expanded">({
  get: () => (settings.chatsView === "expanded" ? "expanded" : "compact"),
  set: (value) => {
    settings.chatsView = value;
  },
});

/** The two views of the list, in the order of the buttons: the expanded view first, then the compact view. */
const VIEWS = [
  { id: "expanded", icon: "view-stacked", title: "chatsPanel.viewExpanded" },
  { id: "compact", icon: "list", title: "chatsPanel.viewCompact" },
] as const;
</script>

<template>
  <section class="chats-panel d-flex flex-column gap-3 overflow-y-auto" :aria-label="t('chatsPanel.label')">
    <div v-if="chats.error !== null" class="alert alert-danger" role="alert">{{ chats.error }}</div>
    <div v-else-if="chats.isLoading" class="text-body-secondary">{{ t("chatsPanel.loading") }}</div>
    <div v-else-if="selectedChatAgent === null" class="text-body-secondary">
      {{ folder === null ? t("chatsPanel.noWorkspace") : t("chatsPanel.empty") }}
    </div>
    <template v-else>
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="btn-group" role="group" :aria-label="t('chatsPanel.agentLabel')">
          <template v-for="choice in CHAT_AGENTS" :key="choice">
            <input
              :id="`chats-agent-${choice}`"
              v-model="agent"
              type="radio"
              class="btn-check"
              name="chats-agent"
              autocomplete="off"
              :value="choice"
              :disabled="chats[choice].length === 0"
            />
            <label
              class="btn"
              :for="`chats-agent-${choice}`"
              :title="chats[choice].length === 0 ? t('chatsPanel.agentUnavailableTitle') : undefined"
            >
              {{ agentLabel(choice) }}
            </label>
          </template>
        </div>
        <div class="btn-group" role="group" :aria-label="t('chatsPanel.viewLabel')">
          <template v-for="choice in VIEWS" :key="choice.id">
            <input
              :id="`chats-view-${choice.id}`"
              v-model="view"
              type="radio"
              class="btn-check"
              name="chats-view"
              autocomplete="off"
              :value="choice.id"
              :aria-label="t(choice.title)"
            />
            <label class="btn" :for="`chats-view-${choice.id}`" :title="t(choice.title)">
              <Icon :name="choice.icon" />
            </label>
          </template>
        </div>
      </div>
      <div class="chats-separator border-top" role="separator"></div>
      <ul class="list-group list-group-flush" :class="{ 'is-expanded': view === 'expanded' }">
        <li v-for="row in rows" :key="row.chat.id" class="list-group-item list-group-item-action text-break">
          <div class="d-flex align-items-start gap-2">
            <div class="chat-title flex-fill">{{ row.chat.title }}</div>
            <div class="chat-actions btn-group" role="group" :aria-label="t('chatsPanel.chatActionsLabel')">
              <button
                type="button"
                class="btn"
                :title="appTitle"
                :aria-label="appTitle"
                @click="openChatInApp(agent, row.chat)"
              >
                <Icon name="box-arrow-up-right" />
              </button>
              <button
                type="button"
                class="btn"
                :title="t('chatsPanel.heidrunTitle')"
                :aria-label="t('chatsPanel.heidrunTitle')"
                @click="openChatInHeidrun(agent, row.chat, chats.folder)"
              >
                <Icon name="terminal" />
              </button>
            </div>
          </div>
          <div class="chat-summary d-flex flex-column text-body-secondary">
            <ChatDatesLine
              v-if="row.lines.dates !== ''"
              :text="row.lines.dates"
              :meta="row.chat.meta"
            />
            <ChatReferencesLine
              v-if="row.references.length > 0"
              :text="row.lines.references"
              :references="row.references"
              :folder="chats.folder ?? ''"
              :forge="repository.forge"
              :web-base="repository.base"
            />
            <ChatFilesLine
              v-if="row.lines.files !== ''"
              :text="row.lines.files"
              :entries="row.lines.fileEntries"
              :folder="chats.folder ?? ''"
              :web-base="repository.base"
              :forge="repository.forge"
            />
          </div>
        </li>
      </ul>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn flex-fill justify-content-center position-relative"
          :disabled="canShowMoreChats === false || chats.isShowingMore"
          :aria-busy="chats.isShowingMore"
          @click="showMoreChats"
        >
          {{ t("chatsPanel.showMore") }}
          <span
            v-if="chats.isShowingMore"
            class="busy-spinner spinner-border position-absolute top-0 bottom-0 end-0 my-auto me-2"
            role="status"
            aria-hidden="true"
          ></span>
        </button>
        <button
          type="button"
          class="btn flex-fill justify-content-center"
          :disabled="canShowLessChats === false || chats.isShowingMore"
          @click="showLessChats"
        >
          {{ t("chatsPanel.showLess") }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.chats-panel { --chats-inset: 14px; flex: 1; min-height: 0; padding: 18px var(--chats-inset); }
.list-group { margin: 0 calc(-1 * var(--chats-inset)); --bs-list-group-item-padding-x: var(--chats-inset); }
.chats-separator { margin: 0 calc(-1 * var(--chats-inset)) -0.5rem; }
.is-expanded { --bs-list-group-item-padding-y: 1rem; }
.is-expanded .chat-title { min-width: 0; }
.chat-actions .btn { height: 26px; --bs-btn-padding-x: 8px; }
.chat-summary { margin-top: 6px; gap: 4px; }
.btn-check:checked + .btn {
  --bs-btn-color: var(--text);
  --bs-btn-hover-color: var(--text);
  --bs-btn-active-color: var(--text);
  --bs-btn-hover-bg: var(--bs-secondary-bg);
  --bs-btn-active-bg: var(--bs-secondary-bg);
}
.btn-check:focus-visible + .btn { outline: 2px solid var(--done); outline-offset: 1px; }
.btn-check:disabled + .btn { opacity: 0.45; }
.chat-summary { margin-top: 2px; font-size: 0.85em; width: fit-content; max-width: 100%; }
.btn:disabled:not([aria-busy="true"]) { opacity: 0.45; }
.busy-spinner { --bs-spinner-width: 0.75rem; --bs-spinner-height: 0.75rem; --bs-spinner-border-width: 0.15em; }
</style>
