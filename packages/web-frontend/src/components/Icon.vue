<script setup lang="ts">
// Small icons, drawn inline so they follow the text colour. "pin" and "pin-fill" come from Bootstrap Icons (MIT).
defineProps<{ name: "split-right" | "split-down" | "close" | "panel-left" | "panel-right" | "text" | "pin" | "pin-fill" }>();
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
    <template v-else-if="name === 'pin'">
      <path fill="currentColor" stroke="none" d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354m1.58 1.408-.002-.001zm-.002-.001.002.001A.5.5 0 0 1 6 2v5a.5.5 0 0 1-.276.447h-.002l-.012.007-.054.03a5 5 0 0 0-.827.58c-.318.278-.585.596-.725.936h7.792c-.14-.34-.407-.658-.725-.936a5 5 0 0 0-.881-.61l-.012-.006h-.002A.5.5 0 0 1 10 7V2a.5.5 0 0 1 .295-.458 1.8 1.8 0 0 0 .351-.271c.08-.08.155-.17.214-.271H5.14q.091.15.214.271a1.8 1.8 0 0 0 .37.282"></path>
    </template>
    <template v-else-if="name === 'pin-fill'">
      <path fill="currentColor" stroke="none" d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354"></path>
    </template>
  </svg>
</template>
