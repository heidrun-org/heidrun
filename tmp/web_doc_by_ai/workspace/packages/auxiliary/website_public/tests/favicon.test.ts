import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../docs/.vitepress/config';
import { SiteFiles } from './site_files';

describe('favicon of the website', () => {
	const publicFavicon = Path.join(SiteFiles.docsDir, 'public/favicon.svg');
	const applicationFavicon = Path.join(SiteFiles.repositoryDir, 'data/images/heidrun_favicon.svg');

	it('is the same image as the favicon of the application', () => {
		expect(Fs.readFileSync(publicFavicon, 'utf8')).toBe(Fs.readFileSync(applicationFavicon, 'utf8'));
	});

	it('is a square drawing with a viewBox of 64 by 64', () => {
		expect(Fs.readFileSync(publicFavicon, 'utf8')).toContain('viewBox="0 0 64 64"');
	});

	it('is linked from the configuration under the base path of the site', () => {
		expect(config.head).toContainEqual(['link', {
			rel: 'icon',
			type: 'image/svg+xml',
			href: `${config.base}favicon.svg`,
		}]);
	});
});
