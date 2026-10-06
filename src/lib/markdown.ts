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
export interface MdContext {
  /** Web page of the project (https://gitlab.com/group/app): relative links and uploads resolve against it. */
  project: string;
  /** Hosts images may load from; any other image becomes a link (no tracking pixel on open). */
  imgHosts: string[];
}
let ctx: MdContext | null = null;

function resolve(u: string, c: MdContext): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("#")) return u;
  try {
    const origin = new URL(c.project).origin;
    // GitLab uploads ("/uploads/…") live under the project; other absolute paths under the host.
    if (u.startsWith("/uploads/")) return c.project.replace(/\/$/, "") + u;
    if (u.startsWith("/")) return origin + u;
    return new URL(u, c.project.replace(/\/?$/, "/")).href;
  } catch {
    return u;
  }
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "INPUT") node.setAttribute("disabled", "");
  if (node.tagName === "A") {
    const h = node.getAttribute("href");
    if (ctx && h) node.setAttribute("href", resolve(h, ctx));
  }
  if (node.tagName === "IMG") {
    const raw = node.getAttribute("src") ?? "";
    const src = ctx ? resolve(raw, ctx) : raw;
    let host = "";
    try {
      host = new URL(src).hostname;
    } catch {
      /* relative without context */
    }
    if (/^data:image\//.test(src) || (ctx && host && ctx.imgHosts.includes(host))) {
      node.setAttribute("src", src);
    } else {
      // Remote image from an unknown host: shown as a link, loaded only if clicked.
      const a = node.ownerDocument.createElement("a");
      a.setAttribute("href", src);
      a.textContent = `🖼 ${node.getAttribute("alt") || "image"}`;
      node.parentNode?.replaceChild(a, node);
    }
  }
});

/** Rendered and sanitized: scripts, event handlers and iframes never survive. */
export function renderMarkdown(text: string, context?: MdContext): string {
  const html = md.parse(text, { async: false }) as string;
  ctx = context ?? null;
  try {
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "iframe", "form", "button", "textarea", "select"], ADD_ATTR: ["target"] });
  } finally {
    ctx = null;
  }
}

export const isMarkdown = (path: string | null) => !!path && /\.(md|markdown|mdx)$/i.test(path);
