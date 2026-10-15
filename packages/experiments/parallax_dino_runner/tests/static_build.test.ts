import Fs from 'node:fs';
import Path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { TestGitRepository } from './test_git_repository.ts';

const __dirname = import.meta.dirname;

describe('Static build', () => {
	afterAll(() => {
		TestGitRepository.removeAll();
	});

	const packageFolder = Path.join(__dirname, '..');
	const sourceFolder = Path.join(packageFolder, 'src');

	const readSources = (): Map<string, string> => {
		const sources = new Map<string, string>();
		for (const relativePath of Fs.readdirSync(sourceFolder, { recursive: true, encoding: 'utf8' })) {
			if (relativePath.endsWith('.ts') === true) {
				sources.set(relativePath, Fs.readFileSync(Path.join(sourceFolder, relativePath), 'utf8'));
			}
		}
		return sources;
	};

	it('builds one folder of static files, and every address in the page is relative', async () => {
		const outputFolder = TestGitRepository.createTemporaryFolder();
		await build({
			root: packageFolder,
			logLevel: 'silent',
			build: {
				outDir: outputFolder,
				emptyOutDir: true,
			},
		});
		const html = Fs.readFileSync(Path.join(outputFolder, 'index.html'), 'utf8');
		expect(html).not.toContain('://');
		expect(html).not.toMatch(/(src|href)="\//);
		expect(html).toMatch(/src="\.\/assets\/[^"]+\.js"/);
		const assetNames = Fs.readdirSync(Path.join(outputFolder, 'assets'));
		expect(assetNames.length).toBeGreaterThan(0);
		expect(assetNames.every((assetName) => /\.(js|css)$/.test(assetName))).toBe(true);
	}, 60_000);

	it('has no network address in its code', () => {
		for (const [relativePath, source] of readSources()) {
			expect(source, relativePath).not.toMatch(/https?:\/\//);
			expect(source, relativePath).not.toMatch(/XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
		}
	});

	it('makes one request only: it reads the file commits.json with a relative address', () => {
		const sources = readSources();
		const filesWithFetch = [...sources.keys()].filter((path) => sources.get(path)?.includes('fetch(') === true);
		expect(filesWithFetch).toEqual([Path.join('view', 'commit_loader.ts')]);
		const loaderSource = sources.get(filesWithFetch[0]) ?? '';
		expect(loaderSource).toContain("'commits.json'");
		expect(loaderSource).not.toContain("'/commits.json'");
	});
});
