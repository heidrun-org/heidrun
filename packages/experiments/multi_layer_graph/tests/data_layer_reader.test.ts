import { afterEach, describe, expect, it } from 'vitest';
import Fs from 'node:fs';
import { DataLayerReader } from '../src/builder/data_layer_reader.ts';
import { TestDatabase } from './test_database.ts';

afterEach(() => {
	TestDatabase.removeAll();
});

describe('DataLayerReader', () => {
	it('reads only the rows of the repository, in order', () => {
		const databasePath = TestDatabase.create([
			{
				repository: 'heidrun-org/heidrun',
				issueRows: [TestDatabase.issueRow(2, 'Second', ''), TestDatabase.issueRow(1, 'First', '')],
				pullRequestRows: [TestDatabase.pullRequestRow(3, 'Third', '', null)],
				commitRows: [TestDatabase.commitRow('aaa', [], 'A commit', '')],
			},
			{
				repository: 'other/project',
				issueRows: [TestDatabase.issueRow(9, 'Other', '')],
			},
		]);
		const reader = new DataLayerReader(databasePath);
		expect(reader.readIssues('heidrun-org/heidrun').map((issueRow) => issueRow.number)).toEqual([1, 2]);
		expect(reader.readPullRequests('heidrun-org/heidrun').map((pullRequestRow) => pullRequestRow.number))
			.toEqual([3]);
		expect(reader.readCommits('heidrun-org/heidrun').map((commitRow) => commitRow.hash)).toEqual(['aaa']);
		reader.close();
	});

	it('reads a table that does not exist as a table with no row', () => {
		const reader = new DataLayerReader(TestDatabase.createEmpty());
		expect(reader.readIssues('heidrun-org/heidrun')).toEqual([]);
		expect(reader.readCommits('heidrun-org/heidrun')).toEqual([]);
		reader.close();
	});

	it('never creates and never changes the SQLite file', () => {
		const databasePath = TestDatabase.create([
			{
				repository: 'heidrun-org/heidrun',
				issueRows: [TestDatabase.issueRow(1, 'First', '')],
			},
		]);
		const bytesBefore = Fs.readFileSync(databasePath);
		const reader = new DataLayerReader(databasePath);
		reader.readIssues('heidrun-org/heidrun');
		reader.close();
		expect(Fs.readFileSync(databasePath).equals(bytesBefore)).toBe(true);
		expect(() => new DataLayerReader(`${databasePath}.missing`)).toThrow(/does not exist/);
		expect(Fs.existsSync(`${databasePath}.missing`)).toBe(false);
	});
});
