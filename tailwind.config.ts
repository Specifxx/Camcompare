import type { Config } from "tailwindcss";

// Colours are RGB triplets in globals.css (`:root` light, dark under
// prefers-color-scheme), so one className renders right in both themes.
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        raised: v("raised"),
        line: v("line"),
        fg: v("fg"),
        muted: v("muted"),
        subtle: v("subtle"),
        accent: { DEFAULT: v("accent"), fg: v("accent-fg"), soft: v("accent-soft") },
        // Spending money: buy buttons and "lowest price" chips only.
        buy: { DEFAULT: v("buy"), fg: v("buy-fg"), soft: v("buy-soft") },
        win: v("win"),
        warn: v("warn"),
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { md: "6px", lg: "8px", xl: "12px" },
    },
  },
  plugins: [],
};
export default config;
