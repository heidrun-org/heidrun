import { describe, expect, it } from 'vitest';
import { RustSource } from '../src/rust_source.ts';

describe('RustSource.prepare', () => {
	it('replaces a line comment by spaces and keeps the new lines', () => {
		const text = '// Command::new("git")\nlet a = 1;\n';
		const prepared = RustSource.prepare(text);
		expect(prepared.code).not.toContain('Command');
		expect(prepared.code).toHaveLength(text.length);
		expect(prepared.code.split('\n')).toHaveLength(3);
		expect(prepared.code).toContain('let a = 1;');
	});

	it('replaces a block comment, also when another block comment is inside', () => {
		const text = 'a /* one /* two Command::new */ still comment */ b';
		const prepared = RustSource.prepare(text);
		expect(prepared.code).not.toContain('Command');
		expect(prepared.code.startsWith('a ')).toBe(true);
		expect(prepared.code.endsWith(' b')).toBe(true);
	});

	it('replaces the content of a string by spaces and gives the string literal with its position', () => {
		const text = 'let query = "SELECT 1 FROM commits";';
		const prepared = RustSource.prepare(text);
		expect(prepared.code).not.toContain('SELECT');
		expect(prepared.stringLiterals).toEqual([
			{
				offset: text.indexOf('SELECT'),
				text: 'SELECT 1 FROM commits',
			},
		]);
	});

	it('keeps a quote that is escaped inside a string', () => {
		const prepared = RustSource.prepare('let a = "x\\"y"; let b = Command::new("z");');
		expect(prepared.stringLiterals.map((literal) => literal.text)).toEqual(['x\\"y', 'z']);
		expect(prepared.code).toContain('Command::new(');
	});

	it('reads a raw string with hash signs', () => {
		const prepared = RustSource.prepare('let a = r#"say "hello" now"#; let b = 1;');
		expect(prepared.stringLiterals.map((literal) => literal.text)).toEqual(['say "hello" now']);
		expect(prepared.code).toContain('let b = 1;');
	});

	it('does not start a string at a quote inside a character literal', () => {
		const prepared = RustSource.prepare(`let c = '"'; let s = "kept"; let d = '\\'';`);
		expect(prepared.stringLiterals.map((literal) => literal.text)).toEqual(['kept']);
	});

	it('does not take a lifetime for a character literal', () => {
		const prepared = RustSource.prepare(`fn f<'a>(x: &'a str) -> &'a str { "y" }`);
		expect(prepared.stringLiterals.map((literal) => literal.text)).toEqual(['y']);
		expect(prepared.code).toContain("<'a>");
	});

	it('removes a test module with its string literals, and keeps the code after it', () => {
		const text = [
			'fn kept() { let a = "before"; }',
			'#[cfg(test)]',
			'mod tests {',
			'    fn t() { let b = "}"; std::fs::read_to_string("inside"); }',
			'}',
			'fn after() { let c = "after"; }',
		].join('\n');
		const prepared = RustSource.prepare(text);
		expect(prepared.code).not.toContain('read_to_string');
		expect(prepared.code).toContain('fn after()');
		expect(prepared.stringLiterals.map((literal) => literal.text)).toEqual(['before', 'after']);
	});

	it('removes a use statement and a function that only the tests compile', () => {
		const text = [
			'#[cfg(test)]',
			'use std::fs::File;',
			'#[test]',
			'fn lonely() { File::open("x"); }',
			'fn kept() {}',
		].join('\n');
		const prepared = RustSource.prepare(text);
		expect(prepared.code).not.toContain('File');
		expect(prepared.code).toContain('fn kept()');
	});

	it('does not remove code after #[cfg(not(test))]', () => {
		const prepared = RustSource.prepare('#[cfg(not(test))]\nfn real() { Command::new("git"); }\n');
		expect(prepared.code).toContain('Command::new');
	});
});

describe('RustSource.lineNumberOf and RustSource.excerptOf', () => {
	it('count the lines from 1 and trim the indentation', () => {
		const text = 'one\n    two\nthree';
		expect(RustSource.lineNumberOf(text, 0)).toBe(1);
		expect(RustSource.lineNumberOf(text, text.indexOf('two'))).toBe(2);
		expect(RustSource.excerptOf(text, 2)).toBe('two');
		expect(RustSource.excerptOf(text, 9)).toBe('');
	});
});
