// Today's exchange rates (ECB reference rates via frankfurter.app: free, no
// key) into data/fx.json, for the "Price around the world" panel only
// (components/WorldPrices.tsx). Prices everywhere else stay in their own
// currency. Run by refresh-prices.yml before the commit; on any failure it
// keeps the last file and exits 0, so prices still land.
import fs from "node:fs";
import { FX_FILE, fxFileSchema } from "../src/lib/fx";

const URL = "https://api.frankfurter.app/latest?from=USD&to=GBP,EUR,AUD,SGD";

async function main() {
  try {
    const res = await fetch(URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { date?: string; base?: string; rates?: Record<string, number> };
    const fx = fxFileSchema.parse({ date: j.date, base: j.base ?? "USD", rates: { GBP: j.rates?.GBP, EUR: j.rates?.EUR, AUD: j.rates?.AUD, SGD: j.rates?.SGD } });
    fs.writeFileSync(FX_FILE, JSON.stringify(fx, null, 2) + "\n");
    console.log(`fx: ${fx.date} ${JSON.stringify(fx.rates)}`);
  } catch (e) {
    console.warn(`fx: kept the last data/fx.json (${(e as Error).message})`);
  }
}

void main();
