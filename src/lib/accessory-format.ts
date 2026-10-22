// What an accessory row shows besides its title: the spec line (capacity,
// speed, connector, system) and price per GB. Client-safe: no Node imports.
import type { AccessorySpecs } from "./accessories";
import type { Currency } from "./markets";

/**
 * Accessory rows show the store's own listing photo, hotlinked from its CDN
 * (DECISIONS.md 2026-10-22, "Accessory photos"). false hides every one; the
 * category icon shows instead. Catalog products never use this: they need
 * licensed thumbnails (docs/images.md).
 */
export const ACCESSORY_IMAGES = true;
/** Pixel width asked of the store's CDN: the thumbnail shows at 56 CSS px, so 160 covers 2-3x screens. */
export const ACCESSORY_IMAGE_PX = 160;

/**
 * A listing's image URL as stored (accessory rows and second-hand offers): Shopify's CDN path after
 * "cdn.shopify.com/s/files/" with "~" in front ("~1/0603/4083/0375/files/x.jpg"),
 * any other https image as host and path. The query string goes when the path
 * is plainly an image file (it is only a cache-buster or a size); otherwise
 * it stays, since it may be what names the image. Not an http(s) URL, or
 * over 400 characters: none.
 */
export function compactImage(u: string | null | undefined): string | undefined {
  let raw = u?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("//")) raw = `https:${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (url.hostname === "cdn.shopify.com" && url.pathname.startsWith("/s/files/")) return `~${url.pathname.slice("/s/files/".length)}`;
  const out = /\.(jpe?g|png|webp|gif|avif)$/i.test(url.pathname) ? `${url.host}${url.pathname}` : `${url.host}${url.pathname}${url.search}`;
  return out.length <= 400 ? out : undefined;
}

/**
 * A stored image (compactImage) as the URL to load: Shopify's
 * CDN at a small width (`?width=`, which cdn.shopify.com and a shop's own
 * /cdn/shop/ path resize to), anything else as the store gave it.
 */
export function accessoryImageUrl(stored: string | null | undefined, px = ACCESSORY_IMAGE_PX): string | null {
  if (!ACCESSORY_IMAGES || !stored) return null;
  if (stored.startsWith("~")) return `https://cdn.shopify.com/s/files/${stored.slice(1)}?width=${px}`;
  const url = `https://${stored}`;
  return /\/cdn\/shop\//.test(stored) && !stored.includes("?") ? `${url}?width=${px}` : url;
}

const SYMBOL: Record<Currency, string> = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$" };

/** Price per GB from minor units per GB: "$0.14/GB", "$0.021/GB" (three places under ten cents). */
export function perGbText(minorPerGB: number, currency: Currency): string {
  const v = minorPerGB / 100;
  return `${SYMBOL[currency]}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v < 0.1 ? 3 : 2 })}/GB`;
}

export const capacityText = (gb: number) => (gb >= 1000 ? `${Math.round((gb / 1000) * 100) / 100}TB` : `${gb}GB`);

export function specLine(s: AccessorySpecs, formatLabel: string | null): string {
  const parts: string[] = [];
  if (formatLabel) parts.push(formatLabel);
  if (s.capacityGB) parts.push(s.pack && s.pack > 1 ? `${capacityText(s.capacityGB)} (${s.pack}-pack)` : capacityText(s.capacityGB));
  if (s.uhs) parts.push(s.uhs);
  if (s.vClass) parts.push(`V${s.vClass}`);
  if (s.vpg) parts.push(`VPG${s.vpg}`);
  if (s.readMBs || s.writeMBs) parts.push([s.readMBs ? `${s.readMBs} MB/s read` : null, s.writeMBs ? `${s.writeMBs} MB/s write` : null].filter(Boolean).join(", "));
  if (s.hdmi) parts.push(s.hdmi);
  if (s.hdmiVersion) parts.push(`HDMI ${s.hdmiVersion}`);
  if (s.usb) parts.push(s.usb);
  if (s.gbps) parts.push(`${s.gbps} Gbps`);
  if (s.watts) parts.push(`${s.watts} W`);
  if (s.lengthM) parts.push(s.lengthM < 1 ? `${Math.round(s.lengthM * 100)} cm` : `${s.lengthM} m`);
  return [...new Set(parts)].join(" · ");
}
