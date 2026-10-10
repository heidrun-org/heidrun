import type { MergedPullRequest } from './change_log_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChangeLogRenderer — writes the text of the change log: the section, the prompt, and the file
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The first lines of a new `CHANGELOG.md` file, in the Keep a Changelog format.
 */
const CHANGE_LOG_HEADER = [
	'# Changelog',
	'',
	'All notable changes to this project are documented in this file.',
	'',
	'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to '
		+ '[Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
	'',
].join('\n');

/**
 * The heading line of the section that holds the changes after the last release.
 */
const UNRELEASED_HEADING = '## [Unreleased]';

/**
 * Builds the texts of the change log. The class reads nothing and writes nothing: it only turns data into text.
 */
export class ChangeLogRenderer {
	/**
	 * Writes the section `Unreleased` without a coding agent: one bullet for every merged pull request, with its title
	 * and its number. The method does not choose a category.
	 * @param mergedPullRequests The merged pull requests.
	 * @param repositoryUrl The web address of the GitHub repository, or null when it is not known.
	 * @param lastTag The last release, or null when there is none.
	 * @returns The section, in Markdown.
	 */
	static renderMechanicalSection(
		mergedPullRequests: MergedPullRequest[],
		repositoryUrl: string | null,
		lastTag: string | null,
	): string {
		if (mergedPullRequests.length === 0) {
			const sinceStr = lastTag === null ? '' : ` since ${lastTag}`;
			return `${UNRELEASED_HEADING}\n\nNo merged pull request${sinceStr}.`;
		}
		const bullets = mergedPullRequests.map((mergedPullRequest) => {
			const link = ChangeLogRenderer._renderPullRequestLink(mergedPullRequest, repositoryUrl);
			return `- ${mergedPullRequest.title} (${link})`;
		});
		return `${UNRELEASED_HEADING}\n\n${bullets.join('\n')}`;
	}

	/**
	 * Writes the prompt that asks a coding agent to write the section `Unreleased`.
	 * @param mergedPullRequests The merged pull requests, with the message of each merge commit.
	 * @param repositoryUrl The web address of the GitHub repository, or null when it is not known.
	 * @param lastTag The last release, or null when there is none.
	 * @returns The prompt.
	 */
	static buildPrompt(
		mergedPullRequests: MergedPullRequest[],
		repositoryUrl: string | null,
		lastTag: string | null,
	): string {
		const sinceStr = lastTag === null ? 'the start of the project' : `the release ${lastTag}`;
		const linkExample = repositoryUrl === null
			? '(#116)'
			: `([#116](${repositoryUrl}/pull/116))`;
		const pullRequestTexts = mergedPullRequests.map((mergedPullRequest) => {
			return [
				`Pull request #${mergedPullRequest.number}`,
				`Branch: ${mergedPullRequest.branchName}`,
				'Message of the merge commit:',
				mergedPullRequest.message,
			].join('\n');
		});
		return [
			'You write the change log of the application Heidrun.',
			'',
			`Below is the list of the pull requests that were merged since ${sinceStr}. Each item has the number of the `
				+ 'pull request, the name of its branch, and the message of its merge commit.',
			'',
			'Write the new section of the file CHANGELOG.md, in the Keep a Changelog 1.1.0 format.',
			'',
			'Rules:',
			`- Start with the heading line "${UNRELEASED_HEADING}".`,
			'- Group the changes under these headings, in this order: "### Added", "### Changed", "### Deprecated", '
				+ '"### Removed", "### Fixed", "### Security".',
			'- Leave out a heading that has no change.',
			'- Write one bullet for each change, in plain English, for the people who use the application.',
			'- Join several pull requests that make one change into one bullet.',
			'- Leave out a pull request that only changes the version number of the application.',
			`- End each bullet with a link to its pull request, in this form: ${linkExample}. Use all the numbers of `
				+ 'the pull requests of the bullet.',
			'- Answer with the Markdown text of the section only. Do not write an introduction, an explanation, or a '
				+ 'code fence.',
			'',
			'Merged pull requests:',
			'',
			pullRequestTexts.join('\n\n---\n\n'),
		].join('\n');
	}

	/**
	 * Checks the answer of a coding agent and cleans it: removes a code fence around the text, and writes the exact
	 * heading `## [Unreleased]`.
	 * @param answer The answer of the coding agent.
	 * @returns The section, in Markdown.
	 * @throws An error when the answer does not start with a heading of level 2.
	 */
	static cleanAgentAnswer(answer: string): string {
		let lines = answer.trim().split('\n');
		if (lines[0].startsWith('```') && lines[lines.length - 1].trim() === '```') {
			lines = lines.slice(1, -1);
		}
		const firstLine = lines[0] ?? '';
		if (firstLine.startsWith('## ') === false) {
			throw new Error(`The coding agent did not answer with a section of the change log:\n${answer}`);
		}
		lines[0] = UNRELEASED_HEADING;
		return lines.join('\n').trim();
	}

	/**
	 * Puts the new section in the text of the file `CHANGELOG.md`, below the header and above all the older sections.
	 * An older section that is already `## [Unreleased]` is replaced. The other older sections stay exactly as they
	 * are.
	 * @param existingText The text of the file `CHANGELOG.md`, or null when the file does not exist.
	 * @param section The new section, in Markdown.
	 * @returns The new text of the file.
	 */
	static insertSection(existingText: string | null, section: string): string {
		const sectionLines = section.trim().split('\n');
		if (existingText === null || existingText.trim() === '') {
			return `${CHANGE_LOG_HEADER}\n${sectionLines.join('\n')}\n`;
		}
		const lines = existingText.split('\n');
		const firstSectionIndex = lines.findIndex((line) => {
			return line.startsWith('## ');
		});
		if (firstSectionIndex === -1) {
			return `${existingText.trimEnd()}\n\n${sectionLines.join('\n')}\n`;
		}
		let endIndex = firstSectionIndex;
		if (lines[firstSectionIndex].startsWith(UNRELEASED_HEADING)) {
			endIndex = lines.findIndex((line, index) => {
				return index > firstSectionIndex && line.startsWith('## ');
			});
			if (endIndex === -1) {
				endIndex = lines.length;
			}
		}
		return [
			...lines.slice(0, firstSectionIndex),
			...sectionLines,
			'',
			...lines.slice(endIndex),
		].join('\n');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Writes the link to one pull request.
	 * @param mergedPullRequest The merged pull request.
	 * @param repositoryUrl The web address of the GitHub repository, or null when it is not known.
	 * @returns A Markdown link, or the plain number when the address is not known.
	 */
	private static _renderPullRequestLink(mergedPullRequest: MergedPullRequest, repositoryUrl: string | null): string {
		if (repositoryUrl === null) {
			return `#${mergedPullRequest.number}`;
		}
		return `[#${mergedPullRequest.number}](${repositoryUrl}/pull/${mergedPullRequest.number})`;
	}
}
