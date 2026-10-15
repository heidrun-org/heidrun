import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { CommitRow, IssueRow, PullRequestRow } from '../src/builder/data_layer_row_types.ts';
import { NodeSqlite } from '../src/builder/node_sqlite.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TestDatabase — temporary SQLite files with the tables of the data layer packages, for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rows that a temporary SQLite file holds, for each repository.
 */
export type TestDatabaseRows = {
	/** The repository, in the format "owner/name". */
	repository: string;
	/** The issues. */
	issueRows?: IssueRow[];
	/** The pull requests. */
	pullRequestRows?: PullRequestRow[];
	/** The commits. */
	commitRows?: CommitRow[];
};

/**
 * Creates temporary SQLite files with the same tables as the data layer packages, and sample rows.
 */
export class TestDatabase {
	/** The temporary folders that the class created and did not remove yet. */
	private static _folders: string[] = [];

	/**
	 * Creates a temporary SQLite file with the tables of the data layer packages.
	 * @param testDatabaseRowsList The rows to write, for each repository.
	 * @returns The path of the SQLite file.
	 */
	static create(testDatabaseRowsList: TestDatabaseRows[]): string {
		const folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'multi_layer_graph_'));
		TestDatabase._folders.push(folder);
		const databasePath = Path.join(folder, 'data_layer.sqlite');
		const database = NodeSqlite.open(databasePath, false);
		TestDatabase._createTables(database);
		for (const testDatabaseRows of testDatabaseRowsList) {
			const repository = testDatabaseRows.repository;
			for (const issueRow of testDatabaseRows.issueRows ?? []) {
				database.prepare('INSERT INTO issues VALUES (?, ?, ?, ?)')
					.run(repository, issueRow.number, issueRow.createdAt, JSON.stringify(issueRow));
			}
			for (const pullRequestRow of testDatabaseRows.pullRequestRows ?? []) {
				database.prepare('INSERT INTO pull_requests VALUES (?, ?, ?, ?)')
					.run(repository, pullRequestRow.number, pullRequestRow.createdAt, JSON.stringify(pullRequestRow));
			}
			for (const commitRow of testDatabaseRows.commitRows ?? []) {
				database.prepare('INSERT INTO commits VALUES (?, ?, ?, ?)')
					.run(repository, commitRow.hash, commitRow.committedAt, JSON.stringify(commitRow));
			}
		}
		database.close();
		return databasePath;
	}

	/**
	 * Creates a temporary SQLite file with no table, as a data layer package that never ran.
	 * @returns The path of the SQLite file.
	 */
	static createEmpty(): string {
		const folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'multi_layer_graph_'));
		TestDatabase._folders.push(folder);
		const databasePath = Path.join(folder, 'data_layer.sqlite');
		const database = NodeSqlite.open(databasePath, false);
		database.close();
		return databasePath;
	}

	/**
	 * Makes a temporary folder with no file in it.
	 * @returns The path of the folder.
	 */
	static createFolder(): string {
		const folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'multi_layer_graph_'));
		TestDatabase._folders.push(folder);
		return folder;
	}

	/**
	 * Removes every temporary folder that the class created.
	 */
	static removeAll(): void {
		for (const folder of TestDatabase._folders) {
			Fs.rmSync(folder, {
				recursive: true,
				force: true,
			});
		}
		TestDatabase._folders = [];
	}

	/**
	 * Makes the sample row of an issue.
	 * @param number The number of the issue.
	 * @param title The title of the issue.
	 * @param body The text of the issue.
	 * @returns The issue.
	 */
	static issueRow(number: number, title: string, body: string): IssueRow {
		return {
			number,
			title,
			body,
			state: 'OPEN',
			author: 'jeromeetienne',
			labels: [],
			createdAt: '2026-10-01T10:00:00Z',
			closedAt: null,
			commentCount: 0,
		};
	}

	/**
	 * Makes the sample row of a merged pull request.
	 * @param number The number of the pull request.
	 * @param title The title of the pull request.
	 * @param body The text of the pull request.
	 * @param mergeCommit The hash of the merge commit, or null.
	 * @returns The pull request.
	 */
	static pullRequestRow(number: number, title: string, body: string, mergeCommit: string | null): PullRequestRow {
		return {
			number,
			title,
			body,
			state: 'MERGED',
			author: 'jeromeetienne',
			baseRefName: 'dev_jerome',
			headRefName: `branch-${number}`,
			mergeCommit,
			createdAt: '2026-10-02T10:00:00Z',
			mergedAt: '2026-10-02T11:00:00Z',
			additions: 10,
			deletions: 2,
			changedFiles: 1,
			commitCount: 1,
		};
	}

	/**
	 * Makes the sample row of a commit.
	 * @param hash The hash of the commit.
	 * @param parents The hashes of the parents.
	 * @param subject The first line of the message.
	 * @param body The message after the first line.
	 * @returns The commit.
	 */
	static commitRow(hash: string, parents: string[], subject: string, body: string): CommitRow {
		return {
			hash,
			parents,
			authorName: 'Jerome Etienne',
			authorEmail: 'jerome@example.com',
			committedAt: '2026-10-02T10:30:00Z',
			subject,
			body,
			filesChanged: 1,
			insertions: 10,
			deletions: 2,
		};
	}

	/**
	 * Creates the tables of the data layer packages, with the same columns.
	 * @param database The open SQLite file.
	 */
	private static _createTables(database: DatabaseSync): void {
		database.exec(`
			CREATE TABLE issues (
				repository TEXT NOT NULL,
				number INTEGER NOT NULL,
				updatedAt TEXT NOT NULL,
				data TEXT NOT NULL CHECK (json_valid(data)),
				PRIMARY KEY (repository, number)
			);
			CREATE TABLE pull_requests (
				repository TEXT NOT NULL,
				number INTEGER NOT NULL,
				updatedAt TEXT NOT NULL,
				data TEXT NOT NULL CHECK (json_valid(data)),
				PRIMARY KEY (repository, number)
			);
			CREATE TABLE commits (
				repository TEXT NOT NULL,
				hash TEXT NOT NULL,
				committedAt TEXT NOT NULL,
				data TEXT NOT NULL CHECK (json_valid(data)),
				PRIMARY KEY (repository, hash)
			);
		`);
	}
}
