import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SiteFiles } from './site_files';

const outDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'heidrun-site-'));
const packageDir = Path.resolve(SiteFiles.docsDir, '..');

describe('website build', () => {
	beforeAll(() => {
		ChildProcess.execFileSync('pnpm', ['exec', 'vitepress', 'build', 'docs', '--outDir', outDir], {
			cwd: packageDir,
			stdio: 'pipe',
		});
	});

	afterAll(() => {
		Fs.rmSync(outDir, { recursive: true, force: true });
	});

	it('writes a page for every Markdown source', () => {
		for (const page of ['index.html', 'about.html', 'documentation/index.html', 'documentation/shortcuts.html']) {
			expect(Fs.existsSync(Path.join(outDir, page)), page).toBe(true);
		}
	});

	it('uses the base path in the links to the assets', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(html).toContain('/heidrun/assets/');
	});

	it('puts the title of the site in the home page', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(html).toMatch(/<title>Heidrun/);
	});

	it('puts the title, the motto, and the description of data/identity.json in the home page', () => {
		const identity = JSON.parse(Fs.readFileSync(Path.join(SiteFiles.repositoryDir, 'data/identity.json'), 'utf8'));
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(html).toContain(identity.motto.en);
		expect(html).toContain(identity.description.en);
	});

	it('puts the Flux Lines background in the home page only', () => {
		const home = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(home).toContain('home-flux-lines');
		expect(home).toContain('aria-hidden="true"');
		for (const page of ['about.html', 'documentation/index.html', 'documentation/shortcuts.html']) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			expect(html, page).not.toContain('flux-lines');
		}
	});

	it('copies the splash image', () => {
		expect(Fs.existsSync(Path.join(outDir, 'heidrun_splash_screen.png'))).toBe(true);
	});

	it('copies the favicon', () => {
		expect(Fs.existsSync(Path.join(outDir, 'favicon.svg'))).toBe(true);
	});

	it('links the favicon in every page', () => {
		const pages = Fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' })
			.filter((file) => file.endsWith('.html') === true);
		expect(pages.length).toBeGreaterThanOrEqual(5);
		for (const page of pages) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			expect(html, page).toContain('<link rel="icon" type="image/svg+xml" href="/heidrun/favicon.svg">');
		}
	});

	it('renders the shortcuts table', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'documentation/shortcuts.html'), 'utf8');
		expect(html).toContain('<table');
		expect(html).toContain('Command palette');
	});

	it('writes the text of the about page', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'about.html'), 'utf8');
		expect(html).toContain('Who is Heiðrún?');
	});

	it('writes a page for an address that does not exist', () => {
		expect(Fs.existsSync(Path.join(outDir, '404.html'))).toBe(true);
	});
});
