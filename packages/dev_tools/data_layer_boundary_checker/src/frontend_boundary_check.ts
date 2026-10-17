import {
	ALLOWED_FRONTEND_COMMANDS,
	FRONTEND_CODE_RULES,
	FRONTEND_SCOPE_PATTERNS,
} from './boundary_rules.ts';
import type { BoundaryViolation } from './boundary_types.ts';
import { FrontendSource } from './frontend_source.ts';
import { ViolationBuilder } from './violation_builder.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FrontendBoundaryCheck — finds the web page code that gets data without a Tauri command of the data layer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Checks the files of the web page that belong to the Past chats sidebar section or to the Statistics window. These files call
 * only the Tauri commands of the list, and they never reach a source themselves.
 */
export class FrontendBoundaryCheck {
	/**
	 * Tests whether a web page file belongs to the Past chats sidebar section or to the Statistics window.
	 *
	 * @param relativePath - The path of the file relative to the folder of the web frontend source, with `/` as separator.
	 * @returns True when the checks apply to the file. A test file is never in the scope.
	 */
	static isInScope(relativePath: string): boolean {
		if (relativePath.includes('.test.')) {
			return false;
		}
		for (const pattern of FRONTEND_SCOPE_PATTERNS) {
			if (pattern.test(relativePath) === true) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks one web page file of the scope.
	 *
	 * @param filePath - The path of the file, relative to the root of the repository.
	 * @param relativePath - The path of the file relative to the folder of the web frontend source, with `/` as separator.
	 * @param text - The text of the file.
	 * @returns The places where the file gets data without a Tauri command of the data layer.
	 */
	static check(filePath: string, relativePath: string, text: string): BoundaryViolation[] {
		const code = FrontendSource.blankComments(text, relativePath.endsWith('.vue'));
		const violations: BoundaryViolation[] = [];
		for (const rule of FRONTEND_CODE_RULES) {
			if (relativePath in rule.allowedFiles) {
				continue;
			}
			const pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`);
			let match = pattern.exec(code);
			while (match !== null) {
				violations.push(ViolationBuilder.make(filePath, text, match.index, rule.ruleId, rule.message));
				match = pattern.exec(code);
			}
		}
		violations.push(...FrontendBoundaryCheck._checkInvokeCalls(filePath, text, code));
		return violations;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Checks each call of `invoke`: its first argument is the name of a Tauri command that the list allows.
	 *
	 * @param filePath - The path of the file, relative to the root of the repository.
	 * @param text - The original text of the file.
	 * @param code - The text of the file with no comment. It has the same positions as the original text.
	 * @returns One violation for each call that the list does not allow, and for each use of `invoke` that the check cannot read.
	 */
	private static _checkInvokeCalls(filePath: string, text: string, code: string): BoundaryViolation[] {
		const violations: BoundaryViolation[] = [];
		const word = /\binvoke\b/g;
		let match = word.exec(code);
		while (match !== null) {
			const afterWord = match.index + match[0].length;
			const callStart = FrontendBoundaryCheck._findCallStart(code, afterWord);
			if (callStart === null) {
				const alias = FrontendBoundaryCheck._isAlias(code, match.index, afterWord);
				if (alias === true) {
					violations.push(
						ViolationBuilder.make(
							filePath,
							text,
							match.index,
							'frontend-invoke-alias',
							'A web page file of the scope gives another name to `invoke`, or passes it as a value. The check reads only the direct calls of `invoke`.',
						),
					);
				}
				match = word.exec(code);
				continue;
			}
			const command = /\s*(['"`])([A-Za-z0-9_]+)\1/y;
			command.lastIndex = callStart;
			const commandMatch = command.exec(code);
			if (commandMatch === null) {
				violations.push(
					ViolationBuilder.make(
						filePath,
						text,
						match.index,
						'frontend-dynamic-command',
						'A call of `invoke` in a web page file of the scope has no plain string as its first argument. The check cannot read the name of the command.',
					),
				);
			} else if ((commandMatch[2] ?? '') in ALLOWED_FRONTEND_COMMANDS === false) {
				violations.push(
					ViolationBuilder.make(
						filePath,
						text,
						match.index,
						'frontend-command',
						`The Tauri command \`${commandMatch[2]}\` is not in the list ALLOWED_FRONTEND_COMMANDS. A command that gives data of the Past chats sidebar section or of the Statistics window comes from a package of the data layer.`,
					),
				);
			}
			match = word.exec(code);
		}
		return violations;
	}

	/**
	 * Finds the position after the opening parenthesis of a call, and skips the type arguments of the call.
	 *
	 * @param code - The text of the file with no comment.
	 * @param start - The position after the word `invoke`.
	 * @returns The position after the opening parenthesis, or null when the word is not called.
	 */
	private static _findCallStart(code: string, start: number): number | null {
		let index = start;
		while (/\s/.test(code[index] ?? '')) {
			index += 1;
		}
		if (code[index] === '<') {
			let depth = 0;
			while (index < code.length) {
				if (code[index] === '=' && code[index + 1] === '>') {
					index += 2;
					continue;
				}
				if (code[index] === '<') {
					depth += 1;
				} else if (code[index] === '>') {
					depth -= 1;
					if (depth === 0) {
						index += 1;
						break;
					}
				}
				index += 1;
			}
			while (/\s/.test(code[index] ?? '')) {
				index += 1;
			}
		}
		if (code[index] === '(') {
			return index + 1;
		}
		return null;
	}

	/**
	 * Tests whether the word `invoke` is used as a value or renamed, and not only imported.
	 *
	 * @param code - The text of the file with no comment.
	 * @param start - The position of the word.
	 * @param end - The position after the word.
	 * @returns True when the word is renamed or passed as a value.
	 */
	private static _isAlias(code: string, start: number, end: number): boolean {
		const after = code.slice(end, end + 12);
		if (/^\s+as\b/.test(after)) {
			return true;
		}
		const before = code.slice(Math.max(0, start - 3), start);
		return /[=,(:]\s*$/.test(before) && /^\s*[;,)]/.test(after);
	}
}
