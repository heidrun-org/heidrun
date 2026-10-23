import {
	ALLOWED_COMMAND_FILES_OUTSIDE_SCOPE,
	ALLOWED_CRATE_PATHS,
	ALLOWED_PACKAGE_FUNCTIONS,
	FORBIDDEN_DESKTOP_DEPENDENCIES,
	PATH_HELPERS_OUTSIDE_SCOPE,
	RUST_CODE_RULES,
	RUST_STRING_RULES,
	SCOPE_COMMAND_NAME_PATTERN,
} from './boundary_rules.ts';
import type { BoundaryViolation, PatternRule } from './boundary_types.ts';
import { RustPaths } from './rust_paths.ts';
import { RustSource } from './rust_source.ts';
import { ViolationBuilder } from './violation_builder.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RustBoundaryCheck — finds the Rust code that gets data without a package of the data layer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Checks the Rust files of the desktop application. A file of the scope (the commands of the Past chats sidebar section and of
 * the Statistics window) may call only the functions of the packages of the data layer. A file outside the scope may not use the
 * packages of the data layer to get data for the scope.
 */
export class RustBoundaryCheck {
	/**
	 * Checks one Rust file of the scope.
	 *
	 * @param filePath - The path of the file, relative to the root of the repository.
	 * @param text - The text of the file.
	 * @returns The places where the file gets data without a package of the data layer.
	 */
	static checkScopeFile(filePath: string, text: string): BoundaryViolation[] {
		const prepared = RustSource.prepare(text);
		const violations: BoundaryViolation[] = [];
		for (const rule of RUST_CODE_RULES) {
			violations.push(...RustBoundaryCheck._findPattern(filePath, text, prepared.code, rule));
		}
		for (const rule of RUST_STRING_RULES) {
			for (const stringLiteral of prepared.stringLiterals) {
				const match = rule.pattern.exec(stringLiteral.text);
				if (match !== null) {
					violations.push(
						ViolationBuilder.make(
							filePath,
							text,
							stringLiteral.offset + match.index,
							rule.ruleId,
							rule.message,
						),
					);
				}
			}
		}
		for (const rustPath of RustPaths.find(prepared.code)) {
			const message = RustBoundaryCheck._explainScopePath(rustPath.text);
			if (message !== null) {
				violations.push(
					ViolationBuilder.make(filePath, text, rustPath.offset, message.ruleId, message.message),
				);
			}
		}
		return violations;
	}

	/**
	 * Checks one Rust file of the desktop application that is outside the scope.
	 *
	 * @param filePath - The path of the file, relative to the root of the repository.
	 * @param text - The text of the file.
	 * @returns The places where the file takes data from a package of the data layer, or defines a command of the scope.
	 */
	static checkOutsideFile(filePath: string, text: string): BoundaryViolation[] {
		const prepared = RustSource.prepare(text);
		const violations: BoundaryViolation[] = [];
		for (const rustPath of RustPaths.find(prepared.code)) {
			const segments = rustPath.text.split('::');
			const firstSegment = segments[0] ?? '';
			if (RustPaths.isPackageName(firstSegment) === false) {
				continue;
			}
			const name = segments[segments.length - 1] ?? '';
			const isPathHelper = firstSegment === 'data_layer_coding_agents' && PATH_HELPERS_OUTSIDE_SCOPE.includes(name);
			if (isPathHelper === true) {
				continue;
			}
			violations.push(
				ViolationBuilder.make(
					filePath,
					text,
					rustPath.offset,
					'package-outside-scope',
					`A file outside the scope takes \`${rustPath.text}\` from a package of the data layer. Put the command in the folder past_chats or statistics, where the checks run. Only ${PATH_HELPERS_OUTSIDE_SCOPE.join(' and ')} may be used elsewhere, because they give a folder name.`,
				),
			);
		}
		if (filePath in ALLOWED_COMMAND_FILES_OUTSIDE_SCOPE) {
			return violations;
		}
		const commandName = new RegExp(SCOPE_COMMAND_NAME_PATTERN.source, 'g');
		let match = commandName.exec(prepared.code);
		while (match !== null) {
			violations.push(
				ViolationBuilder.make(
					filePath,
					text,
					match.index,
					'command-outside-scope',
					`The function \`${match[1]}\` has the name of a command of the Past chats sidebar section or of the Statistics window, but it is outside the folders past_chats and statistics.`,
				),
			);
			match = commandName.exec(prepared.code);
		}
		return violations;
	}

	/**
	 * Checks the manifest of the desktop application.
	 *
	 * @param filePath - The path of the file `Cargo.toml`, relative to the root of the repository.
	 * @param text - The text of the file.
	 * @returns The libraries that only a package of the data layer may use.
	 */
	static checkManifest(filePath: string, text: string): BoundaryViolation[] {
		const violations: BoundaryViolation[] = [];
		const lines = text.split('\n');
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] ?? '';
			const dependency = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line);
			if (dependency === null) {
				continue;
			}
			const name = dependency[1] ?? '';
			if (FORBIDDEN_DESKTOP_DEPENDENCIES.includes(name) === true) {
				violations.push({
					filePath,
					lineNumber: index + 1,
					ruleId: 'manifest-sql-library',
					message: `The desktop application depends on \`${name}\`. Only a package of the data layer may open the SQLite file.`,
					excerpt: line.trim(),
				});
			}
		}
		return violations;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Finds every match of a rule in the code of a file.
	 *
	 * @param filePath - The path of the file, relative to the root of the repository.
	 * @param text - The original text of the file.
	 * @param code - The code of the file, without comments, string contents, and test code. It has the same positions as the text.
	 * @param rule - The rule to search.
	 * @returns One violation for each match.
	 */
	private static _findPattern(
		filePath: string,
		text: string,
		code: string,
		rule: PatternRule,
	): BoundaryViolation[] {
		const violations: BoundaryViolation[] = [];
		const pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`);
		let match = pattern.exec(code);
		while (match !== null) {
			violations.push(ViolationBuilder.make(filePath, text, match.index, rule.ruleId, rule.message));
			if (match[0].length === 0) {
				pattern.lastIndex += 1;
			}
			match = pattern.exec(code);
		}
		return violations;
	}

	/**
	 * Tells why a path of a file of the scope is not allowed.
	 *
	 * @param pathText - A path that starts with `crate` or with the name of a package of the data layer.
	 * @returns The rule and the message, or null when the path is allowed.
	 */
	private static _explainScopePath(pathText: string): { ruleId: string; message: string } | null {
		const segments = pathText.split('::');
		const firstSegment = segments[0] ?? '';
		const name = segments[segments.length - 1] ?? '';
		if (firstSegment === 'crate') {
			return RustBoundaryCheck._explainCratePath(segments.slice(1));
		}
		if (segments.length === 1) {
			return {
				ruleId: 'package-alias',
				message: `A file of the scope names the package \`${firstSegment}\` without a function. Write the full path of each function, so that the check can read it.`,
			};
		}
		if (name === '*') {
			return {
				ruleId: 'package-glob',
				message: `A file of the scope imports everything of \`${pathText}\`. Name each function and each type, so that the check can read them.`,
			};
		}
		const isFunction = /^[a-z_]/.test(name);
		if (isFunction === false) {
			return null;
		}
		const isAllowedFunction =
			name.startsWith('refresh_') || name.startsWith('find_') || ALLOWED_PACKAGE_FUNCTIONS.includes(name);
		if (isAllowedFunction === true) {
			return null;
		}
		return {
			ruleId: 'package-function',
			message: `A file of the scope takes \`${pathText}\` from a package of the data layer. It may take only a function that starts with refresh_ or find_, a type, or one of ${ALLOWED_PACKAGE_FUNCTIONS.join(', ')}.`,
		};
	}

	/**
	 * Tells why a path that starts with `crate` is not allowed in a file of the scope.
	 *
	 * @param segments - The segments of the path after `crate`.
	 * @returns The rule and the message, or null when the path is allowed.
	 */
	private static _explainCratePath(segments: string[]): { ruleId: string; message: string } | null {
		const remainder = segments.join('::');
		if (segments.length === 0 || segments[segments.length - 1] === '*') {
			return {
				ruleId: 'crate-helper',
				message: 'A file of the scope imports everything of the desktop application. Name each item, so that the check can read them.',
			};
		}
		for (const allowedPath of ALLOWED_CRATE_PATHS) {
			const isFolder = allowedPath.endsWith('::');
			const isAllowed = isFolder === true ? `${remainder}::`.startsWith(allowedPath) : remainder === allowedPath;
			if (isAllowed === true) {
				return null;
			}
		}
		return {
			ruleId: 'crate-helper',
			message: `A file of the scope uses \`crate::${remainder}\`. A helper of the desktop application is not checked, so it can read a source. Put the helper in the folder past_chats or statistics, or add it to ALLOWED_CRATE_PATHS with a reason.`,
		};
	}
}
