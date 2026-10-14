<script setup lang="ts">
import Icon from "./Icon.vue";

// The close button of a Bootstrap dialog: a big X, with no border and no background of its own. The click handler of the
// parent falls through to the button. The dialog title before it carries the class "me-auto", so the button stays at the end.

defineProps<{
  /** The text of the tooltip of the button. */
  title: string;
  /** The name of the button, for the screen reader. */
  label: string;
}>();
</script>

<template>
  <button type="button" class="btn border-0 fs-4" :title="title" :aria-label="label"><Icon name="x-lg" /></button>
</template>
