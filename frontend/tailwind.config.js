/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["'DM Sans'",    "sans-serif"],
        display: ["'Bricolage Grotesque'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        // Refined amber accent (unslop direction: night-shift world, alerts & payouts)
        accent: {
          400: "#f0b84a",
          500: "#e8a030",
          600: "#c47d14",
        },
        // Alias brand to accent for backward compatibility during step-by-step unslopping
        brand: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#f0b84a",
          500: "#e8a030",
          600: "#c47d14",
          700: "#b45309",
        },
        // Ink ramp for surfaces (slate-tinted neutral, night shift)
        ink: {
          950: "#07080d", // deepest shell / nav
          900: "#0b0d14", // page background
          800: "#11141c", // card surface
          700: "#1a1e28", // raised surface / input
          600: "#252a38", // subtle border / hairline
          500: "#374052", // muted border
          400: "#6b7487", // muted text / icons
          300: "#a3a9b8", // secondary text
          100: "#eaedf5", // primary text
        },
        dark: {
          900: "#0b0d14", // aligned to ink-900
          800: "#11141c", // aligned to ink-800
          700: "#1a1e28", // aligned to ink-700
          600: "#252a38", // aligned to ink-600
          500: "#374052",
          400: "#6b7487",
        },
        positive: "#4cc38a",
        negative: "#e5484d",
      },
      animation: {
        "fade-up": "fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-in": "fadeIn 0.25s ease forwards",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
