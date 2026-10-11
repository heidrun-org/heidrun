<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import {
  availableChatAgents,
  canShowMoreChats,
  chats,
  loadChats,
  selectedChatAgent,
  shownChats,
  showMoreChats,
  type ChatAgent,
} from "../stores/chats";
import { workspaceCwd } from "../stores/project";
import { state } from "../stores/session";
import { t } from "../i18n/index";

/** How often the list reads the files of the coding agents again while it is on the screen, in milliseconds. */
const REFRESH_DELAY = 10_000;

const folder = computed(() => (state.selectedWorkspaceId === null ? null : workspaceCwd(state.selectedWorkspaceId)));

watch(folder, (value) => loadChats(value), { immediate: true });
const refreshTimer = setInterval(() => loadChats(folder.value), REFRESH_DELAY);
onBeforeUnmount(() => clearInterval(refreshTimer));

/** The name of a coding agent, as the selector shows it. */
function agentLabel(agent: ChatAgent): string {
  return t(`chatsPanel.agent.${agent}`);
}

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
        <li v-for="chat in shownChats" :key="chat.id" class="list-group-item text-break">{{ chat.title }}</li>
      </ul>
      <button v-if="canShowMoreChats" type="button" class="btn" :disabled="chats.isShowingMore" @click="showMoreChats">
        {{ t("chatsPanel.showMore") }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.chats-panel { flex: 1; min-height: 0; padding: 18px 14px; }
</style>
