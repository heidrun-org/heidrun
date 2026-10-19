<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';
import Icon from './Icon.vue';
import InformationCard from './InformationCard.vue';
import type { Forge } from '../lib/refs';
import { t } from '../i18n/index';

defineProps<{
	/** The hosting service of the selected repository. */
	forge: Forge;
	/** The translated name of the list whose search is explained. */
	title: string;
	/** Whether the list contains pull requests or merge requests. */
	isRequests: boolean;
}>();

/** The full GitHub search documentation requested in issue #741. */
const GITHUB_SEARCH_DOCUMENTATION = 'https://docs.github.com/en/issues/tracking-your-work-with-issues/'
	+ 'using-issues/filtering-and-searching-issues-and-pull-requests';
</script>

<template>
  <InformationCard
    :label="t('codeHostingPanel.help.label', { name: title })"
    placement="bottom-center"
    width="26rem"
    tabindex="-1"
  >
    <button
      type="button"
      class="btn search-help-button text-body-secondary"
      data-search-help
      :aria-label="t('codeHostingPanel.help.label', { name: title })"
      :title="t('codeHostingPanel.help.label', { name: title })"
    >
      <Icon name="question-circle" />
    </button>
    <template #card>
      <div class="list-group list-group-flush">
        <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
          <Icon name="question-circle" />
          {{ t(`codeHostingPanel.help.${forge}.title`, { name: title }) }}
        </div>
        <div class="list-group-item text-body-secondary">
          {{ t('codeHostingPanel.help.run', { name: title }) }}
        </div>
        <template v-if="forge === 'gitlab'">
          <div class="list-group-item">
            <div class="fw-medium">{{ t('codeHostingPanel.help.gitlab.supportedTitle') }}</div>
            <div class="text-body-secondary">{{ t('codeHostingPanel.help.gitlab.supported') }}</div>
            <div v-if="isRequests" class="text-body-secondary">
              {{ t('codeHostingPanel.help.gitlab.reviews') }}
            </div>
          </div>
          <div class="list-group-item">
            <div class="fw-medium">{{ t('codeHostingPanel.help.gitlab.limitsTitle') }}</div>
            <div class="text-body-secondary">{{ t('codeHostingPanel.help.gitlab.limits') }}</div>
          </div>
        </template>
        <div v-else class="list-group-item">
          <a :href="GITHUB_SEARCH_DOCUMENTATION" @click.prevent="openUrl(GITHUB_SEARCH_DOCUMENTATION)">
            {{ t('codeHostingPanel.help.github.documentation') }}
          </a>
        </div>
      </div>
    </template>
  </InformationCard>
</template>

<style scoped>
.search-help-button { font-size: 0.75em; line-height: 1; padding: 0 2px; border: none; }
</style>
