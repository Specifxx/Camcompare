// What a source can say about a listing beyond its price (feedback round
// 2026-10-22: "OzBargain + camelcamelcamel + price checker + availability
// tracker"): the store's own struck-through price, stock beyond in/out, a
// bonus or promotion, and what tells two listings at one store apart.
//
// Everything here reads only what the store itself publishes (Shopify
// fields, JSON-LD, feed columns, the listing's own title and text) and
// returns null when that says nothing. Nothing is inferred from other
// stores or invented: a was-price is the store's compare-at or strikethrough
// price, never a launch price or an RRP from the catalog.
import type { Availability } from "../offers";

const strip = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ");

/** The store's struck-through price, only when it is above what it charges now. */
export function wasPriceOf(price: number, compareAt: number | null | undefined): number | null {
  return compareAt && Number.isFinite(compareAt) && compareAt > price ? Math.round(compareAt) : null;
}

// --------------------------------------------------------------- availability

const PREORDER = /\bpre[- ]?orders?\b|\bpre[- ]?sale\b|\bcoming soon\b/i;
const BACKORDER = /\bback[- ]?order(ed|s)?\b|\bawaiting ?stock\b|\bon order\b|\bincoming stock\b|\beta\b/i;
const LOW = /\blow[- ]?stock\b|\blimited stock\b|\bonly \d{1,2} left\b|\blast (one|few|\d{1,2})\b/i;
// A product description often carries the store's boilerplate ("pre-order
// items ship when stock arrives"): there only an explicit statement about
// THIS item counts.
const BODY_PREORDER = /\b(this (item|product|camera|lens) is (now )?(on |available (for|to) )?pre-?order|available (for|to) pre-?order( now)?|pre-?order (now|today) (for|to secure))\b/i;
const BODY_BACKORDER = /\b(this (item|product|camera|lens) is (currently )?(on )?back-?order(ed)?|currently on back-?order)\b/i;

/**
 * Shopify: `available` false is out of stock; a pre-order or back-order the
 * store names in its tags, title or product type (or plainly says in the
 * description) comes next; a stated low stock (tag, or an
 * `inventory_quantity` of 3 or fewer where the store exposes it) last.
 */
export function shopifyAvailability(p: { available: boolean; title: string; tags?: string[] | string; productType?: string | null; body?: string | null; inventoryQuantity?: number | null }): Availability {
  if (!p.available) return "out_of_stock";
  const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",");
  const named = `${p.title} | ${tags.join(" | ")} | ${p.productType ?? ""}`;
  const body = p.body ? strip(p.body).slice(0, 3000) : "";
  if (PREORDER.test(named) || BODY_PREORDER.test(body)) return "preorder";
  // "ETA" counts only as a tag or in the title ("ETA Nov"), never in prose.
  if (BACKORDER.test(named) || BODY_BACKORDER.test(body)) return "backorder";
  if (LOW.test(tags.join(" | ")) || (typeof p.inventoryQuantity === "number" && p.inventoryQuantity > 0 && p.inventoryQuantity <= 3)) return "low_stock";
  return "in_stock";
}

/** schema.org ItemAvailability ("https://schema.org/PreOrder") → ours; null when absent or unknown. */
export function schemaAvailability(v: string | undefined | null): Availability | null {
  const s = (v ?? "").toLowerCase().replace(/^https?:\/\/schema\.org\//, "");
  if (!s) return null;
  if (/preorder|presale/.test(s)) return "preorder";
  if (/backorder/.test(s)) return "backorder";
  if (/limitedavailability/.test(s)) return "low_stock";
  if (/outofstock|soldout|discontinued/.test(s)) return "out_of_stock";
  if (/instock|onlineonly|instoreonly/.test(s)) return "in_stock";
  return null;
}

/** Feed availability column (Google Shopping: "in_stock", "out_of_stock", "preorder", "backorder"). */
export function feedAvailability(v: string | undefined): Availability | null {
  const s = (v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (/^pre_?order/.test(s)) return "preorder";
  if (/^back_?order/.test(s)) return "backorder";
  if (/^limited|^low/.test(s)) return "low_stock";
  if (/^(out_of_stock|no|false|0|sold_out|unavailable)/.test(s)) return "out_of_stock";
  if (/^(in_?stock|yes|true|1|available)/.test(s)) return "in_stock";
  return null;
}

/** Pre-orders and back-orders are shown, but are not stock you can buy today. */
export const availableNow = (a: Availability | null | undefined, fallback: boolean) => (a ? a === "in_stock" || a === "low_stock" : fallback);

// ---------------------------------------------------------------------- promo

// "free" counts only when something is given free, never "free shipping",
// "hands-free" or "dust-free".
const PROMO = /\b(bonus|cash ?back|gift ?cards?|e-?gift|trade[- ]?in (bonus|offer|credit)|giftober|redemption|redeem|promo(tion)?|voucher)\b|(?<![-\w])free (?!shipping|delivery|returns?|postage|express|standard|click|pick|of charge on orders)(gift|[a-z0-9$][\w$.-]*)|\+\s?\$\d[\d,]*\s?(gift|voucher|e-?gift|credit)/i;
// In prose "bonus" is often just a word ("another bonus of the GX7 is its
// WiFi"): there it counts only as an offer ("receive a bonus …", "bonus
// battery", "$200 bonus").
const PROMO_BODY = /\b(cash ?back|gift ?cards?|e-?gift|trade[- ]?in (bonus|offer|credit)|giftober|redemption|redeem)\b|(?<![-\w])free gift\b|\b(receive|get|claim|includes?|plus|with) (a |an |your )?(free )?bonus\b|\bbonus (gift|offer|battery|batteries|lens|card|bag|kit|accessor\w*|memory|sd|grip|strap|tripod|\$)|\$\d[\d,]* (trade-in )?bonus\b/i;
const MAX_PROMO = 120;

const tidy = (s: string) => {
  const t = s.replace(/\s+/g, " ").replace(/^[\s,;:|+\-–—(]+|[\s,;:|+\-–—)]+$/g, "").trim();
  return t.length > MAX_PROMO ? `${t.slice(0, MAX_PROMO - 1).replace(/\s+\S*$/, "")}…` : t;
};

/**
 * A short bonus or promotion the store states: the part of the title that
 * names it ("… with Bonus Battery" → "Bonus Battery"), else a tag that does
 * ("Canon Cashback"), else the first sentence of the description that does.
 */
export function promoOf(p: { title: string; tags?: string[] | string | null; body?: string | null }): string | null {
  // Title: the piece after a separator that holds the keyword.
  const pieces = p.title.split(/\s+(?:with|w\/|incl\.?|includes|plus)\s+|\s*[+|(]\s*|\s+[-–—]\s+|\)\s*/i);
  const hit = pieces.find((x) => PROMO.test(x));
  if (hit) {
    const m = PROMO.exec(hit)!;
    // "Canon EOS R6 III Bonus Battery": start at the keyword, not the model.
    const from = /^(bonus|free|\+)/i.test(m[0]) || m.index > 30 ? m.index : 0;
    const out = tidy(hit.slice(from));
    if (out.length >= 4) return out;
  }
  const tags = (Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",")).map((t) => t.trim());
  // Ted's machine tags: "promo:trade-in-200".
  const machine = tags.map((t) => t.match(/^promo:\s*(.+)$/i)?.[1]).find(Boolean);
  if (machine) {
    const trade = machine.match(/^trade-?in-(\d+)$/i);
    return tidy(trade ? `Trade-in offer: $${trade[1]}` : machine.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
  }
  const tag = tags.find((t) => PROMO.test(t) && !/^(no|not)\b/i.test(t));
  if (tag) return tidy(tag);
  if (p.body) {
    const text = strip(p.body).slice(0, 4000);
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) if (PROMO_BODY.test(sentence) && !/\b(terms|conditions apply only|t&c|not eligible|excluded|exclusions)\b/i.test(sentence.slice(0, 40))) {
      const out = tidy(sentence);
      if (out.length >= 8) return out;
    }
  }
  return null;
}

// --------------------------------------------------------------------- detail

const MAX_DETAIL = 120;
const GRADE = /\((?:grade\s*)?((?:ex|excellent|mint|near mint|like new|as new|good|fair|well used|heavy use|ugly)\+{0,2}|[a-e][+-]?|\d{1,2}(?:\.\d)?\/10)\)|\b(?:grade|condition|rated)\s*:?\s*((?:ex|excellent|mint|near mint|like new|as new|good|very good|fair)\+{0,2}|[a-e][+-]?(?=\s|$|,)|\d{1,2}(?:\.\d)?\s?\/\s?10)\b|\b(mint in box|like new|as new|near mint|ex\+{1,2}|ex(?=\s|$))\b/i;
const SHUTTER = /\b(?:shutter (?:count|actuations?)|actuations?|sc|clicks?)\s*[:#]?\s*(?:of\s*)?(?:approx\.?\s*|~\s*)?(\d[\d,.]*\s?k?)\b|\b(\d[\d,.]*\s?k?)\s*(?:shutter (?:count|actuations?|clicks?)|actuations?|act\b|clicks)\b/i;
const SERIAL = /\b(?:s\/n|sn|serial(?: no\.?| number)?)\s*[:#]?\s*([a-z0-9]{5,16})\b/i;

function shutterText(raw: string): string | null {
  const s = raw.replace(/\s+/g, "").toLowerCase();
  const n = s.endsWith("k") ? Math.round(Number(s.slice(0, -1).replace(/,/g, "")) * 1000) : Number(s.replace(/[,.](?=\d{3}\b)/g, "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 && n < 2_000_000 ? `${n.toLocaleString("en-US")} shutter count` : null;
}

/**
 * What tells this listing apart from the store's other copies of the same
 * product: the variant (not Shopify's "Default Title"), the branch it sits
 * in, the grade, the shutter count, then the serial number. Joined by " · ",
 * at most 120 characters; null when the store says none of these.
 */
export function detailOf(p: { variant?: string | null; branch?: string | null; title: string; text?: string | null; used?: boolean }): string | null {
  const parts: string[] = [];
  const v = p.variant?.trim();
  if (v && !/^default( title)?$/i.test(v)) parts.push(v);
  const branch = p.branch?.replace(/\s+/g, " ").replace(/\s*(buys|loans|&|and|centre|center|store|-)+(\s+(buys|loans|&|and|centre|center|store))*\s*$/i, "").trim();
  if (branch) parts.push(`${branch} store`);
  if (p.used !== false) {
    const text = p.text ? strip(p.text).slice(0, 4000) : "";
    const g = GRADE.exec(p.title) ?? GRADE.exec(text);
    const grade = g ? (g[1] ?? g[2] ?? g[3]).trim() : null;
    if (grade) parts.push(/^\d/.test(grade) ? `Grade ${grade.replace(/\s/g, "")}` : /^[a-e][+-]?$/i.test(grade) ? `Grade ${grade.toUpperCase()}` : grade.replace(/^ex/i, "EX").replace(/^(\w)/, (c) => c.toUpperCase()));
    const sc = SHUTTER.exec(p.title) ?? SHUTTER.exec(text);
    const shutter = sc ? shutterText(sc[1] ?? sc[2]) : null;
    if (shutter) parts.push(shutter);
    const sn = SERIAL.exec(p.title);
    if (sn && /\d/.test(sn[1])) parts.push(`SN ${sn[1].toUpperCase()}`);
  }
  const out = [...new Set(parts)].join(" · ");
  return out ? (out.length > MAX_DETAIL ? `${out.slice(0, MAX_DETAIL - 1)}…` : out) : null;
}
