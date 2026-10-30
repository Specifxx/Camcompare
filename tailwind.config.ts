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
        // The logo's amber blade (Logo.tsx and the home page only; fails text contrast on white).
        spark: v("spark"),
        // Spending money: buy buttons and "lowest price" chips only.
        buy: { DEFAULT: v("buy"), fg: v("buy-fg"), soft: v("buy-soft") },
        win: v("win"),
        warn: v("warn"),
      },
      fontFamily: {
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { md: "8px", lg: "12px", xl: "14px", "2xl": "18px" },
      boxShadow: { card: "var(--shadow-card)", lift: "var(--shadow-lift)" },
    },
  },
  plugins: [],
};
export default config;
