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

	it('copies the splash image', () => {
		expect(Fs.existsSync(Path.join(outDir, 'heidrun_splash_screen.png'))).toBe(true);
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
