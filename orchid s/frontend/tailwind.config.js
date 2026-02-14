/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#fdf4ff", // very light pink/purple for bg
        paper: "#ffffff",
        primary: "#d946ef", // fuchsia-500
        secondary: "#a855f7", // purple-500
        accent: "#ec4899", // pink-500
        dark: "#1e293b", // slate-800 for text
        subtle: "#64748b", // slate-500 for secondary text
        border: "#f0abfc", // fuchsia-300 for borders
      },
      boxShadow: {
        glow: "0 10px 40px -10px rgba(217, 70, 239, 0.3)", // pink glow
        soft: "0 4px 20px -2px rgba(217, 70, 239, 0.1)",
      },
    },
  },
  plugins: [],
};
