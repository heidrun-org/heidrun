<script setup lang="ts">
import { computed, ref } from 'vue';
import { withBase } from 'vitepress';
import HomeJoke from './home_joke.vue';
import { VALHALLA } from './home_content';

/** The index of the part of the window that the outline shows. It starts on the Needs you sidebar section. */
const selectedIndex = ref<number>(3);

const selectedBox = computed(() => {
	const box = VALHALLA.parts[selectedIndex.value].box;
	return {
		left: `${box.left}%`,
		top: `${box.top}%`,
		width: `${box.width}%`,
		height: `${box.height}%`,
	};
});
</script>

<template>
	<section :id="VALHALLA.id" class="home-section home-section-soft home-valhalla">
		<div class="home-container">
			<div class="home-text">
				<h2 class="home-title">{{ VALHALLA.title }}</h2>
				<p v-for="paragraph in VALHALLA.paragraphs" :key="paragraph" class="home-paragraph">{{ paragraph }}</p>
				<HomeJoke :text="VALHALLA.joke" />
			</div>
			<figure class="home-valhalla-figure">
				<div class="home-shot home-valhalla-shot">
					<img
						:src="withBase(VALHALLA.screenshot.src)"
						:alt="VALHALLA.screenshot.alt"
						:width="VALHALLA.screenshot.width"
						:height="VALHALLA.screenshot.height"
						loading="lazy"
					/>
					<div class="home-valhalla-outline" :style="selectedBox" aria-hidden="true"></div>
				</div>
				<figcaption class="home-valhalla-parts">
					<span class="home-visually-hidden">{{ VALHALLA.partsLabel }}</span>
					<button
						v-for="(part, index) in VALHALLA.parts"
						:key="part.name"
						type="button"
						class="home-valhalla-part"
						:aria-pressed="index === selectedIndex"
						@click="selectedIndex = index"
						@mouseenter="selectedIndex = index"
						@focus="selectedIndex = index"
					>
						<strong class="home-valhalla-part-name">{{ part.name }}</strong>
						<span class="home-valhalla-part-text">{{ part.description }}</span>
					</button>
				</figcaption>
			</figure>
		</div>
	</section>
</template>

<style scoped>
.home-valhalla-figure {
	margin: 48px 0 0;
}

.home-valhalla-shot {
	position: relative;
	overflow: hidden;
}

.home-valhalla-outline {
	position: absolute;
	border: 2px solid var(--home-accent);
	border-radius: 8px;
	box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.38);
	transition:
		left 0.3s ease,
		top 0.3s ease,
		width 0.3s ease,
		height 0.3s ease;
	pointer-events: none;
}

.home-valhalla-parts {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 8px;
	margin-top: 20px;
}

.home-valhalla-part {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 14px 16px;
	border: 1px solid transparent;
	border-radius: 10px;
	background: transparent;
	text-align: left;
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease;
}

.home-valhalla-part:hover {
	background: var(--vp-c-default-soft);
}

.home-valhalla-part[aria-pressed='true'] {
	border-color: var(--home-accent);
	background: var(--vp-c-brand-soft);
}

.home-valhalla-part:focus-visible {
	outline: 2px solid var(--home-accent);
	outline-offset: 2px;
}

.home-valhalla-part-name {
	font-family: var(--home-font-display);
	font-size: 17px;
	font-weight: 600;
	color: var(--vp-c-text-1);
}

.home-valhalla-part-text {
	font-size: 14px;
	line-height: 1.5;
	color: var(--vp-c-text-2);
}

@media (prefers-reduced-motion: reduce) {
	.home-valhalla-outline,
	.home-valhalla-part {
		transition: none;
	}
}
</style>
