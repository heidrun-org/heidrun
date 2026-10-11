import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../docs/.vitepress/config';
import { SiteFiles } from './site_files';

const identityPath = Path.join(SiteFiles.repositoryDir, 'data/identity.json');
const readmePath = Path.join(SiteFiles.repositoryDir, 'README.md');
const identity = JSON.parse(Fs.readFileSync(identityPath, 'utf8'));

describe('identity texts', () => {
	it('give the title and the description of the site', () => {
		expect(config.title).toBe(identity.title);
		expect(config.description).toBe(identity.description.en);
	});

	it('fill the hero of the home page, and no other page', async () => {
		const transform = config.transformPageData;
		expect(transform).toBeDefined();
		const home = { relativePath: 'index.md', frontmatter: { hero: { actions: [] } } };
		await transform?.(home as never, {} as never);
		expect(home.frontmatter.hero).toEqual({
			actions: [],
			name: identity.title,
			text: identity.motto.en,
			tagline: identity.description.en,
		});
		const other = { relativePath: 'about.md', frontmatter: {} };
		await transform?.(other as never, {} as never);
		expect(other.frontmatter).toEqual({});
	});

	it('are not written by hand in the home page', () => {
		const home = Fs.readFileSync(Path.join(SiteFiles.docsDir, 'index.md'), 'utf8');
		expect(home).not.toContain(identity.motto.en);
		expect(home).not.toContain(identity.description.en);
	});

	it('are in the README, between the start marker and the end marker', () => {
		const readme = Fs.readFileSync(readmePath, 'utf8');
		const start = readme.indexOf('<!-- identity:start -->');
		const end = readme.indexOf('<!-- identity:end -->');
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const generated = readme.slice(start, end);
		expect(generated).toContain(`# ${identity.title}`);
		expect(generated).toContain(identity.motto.en);
		expect(generated).toContain(identity.description.en);
	});

	it('make the README the file that the command "pnpm docs:identity" would write', () => {
		const before = Fs.readFileSync(readmePath, 'utf8');
		try {
			ChildProcess.execFileSync('node', ['scripts/identity-readme.mjs'], { cwd: SiteFiles.repositoryDir });
			expect(Fs.readFileSync(readmePath, 'utf8')).toBe(before);
		} finally {
			Fs.writeFileSync(readmePath, before);
		}
	});
});
