<script setup lang="ts">
// A line of text on one line. A line that does not fit shows its beginning with an ellipsis. The functions `startScrolling`
// and `stopScrolling` of `lib/scroll_on_hover.ts` scroll it to its end while the pointer is over its row.
</script>

<template>
  <span class="scrolling-line" data-scroll><span class="scrolling-line-text"><slot /></span></span>
</template>

<style scoped>
.scrolling-line { display: block; overflow: hidden; }
.scrolling-line-text { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.scrolling-line.is-scrolling .scrolling-line-text {
  width: max-content;
  text-overflow: clip;
  transform: translateX(calc(-1 * var(--scroll-distance)));
  transition: transform var(--scroll-duration) linear var(--scroll-delay);
}
</style>
