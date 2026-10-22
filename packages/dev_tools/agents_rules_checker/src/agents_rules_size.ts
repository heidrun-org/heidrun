import Fs from 'node:fs';
import Path from 'node:path';
import type { TooLargeFile } from './agents_rules_checker_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AgentsRulesSize — finds the files of the agent rules that are larger than the maximum size
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Measures the files of the folder `docs/agents_rules` and of all its subfolders. The maximum size is written in
 * the file `AGENTS.md`, and this class reads it from there, so the number exists in one place only.
 */
export class AgentsRulesSize {
	/**
	 * The line of the section "Docs folder agents rules system values" of the file `AGENTS.md` that gives the maximum
	 * size of a file of the agent rules.
	 */
	static readonly maximumSizePattern = /^- Maximum size of a file: (\d+) bytes\./m;

	/**
	 * Reads the maximum size of a file of the agent rules in the file `AGENTS.md`.
	 * @param agentsFilePath The absolute path of the file `AGENTS.md`.
	 * @returns The maximum size of a file of the agent rules, in bytes.
	 */
	static readMaximumSizeInBytes(agentsFilePath: string): number {
		const agentsText = Fs.readFileSync(agentsFilePath, 'utf8');
		const match = AgentsRulesSize.maximumSizePattern.exec(agentsText);
		if (match === null || match[1] === undefined) {
			throw new Error(`The file ${agentsFilePath} does not give the maximum size of a file of the agent rules.`);
		}
		return Number.parseInt(match[1], 10);
	}

	/**
	 * Lists every file of a folder and of all its subfolders.
	 * @param folderPath The absolute path of the folder.
	 * @returns The absolute paths of the files, sorted.
	 */
	static listFiles(folderPath: string): string[] {
		const filePaths: string[] = [];
		for (const entry of Fs.readdirSync(folderPath, { withFileTypes: true })) {
			const entryPath = Path.join(folderPath, entry.name);
			if (entry.isDirectory() === true) {
				filePaths.push(...AgentsRulesSize.listFiles(entryPath));
			} else {
				filePaths.push(entryPath);
			}
		}
		return filePaths.sort();
	}

	/**
	 * Finds the files of a folder, and of all its subfolders, that are larger than the maximum size.
	 * @param folderPath The absolute path of the folder `docs/agents_rules`.
	 * @param maximumSizeInBytes The maximum size of a file, in bytes. A file of exactly this size is accepted.
	 * @returns The files that are larger than the maximum size, sorted by path.
	 */
	static findTooLargeFiles(folderPath: string, maximumSizeInBytes: number): TooLargeFile[] {
		const tooLargeFiles: TooLargeFile[] = [];
		for (const filePath of AgentsRulesSize.listFiles(folderPath)) {
			const sizeInBytes = Fs.statSync(filePath).size;
			if (sizeInBytes > maximumSizeInBytes) {
				tooLargeFiles.push({
					filePath,
					sizeInBytes,
				});
			}
		}
		return tooLargeFiles;
	}
}
