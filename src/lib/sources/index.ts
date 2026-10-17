import { RETAILERS } from "../retailers";
import { amazonSource } from "./amazon";
import { ebaySource } from "./ebay";
import { feedSource } from "./feed";
import type { PriceSource } from "./types";

export const SOURCES: PriceSource[] = RETAILERS.flatMap((r) =>
  r.source === "amazon-creators" ? [amazonSource] : r.source === "ebay-browse" ? [ebaySource] : r.source === "feed" ? [feedSource(r.key)] : [],
);
