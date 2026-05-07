/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "outline": "#737785",
        "inverse-primary": "#b2c5ff",
        "on-tertiary-fixed-variant": "#005236",
        "secondary": "#515f74",
        "on-secondary-fixed": "#0d1c2e",
        "surface-bright": "#f7f9fb",
        "on-primary-fixed": "#001847",
        "secondary-fixed": "#d5e3fc",
        "surface-container-highest": "#e0e3e5",
        "on-surface-variant": "#424654",
        "background": "#f7f9fb",
        "primary-fixed": "#dae2ff",
        "surface-tint": "#0056d2",
        "primary": "#0040a1",
        "error": "#ba1a1a",
        "on-primary": "#ffffff",
        "surface-container-high": "#e6e8ea",
        "secondary-fixed-dim": "#b9c7df",
        "on-surface": "#191c1e",
        "on-error": "#ffffff",
        "tertiary-fixed": "#6ffbbe",
        "primary-fixed-dim": "#b2c5ff",
        "on-tertiary-container": "#63f1b4",
        "tertiary-container": "#006c49",
        "inverse-on-surface": "#eff1f3",
        "surface-container-low": "#f2f4f6",
        "on-tertiary-fixed": "#002113",
        "on-secondary-container": "#57657a",
        "inverse-surface": "#2d3133",
        "on-primary-container": "#ccd8ff",
        "on-primary-fixed-variant": "#0040a1",
        "surface": "#f7f9fb",
        "primary-container": "#0056d2",
        "surface-container-lowest": "#ffffff",
        "on-tertiary": "#ffffff",
        "secondary-container": "#d5e3fc",
        "on-background": "#191c1e",
        "surface-variant": "#e0e3e5",
        "on-secondary-fixed-variant": "#3a485b",
        "tertiary-fixed-dim": "#4edea3",
        "outline-variant": "#c3c6d6",
        "error-container": "#ffdad6",
        "surface-dim": "#d8dadc",
        "on-secondary": "#ffffff",
        "surface-container": "#eceef0",
        "on-error-container": "#93000a",
        "tertiary": "#005136"
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
    require("tailwind-scrollbar")
  ],
  // MUI utilise déjà ses propres resets : on désactive Preflight pour ne pas
  // perturber les composants MUI déjà en place.
  corePlugins: {
    preflight: false
  }
};
