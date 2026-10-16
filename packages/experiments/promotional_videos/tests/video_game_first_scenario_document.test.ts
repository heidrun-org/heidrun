import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DinoHitsABoulderScenario } from '../src/dino_hits_a_boulder_scenario.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Scenario document — the file video_game_first.scenario.md says what the code does
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads the rows of the Markdown table under a heading.
 * @param document The text of the Markdown file.
 * @param heading The heading of the section, without the signs `##`.
 * @returns The rows, each row as a list of cells, without the header row and the separator row.
 */
function readTableRows(document: string, heading: string): string[][] {
	const section = document.split(`## ${heading}`)[1]?.split('\n## ')[0] ?? '';
	const tableLines = section.split('\n').filter((line) => line.startsWith('|'));
	return tableLines.slice(2).map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

describe('video_game_first.scenario.md', () => {
	const document = Fs.readFileSync(Path.resolve(__dirname, '../data/scenarios/video_game_first.scenario.md'), 'utf8');
	const scenario = DinoHitsABoulderScenario.create();

	it('has the title with the name of the scenario', () => {
		expect(document).toContain(`# Scenario: ${scenario.name}`);
	});

	it('has the seed of the scenario', () => {
		expect(document).toContain(`- Seed of the game: ${scenario.seed}.`);
	});

	it('has the table of timed commands of the code, row for row', () => {
		const rows = readTableRows(document, 'Timed commands');
		const expectedRows = scenario.timedCommands.map((timedCommand) => [
			String(timedCommand.timeSeconds),
			timedCommand.command,
			timedCommand.label,
		]);
		expect(rows).toEqual(expectedRows);
	});

	it('has the window of the hit of the code', () => {
		expect(document).toContain(
			`the hit must come between ${scenario.earliestHitSeconds} and ${scenario.latestHitSeconds} seconds`,
		);
	});

	it('names each required event', () => {
		for (const requiredEvent of scenario.requiredEvents) {
			expect(document).toContain(requiredEvent);
		}
	});
});
