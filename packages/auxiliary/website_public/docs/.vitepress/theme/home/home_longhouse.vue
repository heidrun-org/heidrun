<script setup lang="ts">
import { withBase } from 'vitepress';
import HomeJoke from './home_joke.vue';
import { LONGHOUSE } from './home_content';
</script>

<template>
	<section :id="LONGHOUSE.id" class="home-section home-section-soft home-longhouse">
		<div class="home-container">
			<div class="home-text">
				<h2 class="home-title">{{ LONGHOUSE.title }}</h2>
				<p v-for="paragraph in LONGHOUSE.paragraphs" :key="paragraph" class="home-paragraph">{{ paragraph }}</p>
			</div>
			<div class="home-longhouse-groups">
				<div v-for="group in LONGHOUSE.groups" :key="group.place" class="home-longhouse-group">
					<h3 class="home-longhouse-place">{{ group.place }}</h3>
					<dl class="home-longhouse-items">
						<div v-for="item in group.items" :key="item.name" class="home-longhouse-item">
							<dt class="home-longhouse-name">
								<a v-if="item.href !== undefined" :href="withBase(item.href)">{{ item.name }}</a>
								<template v-else>{{ item.name }}</template>
							</dt>
							<dd class="home-longhouse-description">{{ item.description }}</dd>
						</div>
					</dl>
				</div>
			</div>
			<p class="home-read-more">
				<a :href="withBase(LONGHOUSE.aiLink.href)">{{ LONGHOUSE.aiLink.text }} →</a>
			</p>
			<HomeJoke :text="LONGHOUSE.joke" />
		</div>
	</section>
</template>

<style scoped>
.home-longhouse-groups {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 40px 48px;
	margin: 48px 0 8px;
}

.home-longhouse-place {
	margin: 0 0 16px;
	padding-bottom: 10px;
	border-bottom: 2px solid var(--home-accent);
	font-family: var(--home-font-display);
	font-size: 15px;
	font-weight: 600;
	color: var(--home-accent);
}

.home-longhouse-items {
	display: flex;
	flex-direction: column;
	gap: 18px;
	margin: 0;
}

.home-longhouse-name {
	font-weight: 600;
	color: var(--vp-c-text-1);
}

.home-longhouse-name a {
	color: inherit;
	text-decoration: underline;
	text-decoration-color: var(--home-accent);
	text-underline-offset: 3px;
}

.home-longhouse-description {
	margin: 4px 0 0;
	font-size: 15px;
	line-height: 1.6;
	color: var(--vp-c-text-2);
}
</style>
