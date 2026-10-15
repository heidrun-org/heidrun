import { describe, expect, it } from 'vitest';
import { TimeAgo } from '../src/time_ago';

const now = 10_000_000;

describe('TimeAgo', () => {
	it('gives an empty text when the time is not known', () => {
		expect(TimeAgo.format(null, now)).toBe('');
		expect(TimeAgo.format(0, now)).toBe('');
	});

	it('says "just now" under half a minute', () => {
		expect(TimeAgo.format(now - 20_000, now)).toBe('just now');
	});

	it('counts the minutes under one hour', () => {
		expect(TimeAgo.format(now - 5 * 60_000, now)).toBe('5 min ago');
		expect(TimeAgo.format(now - 59 * 60_000, now)).toBe('59 min ago');
	});

	it('counts the hours from one hour', () => {
		expect(TimeAgo.format(now - 60 * 60_000, now)).toBe('1 h ago');
		expect(TimeAgo.format(now - 120 * 60_000, now)).toBe('2 h ago');
	});
});
