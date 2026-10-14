import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentsRulesSize } from '../src/agents_rules_size.ts';
import { TemporaryFolder } from './temporary_folder.ts';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');
const agentsFilePath = Path.join(repositoryPath, 'AGENTS.md');
const agentsRulesPath = Path.join(repositoryPath, 'docs', 'agents_rules');

describe('AgentsRulesSize', () => {
	afterEach(() => {
		TemporaryFolder.removeAll();
	});

	describe('the real agent rules', () => {
		it('has no file larger than the maximum size that AGENTS.md gives', () => {
			const maximumSizeInBytes = AgentsRulesSize.readMaximumSizeInBytes(agentsFilePath);
			expect(AgentsRulesSize.findTooLargeFiles(agentsRulesPath, maximumSizeInBytes)).toEqual([]);
		});

		it('looks at the glossary and at the files of the subfolders', () => {
			const filePaths = AgentsRulesSize.listFiles(agentsRulesPath);
			expect(filePaths).toContain(Path.join(agentsRulesPath, 'glossary.md'));
			expect(filePaths).toContain(Path.join(agentsRulesPath, 'user_interface', 'window', 'layout.md'));
		});
	});

	describe('readMaximumSizeInBytes', () => {
		it('reads the number of bytes in the sentence about the maximum size', () => {
			const temporaryAgentsFilePath = Path.join(TemporaryFolder.create(), 'AGENTS.md');
			Fs.writeFileSync(
				temporaryAgentsFilePath,
				'The maximum size of a file in the folder `docs/agents_rules`, and in all its subfolders, is 1234 bytes.\n',
			);
			expect(AgentsRulesSize.readMaximumSizeInBytes(temporaryAgentsFilePath)).toBe(1234);
		});

		it('fails when the file does not give a maximum size', () => {
			const temporaryAgentsFilePath = Path.join(TemporaryFolder.create(), 'AGENTS.md');
			Fs.writeFileSync(temporaryAgentsFilePath, '# Rules\n\nNo number here.\n');
			expect(() => AgentsRulesSize.readMaximumSizeInBytes(temporaryAgentsFilePath)).toThrow('maximum size');
		});
	});

	describe('findTooLargeFiles', () => {
		it('finds a file that is larger than the maximum size, in a subfolder too', () => {
			const folderPath = TemporaryFolder.create();
			Fs.mkdirSync(Path.join(folderPath, 'user_interface', 'sidebars'), { recursive: true });
			Fs.writeFileSync(Path.join(folderPath, 'glossary.md'), 'a'.repeat(100));
			Fs.writeFileSync(Path.join(folderPath, 'user_interface', 'sidebars', 'chats.md'), 'a'.repeat(101));

			expect(AgentsRulesSize.findTooLargeFiles(folderPath, 100)).toEqual([
				{
					filePath: Path.join(folderPath, 'user_interface', 'sidebars', 'chats.md'),
					sizeInBytes: 101,
				},
			]);
		});

		it('accepts a file that has exactly the maximum size', () => {
			const folderPath = TemporaryFolder.create();
			Fs.writeFileSync(Path.join(folderPath, 'glossary.md'), 'a'.repeat(100));
			expect(AgentsRulesSize.findTooLargeFiles(folderPath, 100)).toEqual([]);
		});
	});
});
