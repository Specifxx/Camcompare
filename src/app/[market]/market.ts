import { notFound } from "next/navigation";
import { isMarket, type MarketCode } from "@/lib/markets";

/** The validated market of a /[market]/… route. */
export function marketParam(p: { market: string }): MarketCode {
  if (!isMarket(p.market) || p.market === "us") notFound();
  return p.market;
}
