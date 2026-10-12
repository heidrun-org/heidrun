<script setup lang="ts">
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import { settings } from "../../stores/settings";
import { rebuildTopicClusters, topicClusterStatus } from "../../stores/topic_clusters";
import { t } from "../../i18n/index";

/**
 * The two methods that compute the dynamic topics, in the order of the buttons. The method "languageModel" is not ready
 * yet, so its button is disabled.
 */
const EXTRACTIONS = [
  { id: "keyword", labelKey: "settingsDynamicTopics.keywordLabel", titleKey: "settingsDynamicTopics.keywordTitle", isDisabled: false },
  {
    id: "languageModel",
    labelKey: "settingsDynamicTopics.languageModelLabel",
    titleKey: "settingsDynamicTopics.languageModelTitle",
    isDisabled: true,
  },
] as const;

/** The three blocks of the information card of the clustered dynamic topics, in the order of the card. */
const CLUSTERED_HELP_BLOCKS = [
  { titleKey: "settingsDynamicTopics.clusteredWhatTitle", textKey: "settingsDynamicTopics.clusteredWhatHelp" },
  { titleKey: "settingsDynamicTopics.clusteredSentTitle", textKey: "settingsDynamicTopics.clusteredSentHelp" },
  { titleKey: "settingsDynamicTopics.clusteredOffTitle", textKey: "settingsDynamicTopics.clusteredOffHelp" },
] as const;
</script>

<template>
  <div class="section">
    <div class="d-flex align-items-center gap-2">
      <h4>{{ t("settingsDynamicTopics.extractionTitle") }}</h4>
      <InformationCard :label="t('settingsDynamicTopics.extractionHelpLabel')" placement="bottom">
        <span class="text-body-secondary" role="img" :aria-label="t('settingsDynamicTopics.extractionHelpLabel')">
          <Icon name="question-circle" />
        </span>
        <template #card>
          <div class="list-group list-group-flush">
            <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
              <Icon name="question-circle" />
              {{ t("settingsDynamicTopics.extractionTitle") }}
            </div>
            <div class="list-group-item" data-help-block>
              <div class="fw-medium">{{ t("settingsDynamicTopics.keywordLabel") }}</div>
              <div class="text-body-secondary">{{ t("settingsDynamicTopics.keywordHelp") }}</div>
            </div>
            <div class="list-group-item" data-help-block>
              <div class="fw-medium">{{ t("settingsDynamicTopics.languageModelLabel") }}</div>
              <div class="text-body-secondary">{{ t("settingsDynamicTopics.languageModelHelp") }}</div>
            </div>
          </div>
        </template>
      </InformationCard>
    </div>
    <div class="seg" role="radiogroup" :aria-label="t('settingsDynamicTopics.extractionLabel')">
      <button
        v-for="method in EXTRACTIONS"
        :key="method.id"
        role="radio"
        :title="t(method.titleKey)"
        :aria-checked="settings.dynamicTopicExtraction === method.id"
        :class="{ on: settings.dynamicTopicExtraction === method.id }"
        :disabled="method.isDisabled"
        @click="settings.dynamicTopicExtraction = method.id"
      >
        {{ t(method.labelKey) }}
      </button>
    </div>

    <h4>{{ t("settingsDynamicTopics.clusteredTitle") }}</h4>
    <div class="d-flex align-items-center gap-2">
      <div class="form-check form-switch mb-0">
        <input
          id="clustered-dynamic-topics"
          v-model="settings.clusteredDynamicTopics"
          class="form-check-input"
          type="checkbox"
          role="switch"
        />
        <label class="form-check-label" for="clustered-dynamic-topics">{{ t("settingsDynamicTopics.clusteredLabel") }}</label>
      </div>
      <InformationCard :label="t('settingsDynamicTopics.clusteredHelpLabel')" placement="bottom">
        <span class="text-body-secondary" role="img" :aria-label="t('settingsDynamicTopics.clusteredHelpLabel')">
          <Icon name="question-circle" />
        </span>
        <template #card>
          <div class="list-group list-group-flush">
            <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
              <Icon name="question-circle" />
              {{ t("settingsDynamicTopics.clusteredTitle") }}
            </div>
            <div v-for="block in CLUSTERED_HELP_BLOCKS" :key="block.titleKey" class="list-group-item" data-help-block>
              <div class="fw-medium">{{ t(block.titleKey) }}</div>
              <div class="text-body-secondary">{{ t(block.textKey) }}</div>
            </div>
          </div>
        </template>
      </InformationCard>
    </div>
    <div class="rebuild">
      <button
        type="button"
        class="btn"
        :title="t('settingsDynamicTopics.rebuildTitle')"
        :disabled="settings.clusteredDynamicTopics === false || topicClusterStatus.isRunning"
        @click="rebuildTopicClusters()"
      >
        <span v-if="topicClusterStatus.isRunning" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        {{ t("settingsDynamicTopics.rebuildLabel") }}
      </button>
    </div>
    <div v-if="settings.clusteredDynamicTopics && topicClusterStatus.error !== null" class="keys" role="status">
      {{ t(`settingsDynamicTopics.error.${topicClusterStatus.error}`) }}
    </div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
h4 { margin: 0; font-size: var(--font-size); font-weight: 600; color: var(--text-2); }
.seg button:disabled { opacity: 0.45; }
.rebuild { display: flex; align-items: center; gap: 8px; }
.btn:disabled { opacity: 0.45; }
</style>
