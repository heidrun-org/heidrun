<script setup lang="ts">
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import { SKILLS_HELP_BLOCKS, type SkillsHelpTopic } from "./skills_help";
import { t } from "../../i18n/index";

// The circled question mark of a line of the window Find new skills, and the information card that a click on it opens: the
// title of the line, then one block for each paragraph of its help. The layout is the one of the information cards of the
// Settings window. The texts are described in `skills_help.ts`.

defineProps<{
  /** The line that the card explains. */
  topic: SkillsHelpTopic;
}>();
</script>

<template>
  <InformationCard :label="t(`settingsSkills.help_${topic}_label`)" placement="bottom">
    <span class="text-body-secondary" role="img" :aria-label="t(`settingsSkills.help_${topic}_label`)">
      <Icon name="question-circle" />
    </span>
    <template #card>
      <div class="list-group list-group-flush">
        <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
          <Icon name="question-circle" />
          {{ t(`settingsSkills.help_${topic}_title`) }}
        </div>
        <div v-for="block in SKILLS_HELP_BLOCKS[topic]" :key="block" class="list-group-item" data-help-block>
          <div class="fw-medium">{{ t(`settingsSkills.help_${topic}_${block}_title`) }}</div>
          <div class="text-body-secondary">{{ t(`settingsSkills.help_${topic}_${block}_text`) }}</div>
        </div>
      </div>
    </template>
  </InformationCard>
</template>
