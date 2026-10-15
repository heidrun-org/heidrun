import { defineConfig } from 'vitepress';
import identity from '../../../../../data/identity.json';

const base = '/heidrun/';

export default defineConfig({
	title: identity.title,
	description: identity.description.en,
	head: [
		['link', {
			rel: 'icon',
			type: 'image/svg+xml',
			href: `${base}favicon.svg`,
		}],
		['link', {
			rel: 'preconnect',
			href: 'https://fonts.googleapis.com',
		}],
		['link', {
			rel: 'preconnect',
			href: 'https://fonts.gstatic.com',
			crossorigin: '',
		}],
		['link', {
			rel: 'stylesheet',
			href: 'https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400..700&display=swap',
		}],
	],
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
	base,
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
