<script setup lang="ts">
import { OPEN_SOURCE } from './home_content';
</script>

<template>
	<section :id="OPEN_SOURCE.id" class="home-section home-section-soft home-open-source">
		<div class="home-container">
			<div class="home-text">
				<h2 class="home-title">{{ OPEN_SOURCE.title }}</h2>
				<p v-for="paragraph in OPEN_SOURCE.paragraphs" :key="paragraph" class="home-paragraph">{{ paragraph }}</p>
			</div>
			<div class="home-actions">
				<a v-for="link in OPEN_SOURCE.links" :key="link.href" class="home-button" :href="link.href">{{ link.text }}</a>
			</div>
		</div>
	</section>
</template>
