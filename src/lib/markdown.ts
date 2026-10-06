// Markdown → safe HTML for reading (GFM tables, task lists, code highlighted).
import { Marked } from "marked";
import DOMPurify from "dompurify";
import { highlightLine } from "./highlight";
import hljs from "highlight.js/lib/core";

const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    code({ text, lang }) {
      const l = (lang ?? "").trim().split(/\s+/)[0].toLowerCase();
      const known = l && hljs.getLanguage(l) ? l : null;
      const body = known
        ? hljs.highlight(text, { language: known, ignoreIllegals: true }).value
        : highlightLine(text, null);
      return `<pre class="md-code"><code>${body}</code></pre>`;
    },
  },
});

// Task-list boxes are the only inputs kept, and they stay read-only.
DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "input" && (node as Element).getAttribute("type") !== "checkbox") node.parentNode?.removeChild(node);
});
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "INPUT") node.setAttribute("disabled", "");
});

/** Rendered and sanitized: scripts, event handlers and iframes never survive. */
export function renderMarkdown(text: string): string {
  const html = md.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "iframe", "form", "button", "textarea", "select"], ADD_ATTR: ["target"] });
}

export const isMarkdown = (path: string | null) => !!path && /\.(md|markdown|mdx)$/i.test(path);
