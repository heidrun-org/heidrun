<script setup lang="ts">
import Icon from "../../Icon.vue";

defineProps<{
  /** True when the content below the heading is shown. */
  open: boolean;
  heading: string;
}>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button class="fold" :aria-expanded="open" @click="$emit('toggle')">
    <Icon :name="open ? 'chevron-down' : 'chevron-right'" />
    <span>{{ heading }}</span>
  </button>
  <template v-if="open">
    <slot />
  </template>
</template>

<style scoped>
.fold { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 0; background: transparent; border: 0; color: var(--text); font-size: var(--font-size); font-weight: 600; text-align: left; cursor: pointer; }
.fold :deep(.bi) { color: var(--muted); }
</style>
