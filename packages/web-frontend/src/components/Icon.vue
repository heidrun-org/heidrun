<script setup lang="ts">
// Small stroke icons, drawn inline so they follow the text colour.
defineProps<{ name: "split-right" | "split-down" | "close" | "panel-left" | "panel-right" | "text" }>();
</script>

<template>
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'split-right'">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"></rect>
      <path d="M8 2.75v10.5"></path>
    </template>
    <template v-else-if="name === 'split-down'">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"></rect>
      <path d="M1.75 8h12.5"></path>
    </template>
    <template v-else-if="name === 'close'">
      <path d="M4 4l8 8M12 4l-8 8"></path>
    </template>
    <template v-else-if="name === 'panel-left'">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"></rect>
      <path d="M6 2.75v10.5"></path>
    </template>
    <template v-else-if="name === 'panel-right'">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"></rect>
      <path d="M10 2.75v10.5"></path>
    </template>
    <template v-else-if="name === 'text'">
      <path d="M2.5 12.5L6 3.5l3.5 9M3.8 9.5h4.4M10.5 12.5l2-5 2 5M11.1 11h2.8"></path>
    </template>
  </svg>
</template>
