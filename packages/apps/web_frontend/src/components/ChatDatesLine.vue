<script setup lang="ts">
import { computed } from "vue";
import InformationCard from "./InformationCard.vue";
import Icon from "./Icon.vue";
import { chatDateRows } from "../lib/chat_dates";
import type { ChatMeta } from "../stores/chats";
import { t } from "../i18n/index";

// The first line of the summary of a chat: the first and the last date, then the number of messages from the developer.
// When the line is clicked, an information card gives the same facts in full: the date and the time when the chat started,
// the date and the time of its last activity, how long it lasted, the number of messages from the developer, and the folders
// where the coding agent ran. A fact that the chat does not have is left out.

const props = defineProps<{
  /** The text of the line. */
  text: string;
  /** What the scan of the file of the chat found. */
  meta: ChatMeta;
  /** The root of the repository, or null when it is not known: the folders are shown below it. */
  root: string | null;
}>();

/** What the card shows. */
const rows = computed(() => chatDateRows(props.meta, props.root));

/** The facts of the card as a label and a value, without the facts that the chat does not have. */
const facts = computed(() => {
  const found = rows.value;
  const all: { label: string; value: string | null }[] = [
    { label: t("chatsPanel.startedLabel"), value: found.started },
    { label: t("chatsPanel.lastActivityLabel"), value: found.lastActivity },
    { label: t("chatsPanel.durationLabel"), value: found.duration },
    { label: t("chatsPanel.messagesLabel"), value: found.messages > 0 ? String(found.messages) : null },
  ];
  return all.filter((fact): fact is { label: string; value: string } => fact.value !== null);
});
</script>

<template>
  <InformationCard :label="t('chatsPanel.datesTitle')">
    <div class="d-flex gap-2">
      <Icon name="clock" />
      <span>{{ text }}</span>
    </div>
    <template #card>
      <div class="list-group list-group-flush dates-list">
        <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
          <Icon name="clock" />
          {{ t("chatsPanel.datesTitle") }}
        </div>
        <div v-for="fact in facts" :key="fact.label" class="list-group-item d-flex justify-content-between gap-3" data-fact>
          <span class="fact-label text-body-secondary">{{ fact.label }}</span>
          <span class="text-end">{{ fact.value }}</span>
        </div>
        <template v-if="rows.folders.length > 0">
          <div class="list-group-item text-body-secondary">{{ t("chatsPanel.foldersTitle") }}</div>
          <div v-for="folder in rows.folders" :key="folder" class="list-group-item d-flex gap-2 text-break" data-folder>
            <Icon name="folder2" />
            <span>{{ folder }}</span>
          </div>
        </template>
      </div>
    </template>
  </InformationCard>
</template>

<style scoped>
.dates-list { max-height: 50vh; overflow-y: auto; }
.fact-label { flex-shrink: 0; white-space: nowrap; }
</style>
