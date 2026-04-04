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
        brand: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6", // Violet
          600: "#7c3aed",
          700: "#6d28d9",
        },
        dark: {
          900: "#09090b", // Nextjs/Stripe pitch black
          800: "#18181b", // Deep zinc
          700: "#27272a", // Zinc 800
          600: "#3f3f46", // Border color
          500: "#52525b",
          400: "#71717a",
        },
      },
      animation: {
        "fade-up":    "fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-in":    "fadeIn 0.5s ease forwards",
        "pulse-slow": "pulse 2.5s ease-in-out infinite",
        "slide-in":   "slideIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: 0, transform: "translateY(24px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideIn: {
          "0%":   { opacity: 0, transform: "translateX(-12px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
}
