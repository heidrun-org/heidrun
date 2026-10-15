<script setup lang="ts">
import HomeJoke from './home_joke.vue';
import { DOWNLOAD_URL, REPOSITORY_URL, SKAL } from './home_content';
</script>

<template>
	<section :id="SKAL.id" class="home-section home-section-soft home-skal">
		<div class="home-container home-skal-container">
			<h2 class="home-skal-title">{{ SKAL.title }}</h2>
			<p class="home-paragraph home-skal-text">{{ SKAL.text }}</p>
			<div class="home-actions home-skal-actions">
				<a class="home-button home-button-brand" :href="DOWNLOAD_URL">{{ SKAL.downloadText }}</a>
				<a class="home-button" :href="REPOSITORY_URL">{{ SKAL.repositoryText }}</a>
			</div>
			<HomeJoke :text="SKAL.joke" />
		</div>
	</section>
</template>

<style scoped>
.home-skal-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.home-skal-title {
	margin: 0 0 16px;
	font-family: var(--home-font-display);
	font-size: clamp(4rem, 3rem + 6vw, 8rem);
	font-weight: 700;
	line-height: 1;
	letter-spacing: -0.03em;
	color: var(--home-accent);
}

.home-skal-text {
	max-width: 40ch;
}

.home-skal-actions {
	justify-content: center;
}
</style>
