<script setup lang="ts">
// Bootstrap Icons glyph (https://icons.getbootstrap.com/). `name` is the Bootstrap Icons name without the `bi-` prefix.
defineProps<{ name: string }>();
</script>

<template>
  <i class="bi" :class="`bi-${name}`" aria-hidden="true"></i>
</template>
