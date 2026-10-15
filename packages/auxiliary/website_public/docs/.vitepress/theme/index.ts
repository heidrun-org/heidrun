import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import type { Theme } from 'vitepress';
import HomeFluxLines from './home_flux_lines.vue';
import SplashImage from './splash_image.vue';
import YoutubeVideo from './youtube_video.vue';
import HomeHeroNote from './home/home_hero_note.vue';
import HomeProblem from './home/home_problem.vue';
import HomeValhalla from './home/home_valhalla.vue';
import HomeFeature from './home/home_feature.vue';
import HomeLonghouse from './home/home_longhouse.vue';
import HomeQuickStart from './home/home_quick_start.vue';
import HomeOpenSource from './home/home_open_source.vue';
import HomeMythology from './home/home_mythology.vue';
import HomeSkal from './home/home_skal.vue';
import './custom.css';
import './home/home.css';

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component('YoutubeVideo', YoutubeVideo);
		app.component('HomeProblem', HomeProblem);
		app.component('HomeValhalla', HomeValhalla);
		app.component('HomeFeature', HomeFeature);
		app.component('HomeLonghouse', HomeLonghouse);
		app.component('HomeQuickStart', HomeQuickStart);
		app.component('HomeOpenSource', HomeOpenSource);
		app.component('HomeMythology', HomeMythology);
		app.component('HomeSkal', HomeSkal);
	},
	Layout() {
		return h(DefaultTheme.Layout, null, {
			'layout-top': () => h(HomeFluxLines),
			'home-hero-actions-after': () => h(HomeHeroNote),
			'home-hero-after': () => h(SplashImage),
		});
	},
} satisfies Theme;
