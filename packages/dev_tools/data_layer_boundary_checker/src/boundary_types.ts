///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One place where the Past chats sidebar section or the Statistics window gets data without the packages of the data layer.
 */
export type BoundaryViolation = {
	/** The path of the file, relative to the root of the repository, with `/` as separator. */
	filePath: string;
	/** The line of the file, starting at 1. */
	lineNumber: number;
	/** The identifier of the rule that the line breaks. */
	ruleId: string;
	/** The sentence that says why the line is not allowed, and what to do instead. */
	message: string;
	/** The text of the line, without its indentation. */
	excerpt: string;
};

/**
 * A rule that forbids a pattern in the code of a file.
 */
export type PatternRule = {
	/** The identifier of the rule. */
	ruleId: string;
	/** The pattern that the rule forbids. It is tested on the whole text of the file, so it also finds a pattern that is cut over several lines. */
	pattern: RegExp;
	/** The sentence that says why the pattern is not allowed, and what to do instead. */
	message: string;
};

/**
 * A rule that forbids a pattern in the code of every file of a scope, except in some files.
 */
export type FrontendPatternRule = PatternRule & {
	/** The files, relative to the folder of the web frontend source, where the pattern is allowed, each with the reason. */
	allowedFiles: Record<string, string>;
};

/**
 * A piece of text in a Rust file: a string literal, with the position where it starts.
 */
export type StringLiteral = {
	/** The offset of the first character of the content, in the text of the file. */
	offset: number;
	/** The content of the string literal, as it is written in the file. */
	text: string;
};

/**
 * A Rust file prepared for the checks.
 */
export type PreparedRustSource = {
	/** The text of the file where each comment, each string content, and each block of test code is replaced by spaces. The new lines stay. */
	code: string;
	/** The string literals of the file outside the blocks of test code. */
	stringLiterals: StringLiteral[];
};

/**
 * A path of a Rust file that starts with `crate` or with the name of a package of the data layer.
 */
export type RustPath = {
	/** The path with `::` between the segments. A path that ends with `*` imports everything below it. */
	text: string;
	/** The position in the code of the first character of the path. */
	offset: number;
};
