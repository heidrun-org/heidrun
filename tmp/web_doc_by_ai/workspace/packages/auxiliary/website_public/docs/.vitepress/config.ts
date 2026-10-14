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
			{
				text: 'Files',
				items: [
					{
						text: 'Browse and open project files',
						link: '/documentation/browse_project_files',
					},
					{
						text: 'Create a file or folder',
						link: '/documentation/create_a_file_or_folder',
					},
					{
						text: 'Copy a file path',
						link: '/documentation/copy_a_file_path',
					},
					{
						text: 'Files sidebar section controls',
						link: '/documentation/files_sidebar_section_controls',
					},
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun' },
		],
	},
});
