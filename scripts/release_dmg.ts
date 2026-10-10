// Builds the macOS disk image (.dmg) of Heidrun and uploads it to the GitHub release of the current version.
// pnpm release:dmg
import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
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
					+ 'package.json. The release is created when it does not exist.',
			)
			.option(
				'--notes-file <path>',
				'Markdown file with the text of the release. GitHub shows this text above the generated list of changes.',
			)
			.parse(argv);
		const options = program.opts<{ notesFile?: string }>();

		let notesPath: string | undefined = undefined;
		if (options.notesFile !== undefined) {
			notesPath = Path.resolve(process.cwd(), options.notesFile);
			if (Fs.existsSync(notesPath) === false) {
				console.error(`The notes file does not exist: ${notesPath}`);
				process.exit(1);
			}
		}

		if (process.platform !== 'darwin') {
			console.error('The disk image can only be built on macOS.');
			process.exit(1);
		}

		const rootDir = Path.resolve(__dirname, '..');
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

		const releaseView = ChildProcess.spawnSync('gh', ['release', 'view', tagName], {
			cwd: rootDir,
			stdio: 'ignore',
		});
		if (releaseView.status === 0) {
			ReleaseDmg._run('gh', ['release', 'upload', tagName, ...dmgPaths, '--clobber'], rootDir);
			if (notesPath !== undefined) {
				ReleaseDmg._run('gh', ['release', 'edit', tagName, '--notes-file', notesPath], rootDir);
			}
		} else {
			const notesArgs = notesPath !== undefined ? ['--notes-file', notesPath] : [];
			ReleaseDmg._run(
				'gh',
				[
					'release',
					'create',
					tagName,
					...dmgPaths,
					'--title',
					`Heidrun ${version}`,
					...notesArgs,
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
