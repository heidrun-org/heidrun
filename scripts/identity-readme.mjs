// Writes the title, the motto, and the description of Heidrun into README.md, from data/identity.json.
// pnpm docs:identity
import Fs from 'node:fs';
import Path from 'node:path';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	IdentityReadme — writes the identity texts of Heidrun into README.md
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The line of README.md where the generated identity texts start. */
const START = '<!-- identity:start -->';

/** The line of README.md where the generated identity texts end. */
const END = '<!-- identity:end -->';

/** The root of the repository. */
const REPOSITORY_DIR = Path.resolve(__dirname, '..');

/**
 * Writes the title, the English motto, and the English description of Heidrun between the two markers of README.md.
 */
class IdentityReadme {
	/**
	 * Reads data/identity.json, then replaces the text between the two markers of README.md.
	 *
	 * @returns Nothing. The process exits with the code 1 when a marker is missing.
	 */
	static run() {
		const identity = JSON.parse(Fs.readFileSync(Path.join(REPOSITORY_DIR, 'data/identity.json'), 'utf8'));
		const readmePath = Path.join(REPOSITORY_DIR, 'README.md');
		const readme = Fs.readFileSync(readmePath, 'utf8');
		const startIndex = readme.indexOf(START);
		const endIndex = readme.indexOf(END);
		if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
			console.error(`The markers ${START} and ${END} are missing from README.md, or are in the wrong order.`);
			process.exit(1);
		}
		const generated = IdentityReadme._render(identity);
		Fs.writeFileSync(readmePath, readme.slice(0, startIndex) + generated + readme.slice(endIndex + END.length));
		console.log('README.md: the title, the motto, and the description are up to date');
	}

	/**
	 * Builds the Markdown text of the title, the motto, and the description, with the two markers.
	 *
	 * @param identity - The content of data/identity.json.
	 * @returns The Markdown text, from the start marker to the end marker.
	 */
	static _render(identity) {
		return [
			START,
			'<!-- Generated from data/identity.json: pnpm docs:identity -->',
			'',
			`# ${identity.title}`,
			'',
			`### ${identity.motto.en}`,
			'',
			`**${identity.description.en}**`,
			'',
			END,
		].join('\n');
	}
}

IdentityReadme.run();
