import { describe, expect, it } from 'vitest';
import { OutputText } from '../src/output_text';

const esc = '\x1b';

describe('OutputText', () => {
	it('removes the spaces at the end of each line', () => {
		expect(OutputText.toHtml('one   \ntwo\t')).toBe('one\ntwo');
	});

	it('replaces each group of empty lines by one empty line', () => {
		expect(OutputText.toHtml('one\n\n\n\n\ntwo\n\nthree')).toBe('one\n\ntwo\n\nthree');
	});

	it('treats a line of spaces as an empty line', () => {
		expect(OutputText.toHtml('one\n   \n\t\n  \ntwo')).toBe('one\n\ntwo');
	});

	it('removes the empty lines at the start and at the end', () => {
		expect(OutputText.toHtml('\n\n  \none\ntwo\n\n\n')).toBe('one\ntwo');
	});

	it('keeps the spaces at the start of a line, because they show the indentation', () => {
		expect(OutputText.toHtml('  Worked for 1s\n    detail')).toBe('  Worked for 1s\n    detail');
	});

	it('gives an empty text for an empty screen', () => {
		expect(OutputText.toHtml('')).toBe('');
		expect(OutputText.toHtml('\n \n\n')).toBe('');
	});

	it('shortens a terminal screen of a coding agent that has a wide empty middle', () => {
		const screen = [
			'',
			'',
			'• 1, 2, 3',
			'',
			'  Worked for 1s',
			'',
			'',
			'',
			'',
			'› Ask Codex',
			'',
			'  model · folder',
			'  ← for agents',
			'',
		].join('\n');
		expect(OutputText.toHtml(screen)).toBe(
			'• 1, 2, 3\n\n  Worked for 1s\n\n› Ask Codex\n\n  model · folder\n  ← for agents',
		);
	});

	it('escapes the characters that HTML reads as markup', () => {
		expect(OutputText.toHtml('a < b && "c"')).toBe('a &lt; b &amp;&amp; &quot;c&quot;');
	});

	describe('with colors', () => {
		it('draws the end of a real screen of Codex, without the bars of the full width', () => {
			const reset = `${esc}[0m`;
			const gray = `${esc}[48;2;30;30;30m`;
			const bar = `${reset}${gray}${' '.repeat(95)}${reset}`;
			const title = [
				`  ${reset}${esc}[38;2;99;168;248m>_ ${reset}`,
				`${esc}[1mOpenAI Codex${reset}${esc}[2m (v0.162.0)${reset}`,
			].join('');
			const prompt = [
				`${reset}${esc}[1m${gray}›${reset}${gray} ${reset}`,
				`${esc}[2m${gray}Ask Codex${reset}${gray}${' '.repeat(60)}${reset}`,
			].join('');
			const screen = [title, '', '', bar, prompt, bar].join('\r\n');
			const expectedTitle = [
				'  <span data-fg="#63a8f8">&gt;_ </span>',
				'<span class="a-bold">OpenAI Codex</span>',
				'<span class="a-dim"> (v0.162.0)</span>',
			].join('');
			const expectedPrompt = [
				'<span class="a-bold" data-bg="#1e1e1e">›</span>',
				'<span data-bg="#1e1e1e"> </span>',
				'<span class="a-dim" data-bg="#1e1e1e">Ask Codex</span>',
			].join('');
			expect(OutputText.toHtml(screen)).toBe(`${expectedTitle}\n\n${expectedPrompt}`);
		});

		it('writes a colored word in a span with its color in a data attribute', () => {
			expect(OutputText.toHtml(`${esc}[31mred${esc}[0m plain`)).toBe(
				'<span data-fg="#cd3131">red</span> plain',
			);
		});

		it('writes a background color in a data attribute', () => {
			const html = OutputText.toHtml(`${esc}[44mblue${esc}[49m`);
			expect(html).toBe('<span data-bg="#2472c8">blue</span>');
		});

		it('writes the effects as classes', () => {
			expect(OutputText.toHtml(`${esc}[1;2;3;4;9mall${esc}[m`)).toBe(
				'<span class="a-bold a-dim a-italic a-underline a-strike">all</span>',
			);
		});

		it('swaps the two colors of inverse text, and uses the default colors when one is not set', () => {
			expect(OutputText.toHtml(`${esc}[7mcursor${esc}[27m`)).toBe(
				'<span data-fg="#08090a" data-bg="#b6b9bd">cursor</span>',
			);
			expect(OutputText.toHtml(`${esc}[32;7mok${esc}[0m`)).toBe(
				'<span data-fg="#08090a" data-bg="#0dbc79">ok</span>',
			);
		});

		it('removes the spaces at the end of a line even when they have a background color', () => {
			expect(OutputText.toHtml(`${esc}[44mtitle      ${esc}[0m\nnext`)).toBe(
				'<span data-bg="#2472c8">title</span>\nnext',
			);
		});

		it('treats a line of colored spaces as an empty line', () => {
			const screen = `one\n${esc}[44m          ${esc}[0m\n\n${esc}[41m    ${esc}[0m\ntwo`;
			expect(OutputText.toHtml(screen)).toBe('one\n\ntwo');
		});

		it('escapes the text inside a span', () => {
			const html = OutputText.toHtml(`${esc}[38;2;1;2;3m<b>${esc}[0m`);
			expect(html).toBe('<span data-fg="#010203">&lt;b&gt;</span>');
		});

		it('keeps the color of a span that continues after a new line', () => {
			expect(OutputText.toHtml(`${esc}[32mone\ntwo${esc}[0m`)).toBe(
				'<span data-fg="#0dbc79">one</span>\n<span data-fg="#0dbc79">two</span>',
			);
		});
	});
});
