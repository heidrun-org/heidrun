/** How long the pointer stays on a row before a line that does not fit starts to scroll, in milliseconds. */
const SCROLL_DELAY = 300;

/** How fast a line scrolls, in pixels each second. */
const SCROLL_SPEED = 60;

/** The shortest time that a line takes to scroll, in milliseconds. */
const SCROLL_MIN_DURATION = 800;

/**
 * Starts the CSS animation of each scrolling line of the row under the pointer that does not fit: the browser moves the
 * text from its beginning to its end. A scrolling line is the component `ScrollingLine`.
 * @param event - the event `pointerenter` of the row
 */
export function startScrolling(event: PointerEvent): void {
  for (const line of (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[data-scroll]")) {
    const text = line.firstElementChild as HTMLElement;
    const overflow = text.scrollWidth - line.clientWidth;
    if (overflow <= 0) {
      continue;
    }
    const duration = Math.max(SCROLL_MIN_DURATION, (overflow / SCROLL_SPEED) * 1000);
    line.style.setProperty("--scroll-distance", `${overflow}px`);
    line.style.setProperty("--scroll-duration", `${duration}ms`);
    line.style.setProperty("--scroll-delay", `${SCROLL_DELAY}ms`);
    line.classList.add("is-scrolling");
  }
}

/**
 * Stops the scrolling lines of the row, and shows their beginning again.
 * @param event - the event `pointerleave` of the row
 */
export function stopScrolling(event: PointerEvent): void {
  for (const line of (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[data-scroll]")) {
    line.classList.remove("is-scrolling");
  }
}
