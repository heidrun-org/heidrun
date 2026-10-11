<script setup lang="ts">
import { computed, ref } from "vue";
import InformationCard from "./InformationCard.vue";
import Icon from "./Icon.vue";
import { chatDateRows } from "../lib/chat_dates";
import type { ChatMeta } from "../stores/chats";
import { t } from "../i18n/index";

// The first line of the summary of a chat: the first and the last date, then the number of messages from the developer.
// When the line is clicked, an information card gives the same facts in other words: how long ago the chat started and how
// long ago its last activity was (a question mark gives the full date in its title), how long it lasted, the number of
// messages from the developer, and the text of the first three messages from the developer. A fact that the chat does not
// have is left out.

const props = defineProps<{
  /** The text of the line. */
  text: string;
  /** What the scan of the file of the chat found. */
  meta: ChatMeta;
}>();

/** The present time for the card, in milliseconds since 1970. It is read again each time the card opens. */
const now = ref(Date.now());

/** What the card shows. */
const rows = computed(() => chatDateRows(props.meta, now.value));

/** One fact of the card: its name, its value, and the full date that goes in the title of a question mark, or null. */
type Fact = { label: string; value: string; fullDate: string | null };

/** The facts of the card, without the facts that the chat does not have. */
const facts = computed(() => {
  const found = rows.value;
  const all: (Fact | null)[] = [
    found.started === null
      ? null
      : { label: t("chatsPanel.startedLabel"), value: found.started.ago, fullDate: found.started.full },
    found.lastActivity === null
      ? null
      : { label: t("chatsPanel.lastActivityLabel"), value: found.lastActivity.ago, fullDate: found.lastActivity.full },
    found.duration === null ? null : { label: t("chatsPanel.durationLabel"), value: found.duration, fullDate: null },
    found.messages > 0 ? { label: t("chatsPanel.messagesLabel"), value: String(found.messages), fullDate: null } : null,
  ];
  return all.filter((fact): fact is Fact => fact !== null);
});

/** Reads the present time again, so that "2 minutes ago" is true each time the card opens. */
function refreshNow() {
  now.value = Date.now();
}
</script>

<template>
  <InformationCard :label="t('chatsPanel.datesTitle')" @open="refreshNow">
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
          <span class="text-end">
            <span data-value>{{ fact.value }}</span>
            <span v-if="fact.fullDate !== null" class="ms-1 text-body-secondary" :title="fact.fullDate" :aria-label="fact.fullDate" role="img">
              <small><Icon name="question-circle" /></small>
            </span>
          </span>
        </div>
        <template v-if="rows.firstMessages.length > 0">
          <div class="list-group-item text-body-secondary">{{ t("chatsPanel.firstMessagesTitle") }}</div>
          <div v-for="(message, index) in rows.firstMessages" :key="index" class="list-group-item d-flex gap-2 text-break" data-message>
            <Icon name="chat-left-text" />
            <span>{{ message }}</span>
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
