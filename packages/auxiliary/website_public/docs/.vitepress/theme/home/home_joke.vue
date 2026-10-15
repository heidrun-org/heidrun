<script setup lang="ts">
import { withBase } from 'vitepress';

/** The properties of the component `HomeJoke`. */
type Props = {
	/** The text of the joke. */
	text: string;
};

const props = defineProps<Props>();
</script>

<template>
	<p class="home-joke">
		<img class="home-joke-goat" :src="withBase('/favicon.svg')" alt="" width="28" height="28" />
		<span class="home-joke-text">{{ props.text }}</span>
	</p>
</template>
