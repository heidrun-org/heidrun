<script setup lang="ts">
import { computed } from "vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import {
  DetectionCatalog,
  type CatalogCheck,
  type CatalogNeed,
  type CatalogOptions,
  type CatalogRule,
} from "../../lib/detection_catalog";
import { DETECTION_FAMILY_IDS, DetectionFamilies, type DetectionFamilyId } from "../../lib/detection_families";
import type { RefContext } from "../../lib/refs";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

// One detection family of the section Text detection: its switch, then each of its rules with the real patterns and with
// examples that are run through the real detection, in the project of the selected workspace.
// - issue #638

const props = defineProps<{
  /** The detection family that the card shows. */
  familyId: DetectionFamilyId;
  /** The repository and the project settings of the selected workspace. */
  context: RefContext;
  /** The slash commands that Claude Code knows in the folder of the selected workspace. */
  knownCommands: ReadonlySet<string>;
}>();

/** The families of the references: the key `enabled` of `references` in the project file turns them all off. */
const REFERENCE_FAMILIES: readonly DetectionFamilyId[] = ["issueReferences", "requestReferences", "tickets", "commits"];

/** The text of the project file that turns the tickets on. It is code, so it is not translated. */
const TICKETS_CONFIG_EXAMPLE = '{ "references": { "tickets": "https://acme.atlassian.net/browse/{key}" } }';

/** The text of the project file that turns the tickets on for some prefixes only. It is code, so it is not translated. */
const TICKETS_PREFIXES_CONFIG_EXAMPLE =
  '{ "references": { "tickets": { "url": "https://acme.atlassian.net/browse/{key}", "prefixes": ["ABC", "OPS"] } } }';

const family = computed(() => DetectionCatalog.FAMILIES.find((candidate) => candidate.id === props.familyId));

/** Every family is on: the examples show what the rule does, whatever the switches say. */
const options = computed<CatalogOptions>(() => ({
  context: props.context,
  knownCommands: props.knownCommands,
  agent: "claude",
  enabledFamilies: new Set(DETECTION_FAMILY_IDS),
}));

/** The blocks of the information card of the switch of the family, in the order of the card. */
const helpBlocks = computed(() => [
  { titleKey: "settingsHelp.whatTitle", textKey: `textDetection.family.${props.familyId}.what` },
  { titleKey: "settingsHelp.onTitle", textKey: `textDetection.family.${props.familyId}.on` },
  { titleKey: "settingsHelp.offTitle", textKey: `textDetection.family.${props.familyId}.off` },
]);

const isSwitchedOn = computed(() => settings.disabledDetectionFamilies.includes(props.familyId) === false);

const isWholeDetectionOff = computed(() => settings.terminalTextDetection === false);

/**
 * Saves the switch of the family.
 * @param isOn - True when the developer turned the family on.
 */
function setFamily(isOn: boolean): void {
  settings.disabledDetectionFamilies = DetectionFamilies.withFamily(settings.disabledDetectionFamilies, props.familyId, isOn);
}

/**
 * Tells which need of a rule the project of the selected workspace does not meet.
 * @param rule - The rule.
 * @returns The key of the text that explains the missing need, or null when the project meets every need.
 */
function unmetNeedKey(rule: CatalogRule): string | null {
  if (REFERENCE_FAMILIES.includes(props.familyId) && props.context.enabled === false) {
    return "textDetection.need.referencesOff";
  }
  const need: CatalogNeed | null = rule.need;
  if (need === null) {
    return null;
  }
  const isMet: Record<CatalogNeed, boolean> = {
    repository: props.context.base !== null,
    ticketAddress: props.context.ticketUrl !== null,
    gitlab: props.context.forge !== "github",
    knownCommands: props.knownCommands.size > 0,
  };
  return isMet[need] ? null : `textDetection.need.${need}`;
}

/**
 * Runs one example through the real detection.
 * @param example - The text of the example.
 * @param rule - The rule that the example belongs to.
 */
function check(example: string, rule: CatalogRule): CatalogCheck {
  return DetectionCatalog.check(example, props.familyId, rule.id, options.value);
}

/**
 * Tells in words what the detection did with an example in the project of the selected workspace.
 * @param example - The text of the example.
 * @param rule - The rule that the example belongs to.
 * @param isExpectedFound - True for an example that the rule must find, false for a refused example.
 */
function resultText(example: string, rule: CatalogRule, isExpectedFound: boolean): string {
  const answer = check(example, rule);
  if (answer.isFound === false) {
    return t(isExpectedFound ? "textDetection.example.notFoundHere" : "textDetection.example.nothingFound");
  }
  if (rule.id === "question") {
    return t("textDetection.example.question", { question: answer.text ?? "" });
  }
  if (rule.id === "choices") {
    return t("textDetection.example.choices", { count: answer.choiceCount ?? 0 });
  }
  const item = answer.item;
  const parts: string[] = [];
  if (answer.text !== example) {
    parts.push(t("textDetection.example.matches", { text: answer.text ?? "" }));
  }
  const buttons = item === null ? [] : [item.primary, item.secondary].filter((button) => button !== null);
  const buttonLabels = buttons.map((button) => t(button.labelKey, button.labelParams));
  if (buttonLabels.length > 0) {
    parts.push(buttonLabels.join(" / "));
  } else if (item !== null && item.commandClick !== null) {
    parts.push(t(`textDetection.action.${item.commandClick.type}`));
  }
  const destination = item === null ? null : item.destination;
  const isDestinationShown = destination === null || destination === answer.text || buttonLabels.some((label) => label.includes(destination));
  if (destination !== null && isDestinationShown === false) {
    parts.push(destination);
  }
  if (item !== null && item.commandClick === null) {
    parts.push(t("textDetection.example.noDestination"));
  }
  return parts.join(" · ");
}

/**
 * Writes the first letter of a text in a capital letter, for a rule name that is written to fit inside a sentence.
 * @param text - The text.
 */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
</script>

<template>
  <div
    v-if="family !== undefined"
    class="list-group"
    :class="{ 'opacity-50': isWholeDetectionOff }"
    data-option="detectionFamily"
    :data-family="familyId"
  >
    <div class="list-group-item d-flex flex-column gap-2">
      <SettingsSwitchRow
        :model-value="isSwitchedOn"
        :label="t(`textDetection.family.${familyId}.name`)"
        :is-disabled="isWholeDetectionOff"
        @update:model-value="setFamily"
      >
        <SettingsOptionHelp :title-key="`textDetection.family.${familyId}.name`" :blocks="helpBlocks" />
      </SettingsSwitchRow>
      <div>{{ t(`textDetection.family.${familyId}.what`) }}</div>
      <div v-if="familyId === 'tickets'" class="d-flex flex-column gap-1" data-field="tickets-setup">
        <div>{{ t("textDetection.tickets.setup") }}</div>
        <code class="text-break">{{ TICKETS_CONFIG_EXAMPLE }}</code>
        <div>{{ t("textDetection.tickets.setupPrefixes") }}</div>
        <code class="text-break">{{ TICKETS_PREFIXES_CONFIG_EXAMPLE }}</code>
      </div>
    </div>
    <div v-for="rule in family.rules" :key="rule.id" class="list-group-item d-flex flex-column gap-2" :data-rule="rule.id">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="fw-semibold" data-field="rule-name">{{ capitalize(t(`textDetection.rule.${rule.id}`)) }}</span>
        <span v-if="rule.pane !== 'any'" class="badge theme-secondary" data-field="pane">{{ t(`textDetection.pane.${rule.pane}`) }}</span>
      </div>
      <div>{{ t(`textDetection.ruleWhat.${rule.id}`) }}</div>
      <div v-if="unmetNeedKey(rule) !== null" class="text-warning-emphasis" data-need>{{ t(unmetNeedKey(rule) ?? "") }}</div>
      <div v-for="pattern in rule.patterns" :key="pattern.id" class="d-flex flex-column gap-1" data-pattern>
        <span class="text-body-secondary">{{ t("textDetection.pattern.label") }} · {{ t(`textDetection.pattern.${pattern.id}`) }}</span>
        <code class="text-break">{{ pattern.regex.toString() }}</code>
      </div>
      <div class="d-flex flex-column gap-2">
        <div
          v-for="example in [...rule.found.map((text) => ({ text, isFound: true })), ...rule.notFound.map((text) => ({ text, isFound: false }))]"
          :key="`${example.isFound}-${example.text}`"
          class="d-flex align-items-baseline gap-2 flex-wrap"
          :data-example="example.isFound ? 'found' : 'refused'"
        >
          <span class="fw-medium" :class="example.isFound ? 'text-success-emphasis' : 'text-danger-emphasis'">
            {{ t(example.isFound ? "textDetection.example.found" : "textDetection.example.refused") }}
          </span>
          <pre v-if="example.text.includes('\n')" class="m-0 font-monospace" data-example-text>{{ example.text }}</pre>
          <code v-else class="text-break" data-example-text>{{ example.text }}</code>
          <span class="text-body-secondary" data-example-result>→ {{ resultText(example.text, rule, example.isFound) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
