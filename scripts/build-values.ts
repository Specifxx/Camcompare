// Writes the static JSON My gear (/collection) values a collection with
// (gitignored, rebuilt every build; lib/gear-values.ts has the rules):
//   public/values/<market>.json         per product [typical used, lowest new], minor units
//   public/values/<market>/<slug>.json  that product's estimated value on past days
// Prices stay in each market's own currency. Amazon never: `lowest` leaves it
// out and price history never holds it.
import fs from "node:fs";
import path from "node:path";
import { historyAll, offersFor, publishedCameras, publishedLenses } from "../src/lib/catalog";
import type { SeriesFile, ValuesFile } from "../src/lib/collection";
import { sampleDays, valueSeries } from "../src/lib/gear-values";
import { MARKET_CODES, MARKETS } from "../src/lib/markets";
import { lowest } from "../src/lib/offers";
import { usedValue } from "../src/lib/value";

const out = path.join(process.cwd(), "public", "values");
fs.rmSync(out, { recursive: true, force: true });
const slugs = [...publishedCameras(), ...publishedLenses()].map((p) => p.slug);
let series = 0;
for (const m of MARKET_CODES) {
  const hist = historyAll(m);
  const days = sampleDays([...hist.values()].flatMap((h) => h.map((p) => p.day)));
  const currency = MARKETS[m].currency;
  const file: ValuesFile = { currency, day: days.at(-1) ?? null, p: {} };
  fs.mkdirSync(path.join(out, m), { recursive: true });
  for (const slug of slugs) {
    const h = hist.get(slug) ?? [];
    const used = usedValue(h)?.value ?? null;
    const low = lowest(offersFor(slug, m), "new")?.price ?? null;
    if (used !== null || low !== null) file.p[slug] = [used, low];
    const s = valueSeries(h, days);
    if (!s.length) continue;
    const sf: SeriesFile = { currency, s };
    fs.writeFileSync(path.join(out, m, `${slug}.json`), JSON.stringify(sf));
    series++;
  }
  fs.writeFileSync(path.join(out, `${m}.json`), JSON.stringify(file));
}
console.log(`gear values: ${MARKET_CODES.length} markets, ${series} value series`);
