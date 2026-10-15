import { AnsiLine, AnsiParser, AnsiSegment } from './ansi_parser';
import { AnsiPalette } from './ansi_palette';
import { HtmlEscape } from './html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	OutputText — turns the output of a pane into short, colored HTML
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The output of a pane is a copy of a terminal screen: it has colors, and many empty lines. A phone has no room for the
 * empty lines, and the developer wants the colors.
 */
export class OutputText {
	/**
	 * Draws the output. The spaces at the end of each line are removed, each group of empty lines becomes one empty
	 * line, and the empty lines at the start and at the end are removed. A line of spaces with a background color
	 * is an empty line, because a bar of the width of the terminal would not fit on a phone.
	 * @param text The output of the pane, with escape codes or without.
	 * @returns The HTML of the output. Each color is in the attribute `data-fg` or `data-bg`, because the content
	 * security policy refuses a `style` attribute: the class `ColorPainter` sets the colors after the HTML is in
	 * the page.
	 */
	static toHtml(text: string): string {
		const lines: AnsiLine[] = [];
		for (const line of AnsiParser.parse(text)) {
			OutputText.removeTrailingSpaces(line);
			const previous = lines[lines.length - 1];
			if (line.length === 0 && (previous === undefined || previous.length === 0)) {
				continue;
			}
			lines.push(line);
		}
		while (lines.length > 0 && lines[lines.length - 1].length === 0) {
			lines.pop();
		}
		const lineTexts = lines.map((line) => {
			return line.map((segment) => OutputText.renderSegment(segment)).join('');
		});
		return lineTexts.join('\n');
	}

	private static removeTrailingSpaces(line: AnsiLine): void {
		while (line.length > 0) {
			const last = line[line.length - 1];
			last.text = last.text.replace(/\s+$/, '');
			if (last.text !== '') {
				return;
			}
			line.pop();
		}
	}

	private static renderSegment(segment: AnsiSegment): string {
		const style = segment.style;
		const text = HtmlEscape.escape(segment.text);
		if (AnsiParser.isPlain(style)) {
			return text;
		}
		const defaultBackground = AnsiPalette.defaultBackground;
		const defaultForeground = AnsiPalette.defaultForeground;
		const foreground = style.isInverse ? (style.background ?? defaultBackground) : style.foreground;
		const background = style.isInverse ? (style.foreground ?? defaultForeground) : style.background;
		const classNames = [
			style.isBold ? 'a-bold' : '',
			style.isDim ? 'a-dim' : '',
			style.isItalic ? 'a-italic' : '',
			style.isUnderlined ? 'a-underline' : '',
			style.isStruck ? 'a-strike' : '',
		].filter((className) => className !== '');
		const classAttribute = classNames.length === 0 ? '' : ` class="${classNames.join(' ')}"`;
		const foregroundAttribute = foreground === null ? '' : ` data-fg="${foreground}"`;
		const backgroundAttribute = background === null ? '' : ` data-bg="${background}"`;
		const attributes = `${classAttribute}${foregroundAttribute}${backgroundAttribute}`;
		const spanHtmlContent = /* html */`<span${attributes}>${text}</span>`;
		return spanHtmlContent;
	}
}
