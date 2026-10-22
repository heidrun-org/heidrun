import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SiteFiles } from './site_files';

/** The command that removes the quarantine mark from Heidrun, as the issue 514 gives it. */
const quarantineCommand = 'xattr -dr com.apple.quarantine /Applications/Heidrun.app';

/** The files that must give the command, relative to the root of the repository. */
const filesWithCommand = ['docs/release_notes/prefix.md', 'README_DEV.md', 'HOW_TO_RELEASE.md'];

const prefix = Fs.readFileSync(Path.join(SiteFiles.repositoryDir, 'docs/release_notes/prefix.md'), 'utf8');

describe('macOS message "Heidrun is damaged"', () => {
	for (const filePath of filesWithCommand) {
		it(`is solved by the command of the issue 514 in ${filePath}`, () => {
			const text = Fs.readFileSync(Path.join(SiteFiles.repositoryDir, filePath), 'utf8');
			expect(text).toContain(quarantineCommand);
		});
	}

	it('is explained in the text of every GitHub release', () => {
		expect(prefix).toContain('## If macOS says that Heidrun is damaged');
		expect(prefix).toContain('is damaged and can\'t be opened');
		expect(prefix).toContain('not signed and not notarized by Apple');
	});

	it('is explained after the sentence about the installation', () => {
		const installation = prefix.indexOf(
			'To install Heidrun on a Mac with Apple silicon, run this command in a terminal.',
		);
		const section = prefix.indexOf('## If macOS says that Heidrun is damaged');
		expect(installation).toBeGreaterThan(-1);
		expect(section).toBeGreaterThan(installation);
	});
});
