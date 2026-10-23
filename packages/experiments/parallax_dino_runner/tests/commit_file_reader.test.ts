import { describe, expect, it } from 'vitest';
import { CommitFileReader, FallbackCommits } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('CommitFileReader', () => {
	it('reads a valid file of commits', () => {
		const value = { commits: TestStates.createCommits([0, 1, 2]) };
		expect(CommitFileReader.read(JSON.parse(JSON.stringify(value)))).toEqual(value);
	});

	it('refuses a file with no commit', () => {
		expect(() => CommitFileReader.read({ commits: [] })).toThrow('not valid');
	});

	it('refuses a file that is not a list of commits', () => {
		expect(() => CommitFileReader.read({})).toThrow('not valid');
		expect(() => CommitFileReader.read('text')).toThrow('not valid');
		expect(() => CommitFileReader.read(null)).toThrow('not valid');
	});

	it('refuses a commit with a wrong lane, a negative number of lines, or a missing field', () => {
		const [commit] = TestStates.createCommits([1]);
		expect(() => CommitFileReader.read({ commits: [{ ...commit, lane: 3 }] })).toThrow('lane');
		expect(() => CommitFileReader.read({ commits: [{ ...commit, insertions: -1 }] })).toThrow('insertions');
		expect(() => CommitFileReader.read({ commits: [{ ...commit, subject: undefined }] })).toThrow('subject');
	});

	it('accepts the fake commits', () => {
		const value = { commits: FallbackCommits.create() };
		expect(CommitFileReader.read(value).commits).toHaveLength(value.commits.length);
	});
});
