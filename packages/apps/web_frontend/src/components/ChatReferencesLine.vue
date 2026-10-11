<script setup lang="ts">
import { computed, ref } from "vue";
import InformationCard from "./InformationCard.vue";
import ChatReferenceDetails from "./ChatReferenceDetails.vue";
import Icon from "./Icon.vue";
import ScrollingLine from "./ScrollingLine.vue";
import { chatReferenceName, chatReferenceState, type ChatReference } from "../lib/chat_references";
import type { Forge } from "../lib/refs";
import { startScrolling, stopScrolling } from "../lib/scroll_on_hover";
import { loadChatReferenceDetails, type ChatReferenceDetails as Details } from "../stores/chat_references";
import { t } from "../i18n/index";

// The line of the summary of a chat that names the issues and the pull requests that the chat mentions. When the line is
// clicked, an information card lists every issue, then every pull request, one row for each. A row shows the title and the
// name with the state ("Issue #250 · Closed"). A click on a row opens its details under it, one row at a time, with the
// layout of the card that GitHub shows (see `ChatReferenceDetails.vue`). The forge is read each time the card opens, a few
// rows at a time. The Tauri command keeps each answer on the disk for ten minutes. A repository without a remote has no
// forge to read, so its numbers stay plain text.

const props = defineProps<{
  /** The text of the line: the numbers of the first issues, then of the first pull requests. */
  text: string;
  /** The issues, then the pull requests, that the chat mentions. */
  references: ChatReference[];
  /** The folder of the selected workspace, where the program reads the forge. */
  folder: string;
  /** The forge of the repository, or null when the repository has no remote. */
  forge: Forge | null;
  /** The address of the repository on its forge, or null when the repository has no remote. */
  webBase: string | null;
}>();

/** How many rows the program reads from the forge at the same time. */
const READ_AT_ONCE = 4;

/** The icon of the line: the icon of the forge, else the icon of Git. */
const forgeIcon = computed(() => props.forge ?? "git");

/** What the forge said about each reference, by key. A key is missing until the forge answered. */
const answers = ref<Record<string, Details | null>>({});

/** The key of the row that shows its details, or null. */
const expandedKey = ref<string | null>(null);

function keyOf(reference: ChatReference): string {
  return `${reference.kind}-${reference.number}`;
}

/** The two lines of a row: the title, and the name with the state. While the forge is read, the name stands for the title. */
function rowTexts(reference: ChatReference): { title: string; subtitle: string } {
  const name = chatReferenceName(reference);
  const known = answers.value[keyOf(reference)];
  if (known === undefined) {
    return { title: name, subtitle: t("chatsPanel.referenceLoading", { forge: forgeName() }) };
  }
  if (known === null) {
    return { title: name, subtitle: t("chatsPanel.referenceUnknown", { forge: forgeName() }) };
  }
  return { title: known.title, subtitle: `${name} · ${chatReferenceState(reference.kind, known.rawState).text}` };
}

function forgeName(): string {
  return props.forge === "gitlab" ? "GitLab" : "GitHub";
}

/** One row of the card. */
const rows = computed(() =>
  props.references.map((reference) => ({
    reference,
    key: keyOf(reference),
    icon: reference.kind === "issue" ? "record-circle" : "git",
    ...rowTexts(reference),
  })),
);

/** Reads the forge for every reference, a few at a time, each time the card opens. */
async function readReferences() {
  answers.value = {};
  expandedKey.value = null;
  const forge = props.forge;
  if (forge === null) {
    return;
  }
  const queue = [...props.references];
  const readers = Array.from({ length: Math.min(READ_AT_ONCE, queue.length) }, async () => {
    for (let reference = queue.shift(); reference !== undefined; reference = queue.shift()) {
      const answer = await loadChatReferenceDetails(props.folder, forge, reference);
      answers.value = { ...answers.value, [keyOf(reference)]: answer };
    }
  });
  await Promise.all(readers);
}

/** Opens the details of a row, or closes them when the row is already open. */
function toggle(key: string) {
  expandedKey.value = expandedKey.value === key ? null : key;
}
</script>

<template>
  <InformationCard v-if="forge !== null" :label="t('chatsPanel.referencesTitle')" @open="readReferences">
    <div class="d-flex gap-2">
      <Icon :name="forgeIcon" />
      <span>{{ text }}</span>
    </div>
    <template #card>
      <div class="list-group list-group-flush references-list">
        <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
          <Icon :name="forgeIcon" />
          {{ t("chatsPanel.referencesTitle") }}
        </div>
        <template v-for="row in rows" :key="row.key">
          <button
            type="button"
            class="list-group-item list-group-item-action d-flex align-items-center gap-3 text-start"
            data-reference
            :aria-expanded="expandedKey === row.key"
            @click="toggle(row.key)"
            @pointerenter="startScrolling"
            @pointerleave="stopScrolling"
          >
            <Icon :name="row.icon" />
            <div class="reference-text d-flex flex-column">
              <ScrollingLine class="fw-medium">{{ row.title }}</ScrollingLine>
              <ScrollingLine class="subtitle text-body-secondary">{{ row.subtitle }}</ScrollingLine>
            </div>
            <Icon :name="expandedKey === row.key ? 'chevron-up' : 'chevron-down'" />
          </button>
          <div v-if="expandedKey === row.key" class="list-group-item">
            <ChatReferenceDetails
              :reference="row.reference"
              :details="answers[row.key]"
              :folder="folder"
              :forge="forge"
              :web-base="webBase"
            />
          </div>
        </template>
      </div>
    </template>
  </InformationCard>
  <div v-else class="d-flex gap-2">
    <Icon :name="forgeIcon" />
    <span>{{ text }}</span>
  </div>
</template>

<style scoped>
.references-list { width: 24rem; max-width: 100%; max-height: 50vh; overflow-y: scroll; }
.reference-text { flex: 1 1 0; min-width: 0; }
.subtitle { font-size: 0.85em; }
</style>
