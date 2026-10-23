import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IssueFixSkill } from '../src/issue_fix_skill.ts';
import { SkillValues } from '../src/skill_values.ts';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');
const agentsFilePath = Path.join(repositoryPath, 'AGENTS.md');

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One skill of the folder `docs`, and what its test expects. */
type DocsFolderSkill = {
	/** The name of the skill, which is also the name of its folder. */
	skillName: string;
	/** The heading of the section of the file `AGENTS.md` that gives the values of the skill. */
	valuesHeading: string;
	/** The name of each value that the skill reads. */
	valueNames: readonly string[];
	/** The heading of each group of rules of the skill. */
	headingNames: readonly string[];
};

const DOCS_FOLDER_SKILLS: readonly DocsFolderSkill[] = [
	{
		skillName: 'docs_folder_system',
		valuesHeading: '### Docs folder system values',
		valueNames: ['Documentation folder', 'Files with no metadata header'],
		headingNames: [
			'The values of the repository',
			'The metadata header',
			'The two files of each folder',
			'Add, rename, move, or delete',
			'The template',
		],
	},
	{
		skillName: 'docs_folder_agents_rules_system',
		valuesHeading: '### Docs folder agents rules system values',
		valueNames: ['Agent rules folder', 'Glossary folder', 'Maximum size of a file', 'Size test command'],
		headingNames: [
			'This skill needs the skill docs_folder_system',
			'The values of the repository',
			'Read the rules',
			'Use the words of the glossary',
			'Keep the rules up to date',
			'Keep each file small',
			'The template',
		],
	},
];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

for (const docsFolderSkill of DOCS_FOLDER_SKILLS) {
	const skillFolderPath = Path.join(repositoryPath, '.agents', 'skills', docsFolderSkill.skillName);
	const skillFilePath = Path.join(skillFolderPath, 'SKILL.md');
	const claudeSkillLinkPath = Path.join(repositoryPath, '.claude', 'skills', docsFolderSkill.skillName);

	describe(`the skill ${docsFolderSkill.skillName}`, () => {
		it('names no detail of this repository, so the folder of the skill can be copied', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(IssueFixSkill.findRepositoryDetails(skillText)).toEqual([]);
		});

		it('has a header with the name of its folder and a description', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(skillText.startsWith(`---\nname: ${docsFolderSkill.skillName}\ndescription: `)).toBe(true);
		});

		it('has its groups of rules and the template', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			for (const headingName of docsFolderSkill.headingNames) {
				expect(skillText).toContain(`## ${headingName}`);
			}
		});

		it('names every value that it reads, between quotation marks', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(SkillValues.findValuesNotNamedBySkill(skillText, docsFolderSkill.valueNames)).toEqual([]);
		});

		it('has a template that gives every value', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			const templateText = skillText.slice(skillText.indexOf('## The template'));
			expect(
				SkillValues.findMissingValues(templateText, docsFolderSkill.valuesHeading, docsFolderSkill.valueNames),
			).toEqual([]);
		});

		it('has a pointer in AGENTS.md, and AGENTS.md gives every value', () => {
			const agentsText = Fs.readFileSync(agentsFilePath, 'utf8');
			expect(agentsText).toContain(`(.agents/skills/${docsFolderSkill.skillName}/SKILL.md)`);
			expect(
				SkillValues.findMissingValues(agentsText, docsFolderSkill.valuesHeading, docsFolderSkill.valueNames),
			).toEqual([]);
		});

		it('has a link in the folder .claude/skills that leads to the skill', () => {
			expect(Fs.lstatSync(claudeSkillLinkPath).isSymbolicLink()).toBe(true);
			expect(Fs.realpathSync(claudeSkillLinkPath)).toBe(Fs.realpathSync(skillFolderPath));
		});
	});
}

describe('the dependency between the two skills of the folder docs', () => {
	it('makes the skill of the agent rules name the skill of the folder docs', () => {
		const skillFilePath = Path.join(repositoryPath, '.agents', 'skills', 'docs_folder_agents_rules_system', 'SKILL.md');
		const skillText = Fs.readFileSync(skillFilePath, 'utf8');
		expect(skillText).toContain('needs the skill docs_folder_system');
	});
});

describe('SkillValues', () => {
	it('finds the values that the section does not give, and stops at the next heading', () => {
		const agentsText = '### Some values\n\n- First value: one\n\n## Next section\n\n- Second value: two\n';
		expect(SkillValues.findMissingValues(agentsText, '### Some values', ['First value', 'Second value'])).toEqual([
			'Second value',
		]);
	});

	it('gives every value as missing when the section does not exist', () => {
		expect(SkillValues.findMissingValues('# Rules\n', '### Some values', ['First value'])).toEqual(['First value']);
	});

	it('finds the values that a skill does not name between quotation marks', () => {
		const skillText = 'Read the value "First value".';
		expect(SkillValues.findValuesNotNamedBySkill(skillText, ['First value', 'Second value'])).toEqual([
			'Second value',
		]);
	});
});
