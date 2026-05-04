/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', "serif"],
        body: ['"DM Sans"', "sans-serif"],
      },
      colors: {
        orchid: {
          50: "#fdf4ff",
          100: "#f9e8ff",
          200: "#f3d0fe",
          300: "#e9a8fc",
          400: "#da72f8",
          500: "#c946ef",
          600: "#ae27d3",
          700: "#921daf",
          800: "#791b8f",
          900: "#641b74",
        },
        forest: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        leaf: {
          dark: "#0a1f0e",
          mid: "#0f2d14",
          light: "#163a1b",
        },
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "bar-grow": {
          "0%": { width: "0%" },
          "100%": { width: "var(--bar-width)" },
        },
        spin2: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease forwards",
        "fade-in": "fade-in 0.5s ease forwards",
        shimmer: "shimmer 2.5s linear infinite",
        pulse2: "pulse2 1.5s ease-in-out infinite",
        "bar-grow": "bar-grow 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards",
        spin2: "spin2 1s linear infinite",
      },
    },
  },
  plugins: [],
};
