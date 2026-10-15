/** Writes a number with two digits, with a leading zero when the number has one digit. */
function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The date and time of a build, written as `<year><month><day>-<hours><minutes><seconds>`, in the local time of the
 * computer that does the build, on the 24-hour clock. Example: `20261015-143005`.
 */
export function formatBuildTime(date: Date): string {
  const day = `${date.getFullYear()}${twoDigits(date.getMonth() + 1)}${twoDigits(date.getDate())}`;
  const time = `${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}${twoDigits(date.getSeconds())}`;
  return `${day}-${time}`;
}

/**
 * The version of the application, then a dash, then the date and time of the build. Example: `0.2.5-20261015-143005`.
 * When the version is not known, the result is empty, so the window never shows a dash alone.
 */
export function versionWithBuildTime(version: string, buildTime: string): string {
  if (version === "") {
    return "";
  }
  return `${version}-${buildTime}`;
}
