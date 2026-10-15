import Fs from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { z } from 'zod';
import {
	CommitRowSchema,
	IssueRowSchema,
	PullRequestRowSchema,
	type CommitRow,
	type IssueRow,
	type PullRequestRow,
} from './data_layer_row_types.ts';
import { NodeSqlite } from './node_sqlite.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DataLayerReader — the only code that opens the SQLite file of the data layer packages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A table of the SQLite file that has the columns `repository` and `data`.
 */
type DataTableName = 'issues' | 'pull_requests' | 'commits';

/**
 * Reads the rows of the data layer packages from their SQLite file. The file is always open read only, so the reader
 * never changes it and never creates it. A table that does not exist yet reads as a table with no row.
 */
export class DataLayerReader {
	/** The SQLite file, open read only. */
	private _database: DatabaseSync;

	/**
	 * Opens the SQLite file read only.
	 * @param databasePath The path of the SQLite file.
	 */
	constructor(databasePath: string) {
		if (Fs.existsSync(databasePath) === false) {
			throw new Error(`The SQLite file ${databasePath} does not exist.`);
		}
		this._database = NodeSqlite.open(databasePath, true);
	}

	/**
	 * Reads the issues of a repository, by number.
	 * @param repository The repository, in the format "owner/name".
	 * @returns The issues.
	 */
	readIssues(repository: string): IssueRow[] {
		const issueRows = this._readData('issues', repository, 'number', IssueRowSchema);
		return issueRows;
	}

	/**
	 * Reads the pull requests of a repository, by number.
	 * @param repository The repository, in the format "owner/name".
	 * @returns The pull requests.
	 */
	readPullRequests(repository: string): PullRequestRow[] {
		const pullRequestRows = this._readData('pull_requests', repository, 'number', PullRequestRowSchema);
		return pullRequestRows;
	}

	/**
	 * Reads the commits of a repository, merges included, from the oldest to the newest.
	 * @param repository The repository, in the format "owner/name".
	 * @returns The commits.
	 */
	readCommits(repository: string): CommitRow[] {
		const commitRows = this._readData('commits', repository, 'committedAt, hash', CommitRowSchema);
		return commitRows;
	}

	/**
	 * Closes the SQLite file.
	 */
	close(): void {
		this._database.close();
	}

	/**
	 * Tells whether a table exists in the SQLite file.
	 * @param tableName The name of the table.
	 * @returns True when the table exists.
	 */
	private _hasTable(tableName: string): boolean {
		const statement = this._database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?");
		const row = statement.get(tableName);
		return row !== undefined;
	}

	/**
	 * Reads the column `data` of the rows of a repository, and checks each value against a schema.
	 * @param tableName The table to read.
	 * @param repository The repository, in the format "owner/name".
	 * @param orderBy The columns of the order of the rows.
	 * @param schema The schema of the value of the column `data`.
	 * @returns The values of the column `data`.
	 */
	private _readData<T>(tableName: DataTableName, repository: string, orderBy: string, schema: z.ZodType<T>): T[] {
		if (this._hasTable(tableName) === false) {
			return [];
		}
		const statement = this._database.prepare(
			`SELECT data FROM ${tableName} WHERE repository = ? ORDER BY ${orderBy}`,
		);
		const rows = statement.all(repository) as { data: string }[];
		const values = rows.map((row) => schema.parse(JSON.parse(row.data)));
		return values;
	}
}
