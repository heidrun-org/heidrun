// Builds the macOS disk image (.dmg) of Heidrun and uploads it to the GitHub release of the current version.
// pnpm release:dmg
import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { Command } from 'commander';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ReleaseDmg — builds the macOS disk image and uploads it to a GitHub release
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Builds the macOS disk image of Heidrun and uploads it to the GitHub release of the current version.
 */
class ReleaseDmg {
	/**
	 * Builds the disk image, then creates the GitHub release if it does not exist, uploads the disk image,
	 * and prints the URL of the release.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm release:dmg')
			.description(
				'Builds the macOS disk image of Heidrun and uploads it to the GitHub release of the version in the root '
					+ 'package.json. The release is created when it does not exist, and its text is rewritten when it '
					+ 'exists. The text of the release is the file '
					+ 'docs/release_notes/prefix.md, then the file of the option --notes-file, then the list of changes '
					+ 'that GitHub generates.',
			)
			.option(
				'--notes-file <path>',
				'Markdown file with the text of this release. It goes after the prefix and before the generated list of '
					+ 'changes.',
			)
			.option(
				'--recreate',
				'Delete the existing release and its tag, then create them again on the current commit. The release gets '
					+ 'a new date.',
			)
			.parse(argv);
		const options = program.opts<{ notesFile?: string; recreate?: boolean }>();

		let notesPath: string | undefined = undefined;
		if (options.notesFile !== undefined) {
			notesPath = Path.resolve(process.cwd(), options.notesFile);
			if (Fs.existsSync(notesPath) === false) {
				console.error(`The notes file does not exist: ${notesPath}`);
				process.exit(1);
			}
		}

		const rootDir = Path.resolve(__dirname, '..');
		const prefixPath = Path.join(rootDir, 'docs', 'release_notes', 'prefix.md');
		if (Fs.existsSync(prefixPath) === false) {
			console.error(`The release notes prefix file does not exist: ${prefixPath}`);
			process.exit(1);
		}

		if (process.platform !== 'darwin') {
			console.error('The disk image can only be built on macOS.');
			process.exit(1);
		}

		const rootPackage = JSON.parse(Fs.readFileSync(Path.join(rootDir, 'package.json'), 'utf8')) as { version: string };
		const version = rootPackage.version;
		const tagName = `v${version}`;

		ReleaseDmg._run('pnpm', ['--filter', 'desktop-tauri', 'tauri', 'build', '--bundles', 'dmg'], rootDir);

		const dmgDir = Path.join(rootDir, 'packages', 'desktop-tauri', 'target', 'release', 'bundle', 'dmg');
		const dmgFileNames = Fs.existsSync(dmgDir) === true
			? Fs.readdirSync(dmgDir).filter((fileName) => fileName.endsWith('.dmg') && fileName.includes(version))
			: [];
		if (dmgFileNames.length === 0) {
			console.error(`No disk image for version ${version} found in ${dmgDir}.`);
			process.exit(1);
		}
		const dmgPaths = dmgFileNames.map((fileName) => Path.join(dmgDir, fileName));

		const bodyDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'release_dmg_'));
		const bodyPath = Path.join(bodyDir, 'release_body.md');
		const prefixText = Fs.readFileSync(prefixPath, 'utf8').trimEnd();
		const notesText = notesPath !== undefined ? Fs.readFileSync(notesPath, 'utf8').trim() : '';
		Fs.writeFileSync(bodyPath, `${prefixText}\n\n${notesText}\n`);

		const releaseView = ChildProcess.spawnSync('gh', ['release', 'view', tagName], {
			cwd: rootDir,
			stdio: 'ignore',
		});
		let isReleaseExisting = releaseView.status === 0;
		if (isReleaseExisting === true && options.recreate === true) {
			ReleaseDmg._run('gh', ['release', 'delete', tagName, '--cleanup-tag', '--yes'], rootDir);
			isReleaseExisting = false;
		}
		if (isReleaseExisting === true) {
			ReleaseDmg._run('gh', ['release', 'upload', tagName, ...dmgPaths, '--clobber'], rootDir);
			const generatedNotes = ChildProcess.spawnSync(
				'gh',
				['api', 'repos/{owner}/{repo}/releases/generate-notes', '-f', `tag_name=${tagName}`, '--jq', '.body'],
				{
					cwd: rootDir,
					encoding: 'utf8',
				},
			);
			if (generatedNotes.status !== 0) {
				console.error('The list of changes could not be generated.');
				process.exit(generatedNotes.status ?? 1);
			}
			Fs.appendFileSync(bodyPath, `\n${generatedNotes.stdout.trim()}\n`);
			ReleaseDmg._run('gh', ['release', 'edit', tagName, '--notes-file', bodyPath], rootDir);
		} else {
			const commitSha = ChildProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
				cwd: rootDir,
				encoding: 'utf8',
			}).trim();
			ReleaseDmg._run(
				'gh',
				[
					'release',
					'create',
					tagName,
					...dmgPaths,
					'--target',
					commitSha,
					'--title',
					`Heidrun ${version}`,
					'--notes-file',
					bodyPath,
					'--generate-notes',
				],
				rootDir,
			);
		}

		const releaseUrl = ChildProcess.spawnSync('gh', ['release', 'view', tagName, '--json', 'url', '--jq', '.url'], {
			cwd: rootDir,
			encoding: 'utf8',
		}).stdout.trim();
		console.log(`\nThe release is available at: ${releaseUrl}`);
	}

	/**
	 * Runs a command, shows its output, and stops the script when the command fails.
	 * @param command The program to run.
	 * @param args The arguments of the program.
	 * @param cwd The folder in which the program runs.
	 * @returns Nothing.
	 */
	private static _run(command: string, args: string[], cwd: string): void {
		const result = ChildProcess.spawnSync(command, args, {
			cwd,
			stdio: 'inherit',
		});
		if (result.status !== 0) {
			console.error(`The command failed: ${command} ${args.join(' ')}`);
			process.exit(result.status ?? 1);
		}
	}
}

ReleaseDmg.main(process.argv);
