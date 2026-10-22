///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SkillValues — checks the values that a general skill reads in a section of the file `AGENTS.md`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Checks the values of a general skill. A general skill names no detail of one repository: it reads each value of the
 * repository in one section of the file `AGENTS.md`, on a line that starts with `- <value name>:`.
 */
export class SkillValues {
	/**
	 * Finds the values that a section of the file `AGENTS.md` does not give.
	 * @param agentsText The text of the file `AGENTS.md`.
	 * @param valuesHeading The heading of the section that holds the values, for example `### Issue Fix Workflow values`.
	 * @param valueNames The name of each value that the skill reads.
	 * @returns The names of the missing values. All the names when the section does not exist.
	 */
	static findMissingValues(agentsText: string, valuesHeading: string, valueNames: readonly string[]): string[] {
		const headingIndex = agentsText.indexOf(valuesHeading);
		if (headingIndex === -1) {
			return [...valueNames];
		}
		const afterHeadingText = agentsText.slice(headingIndex + valuesHeading.length);
		const nextHeadingIndex = afterHeadingText.search(/\n#{1,6} /);
		const sectionText = nextHeadingIndex === -1 ? afterHeadingText : afterHeadingText.slice(0, nextHeadingIndex);
		return valueNames.filter((valueName) => {
			return sectionText.includes(`\n- ${valueName}:`) === false;
		});
	}

	/**
	 * Finds the values that a skill text does not name between quotation marks.
	 * @param skillText The text of the file `SKILL.md`.
	 * @param valueNames The name of each value that the skill reads.
	 * @returns The names of the values that the skill does not name.
	 */
	static findValuesNotNamedBySkill(skillText: string, valueNames: readonly string[]): string[] {
		return valueNames.filter((valueName) => {
			return skillText.includes(`"${valueName}"`) === false;
		});
	}
}
