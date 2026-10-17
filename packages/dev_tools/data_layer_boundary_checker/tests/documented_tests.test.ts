import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');
const rulePath = Path.join(repositoryPath, 'docs', 'agents_rules', 'data_layer_access.md');
const desktopSourcePath = Path.join(repositoryPath, 'packages', 'apps', 'desktop_tauri', 'src');

/**
 * Reads the rows of the table "The integration tests" of the rule file.
 * @returns The file and the test name of each row.
 */
function readDocumentedTests(): Array<{ filePath: string; testName: string }> {
	const text = Fs.readFileSync(rulePath, 'utf8');
	const section = text.slice(text.indexOf('## The integration tests'), text.indexOf('## The audit of the bypasses'));
	const rows: Array<{ filePath: string; testName: string }> = [];
	for (const line of section.split('\n')) {
		const match = /^\| `([^`]+\.rs)` \| `([a-z0-9_]+)` \|$/.exec(line);
		if (match !== null) {
			rows.push({
				filePath: match[1] ?? '',
				testName: match[2] ?? '',
			});
		}
	}
	return rows;
}

describe('the integration tests that the rule file names', () => {
	it('names at least one test for the Past chats sidebar section and one for each tab of the Statistics window', () => {
		const filePaths = readDocumentedTests().map((row) => row.filePath);
		expect(filePaths).toEqual(
			expect.arrayContaining([
				'past_chats/chats.rs',
				'past_chats/chat_references.rs',
				'statistics/ai_cost.rs',
				'statistics/person_work.rs',
				'statistics/user_activity_records.rs',
			]),
		);
	});

	it('all exist as a Rust test, in the file that the rule file gives', () => {
		for (const row of readDocumentedTests()) {
			const text = Fs.readFileSync(Path.join(desktopSourcePath, row.filePath), 'utf8');
			const testPattern = new RegExp(`#\\[test\\]\\s*\\n\\s*fn ${row.testName}\\(`);
			expect(testPattern.test(text), `${row.filePath} has no test ${row.testName}`).toBe(true);
		}
	});
});
