import type { Config } from "tailwindcss";

/**
 * Merged design-system config, extracted from the static prototype's five
 * per-page tailwind.config.*.js files (Ui_Prototype_MVP_Prep/js/).
 *
 * Notable extraction decisions (see MVP build notes / CLAUDE.md for detail):
 * - `primary` is declared twice in js/tailwind.config.js ("#0A1F44" then
 *   "#00081e"). Plain JS object literals let the later key win, so the
 *   prototype actually renders primary as #00081e everywhere. We use that
 *   value here. #0a1f44 survives as `primary-container`, unchanged.
 * - borderRadius uses "Scale A" (none/sm/DEFAULT/md/lg/xl/2xl) from
 *   tailwind.config.js / tailwind.config.checkout.js. The login/wizard/
 *   support/campaign configs ship a different scale that redefines
 *   `full: 0.75rem`, silently turning every `rounded-full` avatar/pill into
 *   a squircle. That is a prototype bug and is intentionally NOT ported —
 *   `full` is left at Tailwind's default 9999px.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Material-3 tokens (deduped from the prototype's JS object literals —
        // "primary" is intentionally #00081e, see comment above).
        primary: "#00081e",
        secondary: "#855300",
        surface: "#F9F9FF",
        "surface-container": "#E7EEFF",
        outline: "#75777F",
        "on-surface-variant": "#44464E",
        "tertiary-container": "#1a0073",
        "surface-bright": "#f9f9ff",
        "surface-container-lowest": "#ffffff",
        "on-secondary": "#ffffff",
        "on-secondary-fixed-variant": "#653e00",
        tertiary: "#060031",
        "on-error": "#ffffff",
        "surface-variant": "#d5e3ff",
        "surface-container-low": "#f0f3ff",
        "on-error-container": "#93000a",
        "on-secondary-fixed": "#2a1700",
        "primary-fixed-dim": "#b4c6f4",
        "outline-variant": "#c5c6cf",
        "surface-tint": "#4c5e86",
        "surface-container-highest": "#d5e3ff",
        "secondary-fixed-dim": "#ffb95f",
        background: "#f9f9ff",
        "on-background": "#0b1c32",
        "surface-dim": "#cbdbf9",
        "on-tertiary-fixed": "#160066",
        "on-primary-fixed-variant": "#34466d",
        "inverse-primary": "#b4c6f4",
        "on-primary": "#ffffff",
        "primary-container": "#0a1f44",
        "inverse-on-surface": "#ecf1ff",
        "on-surface": "#0b1c32",
        "primary-fixed": "#d9e2ff",
        "inverse-surface": "#223149",
        "surface-container-high": "#dee8ff",
        "secondary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#c6bfff",
        "on-secondary-container": "#684000",
        error: "#ba1a1a",
        "secondary-container": "#fea619",
        "on-primary-container": "#7687b2",
        "error-container": "#ffdad6",
        "tertiary-fixed": "#e4dfff",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#8274ff",
        "on-tertiary-fixed-variant": "#4029bb",
        "on-primary-fixed": "#041a3f",
        // Additions on top of the prototype's M3 palette.
        accent: "#FEA619",
        "border-subtle": "rgba(10, 31, 68, 0.1)",
      },
      borderRadius: {
        none: "0",
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        // `full` intentionally left at Tailwind's default (9999px).
      },
      fontFamily: {
        headline: ["var(--font-epilogue)", "sans-serif"],
        body: ["var(--font-manrope)", "sans-serif"],
        label: ["var(--font-inter)", "sans-serif"],
        epilogue: ["var(--font-epilogue)", "sans-serif"],
        manrope: ["var(--font-manrope)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        syne: ["var(--font-syne)", "sans-serif"],
      },
      spacing: {
        "128": "32rem",
        "144": "36rem",
      },
      minHeight: {
        "600px": "600px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};

export default config;
