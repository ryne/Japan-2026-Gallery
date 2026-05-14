/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        obsidian: {
          950: "#050507",
          900: "#0a0a0f",
          800: "#111118",
          700: "#1a1a24",
          600: "#242430",
        },
        gold: {
          400: "#d4a853",
          300: "#e8c87a",
          200: "#f0d89a",
        },
        slate: {
          muted: "#8b8b9e",
        },
      },
      transitionTimingFunction: {
        "expo-out": "cubic-bezier(0.19, 1, 0.22, 1)",
        "expo-in": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards",
        "slide-up": "slide-up 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards",
      },
    },
  },
  plugins: [],
};
