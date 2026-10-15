<script setup lang="ts">
// Bootstrap Icons glyph (https://icons.getbootstrap.com/). `name` is the Bootstrap Icons name without the `bi-` prefix.
// The name `heidrun-goat-only` is the icon of Heidrun, the goat: its paths are the ones of `data/images/heidrun_icon_goat_only.svg`,
// drawn in the way of the Bootstrap Icons, so it takes the color and the size of the text around it.
defineProps<{ name: string }>();
</script>

<template>
  <svg
    v-if="name === 'heidrun-goat-only'"
    class="bi bi-heidrun-goat-only"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M9.506 8.064L9.506 6.676C9.229 0.295 3.68 -0.815 1.182 3.902C3.402 1.127 6.454 1.959 7.287 6.954L7.287 8.064Z" />
    <path d="M7.12 7.894L3.006 6.029L5.233 9.621Z" />
    <path
      fill-rule="evenodd"
      d="M14.778 10.838Q15.055 9.451 13.391 8.341L10.061 5.844Q7.564 5.011 5.899 6.954L3.957 11.948L4.512 14.723L7.287 14.723L8.396 12.225Q10.616 12.78 12.558 12.225Q14.5 12.225 14.778 10.838ZM10.561 8.896a0.61 0.61 0 1 0 1.221 0a0.61 0.61 0 1 0 -1.221 0z"
    />
    <path d="M11.448 11.393L11.448 12.503Q11.31 13.89 12.281 15Q13.252 13.89 13.113 12.225L13.113 11.393Z" />
  </svg>
  <i v-else class="bi" :class="`bi-${name}`" aria-hidden="true"></i>
</template>

<style scoped>
.bi-heidrun-goat-only { vertical-align: -0.125em; }
</style>
