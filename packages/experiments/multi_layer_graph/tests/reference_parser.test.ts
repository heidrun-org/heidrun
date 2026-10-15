import { describe, expect, it } from 'vitest';
import { ReferenceParser } from '../src/builder/reference_parser.ts';

const REPOSITORY = 'heidrun-org/heidrun';

describe('ReferenceParser.findMentionedNumbers', () => {
	it('finds each #N one time, in the order of the text', () => {
		const numbers = ReferenceParser.findMentionedNumbers('See #12, then #7 and #12 again.', REPOSITORY);
		expect(numbers).toEqual([12, 7]);
	});

	it('finds the address of an issue and of a pull request of the repository', () => {
		const text = 'https://github.com/heidrun-org/heidrun/issues/510 and '
			+ 'https://github.com/heidrun-org/heidrun/pull/528';
		expect(ReferenceParser.findMentionedNumbers(text, REPOSITORY)).toEqual([510, 528]);
	});

	it('finds no number in an address of another repository, in owner/name#N, or in &#N', () => {
		const text = 'https://github.com/other/project/issues/3 other/project#4 &#5; issue#6 #7abc';
		expect(ReferenceParser.findMentionedNumbers(text, REPOSITORY)).toEqual([]);
	});
});

describe('ReferenceParser.findFixedNumbers', () => {
	it('finds the numbers after each word of GitHub that closes an issue, in any case', () => {
		const text = 'Fixes #1. closes #2, Resolved #3, fix: #4, fixed #5';
		expect(ReferenceParser.findFixedNumbers(text, REPOSITORY)).toEqual([1, 2, 3, 4, 5]);
	});

	it('finds the address of an issue after a word that closes it', () => {
		const text = 'fixes https://github.com/heidrun-org/heidrun/issues/42';
		expect(ReferenceParser.findFixedNumbers(text, REPOSITORY)).toEqual([42]);
	});

	it('finds no number that a text only names', () => {
		expect(ReferenceParser.findFixedNumbers('See #8, it is a prefix of the fixer #9', REPOSITORY)).toEqual([]);
	});
});
