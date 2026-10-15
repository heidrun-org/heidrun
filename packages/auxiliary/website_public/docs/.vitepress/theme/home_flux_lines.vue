<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import FluxLines from './flux_lines.vue';
import type { FluxLinesOptions } from './flux_lines_types';

/** The options of the lines on the dark theme: golden mead, like the glow of the splash image. */
const DARK_OPTIONS: FluxLinesOptions = {
	colors: ['#ffbe3c', '#ffd98a', '#ff9a3c'],
	opacity: 0.7,
	dpr: 1,
};

/** The options of the lines on the light theme: dark golden ink on the white page. */
const LIGHT_OPTIONS: FluxLinesOptions = {
	colors: ['#b8741a', '#8a4b0f', '#d99a2b'],
	lightMode: true,
	opacity: 0.4,
	dpr: 1,
};

const { frontmatter, isDark } = useData();
const isHome = computed(() => frontmatter.value.layout === 'home');
const options = computed(() => (isDark.value === true ? DARK_OPTIONS : LIGHT_OPTIONS));
</script>

<template>
	<div v-if="isHome === true" class="home-flux-lines">
		<FluxLines :options="options" />
	</div>
</template>
