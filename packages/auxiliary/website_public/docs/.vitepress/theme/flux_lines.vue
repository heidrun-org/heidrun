<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FluxLinesRenderer } from './flux_lines_renderer';
import type { FluxLinesOptions } from './flux_lines_types';

/** The properties of the component `FluxLines`. */
type Props = {
	/** The options of the background. A missing option takes its default value. */
	options?: FluxLinesOptions;
};

const props = withDefaults(defineProps<Props>(), {
	options: () => ({}),
});

const containerElement = ref<HTMLDivElement | null>(null);
const canvasElement = ref<HTMLCanvasElement | null>(null);
let renderer: FluxLinesRenderer | null = null;

onMounted(() => {
	if (containerElement.value === null || canvasElement.value === null) {
		return;
	}
	renderer = FluxLinesRenderer.create(containerElement.value, canvasElement.value, props.options);
	if (renderer !== null) {
		renderer.start();
	}
});

watch(() => props.options, (options) => {
	if (renderer !== null) {
		renderer.update(options);
	}
}, { deep: true });

onBeforeUnmount(() => {
	if (renderer !== null) {
		renderer.dispose();
		renderer = null;
	}
});
</script>

<template>
	<div ref="containerElement" class="flux-lines">
		<canvas ref="canvasElement" class="flux-lines-canvas" aria-hidden="true"></canvas>
	</div>
</template>
