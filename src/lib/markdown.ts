import { Marked } from "marked";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Markdown → HTML for in-app previews. Raw HTML in the source is escaped, never rendered. */
const md = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return esc(text);
    },
    link({ href, text }) {
      const safe = /^(https?:|mailto:|\/|#)/i.test(href ?? "") ? href : "#";
      return `<a href="${esc(safe ?? "#")}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`;
    },
  },
});

export function renderMarkdown(src: string) {
  const html = md.parse(src ?? "", { async: false }) as string;
  // Make editor flags impossible to miss.
  return html.replace(/\[VERIFY:([^\]]*)\]/g, '<span class="verify">VERIFY:$1</span>');
}
