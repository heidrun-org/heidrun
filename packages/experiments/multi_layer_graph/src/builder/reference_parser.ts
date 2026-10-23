///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ReferenceParser — finds the issues and the pull requests that a text names
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Finds the numbers of the issues and of the pull requests that a text names, with the text `#N`, or with the address
 * of the issue or of the pull request on GitHub. GitHub gives one number to an issue or to a pull request, never to
 * both, so the parser returns numbers only, and the builder finds the node.
 */
export class ReferenceParser {
	/**
	 * Finds every number that a text names: `#N`, `.../issues/N`, or `.../pull/N` of the repository. A text such as
	 * `owner/name#N` or `&#N` names nothing.
	 * @param text The text to read.
	 * @param repository The repository, in the format "owner/name".
	 * @returns The numbers, each one time, in the order of the text.
	 */
	static findMentionedNumbers(text: string, repository: string): number[] {
		const addressPattern = ReferenceParser._addressPattern(repository, 'issues|pull');
		const pattern = new RegExp(`(?<![\\w/&])#(\\d+)\\b|${addressPattern}`, 'g');
		const numbers = ReferenceParser._collectNumbers(text, pattern);
		return numbers;
	}

	/**
	 * Finds every number that a text closes, with the words of GitHub: "fix", "fixes", "fixed", "close", "closes",
	 * "closed", "resolve", "resolves", or "resolved", then `#N` or the address of the issue.
	 * @param text The text to read.
	 * @param repository The repository, in the format "owner/name".
	 * @returns The numbers, each one time, in the order of the text.
	 */
	static findFixedNumbers(text: string, repository: string): number[] {
		const addressPattern = ReferenceParser._addressPattern(repository, 'issues');
		const keywordPattern = '\\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\\b:?\\s+';
		const pattern = new RegExp(`${keywordPattern}(?:#(\\d+)\\b|${addressPattern})`, 'gi');
		const numbers = ReferenceParser._collectNumbers(text, pattern);
		return numbers;
	}

	/**
	 * Makes the pattern of the address of an issue or of a pull request of the repository on GitHub.
	 * @param repository The repository, in the format "owner/name".
	 * @param kindPattern The kinds of page, for example "issues|pull".
	 * @returns The pattern, with one group that holds the number.
	 */
	private static _addressPattern(repository: string, kindPattern: string): string {
		const repositoryPattern = repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const addressPattern = `https://github\\.com/${repositoryPattern}/(?:${kindPattern})/(\\d+)\\b`;
		return addressPattern;
	}

	/**
	 * Collects the numbers that a pattern finds in a text.
	 * @param text The text to read.
	 * @param pattern The pattern, with the flag "g", and groups that hold the number.
	 * @returns The numbers, each one time, in the order of the text.
	 */
	private static _collectNumbers(text: string, pattern: RegExp): number[] {
		const numbers: number[] = [];
		for (const match of text.matchAll(pattern)) {
			const numberStr = match.slice(1).find((group) => group !== undefined);
			if (numberStr === undefined) {
				continue;
			}
			const number = Number.parseInt(numberStr, 10);
			if (numbers.includes(number) === false) {
				numbers.push(number);
			}
		}
		return numbers;
	}
}
