<script setup lang="ts">
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { languageModelStatus } from "../../stores/language_model_topics";
import { settings } from "../../stores/settings";
import { rebuildTopicClusters, topicClusterStatus } from "../../stores/topic_clusters";
import { t } from "../../i18n/index";

/** The two methods that compute the dynamic topics, in the order of the buttons. */
const EXTRACTIONS = [
  { id: "keyword", labelKey: "settingsDynamicTopics.keywordLabel", titleKey: "settingsDynamicTopics.keywordTitle" },
  { id: "languageModel", labelKey: "settingsDynamicTopics.languageModelLabel", titleKey: "settingsDynamicTopics.languageModelTitle" },
] as const;

/** The three blocks of the information card of the clustered dynamic topics, in the order of the card. */
const CLUSTERED_HELP_BLOCKS = [
  { titleKey: "settingsDynamicTopics.clusteredWhatTitle", textKey: "settingsDynamicTopics.clusteredWhatHelp" },
  { titleKey: "settingsDynamicTopics.clusteredSentTitle", textKey: "settingsDynamicTopics.clusteredSentHelp" },
  { titleKey: "settingsDynamicTopics.clusteredOffTitle", textKey: "settingsDynamicTopics.clusteredOffHelp" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <SettingsSwitchRow v-model="settings.dynamicTopics" :label="t('settingsDynamicTopics.enableLabel')" />

    <div class="d-flex flex-column gap-2">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("settingsDynamicTopics.extractionTitle") }}</h4>
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
      <div class="btn-group" role="group" :aria-label="t('settingsDynamicTopics.extractionLabel')">
        <label v-for="method in EXTRACTIONS" :key="method.id" class="btn-check btn-outline theme-secondary" :title="t(method.titleKey)">
          <input v-model="settings.dynamicTopicExtraction" type="radio" name="dynamic-topic-extraction" autocomplete="off" :value="method.id" />
          {{ t(method.labelKey) }}
        </label>
      </div>
      <div v-if="settings.dynamicTopicExtraction === 'languageModel' && languageModelStatus.error !== null" class="form-text" role="status">
        {{ t(`settingsDynamicTopics.languageModelError.${languageModelStatus.error}`) }}
      </div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsDynamicTopics.clusteredTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.clusteredDynamicTopics" :label="t('settingsDynamicTopics.clusteredLabel')">
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
      </SettingsSwitchRow>
      <button
        type="button"
        class="btn align-self-start"
        :class="{ 'opacity-50': settings.clusteredDynamicTopics === false || topicClusterStatus.isRunning }"
        :title="t('settingsDynamicTopics.rebuildTitle')"
        :disabled="settings.clusteredDynamicTopics === false || topicClusterStatus.isRunning"
        @click="rebuildTopicClusters()"
      >
        <span v-if="topicClusterStatus.isRunning" class="spinner-border spinner-sm" aria-hidden="true"></span>
        {{ t("settingsDynamicTopics.rebuildLabel") }}
      </button>
      <div v-if="settings.clusteredDynamicTopics && topicClusterStatus.error !== null" class="form-text" role="status">
        {{ t(`settingsDynamicTopics.error.${topicClusterStatus.error}`) }}
      </div>
    </div>
  </div>
</template>
