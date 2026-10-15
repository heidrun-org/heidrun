<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import StackedBarChart from "./StackedBarChart.vue";
import { AI_COST_AGENT_IDS, AiCost, type AiCostAgentId, type AiCostItems } from "../lib/ai_cost";
import { CalendarDays } from "../lib/calendar_days";
import { costText } from "../lib/chat_usage";
import { findCodingAgent } from "../lib/coding_agents";
import { DayText } from "../lib/day_text";
import { UserActivity } from "../lib/user_activity";
import {
  PERSON_WORK_LONGEST_DAY_COUNT,
  PERSON_WORK_PERIODS,
  PersonWork,
  type PersonWorkItems,
  type PersonWorkPeriodId,
} from "../lib/person_work";
import type { StackedBarChartContent } from "../lib/stacked_bar_chart";
import { selectedWorkspaceFolder } from "../stores/user_activity";
import { locale, t } from "../i18n/index";

// The tab "Work of one person" of the Statistics window. A radio button group chooses the source of the bar chart: the Git
// history (the commits and the pull requests of one person, with the number of issues), or the AI cost (the estimated cost
// of the chats of each coding agent). Each source reads its data once, for the longest time range, the first time that it is
// shown, and cuts it again when the person or the time range changes.

/** The choices of the radio button group of the source, from left to right. */
const SOURCE_CHOICES = [
  { id: "git_history", labelKey: "statisticsModal.personWorkSourceGitHistory", titleKey: "statisticsModal.personWorkSourceGitHistoryTitle" },
  { id: "ai_cost", labelKey: "statisticsModal.personWorkSourceAiCost", titleKey: "statisticsModal.personWorkSourceAiCostTitle" },
] as const satisfies readonly { id: SourceId; labelKey: string; titleKey: string }[];

/** The choices of the radio button group of the time range, from left to right. */
const PERIOD_CHOICES = [
  { id: "seven_days", labelKey: "statisticsModal.personWorkSevenDays", titleKey: "statisticsModal.personWorkSevenDaysTitle" },
  { id: "thirty_days", labelKey: "statisticsModal.personWorkThirtyDays", titleKey: "statisticsModal.personWorkThirtyDaysTitle" },
] as const satisfies readonly { id: PersonWorkPeriodId; labelKey: string; titleKey: string }[];

/** The color of each coding agent in the chart of the AI cost, as the name of a CSS variable of the theme. */
const AI_COST_COLOR_TOKENS: Record<AiCostAgentId, string> = {
  claude: "--accent",
  codex: "--primary-bg",
};

/** The source of the bar chart: the Git history, or the AI cost. */
type SourceId = "git_history" | "ai_cost";

/** The folder of the selected workspace, or `null` when no workspace is selected. It is read once, when the tab opens. */
const folder = ref<string | null>(null);

/** The source of the bar chart. The tab starts with the Git history. */
const sourceId = ref<SourceId>("git_history");

/** The time range of the chart. The tab starts with the last seven days. */
const periodId = ref<PersonWorkPeriodId>("seven_days");

/** What the command `person_work_in_range` gave, or `null` while it reads. */
const items = ref<PersonWorkItems | null>(null);

/** The time of the read of the Git history, in milliseconds since 1 January 1970. The days of the chart follow it. */
const readAt = ref(0);

/** The identifier of the person of the chart, or `null` before the people are known. */
const personId = ref<string | null>(null);

const errorText = ref("");

/** What the command `ai_cost_in_range` gave, or `null` while it reads, and before the first time that the source is shown. */
const aiCostItems = ref<AiCostItems | null>(null);

/** The time of the read of the AI cost, in milliseconds since 1 January 1970. The days of the chart follow it. */
const aiCostReadAt = ref(0);

const aiCostErrorText = ref("");

/** True from the first time that the AI cost is shown. The tab reads the AI cost once. */
let hasRequestedAiCost = false;

/**
 * Writes a cost in US dollars. A cost of exactly zero is "$0.00": the text "Less than $0.01" of `costText` is for a small
 * cost that is not zero.
 */
function dollarsText(dollars: number): string {
  if (dollars === 0) {
    return (0).toLocaleString(locale.value, { style: "currency", currency: "USD" });
  }
  return costText(dollars);
}

/** The number of days of the chart. */
const dayCount = computed(() => PERSON_WORK_PERIODS[periodId.value].dayCount);

/** The people of the repository, the person with the most items first. */
const persons = computed(() => (items.value === null ? [] : PersonWork.findPersons(items.value)));

/** The person of the chart. */
const person = computed(() => persons.value.find((candidate) => candidate.id === personId.value) ?? null);

/** The days and the totals of the person in the time range, or `null` when there is no person. */
const result = computed(() => {
  if (items.value === null || person.value === null) {
    return null;
  }
  return PersonWork.compute(items.value, person.value.id, readAt.value, dayCount.value);
});

/** The three totals under the chooser, from left to right. */
const totals = computed(() => [
  { id: "commits", labelKey: "statisticsModal.personWorkCommits", value: result.value?.commitCount ?? 0 },
  { id: "pull-requests", labelKey: "statisticsModal.personWorkPullRequests", value: result.value?.pullRequestCount ?? 0 },
  { id: "issues", labelKey: "statisticsModal.personWorkIssues", value: result.value?.issueCount ?? 0 },
]);

/** The days and the totals of the AI cost in the time range, or `null` before the chats are read. */
const aiCostResult = computed(() => {
  if (aiCostItems.value === null) {
    return null;
  }
  return AiCost.compute(aiCostItems.value, aiCostReadAt.value, dayCount.value);
});

/** The totals of the AI cost under the chooser, from left to right: each coding agent, then the two together. */
const aiCostTotals = computed(() => [
  ...AI_COST_AGENT_IDS.map((agentId) => ({
    id: agentId,
    label: findCodingAgent(agentId)?.label ?? agentId,
    value: dollarsText(aiCostResult.value?.totalByAgent[agentId] ?? 0),
  })),
  { id: "total", label: t("statisticsModal.personWorkAiCostTotal"), value: dollarsText(aiCostResult.value?.totalCost ?? 0) },
]);

/** The bar chart of the Git history, or `null` when there is no person. */
const gitHistoryChart = computed<StackedBarChartContent | null>(() => {
  if (result.value === null || person.value === null) {
    return null;
  }
  const days = result.value.days;
  return {
    labels: days.map((day) => DayText.axis(day.startedAt, days.length)),
    series: [
      {
        name: t("statisticsModal.personWorkCommitsTrace"),
        colorToken: "--primary-bg",
        values: days.map((day) => day.commitCount),
        valueTexts: days.map((day) => String(day.commitCount)),
      },
      {
        name: t("statisticsModal.personWorkPullRequestsTrace"),
        colorToken: "--success-bg",
        values: days.map((day) => day.pullRequestCount),
        valueTexts: days.map((day) => String(day.pullRequestCount)),
      },
    ],
    titles: days.map((day) => DayText.cardTitle(day.startedAt)),
    totals: null,
    title: t("statisticsModal.personWorkChartTitle", { person: person.value.name }),
    horizontalAxisTitle: t("statisticsModal.personWorkHorizontalAxis"),
    verticalAxisTitle: t("statisticsModal.personWorkVerticalAxis"),
    verticalAxisUnit: "count",
    chartLabel: t("statisticsModal.personWorkChartLabel"),
  };
});

/** The bar chart of the AI cost, or `null` before the chats are read, or when no chat is in the time range. */
const aiCostChart = computed<StackedBarChartContent | null>(() => {
  if (aiCostResult.value === null || aiCostResult.value.chatCount === 0) {
    return null;
  }
  const days = aiCostResult.value.days;
  return {
    labels: days.map((day) => DayText.axis(day.startedAt, days.length)),
    series: AI_COST_AGENT_IDS.map((agentId) => ({
      name: findCodingAgent(agentId)?.label ?? agentId,
      colorToken: AI_COST_COLOR_TOKENS[agentId],
      values: days.map((day) => day.costByAgent[agentId]),
      valueTexts: days.map((day) => dollarsText(day.costByAgent[agentId])),
    })),
    titles: days.map((day) => DayText.cardTitle(day.startedAt)),
    totals: days.map((day) => dollarsText(AI_COST_AGENT_IDS.reduce((sum, agentId) => sum + day.costByAgent[agentId], 0))),
    title: t("statisticsModal.personWorkAiCostChartTitle"),
    horizontalAxisTitle: t("statisticsModal.personWorkHorizontalAxis"),
    verticalAxisTitle: t("statisticsModal.personWorkAiCostVerticalAxis"),
    verticalAxisUnit: "dollars",
    chartLabel: t("statisticsModal.personWorkAiCostChartLabel"),
  };
});

/** Gives the time range that both reads use: the longest time range, ending at the end of today. */
function longestRange(now: number): { since: string; until: string } {
  return {
    since: UserActivity.formatTime(CalendarDays.firstDayStartedAt(now, PERSON_WORK_LONGEST_DAY_COUNT)),
    until: UserActivity.formatTime(CalendarDays.endOfTodayAt(now)),
  };
}

/** Reads the commits, the pull requests, and the issues of the longest time range through the data layer. */
async function load() {
  folder.value = selectedWorkspaceFolder.value;
  if (folder.value === null) {
    return;
  }
  const now = Date.now();
  try {
    items.value = await invoke<PersonWorkItems>("person_work_in_range", { folder: folder.value, ...longestRange(now) });
    readAt.value = now;
  } catch (error) {
    errorText.value = String(error);
  }
}

/** Reads the chats of the longest time range, with their estimated cost. */
async function loadAiCost() {
  if (folder.value === null) {
    return;
  }
  const now = Date.now();
  try {
    aiCostItems.value = await invoke<AiCostItems>("ai_cost_in_range", { folder: folder.value, ...longestRange(now) });
    aiCostReadAt.value = now;
  } catch (error) {
    aiCostErrorText.value = String(error);
  }
}

// The person with the most items is chosen when the people are known, and a person that the list does not hold cannot stay chosen.
watch(persons, (list) => {
  if (list.some((candidate) => candidate.id === personId.value) === false) {
    personId.value = list[0]?.id ?? null;
  }
});

// The window does not read the chats before the developer asks for the AI cost.
watch(sourceId, (source) => {
  if (source === "ai_cost" && hasRequestedAiCost === false) {
    hasRequestedAiCost = true;
    void loadAiCost();
  }
});

onMounted(load);
</script>

<template>
  <div class="d-flex flex-column" style="height: 100%">
    <span v-if="folder === null" class="form-text">{{ t("statisticsModal.personWorkNoWorkspace") }}</span>
    <template v-else>
      <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div class="btn-group" role="group" :aria-label="t('statisticsModal.personWorkSourceLabel')">
          <label v-for="choice in SOURCE_CHOICES" :key="choice.id" class="btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
            <input
              :id="`statistics-person-source-${choice.id}`"
              v-model="sourceId"
              type="radio"
              name="statistics-person-source"
              autocomplete="off"
              :value="choice.id"
            />
            {{ t(choice.labelKey) }}
          </label>
        </div>
        <label v-if="sourceId === 'git_history' && persons.length > 0" class="d-flex align-items-center gap-2" for="statistics-person">
          <span>{{ t("statisticsModal.personWorkPersonLabel") }}</span>
          <select id="statistics-person" v-model="personId" class="form-control w-auto">
            <option v-for="candidate in persons" :key="candidate.id" :value="candidate.id">{{ candidate.name }}</option>
          </select>
        </label>
        <div class="btn-group" role="group" :aria-label="t('statisticsModal.rangeLabel')">
          <label v-for="choice in PERIOD_CHOICES" :key="choice.id" class="btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
            <input
              :id="`statistics-person-period-${choice.id}`"
              v-model="periodId"
              type="radio"
              name="statistics-person-period"
              autocomplete="off"
              :value="choice.id"
            />
            {{ t(choice.labelKey) }}
          </label>
        </div>
      </div>
      <template v-if="sourceId === 'git_history'">
        <div v-if="errorText !== ''" class="alert theme-danger" role="alert">{{ t("statisticsModal.personWorkLoadError", { error: errorText }) }}</div>
        <span v-else-if="items === null" class="form-text" role="status"><span class="spinner-border spinner-sm me-2" aria-hidden="true"></span>{{ t("statisticsModal.personWorkLoading") }}</span>
        <template v-else>
          <div v-if="items.codeHostingError !== null" class="alert theme-warning" role="alert">
            {{ t("statisticsModal.personWorkCodeHostingError", { error: items.codeHostingError }) }}
          </div>
          <span v-if="persons.length === 0" class="form-text">{{ t("statisticsModal.personWorkNoPerson") }}</span>
          <template v-else>
            <div class="d-flex flex-wrap gap-3 mb-3">
              <div v-for="total in totals" :key="total.id" :data-total="total.id" class="d-flex align-items-center gap-2">
                <span class="fs-4 fw-semibold">{{ total.value }}</span>
                <span class="form-text">{{ t(total.labelKey) }}</span>
              </div>
            </div>
            <div v-if="gitHistoryChart !== null" style="flex: 1 1 0; min-height: 240px">
              <StackedBarChart v-bind="gitHistoryChart" />
            </div>
          </template>
        </template>
      </template>
      <template v-else>
        <div v-if="aiCostErrorText !== ''" class="alert theme-danger" role="alert">
          {{ t("statisticsModal.personWorkAiCostLoadError", { error: aiCostErrorText }) }}
        </div>
        <span v-else-if="aiCostResult === null" class="form-text" role="status"><span class="spinner-border spinner-sm me-2" aria-hidden="true"></span>{{ t("statisticsModal.personWorkAiCostLoading") }}</span>
        <template v-else>
          <div class="d-flex flex-wrap gap-3 mb-3">
            <div v-for="total in aiCostTotals" :key="total.id" :data-total="total.id" class="d-flex align-items-center gap-2">
              <span class="fs-4 fw-semibold">{{ total.value }}</span>
              <span class="form-text">{{ total.label }}</span>
            </div>
          </div>
          <span v-if="aiCostResult.chatCount === 0" class="form-text">{{ t("statisticsModal.personWorkAiCostNone") }}</span>
          <div v-if="aiCostChart !== null" style="flex: 1 1 0; min-height: 240px">
            <StackedBarChart v-bind="aiCostChart" />
          </div>
          <span v-if="aiCostResult.chatWithoutPriceCount > 0" class="form-text" data-note="without-price">
            {{ t("statisticsModal.personWorkAiCostWithoutPrice", { count: aiCostResult.chatWithoutPriceCount }) }}
          </span>
        </template>
      </template>
    </template>
  </div>
</template>
