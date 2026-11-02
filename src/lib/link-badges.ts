// Free link badges (DECISIONS.md, "Free link badges", 2026-11-02): plain HTML a blog, store or community site pastes
// to point readers at a price comparison. No iframe, no script, no image, so the site stays fully static (a live
// price widget would need a function). Pure: tests/link-badges.test.ts.
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One styled link, inline CSS only. */
export function linkBadge(href: string, text: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:6px 10px;border:1px solid #d6dae1;border-radius:8px;font:600 12px system-ui,sans-serif;color:#0f172a;text-decoration:none;background:#fff">${esc(text)}</a>`;
}
