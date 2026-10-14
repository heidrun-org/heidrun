// The saved searches of the Code hosting sidebar section: a search under a name, kept with the other options of
// Heidrun. A saved search is the same in every workspace.
// - issue #374
import { settings } from "./settings";

/**
 * Saves a search under a name. A saved search that has the same name gets the new search.
 * @param name - the name of the saved search
 * @param query - the search, written in the search language of GitHub
 * @returns false when the name or the search is empty, true when the saved search is kept
 */
export function saveSearch(name: string, query: string): boolean {
  const cleanName = name.trim();
  const cleanQuery = query.trim();
  if (cleanName === "" || cleanQuery === "") {
    return false;
  }
  const same = settings.codeHostingSavedSearches.find((saved) => saved.name === cleanName);
  if (same === undefined) {
    settings.codeHostingSavedSearches.push({ name: cleanName, query: cleanQuery });
  } else {
    same.query = cleanQuery;
  }
  return true;
}

/**
 * Changes the name and the search of a saved search.
 * @param index - the place of the saved search in the list
 * @param name - the new name
 * @param query - the new search
 * @returns false when the saved search does not exist, when the name or the search is empty, or when another saved
 * search has the name. Nothing changes then.
 */
export function updateSavedSearch(index: number, name: string, query: string): boolean {
  const saved = settings.codeHostingSavedSearches[index];
  const cleanName = name.trim();
  const cleanQuery = query.trim();
  if (saved === undefined || cleanName === "" || cleanQuery === "") {
    return false;
  }
  const hasOtherWithName = settings.codeHostingSavedSearches.some((other, otherIndex) => {
    return otherIndex !== index && other.name === cleanName;
  });
  if (hasOtherWithName) {
    return false;
  }
  saved.name = cleanName;
  saved.query = cleanQuery;
  return true;
}

/**
 * Deletes a saved search.
 * @param index - the place of the saved search in the list
 * @returns nothing
 */
export function deleteSavedSearch(index: number): void {
  settings.codeHostingSavedSearches.splice(index, 1);
}
