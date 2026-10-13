<script setup lang="ts">
import { computed } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "./Icon.vue";
import {
  chatReferenceState,
  referenceDay,
  referenceExcerpt,
  repositoryName,
  type ChatReference,
} from "../lib/chat_references";
import type { Forge } from "../lib/refs";
import type { ChatReferenceDetails } from "../stores/chat_references";
import { openIssue } from "../stores/issues";
import { toast } from "../stores/session";
import { t } from "../i18n/index";

// What the forge says about one issue or one pull request, under its row in the information card of the references line,
// with the layout of the card that GitHub shows: the repository and the date, the state, the beginning of the description,
// the labels (or the two branches of a pull request), and the person who opened it. Two buttons open the description and
// the comments in Heidrun, or the web page on GitHub or GitLab.

const props = defineProps<{
  /** The issue or the pull request. */
  reference: ChatReference;
  /** What the forge said, `undefined` while the program reads it, and null when the forge did not answer. */
  details: ChatReferenceDetails | null | undefined;
  /** The folder of the selected workspace, where the program reads the forge. */
  folder: string;
  /** The forge of the repository. */
  forge: Forge;
  /** The address of the repository on its forge, or null. */
  webBase: string | null;
}>();

/** The name of the forge on the button. The names of the products are not translated. */
const forgeName = computed(() => (props.forge === "gitlab" ? "GitLab" : "GitHub"));

/** The line above the state: the repository and the date of the creation. */
const header = computed(() => {
  const repository = repositoryName(props.webBase);
  if (repository === null) {
    return "";
  }
  const date = referenceDay(props.details?.createdAt ?? null);
  return date === "" ? repository : t("chatsPanel.referenceDetailsHeader", { repository, date });
});

/** How the state looks: its text, its icon, and the class of its color. */
const state = computed(() => chatReferenceState(props.reference.kind, props.details?.rawState ?? ""));

/** The beginning of the description as plain text, or an empty text. */
const excerpt = computed(() => referenceExcerpt(props.details?.body ?? ""));

/** The style of a label: its color for the text, a tint of it for the background and the border. */
function labelStyle(color: string | null): Record<string, string> {
  if (color === null) {
    return {};
  }
  return {
    color: `color-mix(in srgb, #${color} 70%, var(--fg-body))`,
    backgroundColor: `color-mix(in srgb, #${color} 15%, transparent)`,
    borderColor: `color-mix(in srgb, #${color} 50%, transparent)`,
  };
}

/** Opens the description and the comments of the issue or of the pull request in the window of Heidrun. */
function openInHeidrun() {
  const type = props.reference.kind === "issue" ? "issue" : "mr";
  openIssue(props.folder, { type, number: props.reference.number }, props.reference.url);
}

async function openOnForge() {
  if (props.reference.url === null) {
    return;
  }
  try {
    await openUrl(props.reference.url);
  } catch (reason) {
    toast(String(reason), "error");
  }
}
</script>

<template>
  <div class="reference-details d-flex flex-column gap-3" data-reference-details>
    <div class="d-flex align-items-center gap-3">
      <div class="d-flex flex-column gap-2 flex-fill heading">
        <div v-if="header !== ''" class="text-body-secondary small-text">{{ header }}</div>
        <span v-if="details" class="badge d-inline-flex align-items-center gap-2 align-self-start" :class="state.look">
          <Icon :name="state.icon" />
          {{ state.text }}
        </span>
      </div>
      <div class="btn-group" role="group" :aria-label="t('chatsPanel.openReferenceLabel')">
        <button
          type="button"
          class="btn"
          :title="t('chatsPanel.heidrunTitle')"
          :aria-label="t('chatsPanel.heidrunTitle')"
          @click="openInHeidrun"
        >
          <Icon name="heidrun-goat-only" />
        </button>
        <button
          type="button"
          class="btn"
          :disabled="reference.url === null"
          :title="t('chatsPanel.forgeTitle', { forge: forgeName })"
          :aria-label="t('chatsPanel.forgeTitle', { forge: forgeName })"
          @click="openOnForge"
        >
          <Icon :name="forge" />
        </button>
      </div>
    </div>
    <div v-if="details === undefined" class="text-body-secondary">
      {{ t("chatsPanel.referenceLoading", { forge: forgeName }) }}
    </div>
    <div v-else-if="details === null" class="text-body-secondary">
      {{ t("chatsPanel.referenceUnknown", { forge: forgeName }) }}
    </div>
    <template v-else>
      <div v-if="excerpt !== ''" class="excerpt text-body-secondary">{{ excerpt }}</div>
      <div v-else class="text-body-secondary fst-italic">{{ t("chatsPanel.referenceNoDescription") }}</div>
      <div v-if="details.headBranch !== null" class="d-flex align-items-center gap-2">
        <span class="branch" :title="details.baseBranch ?? ''">{{ details.baseBranch }}</span>
        <Icon name="arrow-left" />
        <span class="branch" :title="details.headBranch">{{ details.headBranch }}</span>
      </div>
      <div v-else-if="details.labels.length > 0" class="d-flex flex-wrap gap-2">
        <span v-for="label in details.labels" :key="label.name" class="badge label" :style="labelStyle(label.color)">
          {{ label.name }}
        </span>
      </div>
      <div v-if="details.author !== null" class="d-flex align-items-center gap-2 text-body-secondary">
        <Icon name="person-circle" />
        {{
          t(reference.kind === "issue" ? "chatsPanel.referenceOpenedIssue" : "chatsPanel.referenceOpenedPullRequest", {
            author: details.author,
          })
        }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.heading { min-width: 0; }
.small-text { font-size: 0.85em; }
.state-done { background-color: #8957e5; }
.state-other { background-color: var(--bg-2); color: var(--fg-body); }
.excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; white-space: pre-line; }
.branch { max-width: 45%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0.15rem 0.5rem; border-radius: var(--radius-5); background-color: var(--bg-1); font-family: var(--font-mono, monospace); font-size: 0.85em; }
.label { border: 1px solid; }
.btn { --btn-hover-bg: var(--bg-2); --btn-active-bg: var(--bg-2); }
.btn:disabled { opacity: 0.45; }
</style>
