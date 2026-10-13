// The searches of the Code hosting sidebar section. A search is written in the search language of GitHub, which `gh`
// takes as it is. GitLab has no such language: its programming interface has separate filters. This file reads the
// words of a search, and translates the simple ones into the filters of GitLab. A word that GitLab cannot do is named,
// never ignored, because the lists would then show items that do not match the search.
// - issue #374
import type { CodeHostingGroup } from "../stores/code_hosting";

/** One word of a search. */
export type SearchWord = {
  /** The word as the developer wrote it, with its minus sign and its quotes. */
  text: string;
  /** True when the word starts with a minus sign, which means "not". */
  isNegated: boolean;
  /** The part before the colon, in lower case ("label" in `label:bug`), or null for a free word. */
  qualifier: string | null;
  /** The part after the colon without its quotes ("good first issue" in `label:"good first issue"`), or the free word. */
  value: string;
  /** True when the value was written between double quotes. */
  isQuoted: boolean;
};

/** The filters that GitLab takes for a search, or the reason why it takes none. */
export type GitlabTranslation =
  /** The query parameters of GitLab, each one as `name=value` with the name and the value already encoded. */
  | { kind: "filters"; parameters: string[] }
  /** The list holds nothing for this search, so GitLab needs no call. For example: `review-requested:` on issues. */
  | { kind: "empty" }
  /** GitLab cannot do the word of the search. */
  | { kind: "cannot"; word: string };

/**
 * Cuts a search into words at the spaces that are not between double quotes.
 * @param text - the search
 * @returns the words, each one as it was written
 */
export function splitSearch(text: string): string[] {
  const words: string[] = [];
  let current = "";
  let isInsideQuotes = false;
  for (const character of text) {
    if (character === '"') {
      isInsideQuotes = isInsideQuotes === false;
      current += character;
    } else if (/\s/.test(character) && isInsideQuotes === false) {
      if (current !== "") {
        words.push(current);
      }
      current = "";
    } else {
      current += character;
    }
  }
  if (current !== "") {
    words.push(current);
  }
  return words;
}

/**
 * Removes the double quotes around a value.
 * @param value - the value, with or without quotes
 * @returns the value, and whether it had quotes
 */
function unquote(value: string): { value: string; isQuoted: boolean } {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return { value: value.slice(1, -1), isQuoted: true };
  }
  return { value, isQuoted: false };
}

/**
 * Reads the words of a search.
 * @param text - the search
 * @returns the words
 */
export function parseSearch(text: string): SearchWord[] {
  return splitSearch(text).map((word) => {
    const isNegated = word.length > 1 && word.startsWith("-");
    const rest = isNegated ? word.slice(1) : word;
    const match = /^([A-Za-z][A-Za-z-]*):(.+)$/.exec(rest);
    if (match === null) {
      return { text: word, isNegated, qualifier: null, ...unquote(rest) };
    }
    return { text: word, isNegated, qualifier: match[1].toLowerCase(), ...unquote(match[2]) };
  });
}

/**
 * The state that `gh` must read. `gh` reads the open items by default. A search that names a state, such as
 * `is:closed`, needs all the items, so that the search decides.
 * @param text - the search
 * @returns "open" for a search that names no state, "all" otherwise
 */
export function githubState(text: string): "open" | "all" {
  const namesState = parseSearch(text).some((word) => {
    return word.qualifier === "state" || (word.qualifier === "is" && ["open", "closed", "merged"].includes(word.value.toLowerCase()));
  });
  return namesState ? "all" : "open";
}

/**
 * The arguments of `gh issue list` and `gh pr list` that carry a search.
 * @param text - the search, empty for no search
 * @returns the flag `--search` with the text, or nothing for an empty search
 */
export function githubSearchArguments(text: string): string[] {
  const search = text.trim();
  return search === "" ? [] : ["--search", search];
}

/**
 * Tells whether a search needs the login of the person who is signed in, because it uses `@me`.
 * @param text - the search
 * @returns true when a word of the search has the value `@me`
 */
export function usesCurrentUser(text: string): boolean {
  return parseSearch(text).some((word) => word.qualifier !== null && word.value === "@me");
}

/**
 * Tells whether a word has a parenthesis outside its quotes.
 * @param word - the word
 * @returns true when the word groups
 */
function hasParenthesis(word: SearchWord): boolean {
  return /[()]/.test(word.text.replace(/"[^"]*"/g, ""));
}

/**
 * Translates a search into the filters of GitLab for one list. GitLab does the words `author:`, `assignee:`, `label:`,
 * `milestone:`, `no:label`, `no:assignee`, `no:milestone`, `is:open`, `is:closed`, `is:merged`, `review-requested:`,
 * the minus sign on the four first, and the free words.
 * @param group - the list: the issues, or the merge requests
 * @param text - the search
 * @param login - the login of the person who is signed in, for `@me`, or null when it is not known
 * @returns the filters, or "empty", or the first word that GitLab cannot do
 */
export function translateForGitlab(group: CodeHostingGroup, text: string, login: string | null): GitlabTranslation {
  let state = "opened";
  let isStateSet = false;
  let isEmpty = false;
  const pairs: [string, string][] = [];
  const usedNames = new Set<string>();
  const labels: string[] = [];
  const notLabels: string[] = [];
  const freeWords: string[] = [];
  const usedFields = new Set<string>();
  const noFields = new Set<string>();

  for (const word of parseSearch(text)) {
    const cannot: GitlabTranslation = { kind: "cannot", word: word.text };
    if (hasParenthesis(word)) {
      return cannot;
    }
    if (word.qualifier === null) {
      if (word.text === "AND") {
        continue;
      }
      if (word.text === "OR" || word.text === "NOT" || word.isNegated || word.isQuoted) {
        return cannot;
      }
      freeWords.push(word.value);
      continue;
    }
    const value = word.value === "@me" ? login : word.value;
    if (value === null) {
      return cannot;
    }
    const field = word.qualifier;
    if (["author", "assignee", "milestone", "label"].includes(field)) {
      if (noFields.has(field)) {
        return cannot;
      }
      usedFields.add(field);
    }
    let name: string | null = null;
    switch (field) {
      case "author":
        name = word.isNegated ? "not[author_username]" : "author_username";
        break;
      case "assignee":
        name = word.isNegated ? "not[assignee_username]" : "assignee_username[]";
        break;
      case "milestone":
        name = word.isNegated ? "not[milestone]" : "milestone";
        break;
      case "label":
        if (value.includes(",")) {
          return cannot;
        }
        (word.isNegated ? notLabels : labels).push(value);
        break;
      case "no": {
        const noName = { label: "labels", assignee: "assignee_id", milestone: "milestone" }[value];
        if (word.isNegated || noName === undefined || usedFields.has(value) || usedNames.has(noName)) {
          return cannot;
        }
        noFields.add(value);
        usedNames.add(noName);
        pairs.push([noName, "None"]);
        break;
      }
      case "is": {
        const wanted = { open: "opened", opened: "opened", closed: "closed", merged: "merged" }[value.toLowerCase()];
        if (word.isNegated || wanted === undefined || isStateSet) {
          return cannot;
        }
        isStateSet = true;
        state = wanted;
        if (wanted === "merged" && group === "issues") {
          isEmpty = true;
        }
        break;
      }
      case "review-requested":
        if (word.isNegated || usedNames.has("reviewer_username")) {
          return cannot;
        }
        usedNames.add("reviewer_username");
        if (group === "requests") {
          pairs.push(["reviewer_username", value]);
        } else {
          isEmpty = true;
        }
        break;
      default:
        return cannot;
    }
    if (name !== null) {
      if (usedNames.has(name)) {
        return cannot;
      }
      usedNames.add(name);
      pairs.push([name, value]);
    }
  }

  if (isEmpty) {
    return { kind: "empty" };
  }
  if (labels.length > 0) {
    pairs.push(["labels", labels.join(",")]);
  }
  if (notLabels.length > 0) {
    pairs.push(["not[labels]", notLabels.join(",")]);
  }
  if (freeWords.length > 0) {
    pairs.push(["search", freeWords.join(" ")]);
  }
  const parameters = [["state", state] as [string, string], ...pairs].map(([name, value]) => {
    return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  });
  return { kind: "filters", parameters };
}
