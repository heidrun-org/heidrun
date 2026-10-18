///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	IssueFixSkill — checks that the skill `issue_fix_workflow` stays general and that `AGENTS.md` gives its values
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Checks the skill `issue_fix_workflow` and the section "Issue Fix Workflow values" of the file `AGENTS.md`. The skill
 * is copied to other repositories, so it must name no detail of this repository. The file `AGENTS.md` must give every
 * value that the skill reads.
 */
export class IssueFixSkill {
	/** The heading of the section of the file `AGENTS.md` that holds the values of the repository. */
	static readonly valuesHeading = '### Issue Fix Workflow values';

	/** The name of each value that the skill reads, as the skill and the file `AGENTS.md` write it. */
	static readonly valueNames: readonly string[] = [
		'Target branch',
		'Worktree creation command',
		'Worktree folder',
		'Launch command',
		'Issue tracker commands',
		'Chat rename',
	];

	/** Each pattern finds one kind of detail of this repository that the skill must not name. */
	static readonly repositoryDetailPatterns: readonly RegExp[] = [
		/heidrun/i,
		/dev_jerome|dev_eric/,
		/J[ée]r[ôo]me|\bEric\b/,
		/\bpnpm\b/,
		/\bgh\b/,
		/\bglab\b/,
		/CLAUDE_CODE_HOST_SESSION_ID/,
		/mcp__/,
		/worktree:create/,
		/\.claude\b/,
		/docs\/agents_rules/,
		/\bClaude\b|\bCodex\b/,
	];

	/**
	 * Finds the details of one repository that a skill text names.
	 * @param skillText The text of the file `SKILL.md`.
	 * @returns The text that matched each pattern, one entry for each pattern that matched. Empty when the skill is general.
	 */
	static findRepositoryDetails(skillText: string): string[] {
		const details: string[] = [];
		for (const pattern of IssueFixSkill.repositoryDetailPatterns) {
			const match = pattern.exec(skillText);
			if (match !== null) {
				details.push(match[0]);
			}
		}
		return details;
	}

	/**
	 * Finds the values that the section "Issue Fix Workflow values" of the file `AGENTS.md` does not give.
	 * @param agentsText The text of the file `AGENTS.md`.
	 * @returns The names of the missing values. All the names when the section does not exist.
	 */
	static findMissingValues(agentsText: string): string[] {
		const headingIndex = agentsText.indexOf(IssueFixSkill.valuesHeading);
		if (headingIndex === -1) {
			return [...IssueFixSkill.valueNames];
		}
		const afterHeadingText = agentsText.slice(headingIndex + IssueFixSkill.valuesHeading.length);
		const nextHeadingIndex = afterHeadingText.search(/\n#{1,6} /);
		const sectionText = nextHeadingIndex === -1 ? afterHeadingText : afterHeadingText.slice(0, nextHeadingIndex);
		return IssueFixSkill.valueNames.filter((valueName) => {
			return sectionText.includes(`\n- ${valueName}:`) === false;
		});
	}

	/**
	 * Finds the values that a skill text does not name between quotation marks.
	 * @param skillText The text of the file `SKILL.md`.
	 * @returns The names of the values that the skill does not name.
	 */
	static findValuesNotNamedBySkill(skillText: string): string[] {
		return IssueFixSkill.valueNames.filter((valueName) => {
			return skillText.includes(`"${valueName}"`) === false;
		});
	}
}
