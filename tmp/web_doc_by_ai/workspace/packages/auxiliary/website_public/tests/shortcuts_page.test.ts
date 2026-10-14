import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SiteFiles } from './site_files';

const pagePath = Path.join(SiteFiles.docsDir, 'documentation/shortcuts.md');
const shortcutsPath = Path.join(SiteFiles.repositoryDir, 'packages/apps/web_frontend/src/lib/shortcuts.json');
const englishPath = Path.join(SiteFiles.repositoryDir, 'packages/apps/web_frontend/src/i18n/locales/en/shortcuts.json');

type Group = { groupKey: string; items: { keys?: string; keysKey?: string; actionKey: string }[] };

describe('shortcuts page', () => {
	const page = Fs.readFileSync(pagePath, 'utf8');
	const groups: Group[] = JSON.parse(Fs.readFileSync(shortcutsPath, 'utf8'));
	const english: Record<string, string> = JSON.parse(Fs.readFileSync(englishPath, 'utf8'));

	it('has the start and the end markers of the generated table, in this order', () => {
		const start = page.indexOf('<!-- shortcuts:start -->');
		const end = page.indexOf('<!-- shortcuts:end -->');
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
	});

	it('is the file that the command "pnpm docs:shortcuts" would write', () => {
		const before = Fs.readFileSync(pagePath, 'utf8');
		try {
			ChildProcess.execFileSync('node', ['scripts/shortcuts-readme.mjs'], { cwd: SiteFiles.repositoryDir });
			expect(Fs.readFileSync(pagePath, 'utf8')).toBe(before);
		} finally {
			Fs.writeFileSync(pagePath, before);
		}
	});

	it('has one table row per shortcut and one row per group', () => {
		const rows = page.split('\n').filter((line) => line.startsWith('| ') && line.includes('Shortcut') === false && line.startsWith('| ---') === false);
		const expected = groups.reduce((total, group) => total + 1 + group.items.length, 0);
		expect(rows).toHaveLength(expected);
	});

	it('writes the English name of every group in bold', () => {
		for (const group of groups) {
			expect(page).toContain(`| **${english[group.groupKey]}** | |`);
		}
	});

	it('writes the English action of every shortcut', () => {
		for (const group of groups) {
			for (const item of group.items) {
				expect(page, item.actionKey).toContain(english[item.actionKey].replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
			}
		}
	});

	it('has an English text for every key of shortcuts.json', () => {
		for (const group of groups) {
			expect(english[group.groupKey], group.groupKey).toBeDefined();
			for (const item of group.items) {
				expect(english[item.actionKey], item.actionKey).toBeDefined();
				if (item.keysKey !== undefined) {
					expect(english[item.keysKey], item.keysKey).toBeDefined();
				}
			}
		}
	});

	it('mentions the shortcut that shows the list in the application', () => {
		expect(page).toContain('⌘/');
	});
});

describe('shortcuts page text', () => {
	it('contains no raw angle bracket outside the generated image tags, because VitePress reads it as a Vue tag', () => {
		const page = Fs.readFileSync(pagePath, 'utf8');
		const withoutImages = page.replace(/<img [^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '');
		expect(/<[A-Za-z]/.test(withoutImages)).toBe(false);
	});
});
