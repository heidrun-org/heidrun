<script setup lang="ts">
import { withBase } from 'vitepress';
</script>

<template>
	<div class="splash-image">
		<img
			:src="withBase('/heidrun_splash_screen.png')"
			alt="The goat Heiðrún on top of Valhalla, pouring golden mead into a huge cauldron while Viking warriors cheer"
		/>
	</div>
</template>
