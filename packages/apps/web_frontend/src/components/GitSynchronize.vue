<script setup lang="ts">
import { computed, ref } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import { currentGit } from "../stores/git";
import { synchronize, runSynchronize } from "../stores/git_synchronize";
import { useStatusCard } from "../lib/status_card";
import { branchUrl, webOfRemote } from "../lib/refs";
import { t } from "../i18n/index";
import Icon from "./Icon.vue";

// The synchronize zone of the Git status bar section: the turning-arrows icon, like "Synchronize Changes" of Visual Studio
// Code. A click on it opens its information card and starts the synchronization with the upstream branch, as "Synchronize
// Changes" of Visual Studio Code does: the upstream branch is fetched, merged into the current branch, then the new commits are pushed. The next click closes the card. A branch without upstream branch has
// the icon faded, and the card says why, and nothing starts.
// - issue #348
const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, close, onFocusOut } = useStatusCard(root);

/** True when the current branch has an upstream branch to merge. */
const hasUpstream = computed(() => currentGit.value?.upstream !== null && currentGit.value?.upstream !== undefined);

// The width of the card, in pixels: the same as the card of the usage of Claude, so the sentences have room.
const CARD_WIDTH_PIXELS = 408;
const cardStyle = { width: `${CARD_WIDTH_PIXELS}px`, "--popover-max-width": `${CARD_WIDTH_PIXELS}px` };

/** The marker of the name of the upstream branch in the texts. */
const UPSTREAM_MARKER = "{upstream}";

/** One sentence of the card, cut in two around the name of the upstream branch, which is a link when the forge is known. */
interface Sentence {
  /** The name of the `data-field` of the sentence. */
  field: string;
  /** The text before the name of the upstream branch. */
  before: string;
  /** The text after the name of the upstream branch. */
  after: string;
  /** The name of the upstream branch, for example `origin/dev_jerome`. */
  upstream: string;
}

/** The address of the page of the upstream branch on the forge, or null when the remote is unknown. The remote name is cut. */
function upstreamPage(upstream: string): string | null {
  const web = webOfRemote(currentGit.value?.remote ?? null);
  if (web === null) {
    return null;
  }
  const branchName = upstream.includes("/") ? upstream.slice(upstream.indexOf("/") + 1) : upstream;
  return branchUrl(web.base, web.forge, branchName);
}

/** Opens the page of the upstream branch on the forge in the web browser. */
async function openUpstreamPage(upstream: string) {
  const address = upstreamPage(upstream);
  if (address !== null) {
    await openUrl(address).catch(() => {});
  }
}

/** Cuts a text at the marker of the upstream branch. */
function sentenceOf(field: string, key: string, upstream: string, params: Record<string, string | number>): Sentence {
  const [before, after] = t(key, params).split(UPSTREAM_MARKER);
  return { field, before: before ?? "", after: after ?? "", upstream };
}

/** The sentences of the card for the state of the synchronization: busy, then the merge result, then the push result. */
const sentences = computed<Sentence[]>(() => {
  const upstream = currentGit.value?.upstream ?? "";
  if (synchronize.isBusy === true) {
    return [sentenceOf("synchronize-busy", "statusBar.gitSynchronizeBusy", upstream, {})];
  }
  const result = synchronize.result;
  if (synchronize.error !== null || result === null) {
    return [];
  }
  if (result.outcome === "conflict") {
    return [sentenceOf("synchronize-conflict", "statusBar.gitSynchronizeConflict", result.upstream, { count: result.conflicts.length })];
  }
  const list: Sentence[] = [];
  if (result.outcome === "merged") {
    list.push(sentenceOf("synchronize-merged", "statusBar.gitSynchronizeMerged", result.upstream, { branch: currentGit.value?.branch ?? "" }));
  } else {
    list.push(sentenceOf("synchronize-up-to-date", "statusBar.gitSynchronizeUpToDate", result.upstream, {}));
  }
  if (result.pushed > 0) {
    list.push(sentenceOf("synchronize-pushed", "statusBar.gitSynchronizePushed", result.upstream, { count: result.pushed }));
  }
  return list;
});

/** Opens the card and starts the synchronization, or closes the card when it is open. */
function onClick() {
  if (isOpen.value === true) {
    close();
    return;
  }
  toggle();
  if (hasUpstream.value === true) {
    void runSynchronize();
  }
}
</script>

<template>
  <div
    ref="root"
    class="git-synchronize-zone status-section d-flex align-items-center"
    :class="{ show: isOpen, 'git-synchronize-zone-disabled': hasUpstream === false }"
    role="button"
    tabindex="0"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
    :aria-disabled="hasUpstream === false"
    :title="isOpen ? undefined : t('statusBar.gitSynchronizeTitle')"
    @click="onClick"
    @keydown.enter.self.prevent="onClick"
    @keydown.space.self.prevent="onClick"
    @focusout="onFocusOut"
  >
    <span v-if="synchronize.isBusy" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
    <Icon v-else name="arrow-repeat" />
    <div
      v-if="isOpen"
      class="popover popover-instant show bs-popover-top position-absolute bottom-100"
      :style="cardStyle"
      role="dialog"
      :aria-label="t('statusBar.gitSynchronizeTitle')"
      @click.stop
    >
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-2" data-field="synchronize-card">
        <span v-if="hasUpstream === false" data-field="synchronize-no-upstream">{{ t("statusBar.gitSynchronizeNoUpstream") }}</span>
        <div v-else-if="synchronize.error !== null" class="alert theme-danger text-break" data-field="synchronize-error">
          {{ synchronize.error }}
        </div>
        <template v-else>
        <span v-for="sentence in sentences" :key="sentence.field" :data-field="sentence.field">
          {{ sentence.before }}<a
            v-if="upstreamPage(sentence.upstream) !== null"
            :href="upstreamPage(sentence.upstream) ?? undefined"
            data-field="synchronize-upstream-link"
            @click.prevent="openUpstreamPage(sentence.upstream)"
          >{{ sentence.upstream }}</a><template v-else>{{ sentence.upstream }}</template>{{ sentence.after }}
        </span>
        <div
          v-if="synchronize.isBusy === false && synchronize.result?.push_error"
          class="alert theme-danger text-break"
          data-field="synchronize-push-error"
        >
          {{ t("statusBar.gitSynchronizePushFailed") }} {{ synchronize.result.push_error }}
        </div>
        </template>
        <template v-if="synchronize.isBusy === false && synchronize.error === null && synchronize.result?.outcome === 'conflict'">
          <ul class="list-unstyled mb-0 text-break" data-field="synchronize-conflict-files">
            <li v-for="path in synchronize.result.conflicts" :key="path">{{ path }}</li>
          </ul>
          <span class="text-body-secondary">{{ t("statusBar.gitSynchronizeConflictHelp") }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The zone is in the middle of a button group: it has no round corner. Both sides keep 4 pixels of background, and the two
   other zones touch it. */
.git-synchronize-zone { margin: 6px -4px; padding: 0 4px; border-radius: 0; }
/* The synchronization cannot start without upstream branch: the icon fades itself, because the application never fades a disabled control. */
.git-synchronize-zone-disabled { opacity: 0.35; }
</style>
