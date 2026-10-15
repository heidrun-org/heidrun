/** What the hold needs from the terminal of xterm. */
export type RefitTerminal = {
  /** Queues bytes for the terminal. The optional callback runs once the terminal has read them. */
  write: (data: Uint8Array | string, callback?: () => void) => void;
  /** Gives the terminal a new size, and reflows its lines. */
  resize: (cols: number, rows: number) => void;
};

/** The settings of one hold. */
export type RefitHoldOptions = {
  /** The terminal that shows the output of Herdr. */
  terminal: RefitTerminal;
  /** Tells Herdr the new size of the terminal, so that it redraws the screen at that size. */
  sendSize: (cols: number, rows: number) => void;
  /** Time without any output from Herdr, in milliseconds, that means the redraw is complete. */
  quietMs: number;
  /** Longest time, in milliseconds, that the old screen stays on show while the redraw is awaited. */
  maxMs: number;
};

/** A change of size that waits for the redraw of Herdr. */
export type RefitHold = {
  /** Tells Herdr the new size, then holds the output until the redraw is complete. Does nothing while busy. */
  start: (cols: number, rows: number) => void;
  /** Takes an output chunk of Herdr. Returns true when the chunk is held: the caller must not write it. */
  hold: (bytes: Uint8Array) => boolean;
  /** True from `start` until the terminal has taken its new size and the held output. */
  isBusy: () => boolean;
  /** Gives the terminal its new size at once and drops the held output, for a screen that is about to be reset. */
  cancel: () => void;
};

type PendingRefit = {
  cols: number;
  rows: number;
  chunks: Uint8Array[];
  isSettling: boolean;
  quietTimer: ReturnType<typeof setTimeout> | null;
  maxTimer: ReturnType<typeof setTimeout> | null;
};

/** Erases the screen and moves the cursor home. Unlike a reset, it keeps the modes that Herdr has set. */
const CLEAR_SCREEN = "\x1b[2J\x1b[H";

/**
 * Changes the size of the terminal without showing the screen in between.
 *
 * When xterm gets a new size, it reflows its old lines at once: the lines are split or joined, and the screen
 * shows that mess until Herdr sends the redraw for the new size. So the terminal keeps its old size and its old
 * screen, Herdr gets the new size, and the output of Herdr is kept back. When the output has stopped, the
 * terminal is cleared, takes the new size, and reads the kept output in one write: the screen goes from the old
 * picture to the new picture in one step.
 *
 * @param options - the terminal, the way to tell Herdr the size, and the waiting times
 * @returns the hold
 */
export function createRefitHold(options: RefitHoldOptions): RefitHold {
  let pending: PendingRefit | null = null;

  function clearTimers(current: PendingRefit) {
    if (current.quietTimer !== null) {
      clearTimeout(current.quietTimer);
      current.quietTimer = null;
    }
    if (current.maxTimer !== null) {
      clearTimeout(current.maxTimer);
      current.maxTimer = null;
    }
  }

  function settle() {
    if (pending === null || pending.isSettling === true) {
      return;
    }
    const current = pending;
    current.isSettling = true;
    clearTimers(current);
    options.terminal.write(CLEAR_SCREEN, () => {
      options.terminal.resize(current.cols, current.rows);
      if (current.chunks.length > 0) {
        const total = current.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const joined = new Uint8Array(total);
        let offset = 0;
        for (const chunk of current.chunks) {
          joined.set(chunk, offset);
          offset += chunk.length;
        }
        options.terminal.write(joined);
      }
      pending = null;
    });
  }

  function start(cols: number, rows: number) {
    if (pending !== null) {
      return;
    }
    pending = {
      cols,
      rows,
      chunks: [],
      isSettling: false,
      quietTimer: null,
      maxTimer: setTimeout(settle, options.maxMs),
    };
    options.sendSize(cols, rows);
  }

  function hold(bytes: Uint8Array): boolean {
    if (pending === null) {
      return false;
    }
    pending.chunks.push(bytes);
    if (pending.isSettling === false) {
      if (pending.quietTimer !== null) {
        clearTimeout(pending.quietTimer);
      }
      pending.quietTimer = setTimeout(settle, options.quietMs);
    }
    return true;
  }

  function isBusy(): boolean {
    return pending !== null;
  }

  function cancel() {
    if (pending === null || pending.isSettling === true) {
      return;
    }
    const current = pending;
    clearTimers(current);
    pending = null;
    options.terminal.resize(current.cols, current.rows);
  }

  return { start, hold, isBusy, cancel };
}
