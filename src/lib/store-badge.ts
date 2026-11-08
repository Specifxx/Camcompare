// The plain-HTML badge a store already listed can put on its own site (competitor scan, 2026-11-08), offered on
// /list-your-store. An ordinary link, no iframe, script, image or tracking, so the link sits on the store's own page.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function storeBadge(href: string, text: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:6px 10px;border:1px solid #d6dae1;border-radius:8px;font:600 12px system-ui,sans-serif;color:#0f172a;text-decoration:none;background:#fff">${esc(text)}</a>`;
}
