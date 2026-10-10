/**
 * Tailwind powers the whole app: the frame system (`components/fobs/*`) and the
 * pages are Tailwind-authored.
 *
 * `preflight` is OFF. Preflight is Tailwind's global element reset — it would
 * wipe the heading margins, list styles and form defaults that `app/globals.css`
 * (the hand-authored "Soft Editorial Fintech" system) supplies. `globals.css`
 * already sets `box-sizing: border-box` and normalises `a`/`button`/`input`,
 * which is all the frame relies on. Utilities (specificity 0,1,0) still win over
 * bare element rules in `globals.css` (0,0,1).
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
