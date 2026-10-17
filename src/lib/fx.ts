// Exchange rates for ONE place: the clearly labelled "Price around the world"
// panel (components/WorldPrices.tsx), where a price is shown in its own
// currency with an approximate conversion beside it (DECISIONS 2026-10-17,
// "Price around the world"). Never use this to show a converted price
// anywhere else. data/fx.json is written by scripts/fetch-fx.ts (ECB rates
// via frankfurter.app); without it, the sanity-check reference rates.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { refRate, type Currency } from "./markets";

export const FX_FILE = path.join(process.cwd(), "data", "fx.json");

const rate = z.number().positive();
export const fxFileSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.literal("USD"),
  rates: z.object({ GBP: rate, EUR: rate, AUD: rate, SGD: rate }),
});
export type FxFile = z.infer<typeof fxFileSchema>;
/** Units of each currency per US dollar, and the day they are from (null: reference rates). */
export type Fx = { date: string | null; rates: Record<Currency, number> };

let memo: Fx | null = null;

export function readFx(file = FX_FILE): Fx {
  if (memo && file === FX_FILE) return memo;
  let fx: Fx;
  try {
    const f = fxFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    fx = { date: f.date, rates: { USD: 1, ...f.rates } };
  } catch {
    fx = { date: null, rates: { USD: 1, GBP: refRate("GBP"), EUR: refRate("EUR"), AUD: refRate("AUD"), SGD: refRate("SGD") } };
  }
  if (file === FX_FILE) memo = fx;
  return fx;
}

/** An amount (any units) from one currency into another, approximately. */
export const convert = (amount: number, from: Currency, to: Currency, fx: Fx = readFx()) => (amount / fx.rates[from]) * fx.rates[to];
