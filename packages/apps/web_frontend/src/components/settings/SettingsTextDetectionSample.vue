<script setup lang="ts">
import { computed, ref, useId } from "vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import { DetectionFamilies, type DetectionFamilyId } from "../../lib/detection_families";
import type { RefContext } from "../../lib/refs";
import { TerminalDetection, type DetectedItem } from "../../lib/terminal_detection";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

// The field "Try a text" of the section Text detection. It reads the sample with the same function as the terminals,
// `TerminalDetection.detectText`, so what it shows is what a terminal does. It runs no action.
// - issue #638

const props = defineProps<{
  /** The repository and the project settings of the selected workspace. */
  context: RefContext;
  /** The slash commands that Claude Code knows in the folder of the selected workspace. */
  knownCommands: ReadonlySet<string>;
}>();

/** The blocks of the information card of the field "Try a text", in the order of the card. */
const SAMPLE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "textDetection.sample.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "textDetection.sample.how" },
] as const;

/** The kinds of pane that the field "Try a text" can pretend, in the order of the choices. */
const PRETENDED_PANES = [
  { id: "plain", labelKey: "textDetection.sample.agent.plain" },
  { id: "claude", labelKey: "textDetection.sample.agent.claude" },
  { id: "codex", labelKey: "textDetection.sample.agent.codex" },
] as const;

const sampleId = useId();
const pretendedPaneId = useId();

/** The sample text that the developer types. It is not saved. */
const sampleText = ref("");

/** The kind of pane that the field pretends. Claude Code allows every family. */
const pretendedPane = ref<(typeof PRETENDED_PANES)[number]["id"]>("claude");

const detection = computed(() => {
  if (sampleText.value.trim() === "") {
    return null;
  }
  return TerminalDetection.detectText(sampleText.value, {
    context: props.context,
    knownCommands: props.knownCommands,
    agent: pretendedPane.value === "plain" ? null : pretendedPane.value,
    enabledFamilies: DetectionFamilies.listEnabled(settings),
  });
});

const isNothingFound = computed(() => {
  const found = detection.value;
  if (found === null) {
    return false;
  }
  const hasPieces = found.lines.some((line) => line.items.length > 0 || line.suppressed.length > 0);
  const hasScreenPieces = found.screen !== null && (found.screen.question !== null || found.screen.choices !== null);
  return hasPieces === false && hasScreenPieces === false;
});

/**
 * The name of a detection family.
 * @param familyId - The detection family.
 */
function familyName(familyId: DetectionFamilyId): string {
  return t(`textDetection.family.${familyId}.name`);
}

/**
 * The text that tells which hover buttons a found piece of text gets.
 * @param item - The found piece of text.
 */
function buttonsText(item: DetectedItem): string {
  return [item.primary, item.secondary]
    .filter((button) => button !== null)
    .map((button) => t(button.labelKey, button.labelParams))
    .join("  ·  ");
}

/**
 * The text that tells what a ⌘-click on a found piece of text does.
 * @param item - The found piece of text.
 */
function commandClickText(item: DetectedItem): string {
  return item.commandClick === null ? "" : t(`textDetection.action.${item.commandClick.type}`);
}
</script>

<template>
  <div class="d-flex flex-column gap-2" data-option="textDetectionSample">
    <div class="d-flex align-items-center gap-2">
      <label class="form-label m-0" :for="sampleId">{{ t("textDetection.sample.name") }}</label>
      <SettingsOptionHelp title-key="textDetection.sample.name" :blocks="SAMPLE_HELP_BLOCKS" />
    </div>
    <textarea
      :id="sampleId"
      v-model="sampleText"
      class="form-control mono"
      rows="3"
      spellcheck="false"
      :placeholder="t('textDetection.sample.placeholder')"
    ></textarea>
    <div class="d-flex align-items-center gap-2">
      <label class="form-label m-0" :for="pretendedPaneId">{{ t("textDetection.sample.agentLabel") }}</label>
      <select :id="pretendedPaneId" v-model="pretendedPane" class="form-control w-auto">
        <option v-for="pane in PRETENDED_PANES" :key="pane.id" :value="pane.id">{{ t(pane.labelKey) }}</option>
      </select>
    </div>
    <div class="form-text">
      {{ context.base === null ? t("textDetection.sample.noRepository") : t("textDetection.sample.repository", { address: context.base }) }}
    </div>
    <div v-if="isNothingFound" class="form-text" data-sample-nothing>{{ t("textDetection.sample.nothing") }}</div>
    <ul v-if="detection !== null && isNothingFound === false" class="list-group" data-sample-result>
      <template v-for="line in detection.lines" :key="line.number">
        <li
          v-for="item in line.items"
          :key="`${line.number}-${item.start}-${item.family}-${item.rule}`"
          class="list-group-item d-flex flex-column gap-1"
          :class="{ 'text-body-secondary': item.isEnabled === false }"
          data-sample-item
        >
          <div>
            <span class="fw-semibold mono">{{ item.text }}</span>
            <span class="text-body-secondary">
              · {{ t("textDetection.sample.line", { number: line.number }) }} ·
              {{ t("textDetection.sample.range", { start: item.start + 1, end: item.end }) }}
            </span>
          </div>
          <div>
            {{ t("textDetection.sample.family", { family: familyName(item.family) }) }} ·
            {{ t("textDetection.sample.rule", { rule: t(`textDetection.rule.${item.rule}`) }) }}
          </div>
          <div v-if="item.destination !== null">{{ t("textDetection.sample.destination", { destination: item.destination }) }}</div>
          <div v-if="item.repository !== null">{{ t("textDetection.sample.repositoryNamed", { repository: item.repository }) }}</div>
          <div v-if="item.primary !== null">{{ t("textDetection.sample.buttons", { buttons: buttonsText(item) }) }}</div>
          <div v-if="item.commandClick !== null">{{ t("textDetection.sample.commandClick", { action: commandClickText(item) }) }}</div>
          <div v-if="item.isEnabled === false">{{ t("textDetection.sample.isOff") }}</div>
          <div v-else-if="item.commandClick === null">{{ t("textDetection.sample.noAction") }}</div>
        </li>
        <li
          v-for="lost in line.suppressed"
          :key="`${line.number}-${lost.start}-${lost.family}-${lost.rule}-lost`"
          class="list-group-item text-body-secondary"
          data-sample-suppressed
        >
          {{ t("textDetection.sample.line", { number: line.number }) }} ·
          {{
            t("textDetection.sample.suppressed", {
              text: lost.text,
              family: familyName(lost.family),
              rule: t(`textDetection.rule.${lost.rule}`),
              winnerFamily: familyName(lost.byFamily),
              winnerRule: t(`textDetection.rule.${lost.byRule}`),
            })
          }}
        </li>
      </template>
      <li
        v-if="detection.screen !== null && detection.screen.question !== null"
        class="list-group-item"
        :class="{ 'text-body-secondary': detection.screen.isEnabled === false }"
      >
        {{ t("textDetection.sample.question", { question: detection.screen.question }) }}
        <div v-if="detection.screen.isEnabled === false">{{ t("textDetection.sample.isOff") }}</div>
      </li>
      <li
        v-if="detection.screen !== null && detection.screen.choices !== null"
        class="list-group-item"
        :class="{ 'text-body-secondary': detection.screen.isEnabled === false }"
      >
        {{ t("textDetection.sample.choices", { count: detection.screen.choices.options.length }) }}
        <div v-if="detection.screen.isEnabled === false">{{ t("textDetection.sample.isOff") }}</div>
      </li>
    </ul>
  </div>
</template>
