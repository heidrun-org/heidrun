// The saved searches of the Code hosting sidebar section: a search under a name, kept with the other options of
// Heidrun. A saved search is the same in every workspace. Each list has its own saved searches.
// - issue #374
// - issue #607
import { settings } from "./settings";
import type { CodeHostingGroup } from "./code_hosting";

/**
 * Saves a search under a name. A saved search of the same list that has the same name gets the new search.
 * @param group - the list that the saved search is for
 * @param name - the name of the saved search
 * @param query - the search, written in the search language of GitHub
 * @returns false when the name or the search is empty, true when the saved search is kept
 */
export function saveSearch(group: CodeHostingGroup, name: string, query: string): boolean {
  const cleanName = name.trim();
  const cleanQuery = query.trim();
  if (cleanName === "" || cleanQuery === "") {
    return false;
  }
  const list = settings.codeHostingSavedSearches[group];
  const same = list.find((saved) => saved.name === cleanName);
  if (same === undefined) {
    list.push({ name: cleanName, query: cleanQuery });
  } else {
    same.query = cleanQuery;
  }
  return true;
}

/**
 * Changes the name and the search of a saved search.
 * @param group - the list that the saved search is for
 * @param index - the place of the saved search in the list
 * @param name - the new name
 * @param query - the new search
 * @returns false when the saved search does not exist, when the name or the search is empty, or when another saved
 * search of the same list has the name. Nothing changes then.
 */
export function updateSavedSearch(group: CodeHostingGroup, index: number, name: string, query: string): boolean {
  const list = settings.codeHostingSavedSearches[group];
  const saved = list[index];
  const cleanName = name.trim();
  const cleanQuery = query.trim();
  if (saved === undefined || cleanName === "" || cleanQuery === "") {
    return false;
  }
  const hasOtherWithName = list.some((other, otherIndex) => otherIndex !== index && other.name === cleanName);
  if (hasOtherWithName) {
    return false;
  }
  saved.name = cleanName;
  saved.query = cleanQuery;
  return true;
}

/**
 * Deletes a saved search.
 * @param group - the list that the saved search is for
 * @param index - the place of the saved search in the list
 * @returns nothing
 */
export function deleteSavedSearch(group: CodeHostingGroup, index: number): void {
  settings.codeHostingSavedSearches[group].splice(index, 1);
}
