<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import { HERO_NOTE } from './home_content';

const { frontmatter } = useData();
const isHome = computed(() => frontmatter.value.layout === 'home');
</script>

<template>
	<p v-if="isHome === true" class="home-hero-note">{{ HERO_NOTE }}</p>
</template>
