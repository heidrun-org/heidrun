<script setup lang="ts">
import { computed, ref } from "vue";
import InformationCard from "./InformationCard.vue";
import Icon from "./Icon.vue";
import { chatDateRows } from "../lib/chat_dates";
import { chatUsageRows, type TokenCountText } from "../lib/chat_usage";
import type { ChatMeta, ChatUsage } from "../stores/chats";
import { t } from "../i18n/index";

// The first line of the summary of a chat: the first and the last date, then the number of messages from the developer.
// When the line is clicked, an information card gives the same facts in other words: how long ago the chat started and how
// long ago its last activity was (a question mark gives the full date in its title), how long it lasted, the number of
// messages from the developer, the tokens that the chat used (input, cached input, output, short like "3.10 MT", with a question mark that gives the full
// number, in a monospace font) with their estimated cost, and
// the text of the first three messages from the developer. A fact that the chat does not have is left out.

const props = defineProps<{
  /** The text of the line. */
  text: string;
  /** What the scan of the file of the chat found. */
  meta: ChatMeta;
  /** The tokens and the cost of the chat, or null when the chat used no token. */
  usage?: ChatUsage | null;
}>();

/** The present time for the card, in milliseconds since 1970. It is read again each time the card opens. */
const now = ref(Date.now());

/** What the card shows. */
const rows = computed(() => chatDateRows(props.meta, now.value));

/** What the card shows about the tokens, or null when the chat used no token. */
const usageRows = computed(() => chatUsageRows(props.usage));

/**
 * One fact of the card: its name, its value, the full text that goes in the title of a question mark (the full date of a
 * date, the full number of a number of tokens), or null, and whether the value is a number of tokens, which shows in a
 * monospace font so that the numbers stay aligned.
 */
type Fact = { label: string; value: string; fullText: string | null; isTokenCount?: boolean };

/** The fact of a number of tokens: the short text is the value, and the full number is the title of the question mark. */
function tokenFact(label: string, count: TokenCountText): Fact {
  return { label, value: count.text, fullText: count.full, isTokenCount: true };
}

/** The facts of the card, without the facts that the chat does not have. */
const facts = computed(() => {
  const found = rows.value;
  const tokens = usageRows.value;
  const all: (Fact | null)[] = [
    found.started === null
      ? null
      : { label: t("chatsPanel.startedLabel"), value: found.started.ago, fullText: found.started.full },
    found.lastActivity === null
      ? null
      : { label: t("chatsPanel.lastActivityLabel"), value: found.lastActivity.ago, fullText: found.lastActivity.full },
    found.duration === null ? null : { label: t("chatsPanel.durationLabel"), value: found.duration, fullText: null },
    found.messages > 0 ? { label: t("chatsPanel.messagesLabel"), value: String(found.messages), fullText: null } : null,
    tokens === null ? null : tokenFact(t("chatsPanel.inputTokensLabel"), tokens.inputTokens),
    tokens === null || tokens.cachedInputTokens === null
      ? null
      : tokenFact(t("chatsPanel.cachedInputTokensLabel"), tokens.cachedInputTokens),
    tokens === null ? null : tokenFact(t("chatsPanel.outputTokensLabel"), tokens.outputTokens),
    tokens === null || tokens.cost === null
      ? null
      : { label: t("chatsPanel.costLabel"), value: tokens.cost, fullText: null },
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
        <div v-for="fact in facts" :key="fact.label" class="list-group-item list-group-item-action d-flex justify-content-between gap-3" data-fact>
          <span class="fact-label text-body-secondary">{{ fact.label }}</span>
          <span class="text-end">
            <span data-value :class="{ 'font-monospace': fact.isTokenCount === true }">{{ fact.value }}</span>
            <span v-if="fact.fullText !== null" class="ms-1 text-body-secondary" :title="fact.fullText" :aria-label="fact.fullText" role="img">
              <small><Icon name="question-circle" /></small>
            </span>
          </span>
        </div>
        <div v-if="usageRows !== null && usageRows.cost !== null" class="list-group-item small text-body-secondary" data-cost-note>
          {{ t("chatsPanel.costNote") }}
        </div>
        <template v-if="rows.firstMessages.length > 0">
          <div class="list-group-item text-body-secondary">{{ t("chatsPanel.firstMessagesTitle") }}</div>
          <div v-for="(message, index) in rows.firstMessages" :key="index" class="list-group-item list-group-item-action d-flex gap-2 text-break" data-message>
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
