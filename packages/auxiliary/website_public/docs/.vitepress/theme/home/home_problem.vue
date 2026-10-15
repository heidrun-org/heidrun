<script setup lang="ts">
import HomeJoke from './home_joke.vue';
import { PROBLEM } from './home_content';
import type { HomeAgentState } from './home_content';

/** The words that a screen reader says for the state of each terminal. */
const STATE_LABELS: Record<HomeAgentState, string> = {
	blocked: 'Blocked, waits for you',
	question: 'Asks you a question',
	working: 'Works',
	done: 'Has finished, waits for your review',
};
</script>

<template>
	<section :id="PROBLEM.id" class="home-section home-problem">
		<div class="home-container home-split">
			<div class="home-text">
				<h2 class="home-title">{{ PROBLEM.title }}</h2>
				<p v-for="paragraph in PROBLEM.paragraphs" :key="paragraph" class="home-paragraph">{{ paragraph }}</p>
				<HomeJoke :text="PROBLEM.joke" />
			</div>
			<figure class="home-problem-figure">
				<ul class="home-problem-desk">
					<li
						v-for="(terminal, index) in PROBLEM.terminals"
						:key="terminal.title"
						class="home-terminal"
						:class="[`home-terminal-${index + 1}`, `is-${terminal.state}`]"
					>
						<div class="home-terminal-bar">
							<span class="home-terminal-lights" aria-hidden="true"><i></i><i></i><i></i></span>
							<span class="home-terminal-title">{{ terminal.title }}</span>
							<span class="home-terminal-dot" role="img" :aria-label="STATE_LABELS[terminal.state]"></span>
						</div>
						<p class="home-terminal-line">{{ terminal.line }}</p>
					</li>
				</ul>
				<figcaption class="home-caption">{{ PROBLEM.caption }}</figcaption>
			</figure>
		</div>
	</section>
</template>

<style scoped>
.home-problem-figure {
	margin: 0;
}

.home-problem-desk {
	position: relative;
	margin: 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.home-terminal {
	border: 1px solid #2b2b2b;
	border-radius: 10px;
	background: #181818;
	color: #cccccc;
	box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.6);
	overflow: hidden;
}

.home-terminal-bar {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 7px 12px;
	background: #1f1f1f;
	border-bottom: 1px solid #2b2b2b;
	font-size: 12px;
	color: #8f8f8f;
}

.home-terminal-lights {
	display: inline-flex;
	gap: 5px;
}

.home-terminal-lights i {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: #3a3d41;
}

.home-terminal-title {
	flex: 1;
	font-family: var(--vp-font-family-mono);
}

.home-terminal-dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: var(--home-state-color);
}

.home-terminal-line {
	margin: 0;
	padding: 12px 14px 14px;
	font-family: var(--vp-font-family-mono);
	font-size: 13px;
	line-height: 1.5;
}

.home-terminal-line::before {
	content: '❯ ';
	color: var(--home-state-color);
}

.is-blocked {
	--home-state-color: #f0645f;
	border-color: #5c2826;
}

.is-blocked .home-terminal-bar {
	background: #2f1b1a;
}

.is-question {
	--home-state-color: #c29bf0;
}

.is-working {
	--home-state-color: #3fb8af;
}

.is-done {
	--home-state-color: #6ea8fe;
}

.is-blocked .home-terminal-dot {
	animation: home-terminal-call 1.6s ease-in-out infinite;
}

@keyframes home-terminal-call {
	0%,
	100% {
		box-shadow: 0 0 0 0 rgba(240, 100, 95, 0.55);
	}
	50% {
		box-shadow: 0 0 0 6px rgba(240, 100, 95, 0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.is-blocked .home-terminal-dot {
		animation: none;
	}
}

@media (min-width: 960px) {
	.home-problem-desk {
		display: block;
		height: 452px;
	}

	.home-terminal {
		position: absolute;
		width: 74%;
	}

	.home-terminal-1 {
		top: 0;
		left: 0;
		transform: rotate(-1.5deg);
	}

	.home-terminal-2 {
		top: 84px;
		right: 0;
		width: 60%;
		transform: rotate(1.2deg);
	}

	.home-terminal-3 {
		top: 168px;
		left: 6%;
		transform: rotate(0.4deg);
	}

	.home-terminal-4 {
		top: 268px;
		right: 2%;
		width: 66%;
		transform: rotate(-1deg);
	}

	.home-terminal-5 {
		top: 362px;
		left: 1%;
		transform: rotate(1.4deg);
	}
}
</style>
