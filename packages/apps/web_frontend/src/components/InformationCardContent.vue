<script setup lang="ts">
import Icon from "./Icon.vue";

// The content of an information card: a heading with the circled question mark and the title, then one block for each
// subject, with a title in a medium weight and a text below. The card of every option of the Settings window and the card
// of every tab button of the Statistics window use this component, so that all these cards look the same. The card has no
// padding of its own besides the Bootstrap list group.
// - issue #608
// - issue #629

defineProps<{
  /** The heading of the card. */
  title: string;
  /** The blocks of the card, in order. Each block has a title and a text. */
  blocks: readonly { title: string; text: string }[];
}>();
</script>

<template>
  <div class="list-group list-group-flush">
    <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
      <Icon name="question-circle" />
      {{ title }}
    </div>
    <div v-for="block in blocks" :key="block.title + block.text" class="list-group-item" data-help-block>
      <div class="fw-medium">{{ block.title }}</div>
      <div class="text-body-secondary text-break">{{ block.text }}</div>
    </div>
  </div>
</template>
