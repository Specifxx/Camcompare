export const usdWhole = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;
export const centsToUsd = (cents: number) => usdWhole(cents / 100);
export const year = (iso: string) => iso.slice(0, 4);
