<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vitepress';
import HomeJoke from './home_joke.vue';
import { FEATURES } from './home_content';

/** The properties of the component `HomeFeature`. */
type Props = {
	/** The identifier of the section in the list `FEATURES` of `home_content.ts`. */
	sectionId: string;
};

const props = defineProps<Props>();

const index = computed(() => FEATURES.findIndex((feature) => feature.id === props.sectionId));
const section = computed(() => {
	const found = FEATURES[index.value];
	if (found === undefined) {
		throw new Error(`HomeFeature: no section with the identifier "${props.sectionId}"`);
	}
	return found;
});
/** The second and the fourth sections put the screenshot on the left, so the page zigzags. */
const isReversed = computed(() => index.value % 2 === 1);
</script>

<template>
	<section :id="section.id" class="home-section home-feature" :class="{ 'is-reversed': isReversed }">
		<div class="home-container" :class="{ 'home-split': section.screenshot !== undefined }">
			<div class="home-text">
				<h2 class="home-title">{{ section.title }}</h2>
				<p v-for="paragraph in section.paragraphs" :key="paragraph" class="home-paragraph">{{ paragraph }}</p>
				<HomeJoke :text="section.joke" />
				<p class="home-read-more">
					<a :href="withBase(section.readMore.href)">{{ section.readMore.text }} →</a>
				</p>
			</div>
			<figure v-if="section.screenshot !== undefined" class="home-shot home-feature-shot">
				<img
					:src="withBase(section.screenshot.src)"
					:alt="section.screenshot.alt"
					:width="section.screenshot.width"
					:height="section.screenshot.height"
					loading="lazy"
				/>
			</figure>
		</div>
	</section>
</template>

<style scoped>
.home-feature-shot {
	margin: 0;
}

@media (min-width: 960px) {
	.is-reversed .home-split {
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
	}

	.is-reversed .home-text {
		order: 2;
	}

	.is-reversed .home-feature-shot {
		order: 1;
	}
}
</style>
