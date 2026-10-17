// Ad slot ids (AdSense), read at build time. Kept out of the "use client"
// AdSlot module: a client module's non-component exports become references,
// not values, in server components.
export const AD_SLOTS = {
  product: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRODUCT,
  listing: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTING,
  article: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE,
};
