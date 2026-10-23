import type { BoundaryViolation } from './boundary_types.ts';
import { RustSource } from './rust_source.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViolationBuilder — builds a violation from a position in a file
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Builds the violations that the checks report.
 */
export class ViolationBuilder {
	/**
	 * Builds a violation from a position in a file.
	 *
	 * @param filePath - The path of the file, relative to the root of the repository.
	 * @param text - The original text of the file.
	 * @param offset - The position of the code that breaks the rule.
	 * @param ruleId - The identifier of the rule that the code breaks.
	 * @param message - The sentence that says why the code is not allowed.
	 * @returns The violation.
	 */
	static make(filePath: string, text: string, offset: number, ruleId: string, message: string): BoundaryViolation {
		const lineNumber = RustSource.lineNumberOf(text, offset);
		return {
			filePath,
			lineNumber,
			ruleId,
			message,
			excerpt: RustSource.excerptOf(text, lineNumber),
		};
	}
}
