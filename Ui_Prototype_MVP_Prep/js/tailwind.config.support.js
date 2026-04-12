/**
 * Tailwind Configuration for Support Page
 * Extends the base Tailwind configuration with custom theme colors,
 * border radius, and font families specific to the OOH Marketplace
 */

tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Primary Colors */
        primary: "#00081e",
        "on-primary": "#ffffff",
        "primary-fixed": "#d9e2ff",
        "primary-fixed-dim": "#b4c6f4",
        "on-primary-fixed": "#041a3f",
        "on-primary-fixed-variant": "#34466d",
        "primary-container": "#0a1f44",
        "on-primary-container": "#7687b2",
        "inverse-primary": "#b4c6f4",

        /* Secondary Colors */
        secondary: "#855300",
        "on-secondary": "#ffffff",
        "secondary-fixed": "#ffddb8",
        "secondary-fixed-dim": "#ffb95f",
        "on-secondary-fixed": "#2a1700",
        "on-secondary-fixed-variant": "#653e00",
        "secondary-container": "#fea619",
        "on-secondary-container": "#684000",

        /* Tertiary Colors */
        tertiary: "#060031",
        "on-tertiary": "#ffffff",
        "tertiary-fixed": "#e4dfff",
        "tertiary-fixed-dim": "#c6bfff",
        "on-tertiary-fixed": "#160066",
        "on-tertiary-fixed-variant": "#4029bb",
        "tertiary-container": "#1a0073",
        "on-tertiary-container": "#8274ff",

        /* Error Colors */
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        /* Surface Colors */
        surface: "#f9f9ff",
        "on-surface": "#0b1c32",
        "on-surface-variant": "#44464e",
        "surface-bright": "#f9f9ff",
        "surface-dim": "#cbdbf9",
        "surface-container": "#e7eeff",
        "surface-container-low": "#f0f3ff",
        "surface-container-high": "#dee8ff",
        "surface-container-highest": "#d5e3ff",
        "surface-container-lowest": "#ffffff",
        "surface-tint": "#4c5e86",
        "inverse-surface": "#223149",
        "inverse-on-surface": "#ecf1ff",

        /* Background */
        background: "#f9f9ff",
        "on-background": "#0b1c32",

        /* Variants & Outlines */
        "surface-variant": "#d5e3ff",
        outline: "#75777f",
        "outline-variant": "#c5c6cf"
      },

      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },

      fontFamily: {
        headline: ["Epilogue", "Syne", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        label: ["Inter", "sans-serif"]
      }
    }
  }
};
