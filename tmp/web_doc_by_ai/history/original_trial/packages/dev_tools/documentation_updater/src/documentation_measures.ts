import { DocumentationPaths } from './documentation_paths.ts';
import type { PageMeasures } from './documentation_judge_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationMeasures — measures the shape of a documentation page, with no coding agent
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Measures a documentation page mechanically: its length, its longest paragraph, its lists, its tables, and the
 * places where paragraphs follow each other with no structure. The measures are exact and free, so the judge can be
 * compared from one run to the next.
 */
export class DocumentationMeasures {
	/**
	 * Measures one page.
	 * @param text The Markdown text of the page.
	 * @returns The measures of the page.
	 */
	static measure(text: string): PageMeasures {
		const lines = text.split('\n');
		const contentLines = lines.filter((line) => {
			return line.trim() !== '' && DocumentationMeasures._isComment(line) === false;
		});
		const blocks = DocumentationMeasures._splitBlocks(lines);
		const paragraphs = blocks.filter((block) => {
			return block.kind === 'paragraph';
		});
		let paragraphRuns = 0;
		for (let index = 1; index < blocks.length; index++) {
			if (blocks[index].kind === 'paragraph' && blocks[index - 1].kind === 'paragraph') {
				paragraphRuns++;
			}
		}
		const pageTypeMatch = DocumentationPaths.pageTypeCommentPattern.exec(text);
		const relatedPagesText = text.split(/^## Related pages\s*$/m)[1]?.split(/^## /m)[0] ?? '';
		return {
			pageType: pageTypeMatch === null ? null : pageTypeMatch[1],
			lineCount: contentLines.length,
			wordCount: contentLines.join(' ').split(/\s+/).filter((word) => {
				return word !== '';
			}).length,
			longestParagraphSentences: paragraphs.reduce((longest, paragraph) => {
				return Math.max(longest, DocumentationMeasures._countSentences(paragraph.text));
			}, 0),
			paragraphRuns,
			numberedStepCount: lines.filter((line) => {
				return /^\s*\d+\.\s/.test(line);
			}).length,
			bulletCount: lines.filter((line) => {
				return /^\s*[-*]\s/.test(line);
			}).length,
			tableCount: blocks.filter((block) => {
				return block.kind === 'table';
			}).length,
			headingCount: blocks.filter((block) => {
				return block.kind === 'heading';
			}).length,
			hasTroubleshooting: /^## Troubleshooting\s*$/m.test(text),
			relatedPageLinkCount: (relatedPagesText.match(/\]\(\/documentation\//g) ?? []).length,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Cuts the lines of a page into blocks: a heading, a list, a table, a paragraph, or a code block. A blank line
	 * or a change of kind ends a block. Comments and the front matter are ignored.
	 * @param lines The lines of the page.
	 * @returns The blocks, in order, with the text of each paragraph.
	 */
	private static _splitBlocks(lines: string[]): { kind: string; text: string }[] {
		const blocks: { kind: string; text: string }[] = [];
		let isInCode = false;
		let previousKind = 'blank';
		for (const line of lines) {
			if (line.trim().startsWith('```') === true) {
				if (isInCode === false) {
					blocks.push({
						kind: 'code',
						text: '',
					});
				}
				isInCode = isInCode === false;
				previousKind = 'code';
				continue;
			}
			if (isInCode === true) {
				continue;
			}
			const kind = DocumentationMeasures._kindOfLine(line);
			if (kind === 'blank' || kind === 'comment') {
				previousKind = kind === 'blank' ? 'blank' : previousKind;
				continue;
			}
			const lastBlock = blocks.at(-1);
			if (lastBlock !== undefined && kind === lastBlock.kind && previousKind !== 'blank' && kind !== 'heading') {
				lastBlock.text += ` ${line.trim()}`;
			} else {
				blocks.push({
					kind,
					text: line.trim(),
				});
			}
			previousKind = kind;
		}
		return blocks;
	}

	/**
	 * Finds the kind of one line.
	 * @param line One line of the page.
	 * @returns `blank`, `comment`, `heading`, `list`, `table`, or `paragraph`.
	 */
	private static _kindOfLine(line: string): string {
		const trimmed = line.trim();
		if (trimmed === '') {
			return 'blank';
		}
		if (DocumentationMeasures._isComment(line) === true) {
			return 'comment';
		}
		if (/^#{1,6}\s/.test(trimmed) === true) {
			return 'heading';
		}
		if (/^(\d+\.|[-*])\s/.test(trimmed) === true) {
			return 'list';
		}
		if (trimmed.startsWith('|') === true) {
			return 'table';
		}
		return 'paragraph';
	}

	/**
	 * Tests that a line is an HTML comment, such as the mark or a source comment.
	 * @param line One line of the page.
	 * @returns True when the line is a whole comment.
	 */
	private static _isComment(line: string): boolean {
		return /^\s*<!--.*-->\s*$/.test(line);
	}

	/**
	 * Counts the sentences of a paragraph: the ends of sentence `.`, `!`, or `?` followed by a space or the end.
	 * @param text The text of the paragraph.
	 * @returns The number of sentences, at least 1.
	 */
	private static _countSentences(text: string): number {
		const ends = text.match(/[.!?](\s|$)/g) ?? [];
		return Math.max(1, ends.length);
	}
}
