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
      },
    },
  },
  plugins: [],
};
