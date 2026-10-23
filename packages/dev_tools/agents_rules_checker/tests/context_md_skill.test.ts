import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IssueFixSkill } from '../src/issue_fix_skill.ts';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');
const agentsFilePath = Path.join(repositoryPath, 'AGENTS.md');
const skillFolderPath = Path.join(repositoryPath, '.agents', 'skills', 'context_md_system');
const skillFilePath = Path.join(skillFolderPath, 'SKILL.md');
const claudeSkillLinkPath = Path.join(repositoryPath, '.claude', 'skills', 'context_md_system');

describe('the skill context_md_system', () => {
	it('names no detail of this repository, so the folder of the skill can be copied', () => {
		const skillText = Fs.readFileSync(skillFilePath, 'utf8');
		expect(IssueFixSkill.findRepositoryDetails(skillText)).toEqual([]);
	});

	it('has a header with the name of its folder and a description', () => {
		const skillText = Fs.readFileSync(skillFilePath, 'utf8');
		expect(skillText.startsWith('---\nname: context_md_system\ndescription: ')).toBe(true);
	});

	it('has the five groups of rules and the template', () => {
		const skillText = Fs.readFileSync(skillFilePath, 'utf8');
		for (const headingName of [
			'Read the files',
			'Create and update the files',
			'Keep each file short',
			'What goes in each section',
			'Verify the files',
			'The template',
		]) {
			expect(skillText).toContain(`## ${headingName}`);
		}
	});

	it('has the limit of 5500 bytes, and the shrink to 4500 bytes', () => {
		const skillText = Fs.readFileSync(skillFilePath, 'utf8');
		expect(skillText).toContain('under 5500 bytes');
		expect(skillText).toContain('shrink it to 4500 bytes');
	});

	it('has a template whose four section headings are in order', () => {
		const skillText = Fs.readFileSync(skillFilePath, 'utf8');
		const templateText = skillText.slice(skillText.indexOf('## The template'));
		const headingIndexes = ['## Purpose', '## Key Exports & Entry Points', '## Rules', '## Background'].map(
			(headingText) => {
				return templateText.indexOf(headingText);
			},
		);
		expect(headingIndexes.every((headingIndex) => headingIndex !== -1)).toBe(true);
		expect([...headingIndexes].sort((first, second) => first - second)).toEqual(headingIndexes);
	});

	it('has a pointer in AGENTS.md', () => {
		const agentsText = Fs.readFileSync(agentsFilePath, 'utf8');
		expect(agentsText).toContain('## CONTEXT.md files');
		expect(agentsText).toContain('(.agents/skills/context_md_system/SKILL.md)');
	});

	it('has a link in the folder .claude/skills that leads to the skill', () => {
		expect(Fs.lstatSync(claudeSkillLinkPath).isSymbolicLink()).toBe(true);
		expect(Fs.realpathSync(claudeSkillLinkPath)).toBe(Fs.realpathSync(skillFolderPath));
	});
});
