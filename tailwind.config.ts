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
        accent: { DEFAULT: v("accent"), fg: v("accent-fg"), soft: v("accent-soft"), 2: v("accent-2") },
        azure: v("azure"),
        // The iris's amber blade: decoration only (fails text contrast on white).
        spark: v("spark"),
        // Spending money: buy buttons and "lowest price" chips only.
        buy: { DEFAULT: v("buy"), fg: v("buy-fg"), soft: v("buy-soft") },
        win: v("win"),
        warn: v("warn"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { md: "4px", lg: "6px", xl: "8px" },
      boxShadow: { lift: "var(--shadow-lift)", glow: "0 0 0 1px rgb(var(--c-accent) / 0.2), 0 10px 36px -14px rgb(var(--c-accent) / 0.6)" },
    },
  },
  plugins: [],
};
export default config;
