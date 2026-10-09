import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Heidrun',
	description: 'A macOS graphical interface for Herdr: the agents and terminals of a Herdr session, in one work window.',
	base: '/heidrun/',
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Documentation', link: '/documentation/' },
		],
		sidebar: [
			{
				text: 'Documentation',
				items: [
					{ text: 'Introduction', link: '/documentation/' },
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun' },
		],
	},
});
