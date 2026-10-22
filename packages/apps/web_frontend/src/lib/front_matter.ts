///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FrontMatter — splits the front matter block from the body of a Markdown file
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A Markdown file split in two parts: the front matter block and the rest of the file. */
export type FrontMatterSplit = {
	/** The text between the two lines of dashes, unchanged, or null when the file has no usable front matter block. */
	frontMatter: string | null;
	/** The text to render as Markdown: the file without the front matter block, or the whole file when there is none. */
	body: string;
};

/** The line of three dashes that opens and closes a front matter block. A byte order mark may start the file. */
const DASH_LINE_PATTERN = /^﻿?---[ \t]*\r?$/;

/** Splits the front matter block from the body of a Markdown file. The block is never parsed. */
export class FrontMatter {
	/**
	 * Splits a Markdown file into its front matter block and its body.
	 * A block is the text between a first line of three dashes and the next line of three dashes.
	 * A file with no block, with an empty block, or with a first line of dashes and no closing line gives no front matter,
	 * and its body is the whole file.
	 * @param text The text of the Markdown file.
	 * @returns The front matter block without its two lines of dashes, and the body.
	 */
	static split(text: string): FrontMatterSplit {
		const unchanged: FrontMatterSplit = {
			frontMatter: null,
			body: text,
		};
		const lines = text.split('\n');
		if (DASH_LINE_PATTERN.test(lines[0]) === false) {
			return unchanged;
		}
		const closingIndex = lines.findIndex((line, index) => index > 0 && DASH_LINE_PATTERN.test(line));
		if (closingIndex === -1) {
			return unchanged;
		}
		const frontMatter = lines
			.slice(1, closingIndex)
			.map((line) => line.replace(/\r$/, ''))
			.join('\n');
		if (frontMatter.trim() === '') {
			return unchanged;
		}
		return {
			frontMatter,
			body: lines.slice(closingIndex + 1).join('\n'),
		};
	}
}
