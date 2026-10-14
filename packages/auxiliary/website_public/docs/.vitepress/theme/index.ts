import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import type { Theme } from 'vitepress';
import SplashImage from './splash_image.vue';
import YoutubeVideo from './youtube_video.vue';
import './custom.css';

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component('YoutubeVideo', YoutubeVideo);
	},
	Layout() {
		return h(DefaultTheme.Layout, null, {
			'home-hero-after': () => h(SplashImage),
		});
	},
} satisfies Theme;
