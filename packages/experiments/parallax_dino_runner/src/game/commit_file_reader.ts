import { z } from 'zod';
import type { CommitFile } from './commit_types.ts';
import { CommitFileSchema } from './commit_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CommitFileReader — checks the content of the file commits.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Checks the content of the file `commits.json` after the page read it. The page and the tests call it, and it uses no
 * browser object.
 */
export class CommitFileReader {
	/**
	 * Checks a value that comes from the file `commits.json`.
	 * @param value The value that the JSON text gave.
	 * @returns The file of commits.
	 * @throws An error that says which part of the value is wrong, when the value is not a valid file of commits.
	 */
	static read(value: unknown): CommitFile {
		const result = CommitFileSchema.safeParse(value);
		if (result.success === false) {
			throw new Error(`The file of commits is not valid:\n${z.prettifyError(result.error)}`);
		}
		return result.data;
	}
}
