import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MultiLayerGraphSchema } from '../src/graph/multi_layer_graph_types.ts';
import { TestDatabase } from './test_database.ts';

const __dirname = import.meta.dirname;

/**
 * The result of one run of the command line in a new process.
 */
type CliResult = {
	/** The text printed on the standard error output. */
	stderr: string;
	/** The exit code of the command line. */
	exitCode: number | null;
};

/**
 * Runs the command line `src/cli.ts` in a new process.
 */
class CliRunner {
	/**
	 * Runs the command line.
	 * @param args The arguments of the command line.
	 * @returns The standard error output and the exit code.
	 */
	static run(args: string[]): CliResult {
		const packageFolder = Path.join(__dirname, '..');
		const tsxPath = Path.join(packageFolder, 'node_modules', '.bin', 'tsx');
		const spawnResult = ChildProcess.spawnSync(
			tsxPath,
			['--disable-warning=ExperimentalWarning', Path.join(packageFolder, 'src', 'cli.ts'), ...args],
			{
				encoding: 'utf8',
			},
		);
		return {
			stderr: spawnResult.stderr,
			exitCode: spawnResult.status,
		};
	}
}

afterEach(() => {
	TestDatabase.removeAll();
});

describe('the command line', () => {
	it('writes the file graph.json of the repository, and prints the counts', () => {
		const databasePath = TestDatabase.create([
			{
				repository: 'heidrun-org/heidrun',
				issueRows: [TestDatabase.issueRow(1, 'The bug', '')],
				pullRequestRows: [TestDatabase.pullRequestRow(2, 'The fix', 'Fixes #1', 'ccc')],
				commitRows: [TestDatabase.commitRow('ccc', [], 'Merge pull request #2', '')],
			},
		]);
		const outputPath = Path.join(TestDatabase.createFolder(), 'folder', 'graph.json');
		const cliResult = CliRunner.run(['--database', databasePath, '--output', outputPath]);
		expect(cliResult.exitCode).toBe(0);
		expect(cliResult.stderr).toContain('3 nodes (1 Issues, 1 Pull requests, 1 Commits), 2 links.');
		const multiLayerGraph = MultiLayerGraphSchema.parse(JSON.parse(Fs.readFileSync(outputPath, 'utf8')));
		expect(multiLayerGraph.repository).toBe('heidrun-org/heidrun');
		const nodeIds = multiLayerGraph.nodes.map((graphNode) => graphNode.id);
		expect(nodeIds).toEqual(['issue:1', 'pull_request:2', 'commit:ccc']);
	});

	it('says which commands fill the SQLite file when it does not exist, and exits with the code 1', () => {
		const folder = TestDatabase.createFolder();
		const missingPath = Path.join(folder, 'missing.sqlite');
		const cliResult = CliRunner.run(['--database', missingPath, '--output', Path.join(folder, 'graph.json')]);
		expect(cliResult.exitCode).toBe(1);
		expect(cliResult.stderr).toContain('does not exist');
		expect(cliResult.stderr).toContain('pnpm --silent data_layer:code_hosting initialize');
		expect(cliResult.stderr).toContain('pnpm --silent data_layer:source_control initialize');
		expect(Fs.existsSync(Path.join(folder, 'missing.sqlite'))).toBe(false);
		expect(Fs.existsSync(Path.join(folder, 'graph.json'))).toBe(false);
	});

	it('exits with the code 1 when the SQLite file has no row for the repository', () => {
		const databasePath = TestDatabase.create([
			{
				repository: 'other/project',
				issueRows: [TestDatabase.issueRow(1, 'Other', '')],
			},
		]);
		const outputPath = Path.join(TestDatabase.createFolder(), 'graph.json');
		const cliResult = CliRunner.run(['--database', databasePath, '--output', outputPath]);
		expect(cliResult.exitCode).toBe(1);
		expect(cliResult.stderr).toContain('has no row for the repository heidrun-org/heidrun');
	});

	it('warns about each table with no row, and still writes the graph', () => {
		const databasePath = TestDatabase.create([
			{
				repository: 'heidrun-org/heidrun',
				commitRows: [TestDatabase.commitRow('aaa', [], 'A commit', '')],
			},
		]);
		const outputPath = Path.join(TestDatabase.createFolder(), 'graph.json');
		const cliResult = CliRunner.run(['--database', databasePath, '--output', outputPath]);
		expect(cliResult.exitCode).toBe(0);
		expect(cliResult.stderr).toContain(
			'Warning: no row for the repository heidrun-org/heidrun in the tables issues, pull_requests.',
		);
		expect(cliResult.stderr).toContain('pnpm --silent data_layer:code_hosting initialize');
		expect(cliResult.stderr).not.toContain('data_layer:source_control');
	});
});
