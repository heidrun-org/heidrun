<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  availableChatAgents,
  canShowLessChats,
  canShowMoreChats,
  chats,
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
import { t } from "../i18n/index";
import ChatDatesLine from "./ChatDatesLine.vue";
import ChatFilesLine from "./ChatFilesLine.vue";
import ChatReferencesLine from "./ChatReferencesLine.vue";

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
  set: (value) => {
    chats.agent = value;
  },
});
</script>

<template>
  <section class="chats-panel d-flex flex-column gap-3 overflow-y-auto" :aria-label="t('chatsPanel.label')">
    <div v-if="chats.error !== null" class="alert alert-danger" role="alert">{{ chats.error }}</div>
    <div v-else-if="chats.isLoading" class="text-body-secondary">{{ t("chatsPanel.loading") }}</div>
    <div v-else-if="selectedChatAgent === null" class="text-body-secondary">
      {{ folder === null ? t("chatsPanel.noWorkspace") : t("chatsPanel.empty") }}
    </div>
    <template v-else>
      <select v-model="agent" class="form-select" :aria-label="t('chatsPanel.agentLabel')">
        <option v-for="choice in availableChatAgents" :key="choice" :value="choice">{{ agentLabel(choice) }}</option>
      </select>
      <ul class="list-group list-group-flush">
        <li v-for="row in rows" :key="row.chat.id" class="list-group-item list-group-item-action text-break">
          <div>{{ row.chat.title }}</div>
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
          class="btn flex-fill position-relative"
          :disabled="canShowMoreChats === false || chats.isShowingMore"
          :aria-busy="chats.isShowingMore"
          @click="showMoreChats"
        >
          {{ t("chatsPanel.showMore") }}
          <span
            v-if="chats.isShowingMore"
            class="busy-spinner spinner-border position-absolute top-50 end-0 translate-middle-y me-2"
            role="status"
            aria-hidden="true"
          ></span>
        </button>
        <button
          type="button"
          class="btn flex-fill"
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
.chat-summary { margin-top: 2px; font-size: 0.85em; width: fit-content; max-width: 100%; }
.btn:disabled:not([aria-busy="true"]) { opacity: 0.45; }
.busy-spinner { --bs-spinner-width: 0.75rem; --bs-spinner-height: 0.75rem; --bs-spinner-border-width: 0.15em; }
</style>
