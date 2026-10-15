import Fs from 'node:fs';
import Path from 'node:path';
import Crypto from 'node:crypto';
import type { DocumentationInput, DocumentationOptions } from './documentation_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationInputs — discovers current rules and records their fingerprints
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Resolves inputs inside the checkout containing this package. */
export class DocumentationInputs {
	/**
	 * Lists selected interface rules and the current glossary.
	 * @param repositoryPath The checkout containing this package.
	 * @param options The requested scope and optional evidence directory.
	 * @returns Current source paths, in a stable order.
	 */
	static collect(repositoryPath: string, options: DocumentationOptions): string[] {
		const rulesPath = 'docs/agents_rules/user_interface';
		const rules = options.onlyRuleFiles.length === 0
			? DocumentationInputs._walk(repositoryPath, rulesPath).filter((file) => {
				return file.endsWith('.md') && ['README.md', 'index.md'].includes(Path.basename(file)) === false;
			})
			: options.onlyRuleFiles.map((file) => {
				const relative = DocumentationInputs._inside(repositoryPath, file);
				if (relative.startsWith(`${rulesPath}/`) === false || relative.endsWith('.md') === false
					|| Fs.statSync(Path.join(repositoryPath, relative)).isFile() === false) {
					throw new Error(`Expected a current interface rule file: ${file}`);
				}
				return relative;
			});
		const glossary = DocumentationInputs._walk(repositoryPath, 'docs/agents_rules/glossary');
		const files = [...rules, ...glossary];
		if (options.evidencePath !== undefined) {
			const evidence = DocumentationInputs._inside(repositoryPath, options.evidencePath);
			if (Fs.existsSync(Path.join(repositoryPath, evidence, 'manifest.json')) === false) {
				throw new Error('The evidence directory needs manifest.json; see the package README.');
			}
			files.push(...DocumentationInputs._walk(repositoryPath, evidence));
		}
		return [...new Set(files)].sort();
	}

	/**
	 * Fingerprints the selected inputs without changing them.
	 * @param repositoryPath The source checkout.
	 * @param files Repository-relative input paths.
	 * @returns Exact input hashes for the run record.
	 */
	static fingerprint(repositoryPath: string, files: string[]): DocumentationInput[] {
		return files.map((file) => ({
			path: file,
			sha256: Crypto.createHash('sha256').update(Fs.readFileSync(Path.join(repositoryPath, file))).digest('hex'),
		}));
	}

	/**
	 * Resolves a supplied path and rejects paths outside the source checkout.
	 * @param repositoryPath The source checkout.
	 * @param file A supplied relative or absolute path.
	 * @returns The canonical repository-relative path using forward slashes.
	 */
	private static _inside(repositoryPath: string, file: string): string {
		const relative = Path.relative(Fs.realpathSync(repositoryPath), Fs.realpathSync(Path.resolve(repositoryPath, file)));
		if (relative === '' || relative === '..' || relative.startsWith(`..${Path.sep}`) || Path.isAbsolute(relative)) {
			throw new Error(`Input must be inside this checkout: ${file}`);
		}
		return relative.split(Path.sep).join('/');
	}

	/**
	 * Lists regular files without following symbolic links or collecting build/dependency directories.
	 * @param repositoryPath The source checkout.
	 * @param directory The repository-relative directory.
	 * @returns Its regular files recursively.
	 */
	private static _walk(repositoryPath: string, directory: string): string[] {
		const files: string[] = [];
		for (const entry of Fs.readdirSync(Path.join(repositoryPath, directory), { withFileTypes: true })) {
			const file = `${directory}/${entry.name}`;
			if (entry.isDirectory() && ['node_modules', '.git', '.vitepress', 'runs'].includes(entry.name) === false) {
				files.push(...DocumentationInputs._walk(repositoryPath, file));
			} else if (entry.isFile()) {
				files.push(file);
			}
		}
		return files;
	}
}
