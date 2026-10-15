/** What a terminal does when its attach client has stopped. */
export type AttachOutcome =
  /** Attach again after a short wait. */
  | "retry"
  /** Another client holds the terminal, and the retries did not free it: show the choice to the developer. */
  | "held"
  /** The attach client keeps stopping: show the choice to the developer. */
  | "detached";

/** Time, in milliseconds, after the start of an attach during which a stop of the attach client is a failed attach. */
export const EARLY_STOP_MS = 4000;
/** Number of retries when Herdr is busy, or when the attach client stops at once. */
export const BUSY_RETRY_LIMIT = 6;
/** Number of retries when another client holds the terminal. The holder can be the attach client of this application that is still stopping. */
export const HELD_RETRY_LIMIT = 2;

const HELD_PATTERN = /already has an attached client/i;
const BUSY_PATTERN = /read in progress/i;

/**
 * True when Herdr refused the attach because another client holds the terminal. A retry without `--takeover` cannot
 * succeed while that client lives.
 */
export function isHeldByAnotherClient(output: string): boolean {
  return HELD_PATTERN.test(output);
}

/**
 * Decides what the terminal does when its attach client has stopped.
 *
 * @param output The first text that the attach client wrote.
 * @param elapsedMs Time, in milliseconds, between the start of the attach and its stop.
 * @param retries Number of retries already made for this attach.
 */
export function decideAfterStop(output: string, elapsedMs: number, retries: number): AttachOutcome {
  if (isHeldByAnotherClient(output)) {
    return retries < HELD_RETRY_LIMIT ? "retry" : "held";
  }
  const isBusy = BUSY_PATTERN.test(output) || elapsedMs < EARLY_STOP_MS;
  if (isBusy && retries < BUSY_RETRY_LIMIT) {
    return "retry";
  }
  return "detached";
}

/**
 * Time to wait, in milliseconds, before a retry. The wait grows with each retry. The wait for a terminal that another
 * client holds is longer, because the attach client of this application needs 400 milliseconds to stop.
 *
 * @param output The first text that the attach client wrote.
 * @param retryNumber Number of this retry, counted from 1.
 */
export function retryDelayMs(output: string, retryNumber: number): number {
  return (isHeldByAnotherClient(output) ? 500 : 250) * retryNumber;
}
