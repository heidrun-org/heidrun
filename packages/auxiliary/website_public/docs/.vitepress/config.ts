import { defineConfig } from 'vitepress';
import identity from '../../../../../data/identity.json';

export default defineConfig({
	title: identity.title,
	description: identity.description.en,
	transformPageData(pageData) {
		if (pageData.relativePath === 'index.md') {
			pageData.frontmatter.hero = {
				...pageData.frontmatter.hero,
				name: identity.title,
				text: identity.motto.en,
				tagline: identity.description.en,
			};
		}
	},
	base: '/heidrun/',
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Documentation', link: '/documentation/' },
			{ text: 'About', link: '/about' },
		],
		sidebar: [
			{
				text: 'Documentation',
				items: [
					{ text: 'Introduction', link: '/documentation/' },
					{ text: 'Keyboard shortcuts', link: '/documentation/shortcuts' },
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun' },
		],
	},
});
