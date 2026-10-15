import { describe, expect, it } from 'vitest';
import { OutputText } from '../src/output_text';

describe('OutputText', () => {
	it('removes the spaces at the end of each line', () => {
		expect(OutputText.tidy('one   \ntwo\t')).toBe('one\ntwo');
	});

	it('replaces each group of empty lines by one empty line', () => {
		expect(OutputText.tidy('one\n\n\n\n\ntwo\n\nthree')).toBe('one\n\ntwo\n\nthree');
	});

	it('treats a line of spaces as an empty line', () => {
		expect(OutputText.tidy('one\n   \n\t\n  \ntwo')).toBe('one\n\ntwo');
	});

	it('removes the empty lines at the start and at the end', () => {
		expect(OutputText.tidy('\n\n  \none\ntwo\n\n\n')).toBe('one\ntwo');
	});

	it('keeps the spaces at the start of a line, because they show the indentation', () => {
		expect(OutputText.tidy('  Worked for 1s\n    detail')).toBe('  Worked for 1s\n    detail');
	});

	it('gives an empty text for an empty screen', () => {
		expect(OutputText.tidy('')).toBe('');
		expect(OutputText.tidy('\n \n\n')).toBe('');
	});

	it('shortens a terminal screen of a coding agent that has a wide empty middle', () => {
		const screen = [
			'',
			'',
			'• 1, 2, 3',
			'',
			'  Worked for 1s',
			'',
			'',
			'',
			'',
			'› Ask Codex',
			'',
			'  model · folder',
			'  ← for agents',
			'',
		].join('\n');
		expect(OutputText.tidy(screen)).toBe(
			'• 1, 2, 3\n\n  Worked for 1s\n\n› Ask Codex\n\n  model · folder\n  ← for agents',
		);
	});
});
