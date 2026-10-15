<script setup lang="ts">
import { withBase } from 'vitepress';
import HomeJoke from './home_joke.vue';
import { MYTHOLOGY } from './home_content';
</script>

<template>
	<section :id="MYTHOLOGY.id" class="home-section home-mythology">
		<div class="home-container home-split">
			<div class="home-text">
				<h2 class="home-title">{{ MYTHOLOGY.title }}</h2>
				<p v-for="paragraph in MYTHOLOGY.paragraphs" :key="paragraph" class="home-paragraph">{{ paragraph }}</p>
				<p class="home-paragraph">
					<a class="home-link" :href="withBase(MYTHOLOGY.aboutLink.href)">{{ MYTHOLOGY.aboutLink.text }}</a>
				</p>
				<HomeJoke :text="MYTHOLOGY.joke" />
			</div>
			<table class="home-mythology-map">
				<thead>
					<tr>
						<th scope="col">{{ MYTHOLOGY.mythHeading }}</th>
						<th scope="col">{{ MYTHOLOGY.developerHeading }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in MYTHOLOGY.rows" :key="row.myth">
						<td>{{ row.myth }}</td>
						<td>{{ row.developer }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>

<style scoped>
.home-mythology-map {
	width: 100%;
	border-collapse: collapse;
	font-size: 16px;
}

.home-mythology-map th {
	padding: 0 16px 12px 0;
	border-bottom: 2px solid var(--home-accent);
	font-family: var(--home-font-display);
	font-size: 15px;
	font-weight: 600;
	text-align: left;
	color: var(--home-accent);
}

.home-mythology-map td {
	padding: 14px 16px 14px 0;
	border-bottom: 1px solid var(--vp-c-divider);
	line-height: 1.5;
	vertical-align: top;
	color: var(--vp-c-text-2);
}

.home-mythology-map td:first-child {
	width: 50%;
	font-weight: 600;
	color: var(--vp-c-text-1);
}
</style>
