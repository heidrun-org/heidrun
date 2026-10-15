<script setup lang="ts">
import { ref } from 'vue';
import HomeJoke from './home_joke.vue';
import { DOWNLOAD_URL, HERDR_URL, QUICK_START } from './home_content';

/** True for two seconds after a click on the copy button. */
const isCopied = ref<boolean>(false);

/** Copies the commands of the quick start to the clipboard, and says so on the button. */
const copyCommands = async (): Promise<void> => {
	await navigator.clipboard.writeText(QUICK_START.source.commands.join('\n'));
	isCopied.value = true;
	window.setTimeout(() => {
		isCopied.value = false;
	}, 2000);
};
</script>

<template>
	<section :id="QUICK_START.id" class="home-section home-quick-start">
		<div class="home-container">
			<h2 class="home-title">{{ QUICK_START.title }}</h2>
			<div class="home-quick-start-paths">
				<div class="home-quick-start-path">
					<h3 class="home-quick-start-heading">{{ QUICK_START.download.title }}</h3>
					<p class="home-paragraph">{{ QUICK_START.download.text }}</p>
					<div class="home-actions">
						<a class="home-button home-button-brand" :href="DOWNLOAD_URL">{{ QUICK_START.download.buttonText }}</a>
						<a class="home-button" :href="HERDR_URL">{{ QUICK_START.download.herdrLinkText }}</a>
					</div>
				</div>
				<div class="home-quick-start-path">
					<h3 class="home-quick-start-heading">{{ QUICK_START.source.title }}</h3>
					<p class="home-paragraph">{{ QUICK_START.source.text }}</p>
					<div class="home-quick-start-code">
						<div class="home-quick-start-bar">
							<span class="home-quick-start-lights" aria-hidden="true"><i></i><i></i><i></i></span>
							<button type="button" class="home-quick-start-copy" @click="copyCommands">
								{{ isCopied === true ? QUICK_START.source.copiedText : QUICK_START.source.copyText }}
							</button>
						</div>
						<pre><code><span v-for="command in QUICK_START.source.commands" :key="command" class="home-quick-start-line">{{ command }}</span></code></pre>
					</div>
				</div>
			</div>
			<HomeJoke :text="QUICK_START.joke" />
		</div>
	</section>
</template>

<style scoped>
.home-quick-start-paths {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 48px;
	margin: 32px 0 8px;
}

.home-quick-start-heading {
	margin: 0 0 12px;
	font-family: var(--home-font-display);
	font-size: 22px;
	font-weight: 600;
	color: var(--vp-c-text-1);
}

.home-quick-start-code {
	border: 1px solid #2b2b2b;
	border-radius: 10px;
	background: #181818;
	overflow: hidden;
}

.home-quick-start-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6px 8px 6px 12px;
	border-bottom: 1px solid #2b2b2b;
	background: #1f1f1f;
}

.home-quick-start-lights {
	display: inline-flex;
	gap: 5px;
}

.home-quick-start-lights i {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: #3a3d41;
}

.home-quick-start-code pre {
	margin: 0;
	padding: 18px 20px;
	overflow-x: auto;
	font-family: var(--vp-font-family-mono);
	font-size: 14px;
	line-height: 1.8;
	color: #cccccc;
}

.home-quick-start-line {
	display: block;
}

.home-quick-start-line::before {
	content: '$ ';
	color: #8f8f8f;
	user-select: none;
}

.home-quick-start-copy {
	padding: 3px 10px;
	border: 1px solid #3a3d41;
	border-radius: 6px;
	background: #1f1f1f;
	font-size: 13px;
	color: #cccccc;
	cursor: pointer;
}

.home-quick-start-copy:hover {
	border-color: #f2a93b;
}

.home-quick-start-copy:focus-visible {
	outline: 2px solid #f2a93b;
	outline-offset: 2px;
}
</style>
