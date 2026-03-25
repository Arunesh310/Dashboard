/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Shadowfax.in — greens, yellows, and ink from public site (approximate to live CSS)
        sfx: {
          DEFAULT: "#008A71",
          deep: "#006b57",
          soft: "#E6F4F0",
          yellow: "#D5D226",
          cta: "#F1EE1B",
          cream: "#FFFDB1",
          ink: "#332F22",
          muted: "#545454",
          body: "#363D47",
        },
      },
      screens: {
        xs: "480px",
      },
      fontFamily: {
        sans: [
          '"Montserrat"',
          '"Plus Jakarta Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.05), 0 4px 16px rgb(15 23 42 / 0.06)",
        "card-dark":
          "0 1px 0 rgb(255 255 255 / 0.04) inset, 0 8px 32px rgb(0 0 0 / 0.35)",
        btn: "0 1px 2px rgb(0 0 0 / 0.08), 0 2px 8px rgb(0 0 0 / 0.06)",
        "btn-dark": "0 1px 0 rgb(255 255 255 / 0.06) inset, 0 4px 14px rgb(0 0 0 / 0.45)",
        "sfx-glow": "0 0 0 1px rgb(0 138 113 / 0.12), 0 4px 20px rgb(0 138 113 / 0.08)",
        "sfx-glow-dark": "0 0 0 1px rgb(241 238 27 / 0.15), 0 4px 24px rgb(0 138 113 / 0.12)",
      },
      transitionTimingFunction: {
        "sfx-smooth": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "sfx-fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sfx-fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "sfx-scale-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "sfx-fade-up": "sfx-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "sfx-fade-in": "sfx-fade-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "sfx-scale-in": "sfx-scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
