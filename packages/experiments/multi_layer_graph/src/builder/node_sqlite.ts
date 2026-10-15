import Module from 'node:module';
import type { DatabaseSync } from 'node:sqlite';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NodeSqlite — loads the module node:sqlite of Node.js
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The module `node:sqlite` of Node.js.
 */
type NodeSqliteModule = typeof import('node:sqlite');

/**
 * Opens a SQLite file with the module `node:sqlite` of Node.js. The module is loaded with `require`, because Vite 5,
 * and so Vitest, does not know `node:sqlite` and fails on `import`.
 */
export class NodeSqlite {
	/**
	 * Opens a SQLite file.
	 * @param databasePath The path of the SQLite file, or ":memory:".
	 * @param isReadOnly True to open the file read only, so that nothing can change it.
	 * @returns The open database.
	 */
	static open(databasePath: string, isReadOnly: boolean): DatabaseSync {
		const nodeSqlite = NodeSqlite._load();
		const database = new nodeSqlite.DatabaseSync(databasePath, {
			readOnly: isReadOnly,
		});
		return database;
	}

	/**
	 * Loads the module `node:sqlite`.
	 * @returns The module.
	 */
	private static _load(): NodeSqliteModule {
		const require = Module.createRequire(import.meta.url);
		const nodeSqlite = require('node:sqlite') as NodeSqliteModule;
		return nodeSqlite;
	}
}
