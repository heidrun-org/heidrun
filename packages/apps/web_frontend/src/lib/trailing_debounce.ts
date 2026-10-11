/** A function that runs once, a fixed time after its last call. */
export type TrailingDebounce = {
  /** Starts the wait again. The wrapped function runs when no new call comes during `delayMs`. */
  call: () => void;
  /** Drops the pending run, if there is one. */
  cancel: () => void;
};

/**
 * Wraps `run` so that it runs once, `delayMs` after the last call, and never during a burst of calls.
 * Used for the terminal: while the window is dragged to a new size, the terminal keeps its old size,
 * and it takes the new size once the window has stopped moving.
 */
export function trailingDebounce(run: () => void, delayMs: number): TrailingDebounce {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function call() {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      run();
    }, delayMs);
  }

  return { call, cancel };
}
