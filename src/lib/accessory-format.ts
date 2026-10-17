// What an accessory row shows besides its title: the spec line (capacity,
// speed, connector, system) and price per GB. Client-safe: no Node imports.
import type { AccessorySpecs } from "./accessories";
import type { Currency } from "./markets";

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
