<script setup lang="ts">
/** The properties of the component `YoutubeVideo`. */
type Props = {
	/** The identifier of the YouTube video: the text after `v=` in the address of the video. */
	videoId: string;
	/** The title of the video. Screen readers read it. */
	title: string;
};

const props = defineProps<Props>();
</script>

<template>
	<div class="youtube-video">
		<iframe
			:src="`https://www.youtube-nocookie.com/embed/${props.videoId}`"
			:title="props.title"
			loading="lazy"
			allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
			referrerpolicy="strict-origin-when-cross-origin"
			allowfullscreen
		></iframe>
	</div>
</template>
