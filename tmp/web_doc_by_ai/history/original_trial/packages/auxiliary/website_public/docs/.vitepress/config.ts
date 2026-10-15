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
				text: 'Get started',
				items: [
					{
						text: 'Introduction',
						link: '/documentation/',
					},
				],
			},
			{
				text: 'How-to guides',
				items: [
					{
						text: 'Browse files and folders',
						link: '/documentation/browse_files',
					},
					{
						text: 'Open a file',
						link: '/documentation/open_a_file',
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
						text: 'Change the appearance of the folder tree',
						link: '/documentation/change_the_files_list_appearance',
					},
				],
			},
			{
				text: 'Reference',
				items: [
					{
						text: 'Files sidebar section',
						link: '/documentation/files_sidebar_reference',
					},
					{
						text: 'Keyboard shortcuts',
						link: '/documentation/shortcuts',
					},
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun' },
		],
	},
});
