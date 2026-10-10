import Fs from 'node:fs';
import Path from 'node:path';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SiteFiles — locates the source files of the website for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Paths of the website sources, and helpers that read them. */
export class SiteFiles {
	/** The folder `docs` of the package `website_public`. */
	static readonly docsDir = Path.resolve(__dirname, '../docs');

	/** The root of the repository. */
	static readonly repositoryDir = Path.resolve(__dirname, '../../../..');

	/**
	 * Finds the Markdown file that a website link points to.
	 * @param link - A link of the navigation, such as `/documentation/shortcuts` or `/about`.
	 * @returns The path of the Markdown file, or null when no file matches.
	 */
	static markdownFileOfLink(link: string): string | null {
		const clean = link.split('#')[0].replace(/^\//, '');
		const candidates = clean === '' || clean.endsWith('/')
			? [Path.join(SiteFiles.docsDir, clean, 'index.md')]
			: [Path.join(SiteFiles.docsDir, `${clean}.md`), Path.join(SiteFiles.docsDir, clean, 'index.md')];
		for (const candidate of candidates) {
			if (Fs.existsSync(candidate) === true) {
				return candidate;
			}
		}
		return null;
	}

	/**
	 * Lists every Markdown page of the website.
	 * @returns The absolute paths of the pages, without the folder `.vitepress`.
	 */
	static listPages(): string[] {
		const pages: string[] = [];
		const walk = (dir: string): void => {
			for (const entry of Fs.readdirSync(dir, { withFileTypes: true })) {
				if (entry.name === '.vitepress' || entry.name === 'node_modules') {
					continue;
				}
				const full = Path.join(dir, entry.name);
				if (entry.isDirectory() === true) {
					walk(full);
				} else if (entry.name.endsWith('.md') === true) {
					pages.push(full);
				}
			}
		};
		walk(SiteFiles.docsDir);
		return pages;
	}
}
