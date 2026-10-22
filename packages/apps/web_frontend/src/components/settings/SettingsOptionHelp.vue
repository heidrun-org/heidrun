<script setup lang="ts">
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import InformationCardContent from "../InformationCardContent.vue";
import { t } from "../../i18n/index";

// The circled question mark of an option of the Settings window, and the information card that it opens. The card has the
// layout of the option "Enable clustered dynamic topics": a heading with the name of the option, then one block for each
// subject, with a title in a medium weight and a text below. Every option of every section uses this component, so that the
// cards look the same. The test `settings_information_cards.test.ts` fails when an option has no card.
// - issue #608

defineProps<{
  /** The key of the text that names the option. It is the heading of the card and a part of the name for the screen reader. */
  titleKey: string;
  /** The blocks of the card, in order. Each block is the key of its title and the key of its text. */
  blocks: readonly { titleKey: string; textKey: string }[];
  /** The values of the markers `{name}` of the texts of the blocks, for example the name of a coding agent. */
  params?: Record<string, string | number>;
}>();
</script>

<template>
  <InformationCard :label="t('settingsHelp.label', { name: t(titleKey, params) })" placement="bottom-center">
    <span class="text-body-secondary" role="img" :aria-label="t('settingsHelp.label', { name: t(titleKey, params) })">
      <Icon name="question-circle" />
    </span>
    <template #card>
      <InformationCardContent
        :title="t(titleKey, params)"
        :blocks="blocks.map((block) => ({ title: t(block.titleKey, params), text: t(block.textKey, params) }))"
      />
    </template>
  </InformationCard>
</template>
