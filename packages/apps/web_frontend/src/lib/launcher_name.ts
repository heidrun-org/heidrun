/** Number of characters of the command that make the name of a custom launcher, when the person gives no name. */
export const LAUNCHER_NAME_LENGTH = 20;

/** Name of a custom launcher without a name: the first 20 characters of its command, written on one line. */
export function launcherNameFromCommand(command: string): string {
  const oneLine = command.replace(/\s+/g, " ").trim();
  return Array.from(oneLine).slice(0, LAUNCHER_NAME_LENGTH).join("").trim();
}
