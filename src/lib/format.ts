import { money, type Currency } from "./markets";

export const year = (iso: string) => iso.slice(0, 4);
/** Minor units (cents) in a currency → "£1,899". */
export const price = (minor: number, currency: Currency) => money(minor, currency, true);
/** A list price as published: whole units, with cents only when it has them ("$2,299.99"). */
export function listPrice(amount: number, currency: Currency): string {
  const whole = Number.isInteger(amount);
  const symbol = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$" }[currency];
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
export const monthYear = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export const longMonthYear = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
