import type { Config } from "tailwindcss";
// Brand colors (from the DaffoMart logo): change here to retheme the whole site
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      // colours come from CSS variables so Admin → Appearance really changes the site (defaults are in globals.css)
      primary: { DEFAULT: "rgb(var(--c-primary) / <alpha-value>)", dark: "rgb(var(--c-primary-dark) / <alpha-value>)", deeper: "rgb(var(--c-primary-deeper) / <alpha-value>)", light: "rgb(var(--c-primary-light) / <alpha-value>)", soft: "rgb(var(--c-primary-soft) / <alpha-value>)" },
      accent: { DEFAULT: "rgb(var(--c-accent) / <alpha-value>)", dark: "rgb(var(--c-accent-dark) / <alpha-value>)", soft: "rgb(var(--c-accent-soft) / <alpha-value>)" },
      secondary: { DEFAULT: "rgb(var(--c-secondary) / <alpha-value>)" },
    },
    fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"] },
    boxShadow: { card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)", pop: "0 12px 32px -8px rgba(16,24,40,.18)" },
  } },
  plugins: [],
};
export default config;
